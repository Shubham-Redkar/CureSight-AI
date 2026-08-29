import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Patient, Wound, Assessment, MedicalReport } from '../types';

interface WoundContextType {
  patients: Patient[];
  wounds: Wound[];
  assessments: Assessment[];
  reports: MedicalReport[];
  settings: {
    clinicName: string;
    practitionerRole: string;
    enableNotifications: boolean;
    securityMfa: boolean;
    autoAnalyze: boolean;
  };
  isLoading: boolean;
  error: string | null;
  addPatient: (patient: Omit<Patient, 'woundsCount' | 'overallHealingStatus'>) => Patient;
  addWound: (wound: Omit<Wound, 'id' | 'createdDate' | 'status'>) => Wound;
  addAssessment: (assessment: Omit<Assessment, 'id' | 'status' | 'date'>) => Assessment;
  runAnalysis: (assessmentId: string) => Promise<void>;
  verifyAssessment: (
    assessmentId: string,
    verifiedResult: NonNullable<Assessment['verifiedResult']>
  ) => void;
  generateReport: (patientId: string, woundId: string, startDate: string, endDate: string) => MedicalReport;
  updateSettings: (newSettings: Partial<WoundContextType['settings']>) => void;
  clearError: () => void;
}

const WoundContext = createContext<WoundContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'clinical_wound_analysis_data';

