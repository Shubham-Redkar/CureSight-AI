import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button } from '../components/ui';
import { FileText, Eye } from 'lucide-react';
import { apiFetch } from '../utils/api';

export const Reports: React.FC = () => {
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [isFetchingList, setIsFetchingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  
  const navigate = useNavigate();

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
                            onClick={() => navigate(`/reports/${ass.id}`)}
                            className="text-teal-700 hover:text-teal-900 hover:bg-teal-50 px-2 cursor-pointer font-medium"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            View
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
    </div>
  );
};
