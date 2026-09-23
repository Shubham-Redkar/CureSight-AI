import { useState } from 'react';
import { WoundProvider, useWounds } from './context/WoundContext';
import { Shell } from './components/layout/Shell';
import { Dashboard } from './views/Dashboard';
import { Patients } from './views/Patients';
import { WoundAssessment } from './views/WoundAssessment';
import { ProgressAnalysis } from './views/ProgressAnalysis';
import { Reports } from './views/Reports';
import { Settings } from './views/Settings';
import { Login } from './views/Login';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedWoundId, setSelectedWoundId] = useState<string | null>(null);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);

  const { settings } = useWounds();

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            setActiveTab={setActiveTab}
            setSelectedPatientId={setSelectedPatientId}
            setSelectedWoundId={setSelectedWoundId}
            setSelectedAssessmentId={setSelectedAssessmentId}
          />
        );
      case 'patients':
        return (
          <Patients
            selectedPatientId={selectedPatientId}
            setSelectedPatientId={setSelectedPatientId}
            setSelectedWoundId={setSelectedWoundId}
            setActiveTab={setActiveTab}
          />
        );
      case 'assessment':
        return (
          <WoundAssessment
            selectedPatientId={selectedPatientId}
            setSelectedPatientId={setSelectedPatientId}
            selectedWoundId={selectedWoundId}
            setSelectedWoundId={setSelectedWoundId}
            selectedAssessmentId={selectedAssessmentId}
            setSelectedAssessmentId={setSelectedAssessmentId}
            setActiveTab={setActiveTab}
          />
        );
      case 'progress':
        return (
          <ProgressAnalysis
            selectedPatientId={selectedPatientId}
            setSelectedPatientId={setSelectedPatientId}
            selectedWoundId={selectedWoundId}
            setSelectedWoundId={setSelectedWoundId}
            setActiveTab={setActiveTab}
          />
        );
      case 'reports':
        return (
          <Reports
            selectedPatientId={selectedPatientId}
            setSelectedPatientId={setSelectedPatientId}
            selectedWoundId={selectedWoundId}
            setSelectedWoundId={setSelectedWoundId}
            setActiveTab={setActiveTab}
          />
        );
      case 'settings':
        return <Settings />;
      default:
        return (
          <Dashboard
            setActiveTab={setActiveTab}
            setSelectedPatientId={setSelectedPatientId}
            setSelectedWoundId={setSelectedWoundId}
            setSelectedAssessmentId={setSelectedAssessmentId}
          />
        );
    }
  };

  return (
    <Shell
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      clinicName={settings.clinicName}
      practitionerRole={settings.practitionerRole}
    >
      {renderContent()}
    </Shell>
  );
}

function AuthBoundary() {
  const { authenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!authenticated) {
    return <Login />;
  }

  return (
    <WoundProvider>
      <AppContent />
    </WoundProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthBoundary />
    </AuthProvider>
  );
}

export default App;