export const WoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [wounds, setWounds] = useState<Wound[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [settings, setSettings] = useState({
    clinicName: 'Clinical Wound Center',
    practitionerRole: 'Wound Care Specialist',
    enableNotifications: true,
    securityMfa: false,
    autoAnalyze: true,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial empty structure or restored session from localStorage
  useEffect(() => {
    try {
      setIsLoading(true);
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPatients(parsed.patients || []);
        setWounds(parsed.wounds || []);
        setAssessments(parsed.assessments || []);
        setReports(parsed.reports || []);
        if (parsed.settings) setSettings(parsed.settings);
      }
    } catch (err) {
      setError('Failed to load clinical database from storage.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save to localStorage when state changes
  const saveState = (
    nextPatients: Patient[],
    nextWounds: Wound[],
    nextAssessments: Assessment[],
    nextReports: MedicalReport[],
    nextSettings = settings
  ) => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          patients: nextPatients,
          wounds: nextWounds,
          assessments: nextAssessments,
          reports: nextReports,
          settings: nextSettings,
        })
      );
    } catch (err) {
      setError('Database save failed. Storage quota exceeded or blocked.');
    }
  };

  const addPatient = (patientData: Omit<Patient, 'woundsCount' | 'overallHealingStatus'>) => {
    const newPatient: Patient = {
      ...patientData,
      woundsCount: 0,
      overallHealingStatus: 'Unassessed',
    };
    const nextPatients = [newPatient, ...patients];
    setPatients(nextPatients);
    saveState(nextPatients, wounds, assessments, reports);
    return newPatient;
  };

  const addWound = (woundData: Omit<Wound, 'id' | 'createdDate' | 'status'>) => {
    // Generate simple incremental ID
    const count = wounds.filter(w => w.patientId === woundData.patientId).length + 1;
    const newWound: Wound = {
      ...woundData,
      id: `WD-${woundData.patientId.replace('PT-', '')}-${String(count).padStart(2, '0')}`,
      createdDate: new Date().toISOString().split('T')[0],
      status: 'Stable',
    };
    
    const nextWounds = [newWound, ...wounds];
    const nextPatients = patients.map(p => {
      if (p.id === woundData.patientId) {
        return { ...p, woundsCount: p.woundsCount + 1 };
      }
      return p;
    });

    setWounds(nextWounds);
    setPatients(nextPatients);
    saveState(nextPatients, nextWounds, assessments, reports);
    return newWound;
  };

  const addAssessment = (assessmentData: Omit<Assessment, 'id' | 'status' | 'date'>) => {
    const count = assessments.length + 1;
    const newAssessment: Assessment = {
      ...assessmentData,
      id: `AS-${String(count).padStart(4, '0')}`,
      date: new Date().toISOString().split('T')[0],
      status: 'Pending Analysis',
    };

    const nextAssessments = [newAssessment, ...assessments];
    setAssessments(nextAssessments);
    saveState(patients, wounds, nextAssessments, reports);
    return newAssessment;
  };

  const runAnalysis = async (assessmentId: string) => {
    // Set status to pending analysis (UI displays loading states for YOLO -> U-Net -> OpenCV)
    setAssessments(prev =>
      prev.map(a => (a.id === assessmentId ? { ...a, status: 'Pending Analysis' } : a))
    );

    // Simulate clinical backend latency (YOLO bounding boxes, U-Net Segmentation layers, OpenCV calculations)
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Simulated tissue statistics based on image dimensions
    const randomArea = parseFloat((Math.random() * 8 + 2).toFixed(2)); // 2 to 10 cm2
    const randomLength = parseFloat((Math.sqrt(randomArea) * (1 + Math.random() * 0.3)).toFixed(1));
    const randomWidth = parseFloat((randomArea / randomLength).toFixed(1));
    const gran = Math.floor(Math.random() * 40) + 40; // 40-80%
    const slough = Math.floor(Math.random() * (100 - gran - 10)) + 5; // slough
    const eschar = 100 - gran - slough; // remainder

    setAssessments(prev => {
      const nextAssessments = prev.map(a => {
        if (a.id === assessmentId) {
          return {
            ...a,
            status: 'Analysis Completed' as const,
            analyzedImageUrl: a.imageUrl, // We will draw SVG overlays on top of this image in UI
            aiResult: {
              detectionConfidence: parseFloat((0.88 + Math.random() * 0.11).toFixed(2)),
              measurements: {
                areaCm2: randomArea,
                lengthCm: randomLength,
                widthCm: randomWidth,
                granulationTissuePct: gran,
                sloughTissuePct: slough,
                escharTissuePct: eschar,
              },
              tissueAnalysis: `Wound presents with primary red granulation tissue (${gran}%) indicating active healing. Minimal necrotic eschar (${eschar}%) and moderate slough tissue (${slough}%) detected along margins. Edge boundaries are well-defined by U-Net segmenter.`,
              healingStatus: 'Improving' as const,
            },
          };
        }
        return a;
      });

      // Update patient latest date
      const activeAss = nextAssessments.find(a => a.id === assessmentId);
      let nextPatients = patients;
      if (activeAss) {
        nextPatients = patients.map(p => {
          if (p.id === activeAss.patientId) {
            return {
              ...p,
              latestAssessmentDate: activeAss.date,
              overallHealingStatus: 'Stable', // Initially stable until clinician verified or more assessments exist
            };
          }
          return p;
        });
      }

      saveState(nextPatients, wounds, nextAssessments, reports);
      return nextAssessments;
    });
  };

  const verifyAssessment = (
    assessmentId: string,
    verifiedResult: NonNullable<Assessment['verifiedResult']>
  ) => {
    setAssessments(prev => {
      const nextAssessments = prev.map(a => {
        if (a.id === assessmentId) {
          return {
            ...a,
            status: 'Verified' as const,
            verifiedResult,
          };
        }
        return a;
      });

      // Update corresponding wound and patient status
      const updatedAss = nextAssessments.find(a => a.id === assessmentId);
      let nextWounds = wounds;
      let nextPatients = patients;

      if (updatedAss) {
        nextWounds = wounds.map(w => {
          if (w.id === updatedAss.woundId) {
            return { ...w, status: verifiedResult.healingStatus };
          }
          return w;
        });

        // Determine patient overall status from their active wounds
        const patientWounds = nextWounds.filter(w => w.patientId === updatedAss.patientId);
        const overallStatus = patientWounds.some(w => w.status === 'Requires Attention')
          ? ('Requires Attention' as const)
          : patientWounds.every(w => w.status === 'Improving')
          ? ('Improving' as const)
          : ('Stable' as const);

        nextPatients = patients.map(p => {
          if (p.id === updatedAss.patientId) {
            return {
              ...p,
              overallHealingStatus: overallStatus,
            };
          }
          return p;
        });
      }

      saveState(nextPatients, nextWounds, nextAssessments, reports);
      return nextAssessments;
    });
  };

  const generateReport = (
    patientId: string,
    woundId: string,
    startDate: string,
    endDate: string
  ) => {
    const reportCount = reports.length + 1;
    const newReport: MedicalReport = {
      id: `RP-${String(reportCount).padStart(4, '0')}`,
      patientId,
      woundId,
      generatedDate: new Date().toISOString().split('T')[0],
      assessmentPeriodStart: startDate,
      assessmentPeriodEnd: endDate,
      status: 'Final',
    };

    const nextReports = [newReport, ...reports];
    setReports(nextReports);
    saveState(patients, wounds, assessments, nextReports);
    return newReport;
  };

  const updateSettings = (newSettings: Partial<WoundContextType['settings']>) => {
    const nextSettings = { ...settings, ...newSettings };
    setSettings(nextSettings);
    saveState(patients, wounds, assessments, reports, nextSettings);
  };

  const clearError = () => setError(null);

  return (
    <WoundContext.Provider
      value={{
        patients,
        wounds,
        assessments,
        reports,
        settings,
        isLoading,
        error,
        addPatient,
        addWound,
        addAssessment,
        runAnalysis,
        verifyAssessment,
        generateReport,
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
