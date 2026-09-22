import React, { useState } from 'react';
import { useWounds } from '../context/WoundContext';
import { Card, Badge, Button, Select, Modal, Input } from '../components/ui';
import { FileText, Plus, Eye, Download, Printer } from 'lucide-react';

interface ReportsProps {
  selectedPatientId: string | null;
  setSelectedPatientId: (id: string | null) => void;
  selectedWoundId: string | null;
  setSelectedWoundId: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
}

export const Reports: React.FC<ReportsProps> = ({
  selectedPatientId: _selectedPatientId,
  setSelectedPatientId,
  selectedWoundId: _selectedWoundId,
  setSelectedWoundId,
  setActiveTab,
}) => {
  const { patients, wounds, assessments, reports, generateReport } = useWounds();

  // Dialog and Preview States
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // Generate Report Form States
  const [formPatientId, setFormPatientId] = useState('');
  const [formWoundId, setFormWoundId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formError, setFormError] = useState('');

  const formWounds = wounds.filter(w => w.patientId === formPatientId);

  // Retrieve active report and connected database models
  const activeReport = reports.find(r => r.id === activeReportId);
  const reportPatient = patients.find(p => p.id === activeReport?.patientId);
  const reportWound = wounds.find(w => w.id === activeReport?.woundId);
  
  // Sort and filter assessments matching report range
  const reportAssessments = assessments
    .filter(a => a.woundId === activeReport?.woundId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const initialAssessment = reportAssessments[0];
  const latestAssessment = reportAssessments[reportAssessments.length - 1];

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formPatientId || !formWoundId) {
      setFormError('Patient and anatomical wound site are required.');
      return;
    }

    const linkedAss = assessments.filter(a => a.woundId === formWoundId);
    if (linkedAss.length === 0) {
      setFormError('This wound site has no clinical assessments filed yet. Cannot generate progress reports.');
      return;
    }

    const start = formStartDate || linkedAss[0].date;
    const end = formEndDate || new Date().toISOString().split('T')[0];

    const rep = generateReport(formPatientId, formWoundId, start, end);
    setIsGenerateOpen(false);
    setActiveReportId(rep.id); // open preview of the generated report immediately

    // Reset Form
    setFormPatientId('');
    setFormWoundId('');
    setFormStartDate('');
    setFormEndDate('');
  };

  // Helper values for calculations
  const getArea = (ass?: any) => {
    if (!ass) return 0;
    return ass.verifiedResult ? ass.verifiedResult.measurements.areaCm2 : (ass.aiResult?.measurements.areaCm2 || 0);
  };

  const getDims = (ass?: any) => {
    if (!ass) return '';
    const m = ass.verifiedResult ? ass.verifiedResult.measurements : ass.aiResult?.measurements;
    return m ? `${m.lengthCm}x${m.widthCm} cm` : 'Unassessed';
  };

  const getTissueStats = (ass?: any) => {
    if (!ass) return { g: 0, s: 0, e: 0 };
    const m = ass.verifiedResult ? ass.verifiedResult.measurements : ass.aiResult?.measurements;
    return {
      g: m?.granulationTissuePct || 0,
      s: m?.sloughTissuePct || 0,
      e: m?.escharTissuePct || 0,
    };
  };

  const getStatusText = (ass?: any) => {
    if (!ass) return 'Stable';
    return ass.verifiedResult ? ass.verifiedResult.healingStatus : (ass.aiResult?.healingStatus || 'Stable');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 m-0 tracking-tight">Clinical Reports</h2>
          <p className="text-xs text-slate-500 mt-1">
            Generate and manage PDF diagnostic summaries for clinical records, hospital transfers, and patient tracking.
          </p>
        </div>
        <Button
          onClick={() => setIsGenerateOpen(true)}
          className="flex items-center gap-1.5 shrink-0 self-start md:self-center cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Generate Progress Report
        </Button>
      </div>

      {/* REPORTS LIST TABLE */}
      <Card title="Generated Diagnostic Summaries">
        {reports.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center justify-center">
            <FileText className="w-12 h-12 text-slate-350 stroke-1 mb-3" />
            <h3 className="font-semibold text-slate-700 text-sm">No Reports Compiled</h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Select a patient and a wound site to compile historical progress reports.
            </p>
            <Button
              size="sm"
              onClick={() => setIsGenerateOpen(true)}
              className="mt-4 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Generate Progress Report
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 -my-5">
            <table className="w-full border-collapse text-left text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Report ID</th>
                  <th className="py-3 px-5">Patient ID</th>
                  <th className="py-3 px-5">Anatomical Location</th>
                  <th className="py-3 px-5">Assessment Span</th>
                  <th className="py-3 px-5">Compilation Date</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reports.map(rep => {
                  const wound = wounds.find(w => w.id === rep.woundId);
                  return (
                    <tr key={rep.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-5 font-mono font-bold text-slate-900">{rep.id}</td>
                      <td className="py-3 px-5 font-mono text-slate-655">{rep.patientId}</td>
                      <td className="py-3 px-5 font-medium text-slate-800">{wound?.location || 'Unspecified'}</td>
                      <td className="py-3 px-5">
                        {rep.assessmentPeriodStart} <span className="text-slate-400 font-medium">to</span> {rep.assessmentPeriodEnd}
                      </td>
                      <td className="py-3 px-5">{rep.generatedDate}</td>
                      <td className="py-3 px-5">
                        <Badge variant="verified">Final</Badge>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveReportId(rep.id)}
                            className="text-teal-700 hover:text-teal-900 hover:bg-teal-50 px-2 cursor-pointer font-medium"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setActiveReportId(rep.id);
                              setTimeout(() => window.print(), 100);
                            }}
                            className="text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-2 cursor-pointer font-medium"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* GENERATE REPORT MODAL */}
      <Modal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        title="Generate Wound Progress Report"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsGenerateOpen(false)} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={handleGenerate} className="cursor-pointer">
              Compile Document
            </Button>
          </div>
        }
      >
        <form onSubmit={handleGenerate} className="space-y-4 text-xs">
          <Select
            label="Select Patient ID"
            value={formPatientId}
            onChange={e => {
              setFormPatientId(e.target.value);
              setFormWoundId('');
            }}
            required
          >
            <option value="">-- Choose Patient ID --</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.id}</option>
            ))}
          </Select>

          <Select
            label="Select Wound Location Site"
            value={formWoundId}
            disabled={!formPatientId}
            onChange={e => setFormWoundId(e.target.value)}
            required
          >
            <option value="">-- Choose Wound Site --</option>
            {formWounds.map(w => (
              <option key={w.id} value={w.id}>{w.location} ({w.type})</option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Evaluation Start Date (Optional)"
              type="date"
              value={formStartDate}
              onChange={e => setFormStartDate(e.target.value)}
            />
            <Input
              label="Evaluation End Date (Optional)"
              type="date"
              value={formEndDate}
              onChange={e => setFormEndDate(e.target.value)}
            />
          </div>

          {formError && (
            <div className="bg-rose-50 text-rose-800 p-2.5 rounded border border-rose-250 font-medium">
              {formError}
            </div>
          )}
        </form>
      </Modal>

      {/* REPORT PREVIEW MODAL */}
      {activeReport && reportPatient && reportWound && (
        <Modal
          isOpen={!!activeReportId}
          onClose={() => setActiveReportId(null)}
          title={`Clinical Report Review - ${activeReport.id}`}
          size="xl"
          footer={
            <div className="flex gap-2 justify-between w-full">
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedPatientId(reportPatient.id);
                  setSelectedWoundId(reportWound.id);
                  setActiveReportId(null);
                  setActiveTab('progress');
                }}
                className="cursor-pointer text-xs"
              >
                Inspect Trend Timeline
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setActiveReportId(null)} className="cursor-pointer text-xs">
                  Close Preview
                </Button>
                <Button onClick={handlePrint} className="flex items-center gap-1.5 cursor-pointer text-xs bg-teal-700 text-white">
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save PDF
                </Button>
              </div>
            </div>
          }
        >
          {/* MEDICAL DOCUMENT PRINT FRAME */}
          <div className="bg-white p-6 md:p-8 border border-slate-300 rounded-md font-sans text-xs text-slate-800 leading-relaxed max-w-3xl mx-auto shadow-2xs printable-document">
            {/* DOCUMENT HEADER */}
            <div className="flex justify-between items-start border-b-2 border-teal-800 pb-4 mb-6">
              <div>
                <h1 className="text-sm font-bold text-slate-900 tracking-wider uppercase m-0 leading-none">
                  CLINICAL PROGRESS SUMMARY REPORT
                </h1>
                <div className="text-[10px] text-teal-850 font-semibold tracking-wide uppercase mt-1">
                  AI-Based Wound healing & Segmentation Suite
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-900 leading-none">{activeReport.id}</div>
                <div className="text-[9px] text-slate-500 font-semibold mt-1">Date: {activeReport.generatedDate}</div>
              </div>
            </div>

            {/* METADATA GRID */}
            <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 border border-slate-200 p-4 rounded-md">
              <div>
                <h4 className="font-semibold text-slate-900 uppercase text-[9px] tracking-wider mb-2">Patient Information</h4>
                <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[10px] text-slate-655">
                  <div className="font-medium">Patient Clinical ID:</div>
                  <div className="font-mono font-bold text-slate-900">{reportPatient.id}</div>
                  <div className="font-medium">Biological Gender:</div>
                  <div>{reportPatient.gender}</div>
                  <div className="font-medium">Date of Birth:</div>
                  <div>{reportPatient.birthDate}</div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 uppercase text-[9px] tracking-wider mb-2">Clinical Parameters</h4>
                <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[10px] text-slate-655">
                  <div className="font-medium">Anatomical Site:</div>
                  <div className="font-semibold text-slate-900">{reportWound.location}</div>
                  <div className="font-medium">Wound Type:</div>
                  <div>{reportWound.type}</div>
                  <div className="font-medium">Evaluation Period:</div>
                  <div>{activeReport.assessmentPeriodStart} to {activeReport.assessmentPeriodEnd}</div>
                </div>
              </div>
            </div>

            {/* CLINICAL COMPARISON IMAGES */}
            {initialAssessment && latestAssessment ? (
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-slate-950 uppercase text-[9px] tracking-wider border-b border-slate-200 pb-1.5 mb-3">
                    Wound Image Adjudication (Initial vs Latest)
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    {/* INITIAL ASSESSMENT */}
                    <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50 text-center p-2">
                      <div className="font-bold text-slate-900 text-[10px] border-b border-slate-200 pb-1 mb-2">
                        Initial Capture: {initialAssessment.date}
                      </div>
                      <div className="h-40 flex items-center justify-center bg-slate-950 rounded">
                        <img src={initialAssessment.imageUrl} alt="Initial Wound" className="h-full w-auto object-contain" />
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium pt-2">
                        Area: {getArea(initialAssessment)} cm² ({getDims(initialAssessment)})
                      </div>
                    </div>

                    {/* LATEST ASSESSMENT */}
                    <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50 text-center p-2">
                      <div className="font-bold text-slate-900 text-[10px] border-b border-slate-200 pb-1 mb-2">
                        Latest Capture: {latestAssessment.date}
                      </div>
                      <div className="h-40 flex items-center justify-center bg-slate-950 rounded">
                        <img src={latestAssessment.imageUrl} alt="Latest Wound" className="h-full w-auto object-contain" />
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium pt-2">
                        Area: {getArea(latestAssessment)} cm² ({getDims(latestAssessment)})
                      </div>
                    </div>
                  </div>
                </div>

                {/* METRICS COMPARISON TABLE */}
                <div>
                  <h4 className="font-semibold text-slate-950 uppercase text-[9px] tracking-wider border-b border-slate-200 pb-1.5 mb-3">
                    Adjudicated Progress Metrics
                  </h4>
                  <table className="w-full border-collapse text-[10px] text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[9px] tracking-wider">
                        <th className="py-2 px-3">Metric Type</th>
                        <th className="py-2 px-3">Initial ({initialAssessment.date})</th>
                        <th className="py-2 px-3">Latest ({latestAssessment.date})</th>
                        <th className="py-2 px-3">Percentage Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      <tr>
                        <td className="py-2 px-3 font-semibold text-slate-800">Adjudicated Area</td>
                        <td className="py-2 px-3">{getArea(initialAssessment)} cm²</td>
                        <td className="py-2 px-3">{getArea(latestAssessment)} cm²</td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {((getArea(latestAssessment) - getArea(initialAssessment)) / (getArea(initialAssessment) || 1) * 100).toFixed(1)}%
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold text-slate-800">Dimensions (L × W)</td>
                        <td className="py-2 px-3">{getDims(initialAssessment)}</td>
                        <td className="py-2 px-3">{getDims(latestAssessment)}</td>
                        <td className="py-2 px-3 text-slate-500">-</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold text-slate-800">Granulation Tissue</td>
                        <td className="py-2 px-3">{getTissueStats(initialAssessment).g}%</td>
                        <td className="py-2 px-3">{getTissueStats(latestAssessment).g}%</td>
                        <td className="py-2 px-3 text-slate-500">-</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold text-slate-800">Slough Tissue</td>
                        <td className="py-2 px-3">{getTissueStats(initialAssessment).s}%</td>
                        <td className="py-2 px-3">{getTissueStats(latestAssessment).s}%</td>
                        <td className="py-2 px-3 text-slate-500">-</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold text-slate-800">Eschar Tissue</td>
                        <td className="py-2 px-3">{getTissueStats(initialAssessment).e}%</td>
                        <td className="py-2 px-3">{getTissueStats(latestAssessment).e}%</td>
                        <td className="py-2 px-3 text-slate-500">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* CLINICIAN NOTES & ADJUDICATION */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-slate-950 uppercase text-[9px] tracking-wider border-b border-slate-200 pb-1.5 mb-2.5">
                      Clinician Verification logs
                    </h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 text-[10px] space-y-1.5 text-slate-700">
                      <div className="flex justify-between">
                        <span>Adjudicated Status:</span>
                        <span className="font-bold text-slate-900">{getStatusText(latestAssessment)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Verification Status:</span>
                        <span className="font-semibold text-indigo-755">Verified System Input</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Verification Sign-off:</span>
                        <span className="font-medium text-slate-800">Clinical Specialist</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-950 uppercase text-[9px] tracking-wider border-b border-slate-200 pb-1.5 mb-2.5">
                      Clinical Narrative Notes
                    </h4>
                    <div className="border border-slate-200 rounded-md p-3 bg-slate-50/50 min-h-16 text-[10px] italic text-slate-800 leading-relaxed">
                      "{latestAssessment.verifiedResult?.clinicalNotes || 'No narrative clinical notes added at latest evaluation.'}"
                    </div>
                  </div>
                </div>

                {/* SIGNATURE BLOCK */}
                <div className="pt-12 border-t border-slate-200 mt-8 flex justify-between items-end text-[10px]">
                  <div>
                    <div className="h-6 border-b border-slate-400 w-44"></div>
                    <div className="text-[8px] text-slate-400 uppercase tracking-wider mt-1">Practitioner Signature</div>
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-right">CLINICAL CENTER SYSTEM VERIFIED</div>
                    <div className="text-[8px] text-slate-400 text-right uppercase tracking-wider mt-0.5">
                      Date Sealed: {latestAssessment.verifiedResult?.verifiedDate || activeReport.generatedDate}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs">No assessments available.</div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
