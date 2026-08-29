import React, { useState, useEffect } from 'react';
import { useWounds } from '../context/WoundContext';
import { Card, Badge, Button, Select } from '../components/ui';
import { TrendingDown, Layers, Clock, TrendingUp, Info } from 'lucide-react';
import type { Assessment } from '../types';

interface ProgressAnalysisProps {
  selectedPatientId: string | null;
  setSelectedPatientId: (id: string | null) => void;
  selectedWoundId: string | null;
  setSelectedWoundId: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
}

export const ProgressAnalysis: React.FC<ProgressAnalysisProps> = ({
  selectedPatientId,
  setSelectedPatientId,
  selectedWoundId,
  setSelectedWoundId,
  setActiveTab,
}) => {
  const { patients, wounds, assessments } = useWounds();

  // Active select dropdown states
  const [activeCompareMode, setActiveCompareMode] = useState<'initial-latest' | 'previous-current' | 'custom'>('initial-latest');
  const [customLeftAssId, setCustomLeftAssId] = useState<string>('');
  const [customRightAssId, setCustomRightAssId] = useState<string>('');

  const patientWounds = wounds.filter(w => w.patientId === selectedPatientId);
  const activeWound = wounds.find(w => w.id === selectedWoundId);

  // Retrieve assessments for the selected wound sorted chronologically (oldest to newest)
  const woundAssessments = assessments
    .filter(a => a.woundId === selectedWoundId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Set default comparison IDs when assessments change
  useEffect(() => {
    if (woundAssessments.length >= 2) {
      setCustomLeftAssId(woundAssessments[0].id);
      setCustomRightAssId(woundAssessments[woundAssessments.length - 1].id);
    }
  }, [selectedWoundId, assessments]);

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
      leftAssessment = woundAssessments.find(a => a.id === customLeftAssId);
      rightAssessment = woundAssessments.find(a => a.id === customRightAssId);
    }
  }

  // Calculate trends
  const getArea = (ass?: Assessment) => {
    if (!ass) return 0;
    return ass.verifiedResult ? ass.verifiedResult.measurements.areaCm2 : (ass.aiResult?.measurements.areaCm2 || 0);
  };

  const getDims = (ass?: Assessment) => {
    if (!ass) return '';
    const m = ass.verifiedResult ? ass.verifiedResult.measurements : ass.aiResult?.measurements;
    return m ? `${m.lengthCm}x${m.widthCm} cm` : 'Unassessed';
  };

  const initialArea = getArea(woundAssessments[0]);
  const currentArea = getArea(woundAssessments[woundAssessments.length - 1]);
  const areaChangePct = initialArea > 0 ? parseFloat((((currentArea - initialArea) / initialArea) * 100).toFixed(1)) : 0;
  
  const overallTrend = areaChangePct < -10 
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
    const areas = woundAssessments.map(a => getArea(a));
    const maxArea = Math.max(...areas, 5) * 1.15; // padding top
    const minArea = 0;

    // Map assessments to points
    const points = woundAssessments.map((ass, i) => {
      const x = padding + (i * (width - 2 * padding)) / (woundAssessments.length - 1);
      const area = getArea(ass);
      const y = height - padding - ((area - minArea) * (height - 2 * padding)) / (maxArea - minArea);
      return { x, y, area, date: ass.date };
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
      {/* SELECTION BAR */}
      <Card className="p-4 bg-white border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Select
            label="Select Patient ID"
            value={selectedPatientId || ''}
            onChange={e => {
              setSelectedPatientId(e.target.value || null);
              setSelectedWoundId(null);
            }}
          >
            <option value="">-- Choose Patient ID --</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.id}</option>
            ))}
          </Select>

          <Select
            label="Select Wound Site"
            value={selectedWoundId || ''}
            disabled={!selectedPatientId}
            onChange={e => setSelectedWoundId(e.target.value || null)}
          >
            <option value="">-- Choose Anatomical Site --</option>
            {patientWounds.map(w => (
              <option key={w.id} value={w.id}>{w.location} ({w.type})</option>
            ))}
          </Select>

          <div className="text-xs text-slate-400 font-medium pb-1 text-center md:text-right">
            {activeWound ? `Tracking Classification: ${activeWound.type}` : 'Choose anatomical parameters to trace diagnostics.'}
          </div>
        </div>
      </Card>

      {!activeWound ? (
        /* NO SELECTION STATE */
        <Card className="py-16 text-center">
          <Clock className="w-12 h-12 text-slate-350 stroke-1 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-700 text-sm">No Site Selected</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
            Choose a patient and their specific wound site from the dropdown options to inspect longitudinal progress.
          </p>
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
              onClick={() => setActiveTab('assessment')}
              className="text-xs py-1.5 cursor-pointer"
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
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Initial Area ({woundAssessments[0].date})</div>
                      <div className="text-xl font-bold text-slate-900 mt-1">{initialArea} cm²</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-md p-3 text-center">
                      <div className="text-[10px] text-slate-500 font-semibold uppercase">Current Area ({woundAssessments[woundAssessments.length - 1].date})</div>
                      <div className="text-xl font-bold text-slate-900 mt-1">{currentArea} cm²</div>
                    </div>
                  </div>

                  {/* LONGITUDINAL VELOCITY */}
                  <div className="p-4 rounded-lg flex items-center justify-between border border-slate-200 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full border ${
                        areaChangePct < 0 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                          : areaChangePct > 0 
                          ? 'bg-rose-50 text-rose-700 border-rose-150' 
                          : 'bg-blue-50 text-blue-700 border-blue-150'
                      }`}>
                        {areaChangePct <= 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="text-2xs font-semibold text-slate-500 uppercase">Longitudinal Area Delta</div>
                        <div className="text-sm font-bold text-slate-900 mt-0.5">
                          {areaChangePct <= 0 ? '' : '+'}{areaChangePct}%
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
                      Across a span of <strong>{woundAssessments.length} assessments</strong> dating from {woundAssessments[0].date} to {woundAssessments[woundAssessments.length - 1].date}, this {activeWound.type} site has shown a total area reduction of {Math.abs(initialArea - currentArea).toFixed(2)} cm² ({Math.abs(areaChangePct)}%). The wound margins are currently classified as <strong>{overallTrend.toLowerCase()}</strong>.
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* PROGRESS CHART (7 cols) */}
            <div className="lg:col-span-7">
              <Card title="Wound Area Over Time (Longitudinal Progression)">
                <div className="h-44 flex items-center justify-center pt-2">
                  {renderAreaChart()}
                </div>
                <div className="flex justify-between items-center text-3xs text-slate-400 border-t border-slate-100 mt-3 pt-2 font-medium">
                  <span>Y-Axis: Square Centimeters (cm²)</span>
                  <span>X-Axis: Assessment Dates</span>
                </div>
              </Card>
            </div>
          </div>

          {/* CHRONOLOGICAL TIMELINE SLIDER */}
          <Card title="Chronological Wound Timeline">
            <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x">
              {woundAssessments.map((item) => {
                const area = getArea(item);
                const isVerified = item.status === 'Verified';
                const status = isVerified ? item.verifiedResult?.healingStatus : (item.aiResult?.healingStatus || 'Stable');

                return (
                  <div
                    key={item.id}
                    className="min-w-[170px] max-w-[170px] border border-slate-200 rounded-lg bg-white overflow-hidden shadow-2xs snap-start flex flex-col justify-between shrink-0"
                  >
                    <div className="relative h-28 bg-slate-900 flex items-center justify-center">
                      <img src={item.imageUrl} alt={item.date} className="h-full w-auto object-cover" />
                      <div className="absolute top-2 left-2 bg-slate-900/60 text-white font-mono text-[9px] px-1.5 py-0.5 rounded">
                        {item.date}
                      </div>
                    </div>
                    <div className="p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{area} cm²</span>
                        {status === 'Improving' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>}
                        {status === 'Stable' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                        {status === 'Requires Attention' && <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between">
                        <span>{getDims(item)}</span>
                        <span>{isVerified ? 'Verified' : 'AI Analysis'}</span>
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
                    <option key={a.id} value={a.id}>{a.date} (Record: {a.id})</option>
                  ))}
                </Select>
                <Select
                  label="Right Frame Image"
                  value={customRightAssId}
                  onChange={e => setCustomRightAssId(e.target.value)}
                >
                  {woundAssessments.map(a => (
                    <option key={a.id} value={a.id}>{a.date} (Record: {a.id})</option>
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
                    <span className="font-semibold text-slate-800">Frame A: {leftAssessment.date}</span>
                    <Badge variant={leftAssessment.status === 'Verified' ? 'verified' : 'pending'}>
                      {leftAssessment.status === 'Verified' ? 'Verified' : 'AI Assessment'}
                    </Badge>
                  </div>
                  <div className="relative h-64 md:h-72 flex items-center justify-center p-2 bg-slate-950">
                    <img src={leftAssessment.imageUrl} alt="Frame A Wound" className="h-full w-auto object-contain" />
                  </div>
                  <div className="bg-white p-3.5 border-t border-slate-150 text-xs grid grid-cols-2 gap-2 text-slate-700">
                    <div>Wound Area: <strong className="text-slate-900">{getArea(leftAssessment)} cm²</strong></div>
                    <div>Dimensions: <strong className="text-slate-900">{getDims(leftAssessment)}</strong></div>
                  </div>
                </div>

                {/* RIGHT FRAME */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900">
                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-800">Frame B: {rightAssessment.date}</span>
                    <Badge variant={rightAssessment.status === 'Verified' ? 'verified' : 'pending'}>
                      {rightAssessment.status === 'Verified' ? 'Verified' : 'AI Assessment'}
                    </Badge>
                  </div>
                  <div className="relative h-64 md:h-72 flex items-center justify-center p-2 bg-slate-950">
                    <img src={rightAssessment.imageUrl} alt="Frame B Wound" className="h-full w-auto object-contain" />
                  </div>
                  <div className="bg-white p-3.5 border-t border-slate-150 text-xs grid grid-cols-2 gap-2 text-slate-700">
                    <div>Wound Area: <strong className="text-slate-900">{getArea(rightAssessment)} cm²</strong></div>
                    <div>Dimensions: <strong className="text-slate-900">{getDims(rightAssessment)}</strong></div>
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
