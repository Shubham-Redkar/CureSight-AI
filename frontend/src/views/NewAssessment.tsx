import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWounds } from '../context/WoundContext';
import { Card, Button, Select } from '../components/ui';
import { Upload, RotateCcw, Sparkles, AlertCircle, Info } from 'lucide-react';

export const NewAssessment: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { patients, wounds, runAnalysis } = useWounds();

  // Initial params
  const initialPatientId = searchParams.get('patientId') || '';
  const initialWoundId = searchParams.get('woundId') || '';

  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatientId);
  const [selectedWoundId, setSelectedWoundId] = useState<string>(initialWoundId);

  // Local UI states
  const [dragActive, setDragActive] = useState(false);
  const [imageFile, setImageFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calibration state
  const [showAdvancedCalibration, setShowAdvancedCalibration] = useState<boolean>(false);
  const [calibrationMode, setCalibrationMode] = useState<'automatic' | 'manual'>('automatic');
  const [pixelsPerCm, setPixelsPerCm] = useState<string>('25');
  const [manualCalibrationConfirmed, setManualCalibrationConfirmed] = useState<boolean>(false);

  const activePatient = patients.find(p => p.id === Number(selectedPatientId));
  const patientWounds = wounds.filter(w => w.patientId === Number(selectedPatientId));
  const activeWound = wounds.find(w => w.id === Number(selectedWoundId));

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

  const handleStartAnalysis = async () => {
    if (!selectedWoundId || !imageFile) return;

    setIsLoading(true);
    setError(null);

    const calibrationValue = calibrationMode === 'manual' && manualCalibrationConfirmed && pixelsPerCm && !isNaN(parseFloat(pixelsPerCm)) && parseFloat(pixelsPerCm) > 0 
      ? parseFloat(pixelsPerCm) 
      : undefined;

    try {
      const res = await fetch(imageFile);
      const rawBlob = await res.blob();
      
      const newAss = await runAnalysis(selectedWoundId, rawBlob, calibrationValue);
      // Navigate to AssessmentDetail
      navigate(`/assessments/${newAss.id}`);
    } catch (err: any) {
      setError(`Error: ${err.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 m-0 tracking-tight">New Wound Assessment</h2>
        <p className="text-xs text-slate-500 mt-1">
          Capture an image for AI-assisted wound detection and analysis.
        </p>
      </div>

      {!activePatient || !activeWound ? (
        <Card title="Patient & Anatomical Site Selection" className="max-w-2xl mx-auto">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Select Patient ID"
                value={selectedPatientId}
                onChange={e => {
                  setSelectedPatientId(e.target.value);
                  setSelectedWoundId('');
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
                value={selectedWoundId}
                disabled={!selectedPatientId}
                onChange={e => setSelectedWoundId(e.target.value)}
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
                  No wound sites registered for this patient.
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : (
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
                  
                  <div className="flex items-center gap-3 mt-4 justify-center w-full">
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
                      className="absolute top-3 right-3 bg-slate-900/70 hover:bg-slate-900 text-white rounded-md p-1.5 transition-colors shadow-md focus:outline-hidden cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
                    <div>Assessment Date: <strong className="text-slate-800">{new Date().toISOString().split('T')[0]}</strong></div>
                    <div>Anatomical Site: <strong className="text-slate-800">{activeWound.location}</strong></div>
                  </div>

                  <div className="w-full mt-6 text-left border border-slate-200 rounded-md p-3 bg-slate-50">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-sm font-semibold text-slate-800">Physical Measurement Calibration</div>
                      <button 
                        type="button" 
                        onClick={() => setShowAdvancedCalibration(!showAdvancedCalibration)}
                        className="text-xs text-teal-600 hover:text-teal-800 cursor-pointer"
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
                              <label className="text-xs font-semibold text-slate-700 block mb-1">Manual scale (px/cm)</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                placeholder="25"
                                value={pixelsPerCm}
                                onChange={(e) => setPixelsPerCm(e.target.value)}
                                disabled={isLoading}
                                className="border border-slate-300 rounded p-1"
                              />
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

                  {error && (
                    <div className="text-red-500 text-sm py-2">{error}</div>
                  )}

                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                    <Button
                      variant="secondary"
                      onClick={() => setImageFile(null)}
                      className="cursor-pointer"
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleStartAnalysis} disabled={isLoading || (calibrationMode === 'manual' && !manualCalibrationConfirmed)} className="cursor-pointer bg-teal-700 text-white hover:bg-teal-800 flex items-center gap-2">
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Start Diagnostic Analysis
                        </>
                      )}
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
                    <li><strong className="text-slate-800">Placement:</strong> Same physical plane as the wound</li>
                    <li><strong className="text-slate-800">Visibility:</strong> Fully visible (do not cover or obscure)</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
