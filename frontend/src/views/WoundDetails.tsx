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

  // Find the latest tissue analysis
  const tissueAssessments = woundAssessments.filter(a => a.notes === 'Tissue Analysis' || (a.measurements && a.measurements.tissue_composition));
  const latestTissueAnalysis = tissueAssessments.sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime())[0];
  const comp = latestTissueAnalysis?.measurements?.tissue_composition;

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
        <h3 className="text-lg font-bold text-slate-900 mb-4">Tissue Analysis</h3>
        <Card>
          {!latestTissueAnalysis || !comp ? (
            <div className="text-center py-6">
              <p className="text-slate-500 mb-4">No tissue analysis available.</p>
              {(user?.role === 'DOCTOR' || user?.role === 'ADMIN') && (
                <Button
                  onClick={() => navigate(`/wounds/${wound.id}/tissue`)}
                  className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Analyze Tissue
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-800">Latest Analysis ({new Date(latestTissueAnalysis.assessmentDate).toLocaleDateString()})</h4>
                <Button
                  onClick={() => navigate(`/wounds/${wound.id}/tissue?assessmentId=${latestTissueAnalysis.id}`)}
                  variant="secondary"
                  className="cursor-pointer text-blue-600 border-blue-200 hover:bg-blue-50"
                  size="sm"
                >
                  View Tissue Analysis
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                {comp.granulation > 0 && (
                  <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <div className="text-xs text-slate-500">Granulation</div>
                    <div className="text-lg font-bold text-red-600">{comp.granulation.toFixed(1)}%</div>
                  </div>
                )}
                {comp.slough > 0 && (
                  <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <div className="text-xs text-slate-500">Slough</div>
                    <div className="text-lg font-bold text-yellow-600">{comp.slough.toFixed(1)}%</div>
                  </div>
                )}
                {comp.necrotic > 0 && (
                  <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <div className="text-xs text-slate-500">Necrotic</div>
                    <div className="text-lg font-bold text-slate-800">{comp.necrotic.toFixed(1)}%</div>
                  </div>
                )}
                {comp.epithelial > 0 && (
                  <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <div className="text-xs text-slate-500">Epithelial</div>
                    <div className="text-lg font-bold text-pink-500">{comp.epithelial.toFixed(1)}%</div>
                  </div>
                )}
                {comp.callus > 0 && (
                  <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <div className="text-xs text-slate-500">Callus</div>
                    <div className="text-lg font-bold text-slate-400">{comp.callus.toFixed(1)}%</div>
                  </div>
                )}
                {comp.fibrin > 0 && (
                  <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <div className="text-xs text-slate-500">Fibrin</div>
                    <div className="text-lg font-bold text-yellow-400">{comp.fibrin.toFixed(1)}%</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
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
