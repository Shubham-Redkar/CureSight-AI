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
  });
});
