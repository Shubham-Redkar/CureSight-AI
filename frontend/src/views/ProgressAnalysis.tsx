import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Select } from '../components/ui';
import { TrendingDown, Layers, Clock, TrendingUp, Info } from 'lucide-react';
import { apiFetch, buildImageUrl } from '../utils/api';
import { getAreaRaw, calculateAreaChangePct } from '../utils/progressUtils';
import type { Patient, Wound, Assessment } from '../types';

import { useParams, useNavigate } from 'react-router-dom';

export const ProgressAnalysis: React.FC = () => {
  const { woundId } = useParams<{ woundId: string }>();
  const navigate = useNavigate();

  // Data fetching states
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientWounds, setPatientWounds] = useState<Wound[]>([]);
  const [woundAssessments, setWoundAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(false);

  // Active select dropdown states
  const [activeCompareMode, setActiveCompareMode] = useState<'initial-latest' | 'previous-current' | 'custom'>('initial-latest');
  const [customLeftAssId, setCustomLeftAssId] = useState<string>('');
  const [customRightAssId, setCustomRightAssId] = useState<string>('');

  const [selectedPatientId, setSelectedPatientId] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    apiFetch('/api/patients').then(res => res.json()).then(data => {
      if (isMounted && data.status === 'ok') setPatients(data.patients || []);
    }).catch(console.error);
    return () => { isMounted = false; };
  }, []);

  // Update selectedPatientId when woundId or patients/wounds change
  useEffect(() => {
    if (woundId && patientWounds.length > 0) {
      const w = patientWounds.find(w => String(w.id) === woundId);
      if (w) setSelectedPatientId(String(w.patientId));
    }
  }, [woundId, patientWounds]);

  // Auto-select wound if patient only has 1 tracked wound
  useEffect(() => {
    if (selectedPatientId && !woundId && patientWounds.length > 0) {
      const matching = patientWounds.filter(w => String(w.patientId) === selectedPatientId);
      if (matching.length === 1) {
        navigate(`/wounds/${matching[0].id}/progress`, { replace: true });
      }
    }
  }, [selectedPatientId, woundId, patientWounds, navigate]);

  // Fetch all wounds across all patients (or just fetch them once) to support wound finding
  useEffect(() => {
    let isMounted = true;
    apiFetch('/api/wounds').then(res => res.json()).then(data => {
      if (isMounted && data.status === 'ok') setPatientWounds(data.wounds || []);
    }).catch(console.error);
    return () => { isMounted = false; };
  }, []);


  useEffect(() => {
    let isMounted = true;
    if (woundId) {
      setLoading(true);
      apiFetch(`/api/assessments?woundId=${woundId}`).then(res => res.json()).then(data => {
        if (isMounted && data.status === 'ok') {
          const mapped = data.assessments.map((assessment: any) => {
            let aiResult = undefined;
            if (assessment.status === 'COMPLETED' || assessment.status === 'VERIFIED') {
               aiResult = {
                   detectionConfidence: assessment.measurements?.wounds?.[0]?.detection_confidence ?? null,
                   measurements: {
                       woundCount: assessment.measurements?.wound_count ?? 0,
                       areaCm2: assessment.measurements?.total_area_cm2 ?? null,
                       lengthCm: assessment.measurements?.wounds?.[0]?.length_cm ?? null,
                       widthCm: assessment.measurements?.wounds?.[0]?.width_cm ?? null,
                       woundsList: assessment.measurements?.wounds ?? [],
                   },
                   tissueAnalysis: assessment.notes || 'Analysis complete',

                   calibration: assessment.measurements?.calibration || null
               };
            }
            return {
               ...assessment,
               imageUrl: buildImageUrl(assessment.imageKey),
               aiResult,
            };
          });
          const sorted = mapped.sort((a: Assessment, b: Assessment) => new Date(a.assessmentDate).getTime() - new Date(b.assessmentDate).getTime());
          setWoundAssessments(sorted);
        }
        if (isMounted) setLoading(false);
      }).catch(() => { if (isMounted) setLoading(false); });
    } else {
      setWoundAssessments([]);
    }
    return () => { isMounted = false; };
  }, [woundId]);

  const activeWound = patientWounds.find(w => String(w.id) === woundId);

  // Set default comparison IDs when assessments change
  useEffect(() => {
    if (woundAssessments.length >= 2) {
      setCustomLeftAssId(String(woundAssessments[0].id));
      setCustomRightAssId(String(woundAssessments[woundAssessments.length - 1].id));
    }
  }, [woundId, woundAssessments]);

  // Determine compare images based on mode
  let leftAssessment: Assessment | undefined;
  let rightAssessment: Assessment | undefined;

  if (woundAssessments.length >= 2) {
    if (activeCompareMode === 'initial-latest') {
      leftAssessment = woundAssessments[0];
      rightAssessment = woundAssessments[woundAssessments.length - 1];
    } else if (activeCompareMode === 'previous-current') {
      leftAssessment = woundAssessments[woundAssessments.length - 2];
      rightAssessment = woundAssessments[woundAssessments.length - 1];
    } else {
      leftAssessment = woundAssessments.find(a => String(a.id) === customLeftAssId);
      rightAssessment = woundAssessments.find(a => String(a.id) === customRightAssId);
    }
  }

  // Calculate trends
  // getAreaRaw is imported from progressUtils
  const getAreaFormatted = (ass?: Assessment): string => {
    const raw = getAreaRaw(ass);
    return raw !== null ? `${raw.toFixed(2)} cm²` : 'Not available';
  };

  const getDimsFormatted = (ass?: Assessment) => {
    if (!ass) return 'Not available';
    const m = ass.status === 'VERIFIED' || ass.verified ? ass.verifiedResult?.measurements : ass.aiResult?.measurements;
    return m?.lengthCm != null && m?.widthCm != null ? `${Number(m.lengthCm).toFixed(2)} cm × ${Number(m.widthCm).toFixed(2)} cm` : 'Not available';
  };

  const getCalibrationLabel = (ass?: Assessment) => {
    if (!ass) return 'Unavailable';
    const cal = ass.aiResult?.calibration;
    const source = cal?.source;
    if (source === 'automatic') return 'Automatic';
    if (source === 'manual') return cal?.verified ? 'Manual (Verified)' : 'Manual (Demo)';
    if (source === 'demo') return 'Demo — Demonstration';
    return 'Unavailable';
  };

  const validCalibratedAssessments = woundAssessments.filter(a => getAreaRaw(a) !== null);
  const initialAreaRaw = validCalibratedAssessments.length > 0 ? getAreaRaw(validCalibratedAssessments[0]) : null;
  const currentAreaRaw = validCalibratedAssessments.length > 0 ? getAreaRaw(validCalibratedAssessments[validCalibratedAssessments.length - 1]) : null;
  const areaChangePct = calculateAreaChangePct(initialAreaRaw, currentAreaRaw);
  
  const overallTrend = areaChangePct === null
    ? 'Insufficient data'
    : areaChangePct < -10 
    ? 'Improving' 
    : areaChangePct > 10 
    ? 'Requires Attention' 
    : 'Stable';

  // SVG Chart Render logic
  const renderAreaChart = () => {
    if (woundAssessments.length < 2) return null;

    const width = 500;
    const height = 180;
    const padding = 30;

    // Get max/min areas for scaling
    const validAssessments = woundAssessments.filter(a => getAreaRaw(a) !== null);
    if (validAssessments.length < 2) return null;

    const areas = validAssessments.map(a => getAreaRaw(a) as number);
    const maxArea = Math.max(...areas, 5) * 1.15; // padding top
    const minArea = 0;

    // Map assessments to points
    const points = validAssessments.map((ass, i) => {
      const x = padding + (i * (width - 2 * padding)) / (validAssessments.length - 1);
      const area = getAreaRaw(ass) as number;
      const y = height - padding - ((area - minArea) * (height - 2 * padding)) / (maxArea - minArea);
      return { x, y, area, date: ass.assessmentDate };
    });

    // Create line path string
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    // Create area path string (filled gradient)
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = padding + ratio * (height - 2 * padding);
          const val = (maxArea - (ratio * (maxArea - minArea))).toFixed(1);
          return (
            <g key={idx}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={padding - 5} y={y + 4} fill="#94a3b8" fontSize="8" textAnchor="end">{val}</text>
            </g>
          );
        })}

        {/* Filled Area */}
        <path d={areaPath} fill="url(#chartGrad)" />

        {/* Chart Line */}
        <path d={linePath} fill="none" stroke="#0f766e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {points.map((p, idx) => (
          <g key={idx} className="group">
            <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="#0f766e" strokeWidth="2" />
            <circle cx={p.x} cy={p.y} r="7" fill="#0f766e" fillOpacity="0" className="hover:fill-opacity-10 cursor-pointer" />
            {/* Tooltip on hover */}
            <text x={p.x} y={p.y - 10} fill="#0f766e" fontSize="9" fontWeight="bold" textAnchor="middle" className="opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900">
              {p.area} cm²
            </text>
            <text x={p.x} y={height - padding + 15} fill="#94a3b8" fontSize="8" textAnchor="middle">
              {p.date.split('-').slice(1).join('/')}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 m-0 tracking-tight">Progress Analysis</h2>
        <p className="text-xs text-slate-500 mt-1">
          Review wound measurements and assessment history over time.
        </p>
      </div>

      {/* SELECTION BAR */}
      <Card className="p-4 bg-white border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Select
            label="Select Patient ID"
            value={selectedPatientId || ''}
            onChange={e => {
              setSelectedPatientId(e.target.value);
            }}
          >
            <option value="">-- Choose Patient ID --</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.patientCode || p.id}</option>
            ))}
          </Select>

          <Select
            label="Select Wound Site"
            value={woundId || ''}
            disabled={!selectedPatientId}
            onChange={e => {
              if (e.target.value) navigate(`/wounds/${e.target.value}/progress`);
            }}
          >
            <option value="">-- Choose Anatomical Site --</option>
            {patientWounds.filter(w => String(w.patientId) === selectedPatientId).map(w => (
              <option key={w.id} value={w.id}>{w.location} ({w.description || 'Unspecified'})</option>
            ))}
          </Select>

          <div className="text-xs text-slate-400 font-medium pb-1 text-center md:text-right">
            {activeWound ? `Tracking Classification: ${activeWound.description || 'Unspecified'}` : 'Choose anatomical parameters to trace diagnostics.'}
          </div>
        </div>
      </Card>

      {!activeWound ? (
        /* NO SELECTION STATE */
        <Card className="py-16 text-center">
          <Clock className="w-12 h-12 text-slate-350 stroke-1 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 text-sm">
            {selectedPatientId && patientWounds.filter(w => String(w.patientId) === selectedPatientId).length === 0
              ? 'No Assessments Recorded Yet'
              : 'No Site Selected'}
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 mb-3">
            {selectedPatientId && patientWounds.filter(w => String(w.patientId) === selectedPatientId).length === 0
              ? 'This patient has no recorded assessments yet. You can start a new assessment directly.'
              : 'Choose a patient and their specific wound site from the dropdown options to inspect longitudinal progress.'}
          </p>
          {selectedPatientId && patientWounds.filter(w => String(w.patientId) === selectedPatientId).length === 0 && (
            <Button
              size="sm"
              onClick={() => navigate(`/assessments/new?patientId=${selectedPatientId}`)}
              className="cursor-pointer"
            >
              Start Wound Assessment
            </Button>
          )}
        </Card>
      ) : loading ? (
        <Card className="py-16 text-center">
          <div className="text-slate-500">Loading assessments...</div>
        </Card>
      ) : woundAssessments.length < 2 ? (
        /* INSUFFICIENT ASSESSMENTS STATE */
        <Card className="py-16 text-center">
          <Layers className="w-12 h-12 text-slate-350 stroke-1 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 text-sm">Longitudinal Trend Analysis Locked</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
            Comparing wound healing progress requires at least two assessments. Currently, this site has {woundAssessments.length} assessment filed.
          </p>
          <div className="mt-5">
            <Button
              onClick={() => navigate(`/assessments/new?woundId=${woundId}&patientId=${selectedPatientId}`)}
              className="text-xs py-1.5 cursor-pointer bg-teal-700 text-white hover:bg-teal-800"
            >
              Perform Next Assessment
            </Button>
          </div>
        </Card>
      ) : (
        /* ACTIVE LONGITUDINAL ANALYTICS */
        <div className="space-y-6">
          {/* STATS PANEL AND GRAPH GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* PROGRESS METRICS CARD (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <Card title="Progress Index Metrics">
                <div className="space-y-4">
                  {/* KPI BOXES */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-md p-3 text-center">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Baseline Area {validCalibratedAssessments.length > 0 ? `(${new Date(validCalibratedAssessments[0].assessmentDate).toLocaleDateString()})` : ''}</div>
                      <div className="text-xl font-bold text-slate-900 mt-1">{validCalibratedAssessments.length > 0 ? getAreaFormatted(validCalibratedAssessments[0]) : 'Not available'}</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-md p-3 text-center">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Latest Area {validCalibratedAssessments.length > 0 ? `(${new Date(validCalibratedAssessments[validCalibratedAssessments.length - 1].assessmentDate).toLocaleDateString()})` : ''}</div>
                      <div className="text-xl font-bold text-slate-900 mt-1">{validCalibratedAssessments.length > 0 ? getAreaFormatted(validCalibratedAssessments[validCalibratedAssessments.length - 1]) : 'Not available'}</div>
                    </div>
                  </div>

                  {/* LONGITUDINAL VELOCITY */}
                  <div className="p-4 rounded-lg flex items-center justify-between border border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full border ${
                        (areaChangePct ?? 0) < 0 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                          : (areaChangePct ?? 0) > 0 
                          ? 'bg-rose-50 text-rose-700 border-rose-150' 
                          : 'bg-blue-50 text-blue-700 border-blue-150'
                      }`}>
                        {(areaChangePct ?? 0) <= 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="text-2xs font-semibold text-slate-500 uppercase">Longitudinal Area Delta</div>
                        <div className="text-sm font-bold text-slate-900 mt-0.5">
                          {areaChangePct !== null ? (areaChangePct <= 0 ? '' : '+') + areaChangePct + '%' : 'Not available'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xs text-slate-450 uppercase font-semibold">Clinician Verdict</div>
                      <div className="mt-0.5">
                        {overallTrend === 'Improving' && <Badge variant="improving">Improving</Badge>}
                        {overallTrend === 'Stable' && <Badge variant="stable">Stable</Badge>}
                        {overallTrend === 'Requires Attention' && <Badge variant="attention">Requires Attention</Badge>}
                      </div>
                    </div>
                  </div>

                  {/* CLINICAL SUMMARY STATEMENT */}
                  <div className="bg-teal-50/40 border border-teal-100 rounded-lg p-3.5 text-xs text-slate-655 flex gap-2">
                    <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                    <div>
                      Across a span of <strong>{woundAssessments.length} assessments</strong> (with {validCalibratedAssessments.length} calibrated for area comparison), this {activeWound.description || 'wound'} site has shown a total calibrated area change of {initialAreaRaw !== null && currentAreaRaw !== null ? Math.abs(initialAreaRaw - currentAreaRaw).toFixed(2) : 'Not available'} cm² ({areaChangePct !== null ? Math.abs(areaChangePct) : 'Not available'}%). The wound margins are currently classified as <strong>{overallTrend.toLowerCase()}</strong>.
                    </div>
                  </div>
                </div>
              </Card>
            </div>

          {/* PROGRESS CHART (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <Card title="Wound Area Over Time (Longitudinal Progression)">
                <div className="h-44 flex items-center justify-center pt-2">
                  {renderAreaChart()}
                </div>
                <div className="flex justify-between items-center text-3xs text-slate-400 border-t border-slate-100 mt-3 pt-2 font-medium">
                  <span>Y-Axis: Square Centimeters (cm²)</span>
                  <span>X-Axis: Assessment Dates</span>
                </div>
              </Card>

              <Card title="Tissue Composition Trends">
                <div className="space-y-4 pt-2">
                  {(() => {
                    const tissueAssessments = woundAssessments.filter(a => a.aiResult?.tissueComposition);
                    if (tissueAssessments.length === 0) {
                      return <div className="text-center py-6 text-slate-400 text-xs">No tissue composition data available for historical comparison.</div>;
                    }
                    return tissueAssessments.map(a => {
                      const comp = a.aiResult!.tissueComposition;
                      return (
                        <div key={a.id} className="text-xs">
                          <div className="flex justify-between font-semibold mb-1 text-slate-700">
                            <span>{new Date(a.assessmentDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex h-4 rounded overflow-hidden">
                            {Object.entries(comp).map(([key, value]) => {
                              const val = Number(value);
                              if (val <= 0) return null;
                              let color = 'bg-slate-300';
                              if (key.toLowerCase().includes('granulation')) color = 'bg-rose-500';
                              if (key.toLowerCase().includes('slough')) color = 'bg-yellow-400';
                              if (key.toLowerCase().includes('eschar') || key.toLowerCase().includes('necrotic')) color = 'bg-slate-800';
                              if (key.toLowerCase().includes('epithelial')) color = 'bg-pink-300';

                              return (
                                <div
                                  key={key}
                                  className={`${color} h-full flex items-center justify-center text-[8px] text-white font-bold whitespace-nowrap overflow-hidden`}
                                  style={{ width: `${val}%` }}
                                  title={`${key}: ${val.toFixed(1)}%`}
                                >
                                  {val > 10 ? `${val.toFixed(0)}%` : ''}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex gap-3 mt-1.5 text-[9px] text-slate-500 flex-wrap">
                            {Object.entries(comp).filter(([_, v]) => Number(v) > 0).map(([k, v]) => (
                              <span key={k} className="capitalize">{k}: {Number(v).toFixed(1)}%</span>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                  <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-100 pt-2">
                    * AI-generated tissue estimates. Not a clinical diagnosis. Compare percentages only when class definitions are compatible.
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* CHRONOLOGICAL TIMELINE SLIDER */}
          <Card title="Chronological Wound Timeline">
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x">
              {woundAssessments.map((item) => {
                const isVerified = item.status === 'VERIFIED' || item.verified;
                return (
                  <div
                    key={item.id}
                    className="min-w-[170px] max-w-[170px] border border-slate-200 rounded-lg bg-white overflow-hidden shadow-2xs snap-start flex flex-col justify-between shrink-0"
                  >
                    <div className="relative h-28 bg-slate-900 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.assessmentDate} className="h-full w-auto object-cover" />
                      ) : (
                        <div className="text-slate-500 text-xs">Image unavailable</div>
                      )}
                      <div className="absolute top-2 left-2 bg-slate-900/60 text-white font-mono text-[9px] px-1.5 py-0.5 rounded">
                        {new Date(item.assessmentDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="p-3 text-xs space-y-1.5 flex flex-col h-full">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{getAreaFormatted(item)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
                        <span>{getDimsFormatted(item)}</span>
                        <span>{isVerified ? 'Verified' : 'AI Analysis'}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 mt-auto uppercase tracking-wider font-semibold">
                        Cal: {getCalibrationLabel(item)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* SIDE-BY-SIDE FOCUS COMPARISON */}
          <Card
            title="Professional Image Comparison"
            headerAction={
              <div className="flex gap-2 items-center text-xs">
                <span className="text-slate-500 font-medium">Comparison Mode:</span>
                <Select
                  value={activeCompareMode}
                  onChange={e => setActiveCompareMode(e.target.value as any)}
                  className="py-1 text-xs"
                >
                  <option value="initial-latest">Initial vs Latest</option>
                  <option value="previous-current">Previous vs Current</option>
                  <option value="custom">Custom Dates Selection</option>
                </Select>
              </div>
            }
          >
            {/* Custom dropdown select selectors */}
            {activeCompareMode === 'custom' && (
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100 mb-4">
                <Select
                  label="Left Frame Image"
                  value={customLeftAssId}
                  onChange={e => setCustomLeftAssId(e.target.value)}
                >
                  {woundAssessments.map(a => (
                    <option key={a.id} value={a.id}>{a.assessmentDate} (Assessment: {a.id})</option>
                  ))}
                </Select>
                <Select
                  label="Right Frame Image"
                  value={customRightAssId}
                  onChange={e => setCustomRightAssId(e.target.value)}
                >
                  {woundAssessments.map(a => (
                    <option key={a.id} value={a.id}>{a.assessmentDate} (Assessment: {a.id})</option>
                  ))}
                </Select>
              </div>
            )}

            {/* Comparison frame views */}
            {leftAssessment && rightAssessment ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* LEFT FRAME */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900">
                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-800">Frame A: {new Date(leftAssessment.assessmentDate).toLocaleDateString()}</span>
                    <Badge variant={leftAssessment.status === 'VERIFIED' || leftAssessment.verified ? 'verified' : 'pending'}>
                      {leftAssessment.status === 'VERIFIED' || leftAssessment.verified ? 'Verified' : 'AI Assessment'}
                    </Badge>
                  </div>
                  <div className="relative h-64 md:h-72 flex items-center justify-center p-2 bg-slate-950">
                    {leftAssessment.imageUrl ? (
                      <img src={leftAssessment.imageUrl} alt="Frame A Wound" className="h-full w-auto object-contain" />
                    ) : (
                      <div className="text-slate-500">Image unavailable</div>
                    )}
                  </div>
                  <div className="bg-white p-3.5 border-t border-slate-150 text-xs grid grid-cols-2 gap-2 text-slate-700">
                    <div>Wound Area: <strong className="text-slate-900">{getAreaFormatted(leftAssessment)}</strong></div>
                    <div>Dimensions: <strong className="text-slate-900">{getDimsFormatted(leftAssessment)}</strong></div>
                  </div>
                </div>

                {/* RIGHT FRAME */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900">
                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-800">Frame B: {new Date(rightAssessment.assessmentDate).toLocaleDateString()}</span>
                    <Badge variant={rightAssessment.status === 'VERIFIED' || rightAssessment.verified ? 'verified' : 'pending'}>
                      {rightAssessment.status === 'VERIFIED' || rightAssessment.verified ? 'Verified' : 'AI Assessment'}
                    </Badge>
                  </div>
                  <div className="relative h-64 md:h-72 flex items-center justify-center p-2 bg-slate-950">
                    {rightAssessment.imageUrl ? (
                      <img src={rightAssessment.imageUrl} alt="Frame B Wound" className="h-full w-auto object-contain" />
                    ) : (
                      <div className="text-slate-500">Image unavailable</div>
                    )}
                  </div>
                  <div className="bg-white p-3.5 border-t border-slate-150 text-xs grid grid-cols-2 gap-2 text-slate-700">
                    <div>Wound Area: <strong className="text-slate-900">{getAreaFormatted(rightAssessment)}</strong></div>
                    <div>Dimensions: <strong className="text-slate-900">{getDimsFormatted(rightAssessment)}</strong></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">Selection coordinates invalid.</div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
