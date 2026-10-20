import { getAreaRaw, calculateAreaChangePct } from './progressUtils';
import { describe, it, expect } from 'vitest';
import type { Assessment } from '../types';

describe('Progress Utils', () => {
  describe('calculateAreaChangePct', () => {
    it('calculates positive percentage change (area increases)', () => {
      expect(calculateAreaChangePct(10, 15)).toBe(50.0);
    });

    it('calculates negative percentage change (area decreases)', () => {
      expect(calculateAreaChangePct(10, 5)).toBe(-50.0);
    });

    it('returns 0 for no change', () => {
      expect(calculateAreaChangePct(10, 10)).toBe(0.0);
    });

    it('returns null if baseline is zero to prevent division by zero', () => {
      expect(calculateAreaChangePct(0, 5)).toBeNull();
    });

    it('returns null if any area is missing', () => {
      expect(calculateAreaChangePct(null, 5)).toBeNull();
      expect(calculateAreaChangePct(10, null)).toBeNull();
      expect(calculateAreaChangePct(null, null)).toBeNull();
    });

    it('returns null if baseline is negative', () => {
      expect(calculateAreaChangePct(-5, 5)).toBeNull();
    });
  });

  describe('getAreaRaw', () => {
    it('returns null for empty assessment', () => {
      expect(getAreaRaw(undefined)).toBeNull();
    });

    it('returns aiResult area when not verified', () => {
      const mockAss = {
        status: 'COMPLETED',
        aiResult: { measurements: { areaCm2: 12.5 } }
      } as Assessment;
      expect(getAreaRaw(mockAss)).toBe(12.5);
    });

    it('returns verifiedResult area when verified with measurement override', () => {
      const mockAss = {
        status: 'VERIFIED',
        verified: true,
        aiResult: { measurements: { areaCm2: 12.5 } },
        verifiedResult: { measurements: { areaCm2: 10.0 } }
      } as Assessment;
      expect(getAreaRaw(mockAss)).toBe(10.0);
    });

    it('falls back to aiResult area when verified without measurement override', () => {
      const mockAss = {
        status: 'VERIFIED',
        verified: true,
        aiResult: { measurements: { areaCm2: 12.5 } },
        verifiedResult: { notes: 'Confirmed wound by clinician' }
      } as unknown as Assessment;
      expect(getAreaRaw(mockAss)).toBe(12.5);
    });

    it('returns null when verified override sets woundDetected to false', () => {
      const mockAss = {
        status: 'VERIFIED',
        verified: true,
        aiResult: { measurements: { areaCm2: 12.5 } },
        verifiedResult: { woundDetected: false, notes: 'Artifact only, no wound' }
      } as unknown as Assessment;
      expect(getAreaRaw(mockAss)).toBeNull();
    });

    it('returns null if calibration/area is missing', () => {
      const mockAss = {
        status: 'COMPLETED',
        aiResult: { measurements: {} }
      } as Assessment;
      expect(getAreaRaw(mockAss)).toBeNull();
    });

    it('returns null when calibration is unverified demo fallback', () => {
      const demoAss = {
        status: 'COMPLETED',
        aiResult: {
          measurements: { areaCm2: 8.5 },
          calibration: { source: 'demo', detected: false, pixels_per_cm: 25.0 }
        }
      } as unknown as Assessment;
      expect(getAreaRaw(demoAss)).toBeNull();
    });

    it('returns null when physical_measurement_available is false', () => {
      const uncalibratedAss = {
        status: 'COMPLETED',
        aiResult: {
          measurements: { areaCm2: 8.5 },
          physical_measurement_available: false
        }
      } as unknown as Assessment;
      expect(getAreaRaw(uncalibratedAss)).toBeNull();
    });

    it('returns area when calibration is verified automatic marker', () => {
      const verifiedCalAss = {
        status: 'COMPLETED',
        aiResult: {
          measurements: { areaCm2: 6.2 },
          calibration: { source: 'automatic', detected: true, confidence: 0.95, pixels_per_cm: 32.0 }
        }
      } as unknown as Assessment;
      expect(getAreaRaw(verifiedCalAss)).toBe(6.2);
    });

    it('allows clinician override even if AI calibration was demo fallback', () => {
      const overrideAss = {
        status: 'VERIFIED',
        verified: true,
        aiResult: {
          measurements: { areaCm2: 8.5 },
          calibration: { source: 'demo', detected: false }
        },
        verifiedResult: {
          measurements: { areaCm2: 7.0 },
          notes: 'Clinician measured with ruler'
        }
      } as unknown as Assessment;
      expect(getAreaRaw(overrideAss)).toBe(7.0);
    });

    it('prevents longitudinal percentage change calculation when one visit has unverified demo calibration', () => {
      const baselineVerified = {
        status: 'COMPLETED',
        aiResult: {
          measurements: { areaCm2: 10.0 },
          calibration: { source: 'automatic', detected: true, confidence: 0.9 }
        }
      } as unknown as Assessment;

      const followUpDemo = {
        status: 'COMPLETED',
        aiResult: {
          measurements: { areaCm2: 5.0 },
          calibration: { source: 'demo', detected: false }
        }
      } as unknown as Assessment;

      const baselineArea = getAreaRaw(baselineVerified);
      const followUpArea = getAreaRaw(followUpDemo);

      expect(baselineArea).toBe(10.0);
      expect(followUpArea).toBeNull();
      expect(calculateAreaChangePct(baselineArea, followUpArea)).toBeNull();
    });

    it('returns area when calibration is verified clinician manual calibration', () => {
      const manualVerifiedAss = {
        status: 'COMPLETED',
        aiResult: {
          measurements: { areaCm2: 4.8 },
          calibration: { source: 'manual', detected: false, verified: true, pixels_per_cm: 28.5 }
        }
      } as unknown as Assessment;
      expect(getAreaRaw(manualVerifiedAss)).toBe(4.8);
    });

    it('calculates longitudinal percentage change between verified automatic and verified manual assessments', () => {
      const baselineAuto = {
        status: 'COMPLETED',
        aiResult: {
          measurements: { areaCm2: 8.0 },
          calibration: { source: 'automatic', detected: true, confidence: 0.95, pixels_per_cm: 30.0 }
        }
      } as unknown as Assessment;

      const followUpManual = {
        status: 'COMPLETED',
        aiResult: {
          measurements: { areaCm2: 6.0 },
          calibration: { source: 'manual', detected: false, verified: true, pixels_per_cm: 28.0 }
        }
      } as unknown as Assessment;

      const baselineArea = getAreaRaw(baselineAuto);
      const followUpArea = getAreaRaw(followUpManual);

      expect(baselineArea).toBe(8.0);
      expect(followUpArea).toBe(6.0);
      // ((6.0 - 8.0) / 8.0) * 100 = -25.0%
      expect(calculateAreaChangePct(baselineArea, followUpArea)).toBe(-25.0);
    });

    it('prevents longitudinal percentage change calculation when manual calibration is unverified', () => {
      const baselineAuto = {
        status: 'COMPLETED',
        aiResult: {
          measurements: { areaCm2: 10.0 },
          calibration: { source: 'automatic', detected: true, confidence: 0.9 }
        }
      } as unknown as Assessment;

      const followUpUnverified = {
        status: 'COMPLETED',
        aiResult: {
          measurements: { areaCm2: 5.0 },
          calibration: { source: 'manual', detected: false, verified: false }
        }
      } as unknown as Assessment;

      const baselineArea = getAreaRaw(baselineAuto);
      const followUpArea = getAreaRaw(followUpUnverified);

      expect(baselineArea).toBe(10.0);
      expect(followUpArea).toBeNull();
      expect(calculateAreaChangePct(baselineArea, followUpArea)).toBeNull();
    });
  });
});
