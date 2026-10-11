import type { Assessment } from '../types';

export const getAreaRaw = (ass?: Assessment): number | null => {
  if (!ass) return null;
  let effectiveWoundDetected = ass.woundDetected ?? true;
  if (ass.verified && ass.verifiedResult) {
    if (typeof (ass.verifiedResult as any).woundDetected === 'boolean') {
      effectiveWoundDetected = (ass.verifiedResult as any).woundDetected;
    }
  }
  if (!effectiveWoundDetected) return null;

  if (ass.status === 'VERIFIED' || ass.verified) {
    return ass.verifiedResult?.measurements?.areaCm2 ?? ass.aiResult?.measurements?.areaCm2 ?? null;
  }
  return ass.aiResult?.measurements?.areaCm2 ?? null;
};

export const calculateAreaChangePct = (initialAreaRaw: number | null, currentAreaRaw: number | null): number | null => {
  if (initialAreaRaw !== null && currentAreaRaw !== null && initialAreaRaw > 0) {
    return parseFloat((((currentAreaRaw - initialAreaRaw) / initialAreaRaw) * 100).toFixed(1));
  }
  return null;
};
