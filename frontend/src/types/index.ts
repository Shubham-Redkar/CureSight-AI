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
}

export interface Wound {
  id: number;
  patientId: number;
  location: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  
  // UI-calculated fields
}

export interface Measurement {
  woundCount: number;
  areaCm2: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  woundsList?: any[];
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
  verified?: boolean;
  
  // UI fields mapping for legacy support in components
  imageUrl?: string;
  analyzedImageUrl?: string;
  error?: string;
  
  aiResult?: {
    detectionConfidence: number | null;
    measurements: Measurement;
    tissueAnalysis: string; // Textual description
    calibration?: any;
  };

  verifiedResult?: {
    verifiedDate: string;
    measurements: Measurement;
    clinicalNotes: string;
  };
}

export interface ClinicalReport {
  id: string;
  patientId: string;
  woundId: string;
  generatedDate: string;
  assessmentPeriodStart: string;
  assessmentPeriodEnd: string;
  status: 'Draft' | 'Final';
}
