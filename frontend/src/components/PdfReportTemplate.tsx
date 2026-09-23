import React from 'react';

interface PdfReportTemplateProps {
  reportData: any;
}

export const PdfReportTemplate: React.FC<PdfReportTemplateProps> = ({ reportData }) => {
  if (!reportData) return null;

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const {
    patient,
    wound,
    assessment,
    images,
    progress,
    clinicalReview
  } = reportData;

  const isPhysicalAvailable = assessment.measurements?.physical_measurement_available === true;
  const calibration = assessment.measurements?.calibration;

  return (
    <div id="pdf-report-content" className="p-12 font-sans mx-auto" style={{ width: '800px', minHeight: '1131px', backgroundColor: '#ffffff', color: '#0f172a' }}>
      
      {/* HEADER */}
      <div className="flex justify-between items-start pb-4 mb-6" style={{ borderBottomWidth: '2px', borderBottomStyle: 'solid', borderColor: '#115e59' }}>
        <div>
          <h1 className="text-xl font-bold tracking-wider uppercase m-0 leading-none" style={{ color: '#0f172a' }}>
            CureSight AI
          </h1>
          <div className="text-sm font-semibold tracking-wide uppercase mt-1" style={{ color: '#0f524d' }}>
            Wound Intelligence Platform
          </div>
          <div className="text-lg font-bold mt-4 uppercase" style={{ color: '#334155' }}>
            Clinical Wound Assessment Report
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold leading-none" style={{ color: '#0f172a' }}>REP-{assessment.id}</div>
          <div className="text-sm font-semibold mt-1" style={{ color: '#64748b' }}>Assessment Date: {new Date(assessment.assessmentDate).toLocaleDateString()}</div>
          <div className="text-xs mt-1" style={{ color: '#94a3b8' }}>Generated: {new Date().toLocaleString()}</div>
        </div>
      </div>

      <div className="space-y-8 text-sm">
        
        {/* SECTION 1 - PATIENT INFO */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider pb-2 mb-3" style={{ color: '#0f172a', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#e2e8f0' }}>
            Patient Information
          </h2>
          <div className="grid grid-cols-2 gap-4" style={{ color: '#334155' }}>
            <div className="flex gap-2"><span className="font-semibold w-24">Patient Name:</span> <span>{patient.name}</span></div>
            <div className="flex gap-2"><span className="font-semibold w-24">Patient Code:</span> <span className="font-mono font-bold">{patient.patientCode}</span></div>
            <div className="flex gap-2"><span className="font-semibold w-24">Age:</span> <span>{patient.age || 'Unknown'}</span></div>
            <div className="flex gap-2"><span className="font-semibold w-24">Patient ID:</span> <span>{patient.id}</span></div>
          </div>
        </section>

        {/* SECTION 2 - WOUND INFO & ASSESSMENT */}
        <div className="grid grid-cols-2 gap-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider pb-2 mb-3" style={{ color: '#0f172a', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#e2e8f0' }}>
              Wound Information
            </h2>
            <div className="space-y-2" style={{ color: '#334155' }}>
              <div className="flex gap-2"><span className="font-semibold w-28">Wound ID:</span> <span>{wound.id}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-28">Location:</span> <span>{wound.location || 'Unspecified'}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-28">Description:</span> <span>{wound.description || 'Unspecified'}</span></div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider pb-2 mb-3" style={{ color: '#0f172a', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#e2e8f0' }}>
              Assessment
            </h2>
            <div className="space-y-2" style={{ color: '#334155' }}>
              <div className="flex gap-2"><span className="font-semibold w-28">Status:</span> <span className="capitalize">{assessment.status || 'Not available'}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-28">Wound Detected:</span> <span>{assessment.woundDetected ? "Yes" : "No"}</span></div>
            </div>
          </section>
        </div>

        {/* SECTION 4 - MEASUREMENTS & CALIBRATION */}
        <div className="grid grid-cols-2 gap-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider pb-2 mb-3" style={{ color: '#0f172a', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#e2e8f0' }}>
              Wound Measurements
            </h2>
            <div className="space-y-2" style={{ color: '#334155' }}>
              <div className="flex justify-between pb-1" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#f1f5f9' }}>
                <span className="font-semibold">Wound count:</span>
                <span>{assessment.measurements?.wound_count || 0}</span>
              </div>
              <div className="flex justify-between pb-1" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#f1f5f9' }}>
                <span className="font-semibold">Area:</span>
                <span>{isPhysicalAvailable && assessment.measurements?.total_area_cm2 !== null ? `${assessment.measurements.total_area_cm2.toFixed(2)} cm²` : 'Not available'}</span>
              </div>
              <div className="flex justify-between pb-1" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#f1f5f9' }}>
                <span className="font-semibold">Length:</span>
                <span>{isPhysicalAvailable && assessment.measurements?.wounds?.[0]?.length_cm != null ? `${assessment.measurements.wounds[0].length_cm.toFixed(2)} cm` : 'Not available'}</span>
              </div>
              <div className="flex justify-between pb-1" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#f1f5f9' }}>
                <span className="font-semibold">Width:</span>
                <span>{isPhysicalAvailable && assessment.measurements?.wounds?.[0]?.width_cm != null ? `${assessment.measurements.wounds[0].width_cm.toFixed(2)} cm` : 'Not available'}</span>
              </div>
              {(assessment.measurements?.wound_count || 0) > 1 && (
                <div className="text-xs italic mt-2" style={{ color: '#b45309' }}>Multiple wounds detected. Length and width represent the primary wound.</div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider pb-2 mb-3" style={{ color: '#0f172a', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#e2e8f0' }}>
              Physical Measurement Calibration
            </h2>
            <div className="space-y-2 p-3 rounded" style={{ color: '#334155', backgroundColor: '#f8fafc' }}>
              {calibration?.pixels_per_cm ? (
                calibration.source === 'automatic' ? (
                  <>
                    <div className="flex justify-between"><span className="font-semibold">Calibration source:</span> <span className="capitalize font-bold" style={{ color: '#115e59' }}>Automatic marker</span></div>
                    <div className="flex justify-between"><span className="font-semibold">Scale:</span> <span>{calibration.pixels_per_cm} px/cm</span></div>
                    {calibration.confidence && <div className="flex justify-between"><span className="font-semibold">Confidence:</span> <span>{Math.round(calibration.confidence * 100)}%</span></div>}
                    <div className="flex justify-between"><span className="font-semibold">Marker:</span> <span>Detected</span></div>
                  </>
                ) : calibration.source === 'demo' ? (
                  <>
                    <div className="flex justify-between"><span className="font-semibold">Calibration source:</span> <span className="font-bold" style={{ color: '#0f172a' }}>Default Demonstration Scale</span></div>
                    <div className="flex justify-between"><span className="font-semibold">Scale:</span> <span>{calibration.pixels_per_cm} px/cm</span></div>
                    <div className="mt-2 text-[10px] p-2" style={{ color: '#92400e', backgroundColor: '#fffbeb', borderWidth: '1px', borderStyle: 'solid', borderColor: '#fde68a' }}>
                      <span className="font-bold" style={{ color: '#d97706' }}>WARNING: </span> A physical calibration marker was not detected. The displayed physical measurements were calculated using the system's configured demonstration scale and are intended for testing/demo purposes only.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between"><span className="font-semibold">Calibration source:</span> <span className="font-bold" style={{ color: '#0f172a' }}>Manual — Demonstration</span></div>
                    <div className="flex justify-between"><span className="font-semibold">Scale:</span> <span>{calibration.pixels_per_cm} px/cm</span></div>
                    <div className="mt-2 text-[10px] p-2" style={{ color: '#92400e', backgroundColor: '#fffbeb', borderWidth: '1px', borderStyle: 'solid', borderColor: '#fde68a' }}>
                      <span className="font-bold" style={{ color: '#d97706' }}>⚠ Demonstration measurement: </span> manually calibrated value. Not derived from a photograph-based physical reference.
                    </div>
                  </>
                )
              ) : (
                <>
                  <div className="flex justify-between"><span className="font-semibold" style={{ color: '#b45309' }}>Calibration marker:</span> <span className="font-bold" style={{ color: '#b45309' }}>Not detected</span></div>
                  <div className="flex justify-between" style={{ color: '#b45309' }}><span className="font-semibold">Physical measurements:</span> <span>Not available</span></div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* SECTION 6 - PROGRESS & AI */}
        <div className="grid grid-cols-2 gap-8">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider pb-2 mb-3" style={{ color: '#0f172a', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#e2e8f0' }}>
              Progress Analysis
            </h2>
            <div className="space-y-2" style={{ color: '#334155' }}>
              <div className="flex justify-between pb-1" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#f1f5f9' }}>
                <span className="font-semibold">Status:</span>
                <span className="capitalize font-bold" style={{ color: '#0f172a' }}>
                  {progress?.status ? progress.status.replace('_', ' ') : 'Insufficient data'}
                </span>
              </div>
              <div className="flex justify-between pb-1" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#f1f5f9' }}>
                <span className="font-semibold">Previous Area:</span>
                <span>{progress?.previousAssessment?.area_cm2 != null ? `${progress.previousAssessment.area_cm2.toFixed(2)} cm²` : 'Insufficient data'}</span>
              </div>
              <div className="flex justify-between pb-1" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#f1f5f9' }}>
                <span className="font-semibold">Current Area:</span>
                <span>{progress?.currentArea_cm2 != null ? `${progress.currentArea_cm2.toFixed(2)} cm²` : 'Insufficient data'}</span>
              </div>
              <div className="flex justify-between pb-1" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#f1f5f9' }}>
                <span className="font-semibold">Area Change:</span>
                <span>{progress?.areaChangePct != null ? `${progress.areaChangePct > 0 ? '+' : ''}${progress.areaChangePct.toFixed(1)}%` : 'Insufficient data'}</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider pb-2 mb-3" style={{ color: '#0f172a', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#e2e8f0' }}>
              AI Analysis Findings
            </h2>
            <div className="space-y-2" style={{ color: '#334155' }}>
              <div className="flex justify-between pb-1" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#f1f5f9' }}>
                <span className="font-semibold">Wound Detected:</span>
                <span>{assessment.woundDetected ? "Yes" : "No"}</span>
              </div>
              <div className="flex justify-between pb-1" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#f1f5f9' }}>
                <span className="font-semibold">Detection Confidence:</span>
                <span>{assessment.measurements?.wounds?.[0]?.detection_confidence ? `${Math.round(assessment.measurements.wounds[0].detection_confidence * 100)}%` : 'Not available'}</span>
              </div>
              <div className="flex justify-between pb-1" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#f1f5f9' }}>
                <span className="font-semibold">Wound Count:</span>
                <span>{assessment.measurements?.wound_count || 0}</span>
              </div>
              {assessment.measurements?.overall_color_classification && (
                <div className="flex justify-between pb-1" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#f1f5f9' }}>
                  <span className="font-semibold">Tissue Color:</span>
                  <span>{assessment.measurements.overall_color_classification.label} {assessment.measurements.overall_color_classification.emoji}</span>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* SECTION 8 - IMAGES */}
        <section className="break-inside-avoid">
          <h2 className="text-sm font-bold uppercase tracking-wider pb-2 mb-3 mt-6" style={{ color: '#0f172a', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#e2e8f0' }}>
            Clinical Images
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded p-2 text-center" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: '#e2e8f0' }}>
              <div className="font-semibold mb-2" style={{ color: '#1e293b' }}>Original Wound Image</div>
              <div className="h-48 flex items-center justify-center rounded" style={{ backgroundColor: '#f1f5f9' }}>
                {images?.originalUrl ? (
                  <img src={`${API_URL}${images.originalUrl}`} crossOrigin="anonymous" alt="Original" className="max-h-full max-w-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                ) : (
                  <span className="italic" style={{ color: '#94a3b8' }}>Image not available</span>
                )}
                <span className="italic hidden" style={{ color: '#94a3b8' }}>Image not available</span>
              </div>
            </div>
            <div className="rounded p-2 text-center" style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: '#e2e8f0' }}>
              <div className="font-semibold mb-2" style={{ color: '#1e293b' }}>AI Analysis / Segmentation</div>
              <div className="h-48 flex items-center justify-center rounded" style={{ backgroundColor: '#f1f5f9' }}>
                {images?.annotatedUrl ? (
                  <img src={`${API_URL}${images.annotatedUrl}`} crossOrigin="anonymous" alt="Annotated" className="max-h-full max-w-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                ) : (
                  <span className="italic" style={{ color: '#94a3b8' }}>Image not available</span>
                )}
                <span className="italic hidden" style={{ color: '#94a3b8' }}>Image not available</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 9 - CLINICAL REVIEW */}
        {clinicalReview && (
          <section className="break-inside-avoid mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wider pb-2 mb-3" style={{ color: '#0f172a', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderColor: '#e2e8f0' }}>
              Clinical Review
            </h2>
            <div className="space-y-2 p-4 rounded" style={{ color: '#334155', backgroundColor: '#f8fafc', borderWidth: '1px', borderStyle: 'solid', borderColor: '#e2e8f0' }}>
              <div className="flex gap-2"><span className="font-semibold w-40">Review Status:</span> <span className="font-bold">{clinicalReview.status || 'Verified'}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-40">Verified Wound Area:</span> <span>{clinicalReview.verifiedArea ? `${clinicalReview.verifiedArea} cm²` : 'Not available'}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-40">Verified Length:</span> <span>{clinicalReview.verifiedLength ? `${clinicalReview.verifiedLength} cm` : 'Not available'}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-40">Verified Width:</span> <span>{clinicalReview.verifiedWidth ? `${clinicalReview.verifiedWidth} cm` : 'Not available'}</span></div>
              <div className="flex gap-2"><span className="font-semibold w-40">Clinical Notes:</span> <span className="italic">{clinicalReview.notes || 'Not available'}</span></div>
              <div className="flex gap-2 mt-2 pt-2" style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderColor: '#e2e8f0' }}><span className="font-semibold w-40">Reviewed At:</span> <span>{clinicalReview.reviewedAt ? new Date(clinicalReview.reviewedAt).toLocaleString() : 'Not available'}</span></div>
            </div>
          </section>
        )}

      </div>

      {/* SECTION 10 - DISCLAIMER */}
      <div className="mt-12 pt-6 text-xs text-center uppercase tracking-wide leading-relaxed pb-8" style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderColor: '#e2e8f0', color: '#64748b' }}>
        CureSight AI is a clinical decision-support prototype intended to assist wound assessment and progress monitoring.<br/>
        AI-generated findings and measurements should be reviewed and verified by a qualified healthcare professional<br/>
        and should not be used as the sole basis for clinical diagnosis or treatment decisions.
      </div>
    </div>
  );
};
