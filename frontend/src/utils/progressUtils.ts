import type { Assessment } from '../types';

export const isCalibrationVerified = (ass?: Assessment): boolean => {
  if (!ass) return false;
  // Clinician verification with physical measurement override is verified
  if (ass.status === 'VERIFIED' || ass.verified) {
    if (
      ass.verifiedResult?.measurements?.areaCm2 != null ||
      (ass.verifiedResult?.measurements as any)?.total_area_cm2 != null
    ) {
      return true;
    }
  }

  const cal = ass.measurements?.calibration ?? ass.aiResult?.calibration;
  const isPhysicalAvail =
    ass.measurements?.physical_measurement_available ??
    (ass.aiResult as any)?.physical_measurement_available;

  // If physical measurements were marked unavailable, not verified
  if (isPhysicalAvail === false) return false;

  if (cal) {
    // Unverified demo or unverified calibration
    if (cal.source === 'demo' || cal.verified === false) {
      return false;
    }
    if (cal.source === 'automatic' && (cal.detected === true || cal.confidence > 0)) {
      return true;
    }
    if (
      cal.source === 'manual' &&
      cal.verified === true &&
      typeof cal.pixels_per_cm === 'number' &&
      cal.pixels_per_cm > 0
    ) {
      return true;
    }
    if (cal.detected === false) {
      return false;
    }
  }

  // If no calibration object is present (e.g. legacy/mock test object), allow area if not explicitly disabled
  return true;
};

export const getAreaRaw = (ass?: Assessment): number | null => {
  if (!ass) return null;
  let effectiveWoundDetected = ass.woundDetected ?? true;
  if (ass.verified && ass.verifiedResult) {
    if (typeof (ass.verifiedResult as any).woundDetected === 'boolean') {
      effectiveWoundDetected = (ass.verifiedResult as any).woundDetected;
    }
  }
  if (!effectiveWoundDetected) return null;

  // Clinician override has highest precedence
  if (ass.status === 'VERIFIED' || ass.verified) {
    const verifiedArea =
      ass.verifiedResult?.measurements?.areaCm2 ??
      (ass.verifiedResult?.measurements as any)?.total_area_cm2;
    if (verifiedArea != null) {
      return verifiedArea;
    }
  }

  // Safety check: verify calibration before returning physical area
  if (!isCalibrationVerified(ass)) {
    return null;
  }

  return (
    ass.aiResult?.measurements?.areaCm2 ??
    (ass.measurements as any)?.total_area_cm2 ??
    null
  );
};

export const calculateAreaChangePct = (initialAreaRaw: number | null, currentAreaRaw: number | null): number | null => {
  if (initialAreaRaw !== null && currentAreaRaw !== null && initialAreaRaw > 0) {
    return parseFloat((((currentAreaRaw - initialAreaRaw) / initialAreaRaw) * 100).toFixed(1));
  }
  return null;
};
