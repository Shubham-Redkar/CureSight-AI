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

const formatMeasurement = (value: number | null | undefined, decimals = 2) => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'Not available';
  }
  return Number(value).toFixed(decimals);
};

const formatConfidence = (value: number | null | undefined) => {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return 'Not available';
  }
  return `${Math.round(Number(value) * 100)}%`;
};

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
    runAnalysis,
    verifyAssessment,
  } = useWounds();

  // Workflow steps: 'select' | 'upload' | 'analysis'
  const [currentStep, setCurrentStep] = useState<'select' | 'upload' | 'analysis'>('select');

  // Local UI states
  const [dragActive, setDragActive] = useState(false);
  const [imageFile, setImageFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simulation loading states
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [_analysisStep, setAnalysisStep] = useState(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Active overlays on analyzed image
  const [showYoloBox, setShowYoloBox] = useState(true);
  const [showUnetMask, setShowUnetMask] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);

  // Verification Form states
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [verifiedHealingStatus, setVerifiedHealingStatus] = useState<'Improving' | 'Stable' | 'Requires Attention' | 'Unavailable' | 'Insufficient historical data' | ''>('');
  
  // Calibration state
  const [showAdvancedCalibration, setShowAdvancedCalibration] = useState<boolean>(false);
  const [calibrationMode, setCalibrationMode] = useState<'automatic' | 'manual'>('automatic');
  const [pixelsPerCm, setPixelsPerCm] = useState<string>('25');
  const [manualCalibrationConfirmed, setManualCalibrationConfirmed] = useState<boolean>(false);
  
  // Track modified measurements manually
  const [verifiedMeasurements, setVerifiedMeasurements] = useState<Measurement>({
    woundCount: 0,
    areaCm2: null,
    lengthCm: null,
    widthCm: null,
    granulationTissuePct: null,
    sloughTissuePct: null,
    escharTissuePct: null,
  });

  const activePatient = patients.find(p => p.id === Number(selectedPatientId));
  const patientWounds = wounds.filter(w => w.patientId === Number(selectedPatientId));
  const activeWound = wounds.find(w => w.id === Number(selectedWoundId));
  const activeAssessment = assessments.find(a => a.id === Number(selectedAssessmentId));

  // Clear assessment specific local states when a new one is selected or resetting
  useEffect(() => {
    if (!selectedAssessmentId) {
      setVerifiedMeasurements({
        woundCount: 0,
        areaCm2: null,
        lengthCm: null,
        widthCm: null,
        granulationTissuePct: null,
        sloughTissuePct: null,
        escharTissuePct: null,
      });
      setVerifiedHealingStatus('');
      setClinicalNotes('');
      setAnalysisStep(-1);
      setAnalysisProgress('');
    }
  }, [selectedAssessmentId]);

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
        setVerifiedHealingStatus(activeAssessment.aiResult.healingStatus || 'Unavailable');
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

  // Image use logic

  const handleProceedToAnalysis = () => {
    if (selectedPatientId && selectedWoundId && imageFile) {
      setCurrentStep('analysis');
    }
  };

  // Run AI analysis pipeline
  const handleStartAnalysis = async () => {
    if (!selectedWoundId || !imageFile) return;

    setAnalysisProgress('Running AI Pipeline...');
    setIsLoading(true);

    const calibrationValue = calibrationMode === 'manual' && manualCalibrationConfirmed && pixelsPerCm && !isNaN(parseFloat(pixelsPerCm)) && parseFloat(pixelsPerCm) > 0 
      ? parseFloat(pixelsPerCm) 
      : undefined;

    try {
      const res = await fetch(imageFile);
      const rawBlob = await res.blob();
      
      setAnalysisProgress('Running AI Pipeline...');
      const newAss = await runAnalysis(selectedWoundId, rawBlob, calibrationValue);
      setSelectedAssessmentId(String(newAss.id));
      setAnalysisProgress('Analysis complete.');
    } catch (err: any) {
      setAnalysisProgress(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit clinician verification
  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAssessmentId) {
      verifyAssessment(selectedAssessmentId, {
        verifiedDate: new Date().toISOString().split('T')[0],
        measurements: verifiedMeasurements,
        healingStatus: verifiedHealingStatus as any,
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
        healingStatus: ai.healingStatus === 'Unavailable' || ai.healingStatus === 'Insufficient historical data' ? 'Unavailable' : ai.healingStatus,
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
          AI-assisted wound detection, segmentation, and physical measurement.
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
                    {p.patientCode} ({p.name})
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
                    {w.location} ({w.description || 'Unspecified'})
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
                    <Button onClick={handleProceedToAnalysis} className="cursor-pointer">
                      Proceed to Analysis
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* QUALITY GUIDANCE (1/3 width) */}
          <div className="space-y-4">
            <Card title="Photography Guidance">
              <div className="space-y-4 text-xs text-slate-600">
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-md">
                  <h5 className="font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                    <Info className="w-4 h-4 text-teal-600" />
                    Calibration Marker Required
                  </h5>
                  <p className="text-[11px] text-slate-600 mb-2 leading-relaxed">
                    Physical measurements in cm/cm² require a valid physical scale reference. Without a confidently detected calibration marker, CureSight AI will not generate physical measurements.
                  </p>
                  <ul className="text-[11px] space-y-1.5 text-slate-700 list-disc pl-4">
                    <li><strong className="text-slate-800">Physical Size:</strong> Exactly 2 cm × 2 cm</li>
                    <li><strong className="text-slate-800">Shape:</strong> Perfect square</li>
                    <li><strong className="text-slate-800">Color:</strong> Solid high-contrast green</li>
                    <li><strong className="text-slate-800">Placement:</strong> Same physical plane as the wound</li>
                    <li><strong className="text-slate-800">Visibility:</strong> Fully visible (do not cover or obscure)</li>
                  </ul>
                </div>

                <div className="flex gap-2.5 items-start">
                  <div className="bg-teal-50 p-1 rounded-full text-teal-700 mt-0.5 shrink-0">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-slate-800">Angle & Orientation</h5>
                    <p className="text-[11px] text-slate-550 mt-0.5">Hold the lens completely parallel (90 degrees) to the wound plane. Skewed angles skew calibration metrics.</p>
                  </div>
                </div>

                <div className="flex gap-2.5 items-start">
                  <div className="bg-teal-50 p-1 rounded-full text-teal-700 mt-0.5 shrink-0">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-slate-800">Focus & Lighting</h5>
                    <p className="text-[11px] text-slate-550 mt-0.5">Ensure even, diffused clinical room illumination. Focus explicitly on the wound bed margin. Blurry pixels degrade boundary accuracy.</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* STEP 3: PIPELINE EXECUTION & VERIFICATION */}
      {currentStep === 'analysis' && activePatient && activeWound && (
        <div className="space-y-6">
          {/* BACK TO SELECTION BUTTON */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedAssessmentId(null);
                setCurrentStep('select');
              }}
              className="cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              New Assessment
            </Button>
            <div className="flex gap-4 text-sm bg-slate-50 border border-slate-200 px-4 py-3 rounded-md shadow-sm w-full">
              {activeAssessment && (
                <>
                  <div className="flex items-center gap-1.5"><span className="text-slate-500">Assessment:</span><span className="font-semibold text-slate-800">{activeAssessment.id}</span></div>
                  <span className="text-slate-300">|</span>
                </>
              )}
              <div className="flex items-center gap-1.5"><span className="text-slate-500">Patient:</span><span className="font-semibold text-slate-800">{activePatient.patientCode || activePatient.id}</span></div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5"><span className="text-slate-500">Location:</span><span className="font-semibold text-slate-800">{activeWound.location}</span></div>
            </div>
          </div>

          {/* AI RUNNING LOADER & TRIGGER */}
          {!activeAssessment && (
            <Card className="max-w-xl mx-auto py-12 text-center">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className={`w-14 h-14 border-4 border-slate-200 border-t-teal-700 rounded-full ${isLoading ? 'animate-spin' : ''}`}></div>
                  <Sparkles className={`w-6 h-6 text-teal-700 absolute inset-0 m-auto ${isLoading ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Processing Wound Architecture</h3>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                    Detecting wound boundaries, segmenting tissue matrices, and calculating physical area.
                  </p>
                </div>
                {analysisProgress && (
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3 max-w-md w-full font-mono text-[10px] text-slate-655 text-left space-y-1">
                    <div className="text-[10px] font-bold text-teal-800">PIPELINE MONITOR LOG:</div>
                    <div>{analysisProgress}</div>
                  </div>
                )}
                
                {/* Calibration Input */}
                <div className="w-full max-w-sm mt-6 text-left border border-slate-200 rounded-md p-3 bg-slate-50">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-semibold text-slate-800">Physical Measurement Calibration</div>
                    <button 
                      type="button" 
                      onClick={() => setShowAdvancedCalibration(!showAdvancedCalibration)}
                      className="text-xs text-teal-600 hover:text-teal-800"
                    >
                      {showAdvancedCalibration ? 'Hide advanced' : 'Advanced'}
                    </button>
                  </div>
                  
                  {!showAdvancedCalibration ? (
                    <div className="text-xs text-slate-600">
                      The system will automatically detect a physical calibration marker. If no marker is found, it will use the configured demonstration scale.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 mt-3">
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="calMode" 
                            value="automatic" 
                            className="mt-0.5"
                            checked={calibrationMode === 'automatic'}
                            onChange={() => setCalibrationMode('automatic')}
                          />
                          <div>
                            <div className="text-sm font-medium text-slate-700">Automatic / Demo Fallback</div>
                            <div className="text-xs text-slate-500">Detect a known physical reference marker, or fallback to default demo scale.</div>
                          </div>
                        </label>

                        <label className="flex items-start gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="calMode" 
                            value="manual" 
                            className="mt-0.5"
                            checked={calibrationMode === 'manual'}
                            onChange={() => setCalibrationMode('manual')}
                          />
                          <div>
                            <div className="text-sm font-medium text-slate-700">Explicit Manual Calibration</div>
                            <div className="text-xs text-slate-500">For demonstration/testing only. Overrides demo fallback.</div>
                          </div>
                        </label>
                      </div>

                      {calibrationMode === 'manual' && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-slate-700 block mb-1">Manual scale</label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.1"
                                min="0.1"
                                placeholder="25"
                                value={pixelsPerCm}
                                onChange={(e) => setPixelsPerCm(e.target.value)}
                                disabled={isLoading}
                              />
                              <span className="text-sm text-slate-600">px/cm</span>
                            </div>
                          </div>
                          
                          <div className="text-xs text-amber-800 font-medium flex gap-1.5 items-start">
                            <span className="text-amber-600">⚠</span>
                            <p>Manual calibration is for demonstration/testing only. The scale is supplied by the user and is not derived from a physical reference in the photograph.</p>
                          </div>

                          <label className="flex items-start gap-2 cursor-pointer mt-2">
                            <input 
                              type="checkbox"
                              className="mt-0.5"
                              checked={manualCalibrationConfirmed}
                              onChange={(e) => setManualCalibrationConfirmed(e.target.checked)}
                              disabled={isLoading}
                            />
                            <span className="text-xs text-slate-700">I understand that this measurement uses a demonstration scale and is not photograph-derived physical calibration.</span>
                          </label>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <Button
                  onClick={handleStartAnalysis}
                  disabled={isLoading || (calibrationMode === 'manual' && !manualCalibrationConfirmed)}
                  className="mt-2 bg-teal-700 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Running...' : 'Start Diagnostic Analysis'}
                </Button>
              </div>
            </Card>
          )}

          {/* ANALYSIS COMPLETED / VERIFIED / FAILED DISPLAY */}
          {activeAssessment && (activeAssessment.status === 'Analysis Completed' || activeAssessment.status === 'Verified' || activeAssessment.status === 'Analysis Failed') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* IMAGE DISPLAY PANEL (7/12 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <Card
                  title="Wound image"
                  headerAction={
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={showYoloBox ? 'primary' : 'secondary'}
                        onClick={() => setShowYoloBox(!showYoloBox)}
                        className="text-[10px] py-1 px-2 cursor-pointer"
                        title="Shows detected wound regions."
                      >
                        Bounding box
                      </Button>
                      <Button
                        size="sm"
                        variant={showUnetMask ? 'primary' : 'secondary'}
                        onClick={() => setShowUnetMask(!showUnetMask)}
                        className="text-[10px] py-1 px-2 cursor-pointer"
                        title="Shows the wound boundary identified by the segmentation model."
                      >
                        Segmentation mask
                      </Button>
                      <Button
                        size="sm"
                        variant={showMeasurements ? 'primary' : 'secondary'}
                        onClick={() => setShowMeasurements(!showMeasurements)}
                        className="text-[10px] py-1 px-2 cursor-pointer"
                        title="Displays physical size estimates."
                      >
                        Measurement ruler
                      </Button>
                    </div>
                  }
                >
                  <div className="relative border border-slate-250 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center" style={{ minHeight: '380px' }}>
                    <img
                      src={activeAssessment.analyzedImageUrl || activeAssessment.imageUrl}
                      alt="Clinical Assessment"
                      className="max-w-full h-auto max-h-[450px] object-contain"
                    />
                  </div>
                  
                  {/* TISSUE MAP LEGEND */}
                  <div className="flex gap-4 mt-3 bg-slate-50 p-2.5 rounded-md border border-slate-200 text-2xs justify-center font-medium">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-red-500/40 border border-red-500"></span>
                      Granulation ({activeAssessment.aiResult?.measurements.granulationTissuePct ?? 'Not available'})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-yellow-500/40 border border-yellow-500"></span>
                      Slough ({activeAssessment.aiResult?.measurements.sloughTissuePct ?? 'Not available'})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-slate-500/40 border border-slate-500"></span>
                      Eschar/Necrotic ({activeAssessment.aiResult?.measurements.escharTissuePct ?? 'Not available'})
                    </span>
                  </div>
                </Card>
              </div>

              {/* ACTION / INFORMATION PANEL (5/12 cols) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* AI FINDINGS PANEL */}
                <Card title="AI analysis" subtitle="Automated wound detection and segmentation">
                  {activeAssessment.status === 'Analysis Failed' ? (
                    <div className="text-center py-6 text-red-600 bg-red-50 border border-red-200 rounded-md">
                      <div className="font-bold text-sm mb-1">Analysis failed</div>
                      <div className="text-xs">{activeAssessment.error || 'Image upload failed. Please retry the analysis.'}</div>
                    </div>
                  ) : activeAssessment.aiResult ? (
                    <div className="space-y-4">
                      {/* STATS PANEL */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="bg-slate-50 border border-slate-100 rounded-md p-2.5 text-center flex flex-col justify-center">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Wound area</div>
                          <div className="text-sm font-bold text-slate-900 mt-0.5">
                            {activeAssessment.aiResult.measurements.areaCm2 !== null ? (
                              <>{formatMeasurement(activeAssessment.aiResult.measurements.areaCm2)} <span className="text-2xs font-normal">cm²</span></>
                            ) : (
                              <span className="text-xs font-normal text-slate-500">Not available</span>
                            )}
                          </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-md p-2.5 text-center flex flex-col justify-center">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Dimensions</div>
                          <div className="text-xs font-bold text-slate-900 mt-1">
                            {activeAssessment.aiResult.measurements.woundCount > 1 ? (
                              <span className="font-normal text-slate-500 text-[11px]">Multiple wounds detected</span>
                            ) : activeAssessment.aiResult.measurements.lengthCm !== null && activeAssessment.aiResult.measurements.widthCm !== null ? (
                              <>{formatMeasurement(activeAssessment.aiResult.measurements.lengthCm)} × {formatMeasurement(activeAssessment.aiResult.measurements.widthCm)} <span className="text-[9px] font-normal">cm</span></>
                            ) : (
                              <span className="font-normal text-slate-500">Not available</span>
                            )}
                          </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-md p-2.5 text-center flex flex-col justify-center">
                          <div className="text-[10px] text-slate-500 font-semibold uppercase">Detection confidence</div>
                          <div className="text-sm font-bold text-teal-700 mt-0.5">
                            {activeAssessment.aiResult.detectionConfidence !== null ? (
                              <>{formatConfidence(activeAssessment.aiResult.detectionConfidence)}</>
                            ) : (
                              <span className="font-normal text-slate-500 text-xs">Not available</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* TEXT ANALYSIS */}
                      <div className="text-xs text-slate-655 bg-slate-50/50 border border-slate-200 rounded-md p-3 space-y-2">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                          Analysis status:
                        </div>
                        <p className="leading-relaxed">
                          {activeAssessment.aiResult.measurements.woundCount > 0 ? (
                            <span className="text-teal-700 font-medium">✓ Analysis completed successfully</span>
                          ) : (
                            <span className="text-slate-600 font-medium">No wound detected</span>
                          )}
                          <br />
                          {activeAssessment.aiResult.tissueAnalysis}
                        </p>
                      </div>

                      {/* DETECTED WOUNDS (MULTI-WOUND) */}
                      {activeAssessment.aiResult.measurements.woundCount > 1 && activeAssessment.aiResult.measurements.woundsList && (
                        <div className="text-xs text-slate-655 bg-slate-50/50 border border-slate-200 rounded-md p-3 space-y-2">
                          <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-2">Detected Wounds</div>
                          <div className="space-y-3">
                            {activeAssessment.aiResult.measurements.woundsList.map((w: any, i: number) => (
                              <div key={i} className="bg-white p-2 rounded border border-slate-100">
                                <div className="font-semibold text-slate-700 mb-1">Wound {w.wound_id || i + 1}</div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div><span className="text-slate-400">Length:</span> {formatMeasurement(w.length_cm)} cm</div>
                                  <div><span className="text-slate-400">Width:</span> {formatMeasurement(w.width_cm)} cm</div>
                                  <div><span className="text-slate-400">Area:</span> {formatMeasurement(w.area_cm2)} cm²</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CALIBRATION DISPLAY */}
                      {activeAssessment.aiResult.calibration && (
                        <div className="text-xs bg-slate-50/50 border border-slate-200 rounded-md p-3 space-y-2">
                          <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-2">Measurement calibration</div>
                          {activeAssessment.aiResult.calibration.source === 'automatic' ? (
                            <div className="space-y-1">
                              <div className="text-teal-700 font-semibold flex items-center gap-1.5">✓ Automatic physical marker detected</div>
                              <div className="text-slate-655 flex justify-between"><span>Scale:</span> <span className="font-mono text-xs">{activeAssessment.aiResult.calibration.pixels_per_cm ? `${activeAssessment.aiResult.calibration.pixels_per_cm} px/cm` : 'Marker not detected'}</span></div>
                              <div className="text-slate-655 flex justify-between"><span>Reference marker:</span> <span className="font-mono">{activeAssessment.aiResult.calibration.marker_width_cm} × {activeAssessment.aiResult.calibration.marker_height_cm} cm</span></div>
                              <div className="text-slate-655 flex justify-between"><span>Confidence:</span> <span className="font-mono">{Math.round((activeAssessment.aiResult.calibration.confidence || 0) * 100)}%</span></div>
                            </div>
                          ) : activeAssessment.aiResult.calibration.source === 'demo' ? (
                            <div className="space-y-1">
                              <div className="text-slate-700 font-semibold">Default Demonstration Scale</div>
                              <div className="text-slate-655 flex justify-between mb-1"><span>Scale:</span> <span className="font-mono text-xs">{activeAssessment.aiResult.calibration.pixels_per_cm ? `${activeAssessment.aiResult.calibration.pixels_per_cm} px/cm` : 'Marker not detected'}</span></div>
                              <div className="text-amber-800 text-xs p-1.5 bg-amber-50 border border-amber-200 rounded mt-1">
                                <span className="font-semibold text-amber-600">⚠ Demonstration measurement: </span>
                                No physical calibration marker was detected. Using the configured demonstration scale for testing only.
                              </div>
                            </div>
                          ) : activeAssessment.aiResult.calibration.source === 'manual' ? (
                            <div className="space-y-1">
                              <div className="text-slate-700 font-semibold">Manual — Demonstration</div>
                              <div className="text-slate-655 flex justify-between mb-1"><span>Scale:</span> <span className="font-mono text-xs">{activeAssessment.aiResult.calibration.pixels_per_cm ? `${activeAssessment.aiResult.calibration.pixels_per_cm} px/cm` : 'Marker not detected'}</span></div>
                              <div className="text-amber-800 text-xs p-1.5 bg-amber-50 border border-amber-200 rounded mt-1">
                                <span className="font-semibold text-amber-600">⚠ Demonstration measurement: </span>
                                scale supplied manually.
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="text-amber-600 font-semibold flex items-center gap-1.5">Physical measurements unavailable</div>
                              <div className="text-slate-550">Calibration marker not detected.</div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100">
                        <span className="text-slate-500">Clinical healing assessment:</span>
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
                      <span>Clinical review</span>
                    </div>
                  }
                  subtitle="Review and verify the automated measurements before saving the assessment."
                >
                  {activeAssessment.status === 'Verified' ? (
                    <div className="space-y-4 text-xs">
                      <div className="bg-indigo-50 border border-indigo-100 rounded-md p-3 flex gap-2">
                        <CheckCircle className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-indigo-900 block text-xs">Verification status: Verified</strong>
                          <span className="text-[11px] text-indigo-755 mt-0.5 block">
                            Verified on {activeAssessment.verifiedResult?.verifiedDate}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Verified healing assessment:</span>
                          <span className="font-semibold text-slate-800">
                            {activeAssessment.verifiedResult?.healingStatus}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Verified wound area (cm²):</span>
                          <span className="font-semibold text-slate-800">
                            {formatMeasurement(activeAssessment.verifiedResult?.measurements?.areaCm2)}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Verified dimensions:</span>
                          <span className="font-semibold text-slate-800">
                            {formatMeasurement(activeAssessment.verifiedResult?.measurements?.lengthCm)} × {formatMeasurement(activeAssessment.verifiedResult?.measurements?.widthCm)} cm
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-md p-3 border border-slate-200">
                        <div className="font-semibold text-slate-600 uppercase text-[9px] tracking-wider mb-1">Clinical notes</div>
                        <p className="text-slate-800 italic leading-relaxed">
                          "{activeAssessment.verifiedResult?.clinicalNotes || 'No notes added.'}"
                        </p>
                      </div>
                    </div>
                  ) : activeAssessment.status === 'Analysis Failed' ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-4 text-center">
                      <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-600">AI analysis is unavailable</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Run a successful wound analysis before reviewing or submitting AI-derived measurements.
                      </p>
                    </div>
                  ) : (
                    /* EDIT VERIFICATION FORM */
                    <form onSubmit={handleVerifySubmit} className="space-y-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-2xs text-slate-500">
                        Review AI-generated margins and segmentations. Adjust measurements below if clinical caliper metrics differ, then submit.
                      </div>

                      {/* STATS COMPARISON */}
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <Input
                            label="Verified Area (cm²)"
                            type="number"
                            step="0.01"
                            value={verifiedMeasurements.areaCm2 ?? ''}
                            onChange={e => setVerifiedMeasurements({
                              ...verifiedMeasurements,
                              areaCm2: e.target.value === '' ? null : parseFloat(e.target.value)
                            })}
                            required
                          />
                          <Select
                            label="Healing Status Trend"
                            value={verifiedHealingStatus}
                            onChange={e => setVerifiedHealingStatus(e.target.value as any)}
                          >
                            <option value="" disabled>Select status...</option>
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
                            value={verifiedMeasurements.lengthCm ?? ''}
                            onChange={e => setVerifiedMeasurements({
                              ...verifiedMeasurements,
                              lengthCm: e.target.value === '' ? null : parseFloat(e.target.value)
                            })}
                            required
                          />
                          <Input
                            label="Verified Width (cm)"
                            type="number"
                            step="0.1"
                            value={verifiedMeasurements.widthCm ?? ''}
                            onChange={e => setVerifiedMeasurements({
                              ...verifiedMeasurements,
                              widthCm: e.target.value === '' ? null : parseFloat(e.target.value)
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
                            value={verifiedMeasurements.granulationTissuePct ?? ''}
                            onChange={e => setVerifiedMeasurements({
                              ...verifiedMeasurements,
                              granulationTissuePct: e.target.value === '' ? null : parseInt(e.target.value)
                            })}
                          />
                          <Input
                            label="Slough %"
                            type="number"
                            max="100"
                            min="0"
                            value={verifiedMeasurements.sloughTissuePct ?? ''}
                            onChange={e => setVerifiedMeasurements({
                              ...verifiedMeasurements,
                              sloughTissuePct: e.target.value === '' ? null : parseInt(e.target.value)
                            })}
                          />
                          <Input
                            label="Eschar %"
                            type="number"
                            max="100"
                            min="0"
                            value={verifiedMeasurements.escharTissuePct ?? ''}
                            onChange={e => setVerifiedMeasurements({
                              ...verifiedMeasurements,
                              escharTissuePct: e.target.value === '' ? null : parseInt(e.target.value)
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
