import React, { useState } from 'react';
import { useWounds } from '../context/WoundContext';
import { Card, Button, Input, Select } from '../components/ui';
import { Settings as SettingsIcon, ShieldCheck, Mail, Sliders, Save, Check } from 'lucide-react';

export const Settings: React.FC = () => {
  const { settings, updateSettings } = useWounds();

  // Local Form states
  const [clinicName, setClinicName] = useState(settings.clinicName);
  const [practitionerRole, setPractitionerRole] = useState(settings.practitionerRole);
  const [enableNotifications, setEnableNotifications] = useState(settings.enableNotifications);
  const [securityMfa, setSecurityMfa] = useState(settings.securityMfa);
  const [autoAnalyze, setAutoAnalyze] = useState(settings.autoAnalyze);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      clinicName,
      practitionerRole,
      enableNotifications,
      securityMfa,
      autoAnalyze,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900 m-0 tracking-tight">Application Settings</h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure clinical parameters, safety protocols, and machine learning pipeline defaults.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* CLINICAL ACCOUNT SETTINGS */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-teal-700" />
              <span>Clinic & Account Setup</span>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <Input
              label="Clinic / Center Name"
              value={clinicName}
              onChange={e => setClinicName(e.target.value)}
              required
            />
            <Select
              label="Default Practitioner Role"
              value={practitionerRole}
              onChange={e => setPractitionerRole(e.target.value)}
            >
              <option value="Wound Care Specialist">Wound Care Specialist</option>
              <option value="Registered Nurse (RN)">Registered Nurse (RN)</option>
              <option value="Plastic Surgeon">Plastic Surgeon</option>
              <option value="Primary Care Physician">Primary Care Physician</option>
              <option value="Clinical Researcher">Clinical Researcher</option>
            </Select>
          </div>
        </Card>

        {/* DIAGNOSTIC ENGINE PREFERENCES */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-700" />
              <span>Automated Diagnostics Preferences</span>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="max-w-md">
                <h4 className="font-semibold text-slate-800 text-xs">Trigger Auto-Analysis</h4>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Automatically start the YOLO/U-Net segmentation pipeline as soon as a new wound photograph is uploaded.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoAnalyze}
                  onChange={e => setAutoAnalyze(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-750"></div>
              </label>
            </div>
          </div>
        </Card>

        {/* NOTIFICATION SETTINGS */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-teal-700" />
              <span>Communications & Notifications</span>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="max-w-md">
                <h4 className="font-semibold text-slate-800 text-xs">Longitudinal Alert Flag</h4>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Flag active patients with alerts on the dashboard when their overall healing trend degrades or requires attention.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableNotifications}
                  onChange={e => setEnableNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-750"></div>
              </label>
            </div>
          </div>
        </Card>

        {/* SECURITY & COMPLIANCE */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-700" />
              <span>Security & Compliance</span>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="max-w-md">
                <h4 className="font-semibold text-slate-800 text-xs">Two-Factor Authentication (MFA)</h4>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Require MFA validation for all clinician logins to comply with strict HIPAA audit controls.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={securityMfa}
                  onChange={e => setSecurityMfa(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-750"></div>
              </label>
            </div>
          </div>
        </Card>

        {/* SAVE ACTION ACTIONS */}
        <div className="flex items-center justify-end gap-3 pt-4">
          {savedSuccess && (
            <span className="text-xs text-teal-750 font-semibold flex items-center gap-1">
              <Check className="w-4 h-4" />
              Configurations updated successfully.
            </span>
          )}
          <Button
            type="submit"
            className="flex items-center gap-2 cursor-pointer bg-teal-700 hover:bg-teal-800 text-white"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};
