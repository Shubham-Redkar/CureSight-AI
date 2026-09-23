import React from 'react';
import { useWounds } from '../context/WoundContext';
import { Card } from '../components/ui';
import { Settings as SettingsIcon, ShieldCheck } from 'lucide-react';

export const Settings: React.FC = () => {
  const { settings } = useWounds();

  // Settings are centrally managed in Phase 15.
  // The UI now truthfully reflects that these cannot be edited by the end user via this interface.

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900 m-0 tracking-tight">Settings</h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure CureSight AI clinical parameters, safety protocols, and machine learning pipeline defaults.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-amber-50 text-amber-800 p-4 rounded-md border border-amber-200 flex gap-3 items-start">
          <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold text-sm">System-Managed Configuration</h3>
            <p className="text-xs mt-1 leading-relaxed">
              Diagnostic pipelines, institutional naming, practitioner roles, and security protocols (such as MFA) are currently managed centrally by your institution's system administrator.
              <br/><br/>
              These settings cannot be modified directly from this clinical dashboard. Please contact IT Support to request configuration changes.
            </p>
          </div>
        </div>

        <Card
          title={
            <div className="flex items-center gap-2 text-slate-500">
              <SettingsIcon className="w-4 h-4" />
              <span>Current Applied Configuration (Read-Only)</span>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 text-xs">
            <div>
              <div className="font-semibold text-slate-800">Clinic / Center Name</div>
              <div className="text-slate-500 mt-1">{settings.clinicName}</div>
            </div>
            <div>
              <div className="font-semibold text-slate-800">Default Practitioner Role</div>
              <div className="text-slate-500 mt-1">{settings.practitionerRole}</div>
            </div>
            <div>
              <div className="font-semibold text-slate-800">Trigger Auto-Analysis</div>
              <div className="text-slate-500 mt-1">Disabled (Manual trigger required)</div>
            </div>
            <div>
              <div className="font-semibold text-slate-800">Longitudinal Alert Flag</div>
              <div className="text-slate-500 mt-1">Disabled</div>
            </div>
            <div>
              <div className="font-semibold text-slate-800">Two-Factor Authentication (MFA)</div>
              <div className="text-slate-500 mt-1">Enforced at Identity Provider level</div>
            </div>
          </div>
        </Card>
      </div>

      {/* FOOTER */}
      <div className="pt-8 text-center border-t border-slate-200 mt-8 text-xs text-slate-400">
        <div className="font-semibold text-slate-500 mb-0.5">CureSight AI</div>
        <div>AI-Powered Wound Assessment & Progress Monitoring</div>
        <div className="mt-1">Clinical decision-support prototype</div>
      </div>
    </div>
  );
};
