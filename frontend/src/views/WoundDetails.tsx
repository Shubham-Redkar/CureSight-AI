import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWounds } from '../context/WoundContext';
import { useAuth } from '../context/AuthContext';
import { Card, Button } from '../components/ui';
import { ChevronLeft } from 'lucide-react';

export const WoundDetails: React.FC = () => {
  const { woundId } = useParams<{ woundId: string }>();
  const navigate = useNavigate();
  const { wounds, patients, assessments, isLoading, error } = useWounds();
  const { user } = useAuth();

  const wound = wounds.find(w => w.id === Number(woundId));
  const patient = wound ? patients.find(p => p.id === wound.patientId) : null;
  const woundAssessments = assessments.filter(a => a.woundId === Number(woundId));

  if (error) {
    return <div className="text-red-500 py-12 text-center">{error}</div>;
  }

  if (isLoading || !wound || !patient) {
    return <div className="text-center py-12 text-slate-500">Loading wound details...</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/patients/${patient.id}`)}
          className="bg-white border border-slate-200 rounded-md p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Wound Details</h2>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-xs border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
              <span className="text-orange-700 font-bold">W</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{wound.location}</h3>
              <p className="text-sm text-slate-500">Wound ID: {wound.id} • Patient: {patient.patientCode}</p>
            </div>
          </div>
          
          <div className="flex gap-2 flex-col sm:flex-row w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={() => navigate(`/wounds/${wound.id}/progress`)}
              className="cursor-pointer"
            >
              View Analytics
            </Button>
            
            {(user?.role === 'DOCTOR' || user?.role === 'ADMIN') && (
              <Button
                onClick={() => navigate(`/wounds/${wound.id}/tissue`)}
                className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
              >
                Analyze Tissue
              </Button>
            )}

            <Button
              onClick={() => navigate(`/assessments/new?woundId=${wound.id}&patientId=${patient.id}`)}
              className="cursor-pointer bg-teal-700 text-white hover:bg-teal-800"
            >
              Analyze New Image
            </Button>
          </div>
        </div>
        
        {wound.description && (
          <div className="mt-6">
            <h4 className="text-sm font-bold text-slate-700">Description</h4>
            <p className="text-base mt-1 text-slate-800">{wound.description}</p>
          </div>
        )}
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Assessments</h3>
        
        {woundAssessments.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-slate-500 mb-2">No assessments yet.</p>
              <p className="text-sm text-slate-400">Click "Analyze New Image" to begin.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {woundAssessments.map(ass => (
              <Card key={ass.id} className="p-0 overflow-hidden cursor-pointer hover:border-slate-350 transition-colors">
                <div 
                  className="p-4 flex items-center justify-between"
                  onClick={() => navigate(`/assessments/${ass.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${ass.status === 'COMPLETED' || ass.status === 'Verified' ? 'bg-green-50' : 'bg-amber-50'}`}>
                       {ass.status === 'COMPLETED' || ass.status === 'Verified' ? <span className="text-green-600 font-bold">✓</span> : <span className="text-amber-600 font-bold">!</span>}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{new Date(ass.assessmentDate).toLocaleString()}</h4>
                      <p className="text-sm text-slate-500">Status: {ass.status}</p>
                      {ass.woundDetected === false && (
                        <p className="text-sm text-red-500">Result: No wound detected</p>
                      )}
                    </div>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-slate-400 transform rotate-180" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
