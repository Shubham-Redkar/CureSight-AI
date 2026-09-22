import React from 'react';
import { useWounds } from '../context/WoundContext';
import { Card, Badge, Button } from '../components/ui';
import { Plus, Users, ShieldAlert, Activity, CheckCircle, ArrowRight, ClipboardCheck } from 'lucide-react';

interface DashboardProps {
  setActiveTab: (tab: string) => void;
  setSelectedPatientId: (id: string | null) => void;
  setSelectedWoundId: (id: string | null) => void;
  setSelectedAssessmentId: (id: string | null) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  setActiveTab,
  setSelectedPatientId,
  setSelectedWoundId,
  setSelectedAssessmentId,
}) => {
  const { patients, wounds, assessments } = useWounds();

  // Metrics calculation
  const totalPatients = patients.length;
  const activeWounds = wounds.length;
  
  const pendingAssessments = assessments.filter(
    a => a.status === 'Pending Analysis' || a.status === 'Pending Verification' || a.status === 'Analysis Completed'
  ).length;
  
  const completedAssessments = assessments.filter(a => a.status === 'Verified').length;

  const recentAssessments = assessments.slice(0, 5);

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

  const getReviewBadge = (status: string) => {
    switch (status) {
      case 'Verified':
        return <Badge variant="verified">Verified</Badge>;
      default:
        return <Badge variant="pending">Pending Review</Badge>;
    }
  };

  const handleAction = (assessment: any) => {
    setSelectedPatientId(assessment.patientId);
    setSelectedWoundId(assessment.woundId);
    setSelectedAssessmentId(assessment.id);
    setActiveTab('assessment');
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 m-0 tracking-tight">Clinical Dashboard</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time wound monitoring, AI-based segmentation tracking, and clinician-verified progress diagnostics.
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedPatientId(null);
            setSelectedWoundId(null);
            setSelectedAssessmentId(null);
            setActiveTab('assessment');
          }}
          className="flex items-center gap-1.5 shrink-0 self-start md:self-center cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Wound Assessment
        </Button>
      </div>

      {/* SYSTEM METRICS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-0">
          <div className="flex items-center gap-4 p-4 md:p-5">
            <div className="bg-teal-50 p-2 md:p-3 rounded-lg border border-teal-100 shrink-0">
              <Users className="w-5 h-5 text-teal-750" />
            </div>
            <div className="min-w-0">
              <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Total Patients</div>
              <div className="text-lg md:text-2xl font-bold text-slate-950 mt-0.5">{totalPatients}</div>
            </div>
          </div>
        </Card>

        <Card className="p-0">
          <div className="flex items-center gap-4 p-4 md:p-5">
            <div className="bg-blue-50 p-2 md:p-3 rounded-lg border border-blue-100 shrink-0">
              <Activity className="w-5 h-5 text-blue-750" />
            </div>
            <div className="min-w-0">
              <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Active Wounds</div>
              <div className="text-lg md:text-2xl font-bold text-slate-950 mt-0.5">{activeWounds}</div>
            </div>
          </div>
        </Card>

        <Card className="p-0">
          <div className="flex items-center gap-4 p-4 md:p-5">
            <div className="bg-amber-50 p-2 md:p-3 rounded-lg border border-amber-100 shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-755" />
            </div>
            <div className="min-w-0">
              <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Pending Review</div>
              <div className="text-lg md:text-2xl font-bold text-slate-950 mt-0.5">{pendingAssessments}</div>
            </div>
          </div>
        </Card>

        <Card className="p-0">
          <div className="flex items-center gap-4 p-4 md:p-5">
            <div className="bg-emerald-50 p-2 md:p-3 rounded-lg border border-emerald-100 shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-755" />
            </div>
            <div className="min-w-0">
              <div className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">Verified Records</div>
              <div className="text-lg md:text-2xl font-bold text-slate-950 mt-0.5">{completedAssessments}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* RECENT ASSESSMENTS TABLE */}
      <Card title="Recent Wound Assessments" className="overflow-hidden">
        {recentAssessments.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center justify-center">
            <ClipboardCheck className="w-12 h-12 text-slate-350 stroke-1 mb-3" />
            <h3 className="font-semibold text-slate-700 text-sm">No Assessments Filed Yet</h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              To begin, register a patient in the Patients tab and start a clinical wound assessment.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setActiveTab('patients')}
              className="mt-4 flex items-center gap-1 cursor-pointer"
            >
              Go to Patients
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 -my-5">
            <table className="w-full border-collapse text-left text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Patient ID</th>
                  <th className="py-3 px-5">Wound ID</th>
                  <th className="py-3 px-5">Assessment Date</th>
                  <th className="py-3 px-5">Anatomical Location</th>
                  <th className="py-3 px-5">Healing Status</th>
                  <th className="py-3 px-5">Review Status</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentAssessments.map(item => {
                  const wound = wounds.find(w => w.id === item.woundId);
                  
                  // Healing status calculation
                  const healingStatus = (item.status === 'Verified' 
                    ? item.verifiedResult?.healingStatus 
                    : item.aiResult?.healingStatus) || 'Stable';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-5 font-mono font-medium text-slate-900">{item.patientId}</td>
                      <td className="py-3 px-5 font-mono text-slate-600">{item.woundId}</td>
                      <td className="py-3 px-5">{item.date}</td>
                      <td className="py-3 px-5 font-medium text-slate-800">{wound?.location || 'Unspecified'}</td>
                      <td className="py-3 px-5">{getHealingBadge(healingStatus)}</td>
                      <td className="py-3 px-5">{getReviewBadge(item.status)}</td>
                      <td className="py-3 px-5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction(item)}
                          className="text-teal-700 hover:text-teal-900 hover:bg-teal-50/50 py-1 px-2.5 cursor-pointer font-medium"
                        >
                          {item.status === 'Verified' ? 'View' : 'Review'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
