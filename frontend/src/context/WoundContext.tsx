import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
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
  addPatient: (patient: Omit<Patient, 'id' | 'woundsCount' | 'overallHealingStatus'>) => Promise<Patient>;
  loadWounds: (patientId: number | string) => Promise<void>;
  addWound: (wound: Omit<Wound, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<Wound>;
  loadAssessments: (woundId: number | string) => Promise<void>;
  runAnalysis: (woundId: number | string, imageBlob: Blob, pixelsPerCm?: number) => Promise<Assessment>;
  verifyAssessment: (
    assessmentId: number | string,
    verifiedResult: NonNullable<Assessment['verifiedResult']>
  ) => void;
  updateSettings: (newSettings: Partial<WoundContextType['settings']>) => void;
  clearError: () => void;
}

const WoundContext = createContext<WoundContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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

  const addPatient = async (patientData: Omit<Patient, 'id' | 'woundsCount' | 'overallHealingStatus'>) => {
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

  const addWound = async (woundData: Omit<Wound, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const patient = patients.find(p => p.id === woundData.patientId);
    if (!patient) throw new Error("Patient not found");

    let res;
    try {
      res = await apiFetch(`/api/wounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          location: woundData.location,
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

  const loadAssessments = async (woundId: number | string) => {
    try {
      let res;
      try {
        res = await apiFetch(`/api/assessments?woundId=${woundId}`);
      } catch (err) {
        throw new Error("Unable to connect to the backend server. Please make sure the server is running.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "Failed to load assessments");
      if (data.status === 'ok') {
        const mappedAssessments = data.assessments.map((assessment: any) => {
          let aiResult = undefined;
          if (assessment.status === 'COMPLETED') {
             aiResult = {
                 detectionConfidence: assessment.measurements?.wounds?.[0]?.detection_confidence ?? null,
                 measurements: {
                     woundCount: assessment.measurements?.wound_count ?? 0,
                     areaCm2: assessment.measurements?.total_area_cm2 ?? null,
                     lengthCm: assessment.measurements?.wounds?.[0]?.length_cm ?? null,
                     widthCm: assessment.measurements?.wounds?.[0]?.width_cm ?? null,
                     granulationTissuePct: null,
                     sloughTissuePct: null,
                     escharTissuePct: null,
                     woundsList: assessment.measurements?.wounds ?? [],
                 },
                 tissueAnalysis: assessment.notes || 'Analysis complete',
                 healingStatus: 'Unavailable',
                 calibration: assessment.measurements?.calibration || null
             };
          }

          return {
             ...assessment,
             status: assessment.status === 'COMPLETED' ? 'Analysis Completed' : (assessment.status === 'FAILED' ? 'Analysis Failed' : 'Pending Analysis'),
             aiResult,
             analyzedImageUrl: assessment.annotatedImageKey ? `${API_URL}/api/images/${assessment.annotatedImageKey}` : undefined,
             imageUrl: assessment.imageKey ? `${API_URL}/api/images/${assessment.imageKey}` : undefined,
             error: assessment.status === 'FAILED' ? assessment.notes : undefined
          };
        });

        setAssessments(prev => {
          const others = prev.filter(a => a.woundId !== Number(woundId));
          return [...mappedAssessments, ...others];
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const runAnalysis = async (woundId: number | string, imageBlob: Blob, pixelsPerCm?: number) => {
    try {
      const activeWound = wounds.find(w => w.id === Number(woundId));
      if (!activeWound) {
        throw new Error("The selected wound could not be found.");
      }

      const formData = new FormData();
      formData.append("image", imageBlob, "upload.jpg");
      formData.append("woundId", activeWound.id.toString());
      
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
                    granulationTissuePct: null,
                    sloughTissuePct: null,
                    escharTissuePct: null,
                    woundsList: data.assessment.measurements?.wounds ?? [],
                },
                tissueAnalysis: ai.message || data.assessment.notes || 'Analysis complete',
                healingStatus: 'Unavailable',
                calibration: data.assessment.measurements?.calibration || null
            },
            analyzedImageUrl: ai.annotated_image_url ? `${API_URL}${ai.annotated_image_url}` : undefined,
            imageUrl: data.objectName ? `${API_URL}/api/images/${data.objectName}` : undefined,
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
