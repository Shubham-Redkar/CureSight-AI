import React, { useState, useRef, useEffect } from 'react';
import { useWounds } from '../context/WoundContext';
import { Card, Button } from '../components/ui';
import { ChevronLeft, Camera, Upload, AlertCircle, Info, RefreshCw } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { type AnalyzeTissueResponse } from '../types/tissue';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

import { useParams, useNavigate } from 'react-router-dom';

const COLORS: Record<string, string> = {
  Epithelial: '#FBCFE8', // pink-200
  Granulation: '#DC2626', // red-600
  Slough: '#CA8A04', // yellow-600
  Necrotic: '#1F2937', // gray-800
  Fibrin: '#FACC15', // yellow-400
  Callus: '#D1D5DB', // gray-300
  Other: '#9CA3AF', // gray-400
};

export const TissueAnalysis: React.FC = () => {
  const { woundId } = useParams<{ woundId: string }>();
  const navigate = useNavigate();
  const { patients, wounds } = useWounds();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [result, setResult] = useState<AnalyzeTissueResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const wound = wounds.find(w => String(w.id) === woundId);
  const patient = patients.find(p => p.id === wound?.patientId);

  useEffect(() => {
    if (selectedFile) {
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setStatus('idle');
      setResult(null);
      setErrorMessage('');
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setStatus('analyzing');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const res = await apiFetch('/api/analysis/tissue', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Authentication required or session expired.');
        } else if (res.status === 403) {
          throw new Error('You do not have permission to perform tissue analysis.');
        } else if (res.status === 413) {
          throw new Error('Uploaded image is too large.');
        } else if (res.status === 503) {
          throw new Error('Tissue inference service is currently unavailable. Please try again later.');
        }
        
        let errorText = 'Invalid image or analysis failed.';
        try {
          const errData = await res.json();
          if (errData.message || errData.error) {
            errorText = errData.message || errData.error;
          }
        } catch (e) {
          // Ignore json parse error
        }
        throw new Error(errorText);
      }

      const data: AnalyzeTissueResponse = await res.json();
      setResult(data);
      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'A network error occurred. Please try again.');
    }
  };

  const resetAnalysis = () => {
    setSelectedFile(null);
    setResult(null);
    setStatus('idle');
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!patient || !wound) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Patient or Wound not found.</p>
        <Button className="mt-4 cursor-pointer" onClick={() => navigate('/patients')}>Back to Patients</Button>
      </div>
    );
  }

  // Prepare chart data
  let chartData: any[] = [];
  let totalValid = 0;

  if (result && result.tissue_composition) {
    const comp = result.tissue_composition;
    totalValid = comp.epithelial + comp.granulation + comp.slough + comp.necrotic + comp.fibrin + comp.callus + comp.other;

    if (comp.epithelial > 0) chartData.push({ name: 'Epithelial', value: comp.epithelial });
    if (comp.granulation > 0) chartData.push({ name: 'Granulation', value: comp.granulation });
    if (comp.slough > 0) chartData.push({ name: 'Slough', value: comp.slough });
    if (comp.necrotic > 0) chartData.push({ name: 'Necrotic', value: comp.necrotic });
    if (comp.fibrin > 0) chartData.push({ name: 'Fibrin', value: comp.fibrin });
    if (comp.callus > 0) chartData.push({ name: 'Callus', value: comp.callus });
    if (comp.other > 0) chartData.push({ name: 'Other', value: comp.other });
  }

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(patient ? `/patients/${patient.id}` : '/patients')}
          className="bg-white border border-slate-200 rounded-md p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Tissue Analysis</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Patient: {patient.patientCode} • Wound: {wound.location}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Input & Preview */}
        <div className="space-y-6">
          <Card title="Wound Image Input">
            {!selectedFile ? (
              <div 
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Select or capture image</h4>
                <p className="text-xs text-slate-500">Supported formats: JPG, PNG</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex justify-center items-center h-64">
                  {previewUrl && (
                    <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                  )}
                </div>
                
                {status === 'idle' || status === 'error' ? (
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={resetAnalysis} className="flex-1 cursor-pointer">
                      Change Image
                    </Button>
                    <Button onClick={handleAnalyze} className="flex-1 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white flex justify-center items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Analyze Tissue
                    </Button>
                  </div>
                ) : status === 'analyzing' ? (
                  <Button disabled className="w-full flex justify-center items-center gap-2 opacity-70">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={resetAnalysis} className="w-full cursor-pointer">
                    Analyze Another Image
                  </Button>
                )}
              </div>
            )}
            
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileSelect}
            />

            {status === 'error' && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{errorMessage}</p>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN: Results */}
        <div className="space-y-6">
          {status === 'success' && result ? (
            <Card title="Analysis Results" className="h-full">
              <div className="space-y-6">
                
                {/* Clinical Disclaimer */}
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-sm font-semibold text-blue-900 mb-1">Clinical Disclaimer</h5>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      AI-generated tissue composition estimates. These results are not a clinical diagnosis or treatment recommendation.
                    </p>
                  </div>
                </div>

                {/* Annotated Image */}
                {result.annotated_image_base64 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold text-slate-700">AI-Estimated Tissue Composition Map</h5>
                    <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex justify-center items-center h-64">
                      <img src={result.annotated_image_base64} alt="Annotated Wound" className="max-h-full max-w-full object-contain" />
                    </div>
                  </div>
                )}

                {/* Chart & Percentages */}
                <div className="space-y-2">
                  <h5 className="text-sm font-semibold text-slate-700">Tissue Composition Estimates</h5>
                  
                  {totalValid > 0 ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="w-full sm:w-1/2 h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[entry.name] || COLORS.Other} />
                              ))}
                            </Pie>
                            <RechartsTooltip 
                              formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Percentage']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="w-full sm:w-1/2 flex flex-col gap-2">
                        {chartData.map(item => (
                          <div key={item.name} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[item.name] }}></span>
                              <span className="text-slate-600 font-medium">{item.name}</span>
                            </div>
                            <span className="font-bold text-slate-800">{item.value.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 rounded-lg border border-slate-100">
                      No wound tissue detected in the image.
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="text-[10px] text-slate-400 font-mono space-y-1">
                    <p>Model: {result.inference_metadata.model_name}</p>
                    <p>Version: {result.inference_metadata.model_version}</p>
                    <p>Message: {result.inference_metadata.message}</p>
                  </div>
                </div>

              </div>
            </Card>
          ) : status === 'analyzing' ? (
            <Card className="h-full flex flex-col items-center justify-center py-24 border-dashed border-2">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <h4 className="text-sm font-semibold text-slate-700">Analyzing Tissue...</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs text-center">
                Processing the image through the AI inference model. This may take a few moments.
              </p>
            </Card>
          ) : (
            <Card className="h-full flex flex-col items-center justify-center py-24 bg-slate-50/50">
              <Info className="w-12 h-12 text-slate-300 mb-3" />
              <h4 className="text-sm font-semibold text-slate-600">No Analysis Results</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs text-center">
                Upload or capture an image of the wound to see the AI-generated tissue composition estimates.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
