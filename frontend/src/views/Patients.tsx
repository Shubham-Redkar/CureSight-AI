import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWounds } from '../context/WoundContext';
import { Card, Button, Input, Select, Modal } from '../components/ui';
import { Search, Plus, Users, AlertCircle } from 'lucide-react';

export const Patients: React.FC = () => {
  const { patients, addPatient, isLoading, error } = useWounds();
  const navigate = useNavigate();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  // New Patient Form state
  const [patientForm, setPatientForm] = useState({
    patientCode: '',
    name: '',
    age: '',
  });
  const [patientFormError, setPatientFormError] = useState('');

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

  // Filtered Patients List
  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.patientCode.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* 1. ERROR AND LOADING STATES */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      {isLoading && !error && (
        <div className="text-center py-12 flex flex-col items-center justify-center">
           <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3"></div>
           <p className="text-sm text-slate-500">Loading patients...</p>
        </div>
      )}

      {/* 2. LIST VIEW */}
      {!isLoading && !error && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 m-0 tracking-tight">Patients</h2>
              <p className="text-xs text-slate-500 mt-1">
                Manage patient profiles and associated wound assessments.
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
                <h3 className="font-semibold text-slate-700 text-sm">No patients yet</h3>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  {searchQuery || statusFilter
                    ? 'Adjust your query or filters to search for patients.'
                    : 'Add a clinical ID to start.'}
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
                        <td className="py-3 px-5 text-slate-500">None</td>
                        <td className="py-3 px-5 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/patients/${p.id}`)}
                            className="cursor-pointer text-xs"
                          >
                            Open Assessments
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
    </div>
  );
};
