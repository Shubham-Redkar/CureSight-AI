import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch, buildImageUrl } from '../utils/api';
import type { Patient, Wound, Assessment } from '../types';

interface WoundContextType {
  patients: Patient[];
  wounds: Wound[];
  assessments: Assessment[];
  settings: {
    clinicName: string;
    practitionerRole: string;
    enableNotifications: boolean;
    securityMfa: boolean;
    autoAnalyze: boolean;
  };
  isLoading: boolean;
  error: string | null;
  loadPatients: () => Promise<void>;
  addPatient: (patient: { name: string; age?: number | null; patientCode?: string }) => Promise<Patient>;
  loadWounds: (patientId: number | string) => Promise<void>;
  addWound: (wound: Omit<Wound, 'id' | 'createdAt' | 'updatedAt' | 'status'> | { patientId: number; location?: string; description?: string }) => Promise<Wound>;
  loadAssessments: (woundId?: number | string, patientId?: number | string) => Promise<void>;
  runAnalysis: (
    target: number | string | { woundId?: number | string; patientId?: number | string; location?: string },
    imageBlob: Blob,
    pixelsPerCm?: number
  ) => Promise<Assessment>;
  verifyAssessment: (
    assessmentId: number | string,
    verifiedResult: NonNullable<Assessment['verifiedResult']>
  ) => void;
  calibrateAssessment: (
    assessmentId: number | string,
    payload: {
      point1?: [number, number] | { x: number; y: number };
      point2?: [number, number] | { x: number; y: number };
      reference_distance_cm?: number;
      pixels_per_cm?: number;
      notes?: string;
    }
  ) => Promise<any>;
  updateSettings: (newSettings: Partial<WoundContextType['settings']>) => void;
  clearError: () => void;
}

const WoundContext = createContext<WoundContextType | undefined>(undefined);

