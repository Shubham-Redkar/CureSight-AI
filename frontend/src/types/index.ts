export interface Patient {
  id: number;
  patientCode: string;
  name: string;
  age: number | null;
  createdAt?: string;
  updatedAt?: string;
  
  // UI-calculated fields
  woundsCount?: number;
  latestAssessmentDate?: string;
  overallHealingStatus?: 'Improving' | 'Stable' | 'Requires Attention' | 'Unassessed' | 'Unavailable';
}

export interface Wound {
  id: number;
  patientId: number;
  location: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  
  // UI-calculated fields
  status?: 'Improving' | 'Stable' | 'Requires Attention' | 'Unavailable';
}

export interface Measurement {
  areaCm2: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  granulationTissuePct: number | null;
  sloughTissuePct: number | null;
  escharTissuePct: number | null;
}

export interface Assessment {
  id: number;
  woundId: number;
  assessmentDate: string;
  imageKey?: string | null;
  annotatedImageKey?: string | null;
  measurements?: any;
  woundDetected?: boolean | null;
  notes?: string | null;
  status: string;
  createdAt?: string;
  
  // UI fields mapping for legacy support in components
  imageUrl?: string;
  analyzedImageUrl?: string;
  error?: string;
  
  aiResult?: {
    detectionConfidence: number | null;
    measurements: Measurement;
    tissueAnalysis: string; // Textual description
    healingStatus: 'Improving' | 'Stable' | 'Requires Attention' | 'Unavailable' | 'Insufficient historical data';
  };

  verifiedResult?: {
    verifiedDate: string;
    measurements: Measurement;
    healingStatus: 'Improving' | 'Stable' | 'Requires Attention' | 'Unavailable';
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
