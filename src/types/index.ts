export interface Patient {
  id: string; // PT-XXXX
  birthDate: string;
  gender: string;
  woundsCount: number;
  latestAssessmentDate?: string;
  overallHealingStatus: 'Improving' | 'Stable' | 'Requires Attention' | 'Unassessed';
}

export interface Wound {
  id: string; // WD-XXX
  patientId: string;
  location: string;
  type: string;
  createdDate: string;
  status: 'Improving' | 'Stable' | 'Requires Attention';
}

export interface Measurement {
  areaCm2: number;
  lengthCm: number;
  widthCm: number;
  granulationTissuePct: number;
  sloughTissuePct: number;
  escharTissuePct: number;
}

export interface Assessment {
  id: string; // AS-XXXX
  woundId: string;
  patientId: string;
  date: string;
  imageUrl: string;
  analyzedImageUrl?: string; // Image with boundary and segmentation mask overlay
  status: 'Pending Analysis' | 'Analysis Completed' | 'Pending Verification' | 'Verified';
  
  aiResult?: {
    detectionConfidence: number;
    measurements: Measurement;
    tissueAnalysis: string; // Textual description
    healingStatus: 'Improving' | 'Stable' | 'Requires Attention';
  };

  verifiedResult?: {
    verifiedDate: string;
    measurements: Measurement;
    healingStatus: 'Improving' | 'Stable' | 'Requires Attention';
    clinicalNotes: string;
  };
}

export interface MedicalReport {
  id: string;
  patientId: string;
  woundId: string;
  generatedDate: string;
  assessmentPeriodStart: string;
  assessmentPeriodEnd: string;
  status: 'Draft' | 'Final';
}
