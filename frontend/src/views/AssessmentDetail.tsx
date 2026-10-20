import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWounds } from '../context/WoundContext';
import { useAuth } from '../context/AuthContext';
import { Card, Button } from '../components/ui';
import { CheckCircle, FileCheck, RotateCcw, Sparkles, AlertCircle, Ruler, X } from 'lucide-react';
import type { Measurement } from '../types';
import { apiFetch, buildImageUrl } from '../utils/api';
import { mapRenderedToOriginalCoords } from '../utils/coordinateUtils';

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

export const AssessmentDetail: React.FC = () => {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const { wounds, patients, assessments, verifyAssessment, calibrateAssessment, loadAssessments } = useWounds();
  const { user } = useAuth();

  const activeAssessment = assessments.find(a => a.id === Number(assessmentId));
  const activeWound = wounds.find(w => w.id === activeAssessment?.woundId);
  const activePatient = patients.find(p => p.id === activeWound?.patientId);

  // Auto-load assessment if navigating directly or upon browser refresh
  useEffect(() => {
    if (!activeAssessment && assessmentId) {
      apiFetch(`/api/assessments/${assessmentId}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'ok' && data.assessment?.woundId) {
            loadAssessments(data.assessment.woundId);
          }
        })
        .catch(console.error);
    }
  }, [assessmentId, activeAssessment, loadAssessments]);

  // Active overlays on analyzed image
  const [showYoloBox, setShowYoloBox] = useState(true);
  const [showUnetMask, setShowUnetMask] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);

  // Verification Form states
  const [clinicalNotes, setClinicalNotes] = useState('');
  
  // Track modified measurements manually
  const [verifiedMeasurements, setVerifiedMeasurements] = useState<Measurement>({
    woundCount: 0,
    areaCm2: null,
    lengthCm: null,
    widthCm: null,
  });

  const [analyzingTissue, setAnalyzingTissue] = useState(false);
  const [tissueError, setTissueError] = useState<string | null>(null);

  // Manual calibration state
  const [showCalibrateModal, setShowCalibrateModal] = useState(false);
  const [calibPoint1, setCalibPoint1] = useState<{ x: number; y: number } | null>(null);
  const [calibPoint2, setCalibPoint2] = useState<{ x: number; y: number } | null>(null);
  const [calibRefDist, setCalibRefDist] = useState<string>('2.0');
  const [calibDirectScale, setCalibDirectScale] = useState<string>('');
  const [calibMethod, setCalibMethod] = useState<'two-point' | 'direct'>('two-point');
  const [calibConfirmed, setCalibConfirmed] = useState<boolean>(false);
  const [calibrating, setCalibrating] = useState<boolean>(false);
  const [calibError, setCalibError] = useState<string | null>(null);

  const handleModalImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (calibMethod !== 'two-point') return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const point = mapRenderedToOriginalCoords({
      clickX: e.clientX - rect.left,
      clickY: e.clientY - rect.top,
      elemWidth: rect.width,
      elemHeight: rect.height,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      objectFit: 'contain',
    });

    if (!point) return;

    if (!calibPoint1 || (calibPoint1 && calibPoint2)) {
      setCalibPoint1(point);
      setCalibPoint2(null);
    } else {
      setCalibPoint2(point);
    }
  };

  const modalPixelDistance = calibPoint1 && calibPoint2
    ? Math.hypot(calibPoint2.x - calibPoint1.x, calibPoint2.y - calibPoint1.y)
    : null;
  const modalCalculatedScale = modalPixelDistance && parseFloat(calibRefDist) > 0
    ? Number((modalPixelDistance / parseFloat(calibRefDist)).toFixed(2))
    : null;

  const handleApplyCalibration = async () => {
    if (!activeAssessment) return;
    setCalibError(null);
    setCalibrating(true);
    try {
      if (!calibConfirmed) {
        throw new Error('Please confirm that the reference measurement is verified on the wound plane.');
      }
      if (calibMethod === 'two-point') {
        if (!calibPoint1 || !calibPoint2) {
          throw new Error('Please click two points on the image corresponding to the known reference distance.');
        }
        const refDist = parseFloat(calibRefDist);
        if (isNaN(refDist) || refDist <= 0) {
          throw new Error('Reference distance must be a positive number in cm.');
        }
        await calibrateAssessment(activeAssessment.id, {
          point1: [calibPoint1.x, calibPoint1.y],
          point2: [calibPoint2.x, calibPoint2.y],
          reference_distance_cm: refDist,
          notes: 'Clinician two-point reference calibration'
        });
      } else {
        const scale = parseFloat(calibDirectScale);
        if (isNaN(scale) || scale <= 0) {
          throw new Error('Please enter a valid positive scale in px/cm.');
        }
        await calibrateAssessment(activeAssessment.id, {
          pixels_per_cm: scale,
          notes: 'Clinician direct reference scale calibration'
        });
      }
      setShowCalibrateModal(false);
      setCalibPoint1(null);
      setCalibPoint2(null);
      setCalibConfirmed(false);
    } catch (err: any) {
      setCalibError(err.message || 'Failed to calibrate assessment.');
    } finally {
      setCalibrating(false);
    }
  };

  const handleAnalyzeTissue = async () => {
    if (!activeAssessment || analyzingTissue) return;
    setAnalyzingTissue(true);
    setTissueError(null);
    try {
      const formData = new FormData();
      formData.append('assessmentId', activeAssessment.id.toString());
      if (activeAssessment.woundId) {
        formData.append('woundId', activeAssessment.woundId.toString());
      }

      const res = await apiFetch('/api/analysis/tissue', {
        method: 'POST',
        body: formData,
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.message || resData.error || 'Failed to analyze tissue composition.');
      }

      // Reload assessments to update the state with the persisted tissue analysis
      await loadAssessments(activeAssessment.woundId);
      setTissueError(null);
    } catch (err: any) {
      setTissueError(err.message || 'An error occurred during tissue analysis.');
    } finally {
      setAnalyzingTissue(false);
    }
  };

  useEffect(() => {
    if (activeAssessment) {
      if (activeAssessment.status === 'Verified' && activeAssessment.verifiedResult) {
        setVerifiedMeasurements(activeAssessment.verifiedResult.measurements);
        setClinicalNotes(activeAssessment.verifiedResult.clinicalNotes);
      } else if (activeAssessment.aiResult) {
        setVerifiedMeasurements(activeAssessment.aiResult.measurements);
        setClinicalNotes('');
      }
    }
  }, [activeAssessment]);

  if (!activeAssessment || !activeWound || !activePatient) {
    return <div className="text-center py-12 text-slate-500">Loading assessment details...</div>;
  }

  // Submit clinician verification
  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (assessmentId) {
      verifyAssessment(assessmentId, {
        verifiedDate: new Date().toISOString().split('T')[0],
        measurements: verifiedMeasurements,
        clinicalNotes: clinicalNotes.trim(),
      });
    }
  };

  // Accept AI findings completely
  const handleAcceptAi = () => {
    if (activeAssessment?.aiResult) {
      const ai = activeAssessment.aiResult;
      verifyAssessment(assessmentId!, {
        verifiedDate: new Date().toISOString().split('T')[0],
        measurements: ai.measurements,
        clinicalNotes: 'AI assessment accepted in full after clinical review.',
      });
    }
  };

  const isVerified = activeAssessment.status === 'Verified';
  const canVerify = user?.role === 'DOCTOR' || user?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* BACK TO SELECTION BUTTON */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/wounds/${activeWound.id}`)}
          className="cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          Back to Wound
        </Button>
        <div className="flex gap-4 text-sm bg-slate-50 border border-slate-200 px-4 py-3 rounded-md shadow-sm w-full">
          <div className="flex items-center gap-1.5"><span className="text-slate-500">Assessment:</span><span className="font-semibold text-slate-800">{activeAssessment.id}</span></div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5"><span className="text-slate-500">Patient:</span><span className="font-semibold text-slate-800">{activePatient.patientCode || activePatient.id}</span></div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5"><span className="text-slate-500">Location:</span><span className="font-semibold text-slate-800">{activeWound.location}</span></div>
        </div>
      </div>

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
                >
                  Bounding box
                </Button>
                <Button
                  size="sm"
                  variant={showUnetMask ? 'primary' : 'secondary'}
                  onClick={() => setShowUnetMask(!showUnetMask)}
                  className="text-[10px] py-1 px-2 cursor-pointer"
                >
                  Segmentation mask
                </Button>
                <Button
                  size="sm"
                  variant={showMeasurements ? 'primary' : 'secondary'}
                  onClick={() => setShowMeasurements(!showMeasurements)}
                  className="text-[10px] py-1 px-2 cursor-pointer"
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
                    {activeAssessment.measurements?.total_area_pixels != null && (
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {Math.round(activeAssessment.measurements.total_area_pixels)} px²
                      </div>
                    )}
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

                {/* CALIBRATION STATUS BADGE */}
                {activeAssessment.aiResult.calibration?.source === 'automatic' && activeAssessment.aiResult.calibration?.detected ? (
                  <div className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200 rounded p-2 flex items-center justify-between">
                    <span className="font-semibold">✓ Automatic Physical Calibration</span>
                    <span className="font-mono">{activeAssessment.aiResult.calibration.pixels_per_cm} px/cm</span>
                  </div>
                ) : activeAssessment.aiResult.calibration?.source === 'manual' && activeAssessment.aiResult.calibration?.verified ? (
                  <div className="text-[11px] text-teal-800 bg-teal-50 border border-teal-200 rounded p-2 flex items-center justify-between">
                    <div>
                      <span className="font-semibold">✓ Clinician Manual Calibration</span>
                      {activeAssessment.aiResult.calibration.reference_distance_cm && (
                        <span className="text-slate-500 ml-1">({activeAssessment.aiResult.calibration.reference_distance_cm} cm ref)</span>
                      )}
                    </div>
                    <span className="font-mono">{activeAssessment.aiResult.calibration.pixels_per_cm} px/cm</span>
                  </div>
                ) : activeAssessment.aiResult.calibration?.source === 'demo' ? (
                  <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2.5 space-y-2">
                    <div className="flex items-start gap-1.5 leading-snug">
                      <span className="font-semibold text-amber-600">⚠ Demo Scale ({activeAssessment.aiResult.calibration.pixels_per_cm || 25} px/cm):</span>
                      <span>Physical calibration marker was not detected. Values shown are demonstration estimates.</span>
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowCalibrateModal(true)}
                        className="text-xs py-1 px-2.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer flex items-center gap-1.5"
                      >
                        <Ruler className="w-3.5 h-3.5 text-amber-700" />
                        Calibrate with known reference
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-2.5 space-y-2">
                    <div className="flex items-start gap-1.5 leading-snug">
                      <span className="font-semibold text-amber-600">⚠ Physical Calibration Unavailable:</span>
                      <span>Reference marker was not detected. Physical area and dimensions cannot be established automatically.</span>
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setShowCalibrateModal(true)}
                        className="text-xs py-1 px-2.5 bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 cursor-pointer flex items-center gap-1.5"
                      >
                        <Ruler className="w-3.5 h-3.5 text-amber-700" />
                        Calibrate with known reference
                      </Button>
                    </div>
                  </div>
                )}

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
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">AI pipeline analysis is pending.</div>
            )}
          </Card>

          {/* TISSUE COMPOSITION PANEL */}
          <Card title="Tissue Composition">
            {activeAssessment.aiResult?.tissueComposition ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(activeAssessment.aiResult.tissueComposition).map(([key, value]) => {
                    if (Number(value) > 0) {
                      return (
                        <div key={key} className="bg-slate-50 border border-slate-100 rounded-md p-2.5 flex justify-between items-center">
                          <span className="text-xs font-semibold text-slate-700 capitalize">{key}</span>
                          <span className="text-sm font-bold text-slate-900">{Number(value).toFixed(1)}%</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
                {activeAssessment.aiResult.tissueAnnotatedUrl && (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-slate-700 mb-2">Tissue Map</div>
                    <div className="relative border border-slate-200 rounded-md overflow-hidden flex items-center justify-center bg-slate-100">
                      <img
                        src={buildImageUrl(activeAssessment.aiResult.tissueAnnotatedUrl) || activeAssessment.aiResult.tissueAnnotatedUrl}
                        alt="Tissue Map"
                        className="max-h-48 object-contain"
                      />
                    </div>
                  </div>
                )}
                <div className="text-[10px] text-slate-400 mt-2">
                  * AI-generated tissue composition estimates are experimental and for investigational use only. Not a clinical diagnosis or treatment recommendation.
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-slate-500 text-sm mb-4">No tissue analysis available for this assessment.</p>
                {tissueError && (
                  <div className="mb-4 bg-red-50 text-red-700 text-xs p-2 rounded flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {tissueError}
                  </div>
                )}
                <Button
                  onClick={handleAnalyzeTissue}
                  disabled={analyzingTissue}
                  className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                >
                  {analyzingTissue ? 'Analyzing...' : 'Analyze Tissue'}
                </Button>
              </div>
            )}
          </Card>

          {/* CLINICIAN VERIFICATION */}
          <Card
            title={
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-teal-700" />
                <span>Clinical review</span>
              </div>
            }
          >
            {isVerified ? (
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
                {activeAssessment.verifiedResult?.clinicalNotes && (
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3">
                    <strong className="text-slate-700 block mb-1">Clinical Notes</strong>
                    <p className="text-slate-600">{activeAssessment.verifiedResult.clinicalNotes}</p>
                  </div>
                )}
                <Button onClick={() => navigate('/reports')} className="w-full cursor-pointer bg-slate-800 text-white hover:bg-slate-900">
                  View Reports
                </Button>
              </div>
            ) : (
              <form onSubmit={handleVerifySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Clinical Adjudication Notes
                  </label>
                  <textarea
                    value={clinicalNotes}
                    onChange={e => setClinicalNotes(e.target.value)}
                    placeholder="Enter clinical assessment notes, debridement actions, or validation of AI boundary..."
                    className="w-full text-xs bg-white border border-slate-200 rounded-md p-3 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 min-h-[100px] resize-y"
                    required
                    disabled={!canVerify}
                  />
                  {!canVerify && (
                    <p className="text-[10px] text-red-500 mt-1">You do not have permission to verify assessments.</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAcceptAi}
                    className="flex-1 cursor-pointer"
                    disabled={!canVerify}
                  >
                    Accept AI Results
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={!canVerify || !clinicalNotes.trim()}
                  >
                    Verify & Finalize
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>

      {/* MANUAL CALIBRATION MODAL */}
      {showCalibrateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-teal-700" />
                <h3 className="text-sm font-bold text-slate-800 m-0">Clinician Physical Calibration</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCalibrateModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Method Tabs */}
              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setCalibMethod('two-point')}
                  className={`py-1.5 px-4 font-semibold border-b-2 cursor-pointer ${calibMethod === 'two-point' ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500'}`}
                >
                  Two-Point Reference on Image
                </button>
                <button
                  type="button"
                  onClick={() => setCalibMethod('direct')}
                  className={`py-1.5 px-4 font-semibold border-b-2 cursor-pointer ${calibMethod === 'direct' ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500'}`}
                >
                  Direct Scale Entry
                </button>
              </div>

              {calibMethod === 'two-point' ? (
                <div className="space-y-3">
                  <p className="text-slate-600">
                    Click two points on the photograph corresponding to a known physical distance (such as tick marks on a ruler or reference marker).
                  </p>

                  <div className="relative border border-slate-200 rounded-md overflow-hidden bg-slate-900 flex justify-center max-h-[280px]">
                    <img
                      src={activeAssessment.imageUrl || activeAssessment.analyzedImageUrl}
                      alt="Calibration target"
                      onClick={handleModalImageClick}
                      className="max-h-[280px] object-contain cursor-crosshair select-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded border border-slate-200">
                    <div>
                      <span className="font-semibold text-slate-700 block mb-0.5">Point 1 (px):</span>
                      <span className="font-mono text-slate-600">
                        {calibPoint1 ? `(${calibPoint1.x}, ${calibPoint1.y})` : 'Click on image to set Point 1'}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 block mb-0.5">Point 2 (px):</span>
                      <span className="font-mono text-slate-600">
                        {calibPoint2 ? `(${calibPoint2.x}, ${calibPoint2.y})` : 'Click on image to set Point 2'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700">Known reference distance:</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={calibRefDist}
                        onChange={(e) => setCalibRefDist(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 w-20 text-xs"
                      />
                      <span className="text-slate-600 font-medium">cm</span>
                    </div>
                  </div>

                  {modalCalculatedScale && (
                    <div className="bg-teal-50 border border-teal-200 text-teal-900 p-2.5 rounded flex justify-between items-center">
                      <span>Calculated Scale:</span>
                      <span className="font-bold font-mono text-sm">{modalCalculatedScale} px/cm</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-slate-600">
                    Enter a verified physical scale in pixels per centimeter derived from a physical reference object in the same plane as the wound.
                  </p>
                  <div className="flex items-center gap-3">
                    <label className="font-semibold text-slate-700">Physical Scale:</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="e.g. 25.0"
                        value={calibDirectScale}
                        onChange={(e) => setCalibDirectScale(e.target.value)}
                        className="border border-slate-300 rounded px-2 py-1 w-28 text-xs"
                      />
                      <span className="text-slate-600 font-medium">px/cm</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Clinical Advisory Notice */}
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded text-[11px] space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                  Clinical Calibration Advisory
                </div>
                <p>
                  Perspective distortion, camera angles, and reference objects placed outside the wound's physical plane introduce measurement error. Ensure the reference points lie directly on the wound plane.
                </p>
              </div>

              {/* Confirmation checkbox */}
              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={calibConfirmed}
                  onChange={(e) => setCalibConfirmed(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-slate-700 text-xs font-medium">
                  I confirm that this calibration represents a verified physical distance on the wound plane.
                </span>
              </label>

              {calibError && (
                <div className="text-red-600 text-xs bg-red-50 p-2 rounded border border-red-200">
                  {calibError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowCalibrateModal(false)}
                disabled={calibrating}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApplyCalibration}
                disabled={calibrating || !calibConfirmed || (calibMethod === 'two-point' && (!calibPoint1 || !calibPoint2))}
                className="bg-teal-700 text-white hover:bg-teal-800 cursor-pointer disabled:opacity-50"
              >
                {calibrating ? 'Applying...' : 'Apply Calibration'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
