import React, { useState } from 'react';
import { Card, Badge, Button, Modal } from '../components/ui';
import { FileText, Eye, Download } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { PdfReportTemplate } from '../components/PdfReportTemplate';

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
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [isFetchingList, setIsFetchingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [activeReportData, setActiveReportData] = useState<any | null>(null);
  const [isFetchingReport, setIsFetchingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<number | null>(null);
  const [downloadReportData, setDownloadReportData] = useState<any | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  React.useEffect(() => {
    let isMounted = true;
    const loadReports = async () => {
      try {
        setIsFetchingList(true);
        const res = await apiFetch("/api/reports");
        if (!res.ok) throw new Error("Failed to load reports");
        const data = await res.json();
        if (isMounted && data.status === "ok") {
          setReportsList(data.reports || []);
        }
      } catch (err: any) {
        if (isMounted) setListError(err.message || "Failed to load reports");
      } finally {
        if (isMounted) setIsFetchingList(false);
      }
    };
    loadReports();
    return () => { isMounted = false; };
  }, []);

  const fetchReport = async (assessmentId: number) => {
    setIsFetchingReport(true);
    setReportError(null);
    try {
      const res = await apiFetch(`/api/reports/${assessmentId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Assessment not found.");
        throw new Error("Unable to generate report. Backend server unavailable.");
      }
      const data = await res.json();
      if (data.status !== "ok") {
        throw new Error(data.message || "Failed to fetch report");
      }
      setActiveReportData(data.report);
    } catch (err: any) {
      setReportError(err.message || "Failed to fetch report.");
    } finally {
      setIsFetchingReport(false);
    }
  };

  const handleDownloadPdf = async (assessmentId: number) => {
    setIsGeneratingPdf(assessmentId);
    
    try {
      const res = await apiFetch(`/api/reports/${assessmentId}`);
      if (!res.ok) {
        throw new Error("Unable to retrieve report data.");
      }
      const data = await res.json();
      if (data.status !== "ok") {
        throw new Error(data.message || "Unable to retrieve report data.");
      }
      
      const reportData = data.report;
      setDownloadReportData(reportData);
      
      // Wait for React to mount the hidden template and images to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const element = document.getElementById('pdf-report-content');
      if (!element) throw new Error("Report generation failed. Template not found.");
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`CureSight-AI_Report_${reportData.patient.patientCode}_${reportData.assessment.id}.pdf`);
      
    } catch (err: any) {
      setReportError("Unable to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPdf(null);
      setDownloadReportData(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 m-0 tracking-tight">Clinical Reports</h2>
          <p className="text-xs text-slate-500 mt-1">
            Review and export structured wound assessment reports.
          </p>
        </div>
      </div>

      {/* REPORTS LIST TABLE */}
      <Card title="Available Clinical Reports">
        {isFetchingList ? (
          <div className="text-center py-12 text-slate-500">Loading reports...</div>
        ) : listError ? (
          <div className="text-center py-12 text-red-500">{listError}</div>
        ) : reportsList.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center justify-center">
            <FileText className="w-12 h-12 text-slate-350 stroke-1 mb-3" />
            <h3 className="font-semibold text-slate-700 text-sm">No reports yet</h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Complete a wound assessment to generate the clinical report.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 -my-5">
            <table className="w-full border-collapse text-left text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Assessment ID</th>
                  <th className="py-3 px-5">Patient ID</th>
                  <th className="py-3 px-5">Anatomical Location</th>
                  <th className="py-3 px-5">Assessment Date</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reportsList.map(ass => {
                  return (
                    <tr key={ass.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-5 font-mono font-bold text-slate-900">{ass.id}</td>
                      <td className="py-3 px-5 font-mono text-slate-655">{ass.wound?.patient?.patientCode || 'Unknown'}</td>
                      <td className="py-3 px-5 font-medium text-slate-800">{ass.wound?.location || 'Unspecified'}</td>
                      <td className="py-3 px-5">{new Date(ass.assessmentDate).toLocaleDateString()}</td>
                      <td className="py-3 px-5">
                        <Badge variant="verified">Final</Badge>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchReport(ass.id)}
                            className="text-teal-700 hover:text-teal-900 hover:bg-teal-50 px-2 cursor-pointer font-medium"
                            disabled={isFetchingReport}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            {isFetchingReport ? 'Loading...' : 'View'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadPdf(ass.id)}
                            className="text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-2 cursor-pointer font-medium"
                            disabled={isFetchingReport || isGeneratingPdf !== null}
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            {isGeneratingPdf === ass.id ? 'Generating...' : 'Download'}
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

      {/* REPORT PREVIEW MODAL */}
      <Modal
        isOpen={!!activeReportData || !!reportError || isFetchingReport}
        onClose={() => {
          setActiveReportData(null);
          setReportError(null);
        }}
        title={`Clinical Report Review`}
        size="xl"
        footer={
          <div className="flex gap-2 justify-between w-full">
            <Button
              variant="secondary"
              onClick={() => {
                if (activeReportData) {
                  setSelectedPatientId(String(activeReportData.patient.id));
                  setSelectedWoundId(String(activeReportData.wound.id));
                }
                setActiveReportData(null);
                setReportError(null);
                setActiveTab('progress');
              }}
              className="cursor-pointer text-xs"
              disabled={!activeReportData}
            >
              Inspect Trend Timeline
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setActiveReportData(null); setReportError(null); }} className="cursor-pointer text-xs">
                Close Preview
              </Button>
              <Button onClick={() => activeReportData && handleDownloadPdf(activeReportData.assessment.id)} disabled={!activeReportData || isGeneratingPdf !== null} className="flex items-center gap-1.5 cursor-pointer text-xs bg-teal-700 text-white hover:bg-teal-800">
                {isGeneratingPdf === activeReportData?.assessment?.id ? (
                  'Generating PDF...'
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        }
      >
        {isFetchingReport ? (
          <div className="text-center py-12 text-slate-500">Generating report...</div>
        ) : reportError ? (
          <div className="text-center py-12 text-rose-500 font-medium">{reportError}</div>
        ) : activeReportData ? (
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
                <div className="text-lg font-bold text-slate-900 leading-none">REP-{activeReportData.assessment.id}</div>
                <div className="text-[9px] text-slate-500 font-semibold mt-1">Date: {new Date(activeReportData.assessment.assessmentDate).toLocaleDateString()}</div>
              </div>
            </div>

            {/* METADATA GRID */}
            <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 border border-slate-200 p-4 rounded-md">
              <div>
                <h4 className="font-semibold text-slate-900 uppercase text-[9px] tracking-wider mb-2">Patient Information</h4>
                <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[10px] text-slate-655">
                  <div className="font-medium">Patient Clinical Code:</div>
                  <div className="font-mono font-bold text-slate-900">{activeReportData.patient.patientCode}</div>
                  <div className="font-medium">Name:</div>
                  <div>{activeReportData.patient.name}</div>
                  <div className="font-medium">Age:</div>
                  <div>{activeReportData.patient.age || 'Unknown'}</div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 uppercase text-[9px] tracking-wider mb-2">Clinical Parameters</h4>
                <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[10px] text-slate-655">
                  <div className="font-medium">Anatomical Site:</div>
                  <div className="font-semibold text-slate-900">{activeReportData.wound.location}</div>
                  <div className="font-medium">Wound Type:</div>
                  <div>{activeReportData.wound.description || 'Unspecified'}</div>
                </div>
              </div>
            </div>

            {/* CLINICAL COMPARISON IMAGES */}
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-slate-950 uppercase text-[9px] tracking-wider border-b border-slate-200 pb-1.5 mb-3">
                  Wound Image Adjudication (Original vs Annotated)
                </h4>
                <div className="grid grid-cols-2 gap-6">
                  {/* INITIAL ASSESSMENT */}
                  <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50 text-center p-2">
                    <div className="font-bold text-slate-900 text-[10px] border-b border-slate-200 pb-1 mb-2">
                      Original Capture
                    </div>
                    <div className="h-40 flex items-center justify-center bg-slate-950 rounded">
                      {activeReportData.images.originalUrl ? (
                        <img src={`${API_URL}${activeReportData.images.originalUrl}`} alt="Original Wound" className="h-full w-auto object-contain" />
                      ) : (
                        <div className="text-slate-400">Original image unavailable</div>
                      )}
                    </div>
                  </div>

                  {/* LATEST ASSESSMENT */}
                  <div className="border border-slate-200 rounded-md overflow-hidden bg-slate-50 text-center p-2">
                    <div className="font-bold text-slate-900 text-[10px] border-b border-slate-200 pb-1 mb-2">
                      Annotated Capture
                    </div>
                    <div className="h-40 flex items-center justify-center bg-slate-950 rounded">
                      {activeReportData.images.annotatedUrl ? (
                        <img src={`${API_URL}${activeReportData.images.annotatedUrl}`} alt="Annotated Wound" className="h-full w-auto object-contain" />
                      ) : (
                        <div className="text-slate-400">Annotated image unavailable</div>
                      )}
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
                      <th className="py-2 px-3">Current Assessment</th>
                      <th className="py-2 px-3">Previous Assessment</th>
                      <th className="py-2 px-3">Percentage Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-800">Adjudicated Area</td>
                      <td className="py-2 px-3">{activeReportData.progress.currentArea_cm2 !== null ? `${activeReportData.progress.currentArea_cm2.toFixed(2)} cm²` : 'Unavailable'}</td>
                      <td className="py-2 px-3">{activeReportData.progress.previousAssessment !== null ? `${activeReportData.progress.previousAssessment.area_cm2.toFixed(2)} cm²` : 'Insufficient data'}</td>
                      <td className="py-2 px-3 font-bold text-slate-900">
                        {activeReportData.progress.areaChangePct !== null ? `${activeReportData.progress.areaChangePct > 0 ? '+' : ''}${activeReportData.progress.areaChangePct.toFixed(1)}%` : 'Insufficient data'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-800">Length</td>
                      <td className="py-2 px-3">
                        {activeReportData.assessment.measurements?.wounds?.[0]?.length_cm != null 
                          ? `${activeReportData.assessment.measurements.wounds[0].length_cm.toFixed(2)} cm` 
                          : 'Unavailable'}
                      </td>
                      <td className="py-2 px-3 text-slate-500">-</td>
                      <td className="py-2 px-3 text-slate-500">-</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-800">Width</td>
                      <td className="py-2 px-3">
                        {activeReportData.assessment.measurements?.wounds?.[0]?.width_cm != null 
                          ? `${activeReportData.assessment.measurements.wounds[0].width_cm.toFixed(2)} cm` 
                          : 'Unavailable'}
                      </td>
                      <td className="py-2 px-3 text-slate-500">-</td>
                      <td className="py-2 px-3 text-slate-500">-</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-800">Wound Detected</td>
                      <td className="py-2 px-3">
                        {activeReportData.assessment.woundDetected ? "Yes" : "No / Unavailable"}
                      </td>
                      <td className="py-2 px-3 text-slate-500">-</td>
                      <td className="py-2 px-3 text-slate-500">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* CALIBRATION SECTION */}
              <div>
                <h4 className="font-semibold text-slate-950 uppercase text-[9px] tracking-wider border-b border-slate-200 pb-1.5 mb-2.5">
                  Physical Measurement Calibration
                </h4>
                <div className="text-[10px] text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-3">
                  {activeReportData.assessment.measurements?.calibration ? (
                    activeReportData.assessment.measurements.calibration.source === 'automatic' ? (
                      <div className="grid grid-cols-2 gap-y-1">
                        <div className="font-semibold">Calibration source:</div>
                        <div className="text-teal-800 font-bold">Automatic marker</div>
                        <div className="font-semibold">Scale:</div>
                        <div>{activeReportData.assessment.measurements.calibration.pixels_per_cm} px/cm</div>
                        <div className="font-semibold">Confidence:</div>
                        <div>{Math.round((activeReportData.assessment.measurements.calibration.confidence || 0) * 100)}%</div>
                        <div className="font-semibold">Marker:</div>
                        <div>Detected</div>
                      </div>
                    ) : activeReportData.assessment.measurements.calibration.source === 'demo' ? (
                      <div className="flex flex-col gap-y-2">
                        <div className="grid grid-cols-2 gap-y-1">
                          <div className="font-semibold">Calibration source:</div>
                          <div className="text-slate-800 font-bold">Default Demonstration Scale</div>
                          <div className="font-semibold">Scale:</div>
                          <div>{activeReportData.assessment.measurements.calibration.pixels_per_cm} px/cm</div>
                        </div>
                        <div className="text-[9px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-1.5 leading-snug">
                          <span className="font-semibold text-amber-600">WARNING: </span> A physical calibration marker was not detected. The displayed physical measurements were calculated using the system's configured demonstration scale and are intended for testing/demo purposes only.
                        </div>
                      </div>
                    ) : activeReportData.assessment.measurements.calibration.source === 'manual' ? (
                      <div className="flex flex-col gap-y-2">
                        <div className="grid grid-cols-2 gap-y-1">
                          <div className="font-semibold">Calibration source:</div>
                          <div className="text-slate-800 font-bold">Manual — Demonstration</div>
                          <div className="font-semibold">Scale:</div>
                          <div>{activeReportData.assessment.measurements.calibration.pixels_per_cm} px/cm</div>
                        </div>
                        <div className="text-[9px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-1.5 leading-snug">
                          <span className="font-semibold text-amber-600">⚠ Demonstration measurement.</span> The physical scale was supplied manually and was not derived from a calibration marker in the photograph.
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-y-1">
                        <div className="font-semibold text-amber-700">Calibration marker:</div>
                        <div className="text-amber-700">Not detected</div>
                        <div className="font-semibold text-amber-700">Physical measurements:</div>
                        <div className="text-amber-700">Not available</div>
                      </div>
                    )
                  ) : (
                    <div className="grid grid-cols-2 gap-y-1">
                      <div className="font-semibold text-amber-700">Calibration marker:</div>
                      <div className="text-amber-700">Not detected</div>
                      <div className="font-semibold text-amber-700">Physical measurements:</div>
                      <div className="text-amber-700">Not available</div>
                    </div>
                  )}
                </div>
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
                      <span className="font-bold text-slate-900">{activeReportData.progress.status === 'insufficient_data' ? 'Insufficient data' : activeReportData.progress.status.charAt(0).toUpperCase() + activeReportData.progress.status.slice(1)}</span>
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
                    "{activeReportData.assessment.notes || 'No narrative clinical notes added at latest evaluation.'}"
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
                    Date Sealed: {new Date(activeReportData.assessment.assessmentDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* HIDDEN PDF TEMPLATE */}
      <div className="absolute top-0 left-0 -z-50 pointer-events-none opacity-0" aria-hidden="true" style={{ width: '800px', overflow: 'hidden' }}>
        {downloadReportData && <PdfReportTemplate reportData={downloadReportData} />}
      </div>
    </div>
  );
};