export const WoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [wounds, setWounds] = useState<Wound[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [settings, setSettings] = useState({
    clinicName: 'Clinical Wound Center',
    practitionerRole: 'Wound Care Specialist',
    enableNotifications: true,
    securityMfa: false,
    autoAnalyze: true,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load Initial Patients
  const loadPatients = async () => {
    try {
      setIsLoading(true);
      setError(null);
      let res;
      try {
        res = await apiFetch(`/api/patients`);
      } catch (err) {
        throw new Error("Unable to connect to the backend server. Please make sure the server is running.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Failed to load patients");
      if (data.status === 'ok') {
        setPatients(data.patients);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load patients from the database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const addPatient = async (patientData: { name: string; age?: number | null; patientCode?: string }) => {
    let res;
    try {
      res = await apiFetch(`/api/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patientData)
      });
    } catch (err) {
      throw new Error("Unable to connect to the backend server. Please make sure the server is running.");
    }
    
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to create patient");
    }
    const newPatient = data.patient;
    setPatients([newPatient, ...patients]);
    return newPatient;
  };

  const loadWounds = async (patientId: number | string) => {
    const patient = patients.find(p => p.id === Number(patientId));
    if (!patient) return;
    try {
      let res;
      try {
        res = await apiFetch(`/api/wounds?patientId=${patient.id}`);
      } catch (err) {
        throw new Error("Unable to connect to the backend server. Please make sure the server is running.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Failed to fetch wounds");
      if (data.status === 'ok') {
        setWounds(prev => {
          const others = prev.filter(w => w.patientId !== Number(patientId));
          return [...data.wounds, ...others];
        });
      }
    } catch (err: any) {
      console.error(err.message || err);
    }
  };

  const addWound = async (woundData: Omit<Wound, 'id' | 'createdAt' | 'updatedAt' | 'status'> | { patientId: number; location?: string; description?: string }): Promise<Wound> => {
    const patient = patients.find(p => p.id === woundData.patientId);
    if (!patient) throw new Error("Patient not found");

    let res;
    try {
      res = await apiFetch(`/api/wounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          location: woundData.location || "General Wound Site",
          description: woundData.description
        })
      });
    } catch (err) {
      throw new Error("Unable to connect to the backend server. Please make sure the server is running.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || data.error || "Failed to create wound");
    const newWound = data.wound;
    setWounds([newWound, ...wounds]);
    return newWound;
  };

  const loadAssessments = async (woundId?: number | string, patientId?: number | string) => {
    try {
      let queryParam = '';
      if (woundId) queryParam = `woundId=${woundId}`;
      else if (patientId) queryParam = `patientId=${patientId}`;
      else return;

      let res;
      try {
        res = await apiFetch(`/api/assessments?${queryParam}`);
      } catch (err) {
        throw new Error("Unable to connect to the backend server. Please make sure the server is running.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Failed to load assessments");
      if (data.status === 'ok') {
        const mappedAssessments = data.assessments.map((assessment: any) => {
          let aiResult = undefined;
          if (assessment.status === 'COMPLETED' || assessment.status === 'VERIFIED') {
             aiResult = {
                 detectionConfidence: assessment.measurements?.wounds?.[0]?.detection_confidence ?? null,
                 measurements: {
                     woundCount: assessment.measurements?.wound_count ?? 0,
                     areaCm2: assessment.measurements?.total_area_cm2 ?? null,
                     lengthCm: assessment.measurements?.wounds?.[0]?.length_cm ?? null,
                     widthCm: assessment.measurements?.wounds?.[0]?.width_cm ?? null,
                     woundsList: assessment.measurements?.wounds ?? [],
                 },
                 tissueAnalysis: assessment.notes || 'Analysis complete',
                 tissueComposition: assessment.measurements?.tissue_composition || null,
                 tissueAnnotatedUrl: buildImageUrl(assessment.measurements?.tissue_annotated_image_url) || null,
                 calibration: assessment.measurements?.calibration || null
             };
          }

          return {
             ...assessment,
             status: assessment.status === 'COMPLETED' ? 'Analysis Completed' : (assessment.status === 'FAILED' ? 'Analysis Failed' : (assessment.status === 'VERIFIED' ? 'Verified' : 'Pending Analysis')),
             aiResult,
             analyzedImageUrl: buildImageUrl(assessment.annotatedImageKey),
             imageUrl: buildImageUrl(assessment.imageKey),
             error: assessment.status === 'FAILED' ? assessment.notes : undefined
          };
        });

        setAssessments(prev => {
          const newIds = new Set(mappedAssessments.map((a: any) => a.id));
          const others = prev.filter(a => !newIds.has(a.id));
          return [...mappedAssessments, ...others];
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const runAnalysis = async (
    target: number | string | { woundId?: number | string; patientId?: number | string; location?: string },
    imageBlob: Blob,
    pixelsPerCm?: number
  ) => {
    try {
      let woundIdToUse: string | null = null;
      let patientIdToUse: string | null = null;
      let locationToUse: string | null = null;

      if (typeof target === 'object' && target !== null) {
        if (target.woundId) woundIdToUse = target.woundId.toString();
        if (target.patientId) patientIdToUse = target.patientId.toString();
        if (target.location) locationToUse = target.location;
      } else if (target) {
        woundIdToUse = target.toString();
      }

      if (!woundIdToUse && !patientIdToUse) {
        throw new Error("Either a wound or patient must be selected for analysis.");
      }

      const formData = new FormData();
      formData.append("image", imageBlob, "upload.jpg");
      if (woundIdToUse) {
        formData.append("woundId", woundIdToUse);
      }
      if (patientIdToUse) {
        formData.append("patientId", patientIdToUse);
      }
      if (locationToUse) {
        formData.append("location", locationToUse);
      }
      
      if (pixelsPerCm && pixelsPerCm > 0) {
        formData.append("pixels_per_cm", pixelsPerCm.toString());
      }
      
      let response;
      try {
        response = await apiFetch(`/api/upload`, {
          method: "POST",
          body: formData,
        });
      } catch (err) {
        throw new Error("Unable to connect to the backend server. Please make sure the server is running.");
      }
      
      const data = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        throw new Error(data.message || data.error || "Upload failed");
      }

      // If backend created/returned a wound, update wounds state
      if (data.wound) {
        setWounds(prev => {
          const exists = prev.some(w => w.id === data.wound.id);
          if (exists) {
            return prev.map(w => w.id === data.wound.id ? data.wound : w);
          }
          return [data.wound, ...prev];
        });
      }

      // Add the created assessment from response (this includes error states if FAILED)
      if (data.assessment) {
        // Hydrate UI mapping fields since the UI reads these
        const ai = data.aiAnalysis || {};
        const newAssessment = {
            ...data.assessment,
            aiResult: data.assessment.status === 'FAILED' ? undefined : {
                detectionConfidence: data.assessment.measurements?.wounds?.[0]?.detection_confidence ?? ai.detection_confidence ?? null,
                measurements: {
                    woundCount: data.assessment.measurements?.wound_count ?? 0,
                    areaCm2: data.assessment.measurements?.total_area_cm2 ?? null,
                    lengthCm: data.assessment.measurements?.wounds?.[0]?.length_cm ?? null,
                    widthCm: data.assessment.measurements?.wounds?.[0]?.width_cm ?? null,
                    woundsList: data.assessment.measurements?.wounds ?? [],
                },
                tissueAnalysis: ai.message || data.assessment.notes || 'Analysis complete',
                calibration: data.assessment.measurements?.calibration || null
            },
            analyzedImageUrl: buildImageUrl(ai.annotated_image_url),
            imageUrl: buildImageUrl(data.objectName),
            error: data.aiError
        };

        if (data.assessment.status === 'COMPLETED') {
            newAssessment.status = 'Analysis Completed';
        } else if (data.assessment.status === 'FAILED') {
            newAssessment.status = 'Analysis Failed';
        }

        setAssessments(prev => [newAssessment, ...prev.filter(a => a.id !== newAssessment.id)]);
        return newAssessment;
      }
      throw new Error("Backend did not return an assessment.");
    } catch (err: any) {
      throw err;
    }
  };

  const verifyAssessment = async (
    assessmentId: number | string,
    verifiedResult: NonNullable<Assessment['verifiedResult']>
  ) => {
    try {
      const res = await apiFetch(`/api/assessments/${assessmentId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifiedResult })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to verify assessment");
      
      setAssessments(prev =>
        prev.map(a => {
          if (a.id === Number(assessmentId)) {
            return {
              ...a,
              status: 'Verified', // Keep frontend display status if needed, or let it match backend
              verifiedResult,
            };
          }
          return a;
        })
      );
    } catch (err: any) {
      setError(err.message || "Failed to verify assessment");
    }
  };

  const calibrateAssessment = async (
    assessmentId: number | string,
    payload: {
      point1?: [number, number] | { x: number; y: number };
      point2?: [number, number] | { x: number; y: number };
      reference_distance_cm?: number;
      pixels_per_cm?: number;
      notes?: string;
    }
  ) => {
    try {
      const res = await apiFetch(`/api/assessments/${assessmentId}/calibrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to calibrate assessment");

      if (data.assessment?.woundId) {
        await loadAssessments(data.assessment.woundId);
      }
      return data.assessment;
    } catch (err: any) {
      setError(err.message || "Failed to calibrate assessment");
      throw err;
    }
  };

  const updateSettings = (newSettings: Partial<WoundContextType['settings']>) => {
    setSettings({ ...settings, ...newSettings });
  };

  const clearError = () => setError(null);

  // Hook to automatically load wounds when a patient is found
  useEffect(() => {
    patients.forEach(p => {
      loadWounds(p.id);
    });
  }, [patients.length]); 

  return (
    <WoundContext.Provider
      value={{
        patients,
        wounds,
        assessments,
        settings,
        isLoading,
        error,
        loadPatients,
        addPatient,
        loadWounds,
        addWound,
        loadAssessments,
        runAnalysis,
        verifyAssessment,
        calibrateAssessment,
        updateSettings,
        clearError,
      }}
    >
      {children}
    </WoundContext.Provider>
  );
};

export const useWounds = () => {
  const context = useContext(WoundContext);
  if (context === undefined) {
    throw new Error('useWounds must be used within a WoundProvider');
  }
  return context;
};
