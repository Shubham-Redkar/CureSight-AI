import React, { useState, useRef, useEffect } from 'react';
import { useWounds } from '../context/WoundContext';
import { Card, Button, Input, Select } from '../components/ui';
import {
  Upload,
  CheckCircle,
  FileCheck,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Info
} from 'lucide-react';
import type { Measurement } from '../types';

interface WoundAssessmentProps {
  selectedPatientId: string | null;
  setSelectedPatientId: (id: string | null) => void;
  selectedWoundId: string | null;
  setSelectedWoundId: (id: string | null) => void;
  selectedAssessmentId: string | null;
  setSelectedAssessmentId: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
}

export const WoundAssessment: React.FC<WoundAssessmentProps> = ({
  selectedPatientId,
  setSelectedPatientId,
  selectedWoundId,
  setSelectedWoundId,
  selectedAssessmentId,
  setSelectedAssessmentId,
  setActiveTab,
}) => {
  const {
    patients,
    wounds,
    assessments,
    addAssessment,
    runAnalysis,
    verifyAssessment,
  } = useWounds();

  // Workflow steps: 'select' | 'upload' | 'analysis'
  const [currentStep, setCurrentStep] = useState<'select' | 'upload' | 'analysis'>('select');

  // Image upload states
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simulation loading states
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [_analysisStep, setAnalysisStep] = useState(0);

  // Active overlays on analyzed image
  const [showYoloBox, setShowYoloBox] = useState(true);
  const [showUnetMask, setShowUnetMask] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);

  // Verification Form states
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [verifiedHealingStatus, setVerifiedHealingStatus] = useState<'Improving' | 'Stable' | 'Requires Attention'>('Stable');
  
  // Track modified measurements manually
  const [verifiedMeasurements, setVerifiedMeasurements] = useState<Measurement>({
    areaCm2: 0,
    lengthCm: 0,
    widthCm: 0,
    granulationTissuePct: 0,
    sloughTissuePct: 0,
    escharTissuePct: 0,
  });

  const activePatient = patients.find(p => p.id === selectedPatientId);
  const patientWounds = wounds.filter(w => w.patientId === selectedPatientId);
  const activeWound = wounds.find(w => w.id === selectedWoundId);
  const activeAssessment = assessments.find(a => a.id === selectedAssessmentId);

  // Synchronize state when selectedAssessmentId changes
  useEffect(() => {
    if (activeAssessment) {
      setCurrentStep('analysis');
      if (activeAssessment.status === 'Verified' && activeAssessment.verifiedResult) {
        setVerifiedMeasurements(activeAssessment.verifiedResult.measurements);
        setVerifiedHealingStatus(activeAssessment.verifiedResult.healingStatus);
        setClinicalNotes(activeAssessment.verifiedResult.clinicalNotes);
      } else if (activeAssessment.aiResult) {
        // Initialize verified form with AI findings
        setVerifiedMeasurements(activeAssessment.aiResult.measurements);
        setVerifiedHealingStatus(activeAssessment.aiResult.healingStatus);
        setClinicalNotes('');
      }
    } else {
      setCurrentStep('select');
      setImageFile(null);
    }
  }, [selectedAssessmentId, activeAssessment]);

  // Workflow step determination on mounting or props change
  useEffect(() => {
    if (!selectedAssessmentId) {
      if (selectedPatientId && selectedWoundId) {
        setCurrentStep('upload');
      } else {
        setCurrentStep('select');
      }
    }
  }, [selectedPatientId, selectedWoundId, selectedAssessmentId]);

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processImageFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setImageFile(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  // Generate a mock clinical image in case user has no image file
  const handleUseMockImage = () => {
    // A clean SVG base64 representing a generic diabetic ulcer or pressure wound structure for visual demo
    const svgMock = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="400" viewBox="0 0 500 400"><rect width="500" height="400" fill="%23f8fafc"/><path d="M150 150 C 180 120, 320 110, 350 160 C 370 200, 330 290, 270 300 C 200 310, 120 280, 130 210 C 135 180, 130 170, 150 150 Z" fill="%23ffd5d5" stroke="%23fda4af" stroke-width="2"/><path d="M180 180 C 200 160, 290 150, 310 190 C 320 220, 290 260, 250 270 C 200 280, 160 250, 170 210 Z" fill="%23f43f5e" fill-opacity="0.75" stroke="%23e11d48" stroke-width="1.5"/><circle cx="210" cy="220" r="15" fill="%23cbd5e1" fill-opacity="0.85"/><circle cx="280" cy="200" r="25" fill="%23fef08a" fill-opacity="0.85"/><text x="20" y="30" font-family="sans-serif" font-size="12" fill="%2364748b">Anatomical Background Skin Model</text></svg>`;
    setImageFile(svgMock);
  };

  const handleCreateAssessment = () => {
    if (selectedPatientId && selectedWoundId && imageFile) {
      const newAss = addAssessment({
        patientId: selectedPatientId,
        woundId: selectedWoundId,
        imageUrl: imageFile,
      });
      setSelectedAssessmentId(newAss.id);
    }
  };

  // Run AI analysis pipeline
  const handleStartAnalysis = async () => {
    if (!selectedAssessmentId) return;

    // Simulate clinical engine logging
    const steps = [
      'Initializing ML Diagnostics Platform...',
      'Step 1/3: Running YOLO v8 Anatomical Boundary Localizer...',
      'Locating wound bounding box on epidermal field...',
      'Step 2/3: Launching U-Net Tissue Segmentation Model...',
      'Segmenting granulation (red), slough (yellow), and eschar (gray) tissue pixels...',
      'Step 3/3: Running OpenCV Feature Calibration...',
      'Fitting contour vectors and converting pixels to square centimeters...',
      'Analysis complete. Generating decision-support diagnostic records.'
    ];

    setAnalysisStep(0);
    setAnalysisProgress(steps[0]);

    const interval = setInterval(() => {
      setAnalysisStep(prev => {
        const next = prev + 1;
        if (next < steps.length) {
          setAnalysisProgress(steps[next]);
          return next;
        } else {
          clearInterval(interval);
          return prev;
        }
      });
    }, 300);

    await runAnalysis(selectedAssessmentId);
    clearInterval(interval);
  };

  // Submit clinician verification
  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAssessmentId) {
      verifyAssessment(selectedAssessmentId, {
        verifiedDate: new Date().toISOString().split('T')[0],
        measurements: verifiedMeasurements,
        healingStatus: verifiedHealingStatus,
        clinicalNotes: clinicalNotes.trim(),
      });
    }
  };

  // Accept AI findings completely
  const handleAcceptAi = () => {
    if (activeAssessment?.aiResult) {
      const ai = activeAssessment.aiResult;
      verifyAssessment(selectedAssessmentId!, {
        verifiedDate: new Date().toISOString().split('T')[0],
        measurements: ai.measurements,
        healingStatus: ai.healingStatus,
        clinicalNotes: 'AI assessment accepted in full after clinical review.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 m-0 tracking-tight">Wound Assessment</h2>
        <p className="text-xs text-slate-500 mt-1">
          Perform clinical photography assessments. Capture or upload wound imagery to trigger YOLO/U-Net boundary calculations.
        </p>
      </div>

      {/* STEP 1: SELECT PATIENT & WOUND */}
      {currentStep === 'select' && (
        <Card title="Patient & Anatomical Site Selection" className="max-w-2xl mx-auto">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Select Patient ID"
                value={selectedPatientId || ''}
                onChange={e => {
                  setSelectedPatientId(e.target.value || null);
                  setSelectedWoundId(null);
                }}
              >
                <option value="">-- Choose Patient ID --</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.id} ({p.gender}, DOB: {p.birthDate})
                  </option>
                ))}
              </Select>

              <Select
                label="Select Wound Site"
                value={selectedWoundId || ''}
                disabled={!selectedPatientId}
                onChange={e => setSelectedWoundId(e.target.value || null)}
              >
                <option value="">-- Choose Anatomical Site --</option>
                {patientWounds.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.location} ({w.type})
                  </option>
                ))}
              </Select>
            </div>

            {selectedPatientId && patientWounds.length === 0 && (
              <div className="bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-250 text-xs flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  No wound sites registered for this patient. Go to the{' '}
                  <button
                    onClick={() => setActiveTab('patients')}
                    className="font-bold underline cursor-pointer"
                  >
                    Patients
                  </button>{' '}
                  tab to link a wound location before starting an assessment.
                </div>
              </div>
            )}

            {!selectedPatientId && (
              <div className="bg-slate-50 text-slate-500 p-3 rounded-md border border-slate-200 text-xs text-center">
                Select a registered clinical ID to load anatomical wound sites.
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                disabled={!selectedPatientId || !selectedWoundId}
                onClick={() => setCurrentStep('upload')}
                className="cursor-pointer"
              >
                Proceed to Upload
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* STEP 2: UPLOAD & REVIEW IMAGE */}
      {currentStep === 'upload' && activePatient && activeWound && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* UPLOAD FORM (2/3 width) */}
          <div className="lg:col-span-2 space-y-4">
            <Card title="Image Upload & Review">
              {!imageFile ? (
                /* DRAG AND DROP ZONE */
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-10 text-center flex flex-col items-center justify-center transition-colors ${
                    dragActive ? 'border-teal-500 bg-teal-50/30' : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                  }`}
                >
                  <Upload className="w-12 h-12 text-slate-400 stroke-1 mb-3" />
                  <h4 className="font-semibold text-slate-800 text-sm">Drag and Drop Wound Photograph</h4>
                  <p className="text-2xs text-slate-450 mt-1 max-w-xs">
                    Supports high-resolution JPG or PNG clinical images.
                  </p>
                  
                  <div className="flex items-center gap-3 mt-4">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer text-xs"
                    >
                      Browse Files
                    </Button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileInput}
                      accept="image/*"
                      className="hidden"
                    />
                    <span className="text-2xs text-slate-400 font-medium">or</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleUseMockImage}
                      className="cursor-pointer text-xs flex items-center gap-1.5 text-teal-850 hover:bg-teal-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Use Practice Sample
                    </Button>
                  </div>
                </div>
              ) : (
                /* IMAGE PREVIEW ZONE */
                <div className="space-y-4">
                  <div className="relative border border-slate-200 rounded-lg overflow-hidden max-h-96 flex items-center justify-center bg-slate-900">
                    <img
                      src={imageFile}
                      alt="Wound Assessment Capture"
                      className="max-h-96 w-auto object-contain"
                    />
                    <button
                      onClick={() => setImageFile(null)}
                      className="absolute top-3 right-3 bg-slate-900/70 hover:bg-slate-900 text-white rounded-md p-1.5 transition-colors shadow-md focus:outline-hidden"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
                    <div>Assessment Date: <strong className="text-slate-800">{new Date().toISOString().split('T')[0]}</strong></div>
                    <div>Anatomical Site: <strong className="text-slate-800">{activeWound.location}</strong></div>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSelectedWoundId(null);
                        setCurrentStep('select');
                      }}
                      className="cursor-pointer"
                    >
                      Back
                    </Button>
                    <Button onClick={handleCreateAssessment} className="cursor-pointer">
                      Create Assessment Entry
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* QUALITY GUIDANCE (1/3 width) */}
          <div className="space-y-4">
            <Card title="Photography Guidance">
              <div className="space-y-3.5 text-xs text-slate-600">
                <div className="flex gap-2.5 items-start">
                  <div className="bg-teal-50 p-1 rounded-full text-teal-700 mt-0.5 shrink-0">
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-slate-800">Lighting & Shadows</h5>
                    <p className="text-[11px] text-slate-550 mt-0.5">Ensure even, diffused clinical room illumination. Avoid direct camera flash to reduce reflection highlights on tissue.</p>
                  </div>
                </div>

                <div className="flex gap-2.5 items-start">
                  <div className="bg-teal-50 p-1 rounded-full text-teal-700 mt-0.5 shrink-0">
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-slate-800">Angle & Orientation</h5>
                    <p className="text-[11px] text-slate-550 mt-0.5">Hold the lens completely parallel (90 degrees) to the wound plane. Skewed angles skew calibration metrics.</p>
                  </div>
                </div>

                <div className="flex gap-2.5 items-start">
                  <div className="bg-teal-50 p-1 rounded-full text-teal-700 mt-0.5 shrink-0">
                    <Info className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-slate-800">Focus & Resolution</h5>
                    <p className="text-[11px] text-slate-550 mt-0.5">Focus explicitly on the wound bed margin. Blurry pixels degrade U-Net boundary accuracy.</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* STEP 3: PIPELINE EXECUTION & VERIFICATION */}
      {currentStep === 'analysis' && activePatient && activeWound && activeAssessment && (
        <div className="space-y-6">
          {/* BACK TO SELECTION BUTTON */}
          <div className="flex justify-between items-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedAssessmentId(null);
                setCurrentStep('select');
              }}
              className="cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              New Assessment
            </Button>
            <div className="flex gap-2 text-xs">
              <span className="font-mono text-slate-500">Record: {activeAssessment.id}</span>
              <span className="text-slate-400">|</span>
              <span className="font-mono text-slate-500">Patient: {activePatient.id}</span>
              <span className="text-slate-400">|</span>
              <span className="font-mono text-slate-500">Location: {activeWound.location}</span>
            </div>
          </div>

          {/* AI RUNNING LOADER */}
          {activeAssessment.status === 'Pending Analysis' && (
            <Card className="max-w-xl mx-auto py-12 text-center">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="w-14 h-14 border-4 border-slate-200 border-t-teal-700 rounded-full animate-spin"></div>
                  <Sparkles className="w-6 h-6 text-teal-700 absolute inset-0 m-auto animate-pulse" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Processing Wound Architecture</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                    YOLO detecting boundaries, U-Net segmenting tissue matrices, and OpenCV calculating area.
                  </p>
                </div>
                {analysisProgress && (
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3 max-w-md w-full font-mono text-[10px] text-slate-655 text-left space-y-1">
                    <div className="text-[10px] font-bold text-teal-800">PIPELINE MONITOR LOG:</div>
                    <div>{analysisProgress}</div>
                  </div>
                )}
                <Button
                  onClick={handleStartAnalysis}
                  className="mt-2 bg-teal-700 text-white cursor-pointer"
                >
                  Start Diagnostic Analysis
                </Button>
              </div>
            </Card>
          )}

          {/* ANALYSIS COMPLETED / VERIFIED DISPLAY */}
          {(activeAssessment.status === 'Analysis Completed' || activeAssessment.status === 'Verified') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* IMAGE DISPLAY PANEL (7/12 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <Card
                  title="Wound Inspection Viewer"
                  headerAction={
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={showYoloBox ? 'primary' : 'secondary'}
                        onClick={() => setShowYoloBox(!showYoloBox)}
                        className="text-[10px] py-1 px-2 cursor-pointer"
                      >
                        YOLO BBox
                      </Button>
                      <Button
                        size="sm"
                        variant={showUnetMask ? 'primary' : 'secondary'}
                        onClick={() => setShowUnetMask(!showUnetMask)}
                        className="text-[10px] py-1 px-2 cursor-pointer"
                      >
                        U-Net Mask
                      </Button>
                      <Button
                        size="sm"
                        variant={showMeasurements ? 'primary' : 'secondary'}
                        onClick={() => setShowMeasurements(!showMeasurements)}
                        className="text-[10px] py-1 px-2 cursor-pointer"
                      >
                        Ruler
                      </Button>
                    </div>
                  }
                >
                  <div className="relative border border-slate-250 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: '380px' }}>
                    <img
                      src={activeAssessment.imageUrl}
                      alt="Clinical Assessment"
                      className="max-w-full h-auto max-h-[450px] object-contain"
                    />

                    {/* DYNAMIC SVG OVERLAY (Simulating ML Bounding Box and Segments) */}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 500 400"
                      preserveAspectRatio="none"
                    >
                      {/* YOLO bounding box overlay */}
                      {showYoloBox && (
                        <>
                          <rect
                            x="110"
                            y="100"
                            width="280"
                            height="230"
                            fill="none"
                            stroke="#0284c7"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                          />
                          <rect
                            x="110"
                            y="78"
                            width="110"
                            height="22"
                            fill="#0284c7"
                          />
                          <text x="115" y="93" fill="white" fontSize="10" fontFamily="monospace" fontWeight="bold">
                            YOLO: Wound ({Math.round((activeAssessment.aiResult?.detectionConfidence || 0.94) * 100)}%)
                          </text>
                        </>
                      )}

                      {/* U-Net segmentation mask overlay */}
                      {showUnetMask && (
                        <>
                          {/* Granulation Tissue: Red */}
                          <path
                            d="M 180 180 C 200 160, 290 150, 310 190 C 320 220, 290 260, 250 270 C 200 280, 160 250, 170 210 Z"
                            fill="rgba(239, 68, 68, 0.4)"
                            stroke="rgba(239, 68, 68, 0.8)"
                            strokeWidth="1.5"
                          />
                          {/* Slough Tissue: Yellow */}
                          <circle cx="280" cy="200" r="22" fill="rgba(234, 179, 8, 0.45)" stroke="rgba(234, 179, 8, 0.8)" strokeWidth="1" />
                          {/* Eschar Tissue: Gray/Black */}
                          <circle cx="210" cy="220" r="14" fill="rgba(100, 116, 139, 0.55)" stroke="rgba(100, 116, 139, 0.8)" strokeWidth="1" />
                        </>
                      )}

                      {/* Measurements crosshair/ruler */}
                      {showMeasurements && activeAssessment.aiResult && (
                        <>
                          {/* Width Ruler line */}
                          <line x1="165" y1="210" x2="315" y2="210" stroke="#14b8a6" strokeWidth="1.5" />
                          <circle cx="165" cy="210" r="3" fill="#14b8a6" />
                          <circle cx="315" cy="210" r="3" fill="#14b8a6" />
                          <text x="210" y="202" fill="#14b8a6" fontSize="10" fontFamily="sans-serif" fontWeight="bold" className="bg-slate-900">
                            W: {activeAssessment.aiResult.measurements.widthCm}cm
                          </text>

                          {/* Length Ruler line */}
                          <line x1="240" y1="150" x2="240" y2="270" stroke="#06b6d4" strokeWidth="1.5" />
                          <circle cx="240" cy="150" r="3" fill="#06b6d4" />
                          <circle cx="240" cy="270" r="3" fill="#06b6d4" />
                          <text x="245" y="215" fill="#06b6d4" fontSize="10" fontFamily="sans-serif" fontWeight="bold">
                            L: {activeAssessment.aiResult.measurements.lengthCm}cm
                          </text>
                        </>
                      )}
                    </svg>
                  </div>
                  
                  {/* TISSUE MAP LEGEND */}
                  <div className="flex gap-4 mt-3 bg-slate-50 p-2.5 rounded-md border border-slate-200 text-2xs justify-center font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-red-500/40 border border-red-500"></span>
                      Granulation ({activeAssessment.aiResult?.measurements.granulationTissuePct}%)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-yellow-500/40 border border-yellow-500"></span>
                      Slough ({activeAssessment.aiResult?.measurements.sloughTissuePct}%)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-slate-500/40 border border-slate-500"></span>
                      Eschar/Necrotic ({activeAssessment.aiResult?.measurements.escharTissuePct}%)
                    </span>
                  </div>
                </Card>
              </div>

              {/* ACTION / INFORMATION PANEL (5/12 cols) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* AI FINDINGS PANEL */}
                <Card title="AI Diagnostics Panel (YOLO/U-Net)">
                  {activeAssessment.aiResult ? (
                    <div className="space-y-4">
                      {/* STATS PANEL */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="bg-slate-50 border border-slate-100 rounded-md p-2.5 text-center">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Wound Area</div>
                          <div className="text-base font-bold text-slate-900 mt-0.5">
                            {activeAssessment.aiResult.measurements.areaCm2} <span className="text-2xs font-normal">cm²</span>
                          </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-md p-2.5 text-center">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Dimensions</div>
                          <div className="text-xs font-bold text-slate-900 mt-1">
                            {activeAssessment.aiResult.measurements.lengthCm} × {activeAssessment.aiResult.measurements.widthCm} <span className="text-[9px] font-normal">cm</span>
                          </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-md p-2.5 text-center">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Confidence</div>
                          <div className="text-base font-bold text-teal-700 mt-0.5">
                            {Math.round(activeAssessment.aiResult.detectionConfidence * 100)}%
                          </div>
                        </div>
                      </div>

                      {/* TEXT ANALYSIS */}
                      <div className="text-xs text-slate-655 bg-slate-50/50 border border-slate-200 rounded-md p-3 space-y-2">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                          Automated Segmentation Report:
                        </div>
                        <p className="leading-relaxed">{activeAssessment.aiResult.tissueAnalysis}</p>
                      </div>

                      <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                        <span className="text-slate-500">Healing Status Assessment:</span>
                        <span className="font-semibold">{activeAssessment.aiResult.healingStatus}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 text-xs">AI pipeline analysis is pending.</div>
                  )}
                </Card>

                {/* CLINICIAN VERIFICATION & ADJUDICATION */}
                <Card
                  title={
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-teal-700" />
                      <span>Clinician Adjudication & Notes</span>
                    </div>
                  }
                >
                  {activeAssessment.status === 'Verified' ? (
                    <div className="space-y-4 text-xs">
                      <div className="bg-indigo-50 border border-indigo-100 rounded-md p-3 flex gap-2">
                        <CheckCircle className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-indigo-900 block text-xs">Assessed Record Finalized</strong>
                          <span className="text-[11px] text-indigo-755 mt-0.5 block">
                            Verified on {activeAssessment.verifiedResult?.verifiedDate}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Verified Healing Trend:</span>
                          <span className="font-semibold text-slate-800">
                            {activeAssessment.verifiedResult?.healingStatus}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Verified Wound Area:</span>
                          <span className="font-semibold text-slate-800">
                            {activeAssessment.verifiedResult?.measurements.areaCm2} cm²
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Verified Dimensions:</span>
                          <span className="font-semibold text-slate-800">
                            {activeAssessment.verifiedResult?.measurements.lengthCm} × {activeAssessment.verifiedResult?.measurements.widthCm} cm
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-md p-3 border border-slate-200">
                        <div className="font-semibold text-slate-600 uppercase text-[9px] tracking-wider mb-1">Clinical Notes</div>
                        <p className="text-slate-800 italic leading-relaxed">
                          "{activeAssessment.verifiedResult?.clinicalNotes || 'No notes added.'}"
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* EDIT VERIFICATION FORM */
                    <form onSubmit={handleVerifySubmit} className="space-y-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-2xs text-slate-500">
                        Review YOLO margins and U-Net segmentations. Adjust measurements below if clinical caliper metrics differ, then submit.
                      </div>

                      {/* STATS COMPARISON */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <Input
                            label="Verified Area (cm²)"
                            type="number"
                            step="0.01"
                            value={verifiedMeasurements.areaCm2}
                            onChange={e => setVerifiedMeasurements({
                              ...verifiedMeasurements,
                              areaCm2: parseFloat(e.target.value) || 0
                            })}
                            required
                          />
                          <Select
                            label="Healing Status Trend"
                            value={verifiedHealingStatus}
                            onChange={e => setVerifiedHealingStatus(e.target.value as any)}
                          >
                            <option value="Improving">Improving</option>
                            <option value="Stable">Stable</option>
                            <option value="Requires Attention">Requires Attention</option>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <Input
                            label="Verified Length (cm)"
                            type="number"
                            step="0.1"
                            value={verifiedMeasurements.lengthCm}
                            onChange={e => setVerifiedMeasurements({
                              ...verifiedMeasurements,
                              lengthCm: parseFloat(e.target.value) || 0
                            })}
                            required
                          />
                          <Input
                            label="Verified Width (cm)"
                            type="number"
                            step="0.1"
                            value={verifiedMeasurements.widthCm}
                            onChange={e => setVerifiedMeasurements({
                              ...verifiedMeasurements,
                              widthCm: parseFloat(e.target.value) || 0
                            })}
                            required
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-2xs">
                          <Input
                            label="Granulation %"
                            type="number"
                            max="100"
                            min="0"
                            value={verifiedMeasurements.granulationTissuePct}
                            onChange={e => setVerifiedMeasurements({
                              ...verifiedMeasurements,
                              granulationTissuePct: parseInt(e.target.value) || 0
                            })}
                          />
                          <Input
                            label="Slough %"
                            type="number"
                            max="100"
                            min="0"
                            value={verifiedMeasurements.sloughTissuePct}
                            onChange={e => setVerifiedMeasurements({
                              ...verifiedMeasurements,
                              sloughTissuePct: parseInt(e.target.value) || 0
                            })}
                          />
                          <Input
                            label="Eschar %"
                            type="number"
                            max="100"
                            min="0"
                            value={verifiedMeasurements.escharTissuePct}
                            onChange={e => setVerifiedMeasurements({
                              ...verifiedMeasurements,
                              escharTissuePct: parseInt(e.target.value) || 0
                            })}
                          />
                        </div>
                      </div>

                      <div className="text-xs">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Clinical Assessment Notes</label>
                        <textarea
                          placeholder="Document margin descriptions, exudate type, odor, patient pain scale, or caliper variations..."
                          value={clinicalNotes}
                          onChange={e => setClinicalNotes(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-slate-800 placeholder-slate-400 min-h-16"
                          required
                        />
                      </div>

                      {/* VERIFICATION ACTIONS */}
                      <div className="flex gap-2 pt-2 border-t border-slate-100 justify-between">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={handleAcceptAi}
                          className="text-xs py-1.5 px-3 cursor-pointer text-teal-850"
                        >
                          Accept AI As-Is
                        </Button>
                        <Button
                          type="submit"
                          className="text-xs py-1.5 px-3 bg-teal-700 text-white cursor-pointer"
                        >
                          Verify & Finalize
                        </Button>
                      </div>
                    </form>
                  )}
                </Card>

              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
