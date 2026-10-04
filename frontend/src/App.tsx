import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WoundProvider, useWounds } from './context/WoundContext';
import { Shell } from './components/layout/Shell';
import { Dashboard } from './views/Dashboard';
import { Patients } from './views/Patients';
import { WoundDetails } from './views/WoundDetails';
import { NewAssessment } from './views/NewAssessment';
import { Settings } from './views/Settings';
import { Login } from './views/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import React, { Suspense } from 'react';

const PatientDetailsLazy = React.lazy(() => import('./views/PatientDetails').then(m => ({ default: m.PatientDetails })));
const AssessmentDetailLazy = React.lazy(() => import('./views/AssessmentDetail').then(m => ({ default: m.AssessmentDetail })));
const TissueAnalysisLazy = React.lazy(() => import('./views/TissueAnalysis').then(m => ({ default: m.TissueAnalysis })));
const ProgressAnalysisLazy = React.lazy(() => import('./views/ProgressAnalysis').then(m => ({ default: m.ProgressAnalysis })));
const ReportsLazy = React.lazy(() => import('./views/Reports').then(m => ({ default: m.Reports })));
const ReportDetailLazy = React.lazy(() => import('./views/ReportDetail').then(m => ({ default: m.ReportDetail })));

function AppContent() {
  const { settings } = useWounds();

  return (
    <Shell clinicName={settings.clinicName} practitionerRole={settings.practitionerRole}>
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* Patients & Wounds Flows */}
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:patientId" element={<PatientDetailsLazy />} />
        
        <Route path="/wounds/:woundId" element={<WoundDetails />} />
        <Route path="/wounds/:woundId/progress" element={<ProgressAnalysisLazy />} />
        <Route path="/wounds/:woundId/tissue" element={<TissueAnalysisLazy />} />

        {/* Assessment Flow */}
        <Route path="/assessments/new" element={<NewAssessment />} />
        <Route path="/assessments/:assessmentId" element={<AssessmentDetailLazy />} />

        {/* Reports */}
        <Route path="/reports" element={<ReportsLazy />} />
        <Route path="/reports/:reportId" element={<ReportDetailLazy />} />

        {/* Settings */}
        <Route path="/settings" element={<Settings />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </Suspense>
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
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
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
      <BrowserRouter>
        <AuthBoundary />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
