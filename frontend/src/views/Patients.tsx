import React, { useState } from 'react';
import { useWounds } from '../context/WoundContext';
import { Card, Badge, Button, Input, Select, Modal } from '../components/ui';
import {
  Search,
  Plus,
  Users,
  ChevronLeft,
  Layers,
  ArrowRight,
  AlertCircle
} from 'lucide-react';


interface PatientsProps {
  selectedPatientId: string | null;
  setSelectedPatientId: (id: string | null) => void;
  setSelectedWoundId: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
}

export const Patients: React.FC<PatientsProps> = ({
  selectedPatientId,
  setSelectedPatientId,
  setSelectedWoundId,
  setActiveTab,
}) => {
  const { patients, wounds, assessments, addPatient, addWound, isLoading, error } = useWounds();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isAddWoundOpen, setIsAddWoundOpen] = useState(false);

  // New Patient Form state
  const [patientForm, setPatientForm] = useState({
    patientCode: '',
    name: '',
    age: '',
  });
  const [patientFormError, setPatientFormError] = useState('');

  // New Wound Form state
  const [woundForm, setWoundForm] = useState({
    location: '',
    type: 'Diabetic Foot Ulcer',
  });
  const [woundFormError, setWoundFormError] = useState('');

  // Registration handler
  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setPatientFormError('');

    if (!patientForm.patientCode.trim()) {
      setPatientFormError('Patient Code is required.');
      return;
    }
    const cleanCode = patientForm.patientCode.trim().toUpperCase();
    if (patients.some(p => p.patientCode === cleanCode)) {
      setPatientFormError('A patient with this Clinical Code already exists.');
      return;
    }
    if (!patientForm.name.trim()) {
      setPatientFormError('Patient Name is required.');
      return;
    }

    try {
      await addPatient({
        patientCode: cleanCode,
        name: patientForm.name.trim(),
        age: patientForm.age ? parseInt(patientForm.age) : null,
      });

      setIsRegisterOpen(false);
      setPatientForm({ patientCode: '', name: '', age: '' });
    } catch (err: any) {
      setPatientFormError(err.message || 'Failed to register patient');
    }
  };

  // Add Wound handler
  const handleAddWound = async (e: React.FormEvent) => {
    e.preventDefault();
    setWoundFormError('');

    if (!woundForm.location.trim()) {
      setWoundFormError('Anatomical location is required (e.g., "Left Heel").');
      return;
    }

    if (selectedPatientId) {
      const selectedPatient = patients.find(p => p.id === Number(selectedPatientId));
      if (!selectedPatient) return;
      
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

  // Filtered Patients List
  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.patientCode.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter ? p.overallHealingStatus === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  const selectedPatient = patients.find(p => p.id === Number(selectedPatientId));
  const selectedPatientWounds = wounds.filter(w => w.patientId === Number(selectedPatientId));
  const selectedPatientAssessments = assessments.filter(a => {
    const w = selectedPatientWounds.find(wound => wound.id === a.woundId);
    return !!w;
  });
  const selectedPatientReports = assessments.filter(a => 
    wounds.find(w => w.id === Number(a.woundId))?.patientId === Number(selectedPatientId) && 
    (a.status === 'Analysis Completed' || a.status === 'COMPLETED')
  );

  // Age is now directly on the model, removing getAge calculation

  return (
    <div className="space-y-6">
      {/* 1. ERROR AND LOADING STATES */}
      {error && !selectedPatient && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      {isLoading && !selectedPatient && !error && (
        <div className="text-center py-12 flex flex-col items-center justify-center">
           <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3"></div>
           <p className="text-sm text-slate-500">Loading patients...</p>
        </div>
      )}

      {/* 2. LIST VIEW */}
      {!selectedPatient && !isLoading && !error && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 m-0 tracking-tight">Patient Registry</h2>
              <p className="text-xs text-slate-500 mt-1">
                Clinical records database. Select a patient ID to view active wound locations, histories, and analytics.
              </p>
            </div>
            <Button
              onClick={() => setIsRegisterOpen(true)}
              className="flex items-center gap-1.5 shrink-0 self-start md:self-center cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Register Patient ID
            </Button>
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search by code or name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50/50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-teal-500 focus:bg-white text-slate-800"
              />
            </div>
            <Select
              className="py-1.5 text-xs bg-slate-50/50"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All Healing Statuses</option>
              <option value="Improving">Improving</option>
              <option value="Stable">Stable</option>
              <option value="Requires Attention">Requires Attention</option>
              <option value="Unassessed">Unassessed</option>
            </Select>
          </div>

          {/* PATIENTS TABLE */}
          <Card className="overflow-hidden">
            {filteredPatients.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center justify-center">
                <Users className="w-12 h-12 text-slate-350 stroke-1 mb-3" />
                <h3 className="font-semibold text-slate-700 text-sm">No Patients Found</h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  {searchQuery || statusFilter
                    ? 'Adjust your query or filters to search for clinical records.'
                    : 'The patient registry is empty. Add a clinical ID to start.'}
                </p>
                {!searchQuery && !statusFilter && (
                  <Button
                    size="sm"
                    onClick={() => setIsRegisterOpen(true)}
                    className="mt-4 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Register Patient ID
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-5 -my-5">
                <table className="w-full border-collapse text-left text-xs md:text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-5">Patient Code</th>
                      <th className="py-3 px-5">Name</th>
                      <th className="py-3 px-5">Age</th>
                      <th className="py-3 px-5">Active Wounds</th>
                      <th className="py-3 px-5">Latest Assessment</th>
                      <th className="py-3 px-5">Overall Status</th>
                      <th className="py-3 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredPatients.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-5 font-mono font-bold text-slate-900">{p.patientCode}</td>
                        <td className="py-3 px-5">{p.name}</td>
                        <td className="py-3 px-5">{p.age || 'Unknown'}</td>
                        <td className="py-3 px-5 font-medium">{p.woundsCount}</td>
                        <td className="py-3 px-5">{p.latestAssessmentDate || 'None'}</td>
                        <td className="py-3 px-5">{getHealingBadge(p.overallHealingStatus ?? 'Unassessed')}</td>
                        <td className="py-3 px-5 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedPatientId(String(p.id))}
                            className="cursor-pointer text-xs"
                          >
                            Open Records
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 3. DETAIL VIEW */}
      {selectedPatient && (
        <div className="space-y-6">
          {/* BACK TO REGISTRY HEADER */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedPatientId(null)}
              className="bg-white border border-slate-200 rounded-md p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight font-mono">Patient: {selectedPatient.patientCode}</h2>
                {getHealingBadge(selectedPatient.overallHealingStatus ?? 'Unassessed')}
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
                    <h4 className="font-semibold text-slate-700 text-xs">No Wound Records Linked</h4>
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
                              {getHealingBadge(wound.status ?? 'Unavailable')}
                            </div>
                            <h4 className="font-semibold text-slate-800 text-sm mt-1.5">{wound.location}</h4>
                            <div className="text-2xs text-slate-500 mt-0.5">{wound.description || 'N/A'}</div>
                          </div>
                          
                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">
                              Assessments: {woundAss.length}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setSelectedWoundId(String(wound.id));
                                  setActiveTab('progress');
                                }}
                                className="text-[10px] py-1 px-2.5 cursor-pointer flex items-center gap-1"
                              >
                                View Trend
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedWoundId(String(wound.id));
                                  setSelectedPatientId(String(selectedPatient.id));
                                  setActiveTab('assessment');
                                }}
                                className="text-[10px] py-1 px-2.5 cursor-pointer bg-teal-700 hover:bg-teal-800 text-white"
                              >
                                Assess
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
                          <th className="py-2.5 px-5">Healing Status</th>
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
                            ? ass.verifiedResult.healingStatus
                            : ass.aiResult?.healingStatus ?? 'Unassessed';

                          return (
                            <tr key={ass.id} className="hover:bg-slate-50/20">
                              <td className="py-2.5 px-5 font-mono font-medium text-slate-900">{ass.id}</td>
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
                      onClick={() => setActiveTab('reports')}
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
                        onClick={() => setActiveTab('reports')}
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
                        onClick={() => setActiveTab('reports')}
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
        </div>
      )}

      {/* REGISTER PATIENT ID MODAL */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => {
          setIsRegisterOpen(false);
          setPatientFormError('');
        }}
        title="Register Patient ID"
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsRegisterOpen(false);
                setPatientFormError('');
              }}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button onClick={handleRegisterPatient} className="cursor-pointer">
              Register ID
            </Button>
          </div>
        }
      >
        <form onSubmit={handleRegisterPatient} className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-2xs text-slate-500 flex gap-2 mb-2 items-start">
            <AlertCircle className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <strong>Security Protocol:</strong> Patient identification must rely strictly on unique clinical IDs (e.g. PT-0123). Do not enter names or physical identification fields to ensure HIPAA/GDPR clinical privacy compliance.
            </div>
          </div>

          <Input
            label="Patient Code"
            placeholder="PT-0001"
            value={patientForm.patientCode}
            onChange={e => setPatientForm({ ...patientForm, patientCode: e.target.value })}
            required
          />

          <Input
            label="Full Name"
            placeholder="Jane Doe"
            value={patientForm.name}
            onChange={e => setPatientForm({ ...patientForm, name: e.target.value })}
            required
          />

          <Input
            label="Age"
            type="number"
            placeholder="45"
            value={patientForm.age}
            onChange={e => setPatientForm({ ...patientForm, age: e.target.value })}
          />

          {patientFormError && (
            <div className="text-xs text-rose-600 font-medium pt-1">
              {patientFormError}
            </div>
          )}
        </form>
      </Modal>

      {/* ADD WOUND RECORD MODAL */}
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
