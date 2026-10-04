import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWounds } from '../context/WoundContext';
import { Card, Badge, Button, Input, Select, Modal } from '../components/ui';
import { Plus, ChevronLeft, Layers, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const PatientDetails: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { patients, wounds, assessments, addWound, isLoading, error } = useWounds();
  useAuth();

  const [isAddWoundOpen, setIsAddWoundOpen] = useState(false);
  const [woundForm, setWoundForm] = useState({
    location: '',
    type: 'Diabetic Foot Ulcer',
  });
  const [woundFormError, setWoundFormError] = useState('');

  const selectedPatient = patients.find(p => p.id === Number(patientId));
  const selectedPatientWounds = wounds.filter(w => w.patientId === Number(patientId));
  const selectedPatientAssessments = assessments.filter(a => {
    const w = selectedPatientWounds.find(wound => wound.id === a.woundId);
    return !!w;
  });
  const selectedPatientReports = assessments.filter(a => 
    wounds.find(w => w.id === Number(a.woundId))?.patientId === Number(patientId) && 
    (a.status === 'Analysis Completed' || a.status === 'COMPLETED')
  );

  const handleAddWound = async (e: React.FormEvent) => {
    e.preventDefault();
    setWoundFormError('');

    if (!woundForm.location.trim()) {
      setWoundFormError('Anatomical location is required (e.g., "Left Heel").');
      return;
    }

    if (selectedPatient) {
      try {
        await addWound({
          patientId: selectedPatient.id,
          location: woundForm.location.trim(),
          description: woundForm.type,
        });

        setIsAddWoundOpen(false);
        setWoundForm({ location: '', type: 'Diabetic Foot Ulcer' });
      } catch (err: any) {
        setWoundFormError(err.message || 'Failed to register wound site');
      }
    }
  };

  const getHealingBadge = (status: string) => {
    switch (status) {
      case 'Improving':
        return <Badge variant="improving">Improving</Badge>;
      case 'Stable':
        return <Badge variant="stable">Stable</Badge>;
      case 'Requires Attention':
        return <Badge variant="attention">Requires Attention</Badge>;
      default:
        return <Badge variant="neutral">Unassessed</Badge>;
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">{error}</p>
      </div>
    );
  }

  if (isLoading || !selectedPatient) {
    return (
      <div className="text-center py-12 flex flex-col items-center justify-center">
         <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3"></div>
         <p className="text-sm text-slate-500">Loading patient details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BACK TO REGISTRY HEADER */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/patients')}
          className="bg-white border border-slate-200 rounded-md p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight font-mono">Patient: {selectedPatient.patientCode}</h2>
            <span className="text-slate-500 text-xs">No status available</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Name: {selectedPatient.name} • Age: {selectedPatient.age || 'Unknown'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: WOUNDS LIST (2/3 width on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          <Card
            title="Registered Wound Sites"
            headerAction={
              <Button
                size="sm"
                onClick={() => setIsAddWoundOpen(true)}
                className="flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Register Site
              </Button>
            }
          >
            {selectedPatientWounds.length === 0 ? (
              <div className="text-center py-8">
                <Layers className="w-10 h-10 text-slate-300 stroke-1 mx-auto mb-2" />
                <h4 className="font-semibold text-slate-700 text-xs">No Wounds Linked</h4>
                <p className="text-2xs text-slate-400 max-w-xs mx-auto mt-0.5">
                  Patients can have multiple wounds tracked simultaneously. Add a location to begin.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedPatientWounds.map(wound => {
                  const woundAss = selectedPatientAssessments.filter(a => a.woundId === wound.id);
                  
                  return (
                    <div
                      key={wound.id}
                      className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-350 transition-colors flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-slate-500">{wound.id}</span>
                          <span className="text-slate-500 text-xs">No status available</span>
                        </div>
                        <h4 className="font-semibold text-slate-800 text-sm mt-1.5">{wound.location}</h4>
                        <div className="text-2xs text-slate-500 mt-0.5">{wound.description || 'Unspecified'}</div>
                      </div>
                      
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">
                          Assessments: {woundAss.length}
                        </span>
                        <div className="flex gap-2 flex-wrap justify-end">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => navigate(`/wounds/${wound.id}`)}
                            className="text-[10px] py-1 px-2.5 cursor-pointer flex items-center gap-1"
                          >
                            View Details
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ASSESSMENT HISTORY */}
          <Card title="Assessment Logs">
            {selectedPatientAssessments.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No assessments have been recorded for this patient.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-5 -my-5">
                <table className="w-full border-collapse text-left text-xs md:text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-5">Assessment ID</th>
                      <th className="py-2.5 px-5">Wound ID</th>
                      <th className="py-2.5 px-5">Date</th>
                      <th className="py-2.5 px-5">AI Measurements</th>
                      <th className="py-2.5 px-5">Clinician Verification</th>
                      <th className="py-2.5 px-5">Wound Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {selectedPatientAssessments.map(ass => {
                      const area = ass.verifiedResult
                        ? ass.verifiedResult.measurements.areaCm2
                        : ass.aiResult?.measurements.areaCm2;
                      const dim = ass.verifiedResult
                        ? `${ass.verifiedResult.measurements.lengthCm}x${ass.verifiedResult.measurements.widthCm}`
                        : ass.aiResult
                        ? `${ass.aiResult.measurements.lengthCm}x${ass.aiResult.measurements.widthCm}`
                        : 'Pending';

                      const hStatus = ass.verifiedResult
                        ? 'Unassessed'
                        : 'Unassessed';

                      return (
                        <tr key={ass.id} className="hover:bg-slate-50/20">
                          <td className="py-2.5 px-5 font-mono font-medium text-slate-900">
                            <button onClick={() => navigate(`/assessments/${ass.id}`)} className="text-teal-600 hover:underline">{ass.id}</button>
                          </td>
                          <td className="py-2.5 px-5 font-mono text-slate-500">{ass.woundId}</td>
                          <td className="py-2.5 px-5">{ass.assessmentDate}</td>
                          <td className="py-2.5 px-5">
                            {area ? `${area} cm² (${dim})` : 'Pending'}
                          </td>
                          <td className="py-2.5 px-5">
                            {ass.status === 'Verified' ? (
                              <Badge variant="verified">Verified</Badge>
                            ) : (
                              <Badge variant="pending">Pending</Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-5">{getHealingBadge(hStatus)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN: QUICK PATIENT METRICS & REPORTS LIST (1/3 width) */}
        <div className="space-y-6">
          <Card title="Clinical Summary">
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100 space-y-2">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Demographics</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
                  <div>Clinical Code:</div>
                  <div className="font-mono font-semibold text-slate-900">{selectedPatient.patientCode}</div>
                  <div>Name:</div>
                  <div className="font-medium">{selectedPatient.name}</div>
                  <div>Age:</div>
                  <div className="font-medium">{selectedPatient.age || 'Unknown'}</div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Tracked Sites:</span>
                  <span className="font-semibold text-slate-800">{selectedPatientWounds.length}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Total Assessments:</span>
                  <span className="font-semibold text-slate-800">{selectedPatientAssessments.length}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Last Assessment Date:</span>
                  <span className="font-semibold text-slate-800">{selectedPatient.latestAssessmentDate || 'Never'}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* PATIENT REPORTS */}
          <Card
            title="Wound Reports"
            headerAction={
              selectedPatientWounds.length > 0 && (
                <button
                  onClick={() => navigate('/reports')}
                  className="text-xs text-teal-700 hover:text-teal-900 font-semibold cursor-pointer"
                >
                  All Reports
                </button>
              )
            }
          >
            {selectedPatientReports.length === 0 ? (
              <div className="text-center py-6 text-slate-450 text-xs">
                No reports generated for this patient.
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate('/reports')}
                    className="text-[10px] py-1 cursor-pointer"
                  >
                    Generate Report
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {selectedPatientReports.map(rep => (
                  <div
                    key={rep.id}
                    onClick={() => navigate(`/reports/${rep.id}`)}
                    className="flex items-center justify-between p-2.5 border border-slate-200 rounded-md bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate">Report {rep.id}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{wounds.find(w => w.id === Number(rep.woundId))?.location || 'Unknown Wound'} • {new Date(rep.assessmentDate).toLocaleDateString()}</div>
                    </div>
                    <Badge variant="verified">Final</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ADD WOUND MODAL */}
      <Modal
        isOpen={isAddWoundOpen}
        onClose={() => {
          setIsAddWoundOpen(false);
          setWoundFormError('');
        }}
        title="Register Wound Site"
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsAddWoundOpen(false);
                setWoundFormError('');
              }}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button onClick={handleAddWound} className="cursor-pointer">
              Link Site
            </Button>
          </div>
        }
      >
        <form onSubmit={handleAddWound} className="space-y-4">
          <Input
            label="Anatomical Location"
            placeholder="e.g. Left heel, sacrum, right shin..."
            value={woundForm.location}
            onChange={e => setWoundForm({ ...woundForm, location: e.target.value })}
            required
            autoFocus
          />

          <Select
            label="Wound Classification"
            value={woundForm.type}
            onChange={e => setWoundForm({ ...woundForm, type: e.target.value })}
          >
            <option value="Diabetic Foot Ulcer">Diabetic Foot Ulcer</option>
            <option value="Pressure Injury">Pressure Injury</option>
            <option value="Venous Leg Ulcer">Venous Leg Ulcer</option>
            <option value="Arterial Ulcer">Arterial Ulcer</option>
            <option value="Surgical Wound">Surgical Wound</option>
            <option value="Burn Wound">Burn Wound</option>
          </Select>

          {woundFormError && (
            <div className="text-xs text-rose-600 font-medium pt-1">
              {woundFormError}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};
