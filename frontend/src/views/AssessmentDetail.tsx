import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWounds } from '../context/WoundContext';
import { useAuth } from '../context/AuthContext';
import { Card, Button } from '../components/ui';
import { CheckCircle, FileCheck, RotateCcw, Sparkles } from 'lucide-react';
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

export const AssessmentDetail: React.FC = () => {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const { wounds, patients, assessments, verifyAssessment } = useWounds();
  const { user } = useAuth();

  const activeAssessment = assessments.find(a => a.id === Number(assessmentId));
  const activeWound = wounds.find(w => w.id === activeAssessment?.woundId);
  const activePatient = patients.find(p => p.id === activeWound?.patientId);

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
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">AI pipeline analysis is pending.</div>
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
    </div>
  );
};
