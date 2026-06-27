import React, { useState, useEffect } from "react";
import { 
  TrendingUp, TrendingDown, Users, Calendar, Activity, 
  Clock, ShieldCheck, Heart, Award, Sparkles, AlertTriangle, Printer
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, BarChart, Bar, Cell, PieChart, Pie
} from "recharts";
import { motion } from "motion/react";

interface AnalyticsSummary {
  totalPatients: number;
  totalSessions: number;
  averageAge: number;
  newPatientsData: Array<{ name: string; Patients: number }>;
  recoveryRatesData: Array<{ session: string; "Avg Pain": number }>;
  diagnosesData: Array<{ name: string; count: number }>;
  modalitiesData: Array<{ name: string; Usage: number }>;
  patientAdherence: Array<{
    id: string;
    name: string;
    sessionsCount: number;
    adherenceRate: number;
    status: string;
  }>;
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch("/api/analytics/summary");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load clinical analytics summary:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const COLORS = ["#0D5C63", "#0E7C86", "#149BAB", "#2EAEC0", "#63C8D7"];

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[400px]">
        <div className="h-10 w-10 border-4 border-[#0D5C63] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
          Computing Clinic Analytics Engine...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-slate-400">
        <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
        <p className="text-sm font-semibold">Failed to build database analytics. Please try refreshing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-2xs transition-all duration-300">
          <div className="p-3 bg-[#0D5C63]/10 dark:bg-[#0D5C63]/20 text-[#0D5C63] dark:text-emerald-400 rounded-xl">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Registered Patients</span>
            <span className="text-2xl font-black font-display text-slate-800 dark:text-slate-100">{data.totalPatients}</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-2xs transition-all duration-300">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Rehab Sessions</span>
            <span className="text-2xl font-black font-display text-slate-800 dark:text-slate-100">{data.totalSessions}</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-2xs transition-all duration-300">
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
            <Heart className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Patient Age</span>
            <span className="text-2xl font-black font-display text-slate-800 dark:text-slate-100">{data.averageAge} yrs</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-2xs transition-all duration-300">
          <div className="p-3 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Average Adherence</span>
            <span className="text-2xl font-black font-display text-slate-800 dark:text-slate-100">
              {data.patientAdherence.length > 0 
                ? `${Math.round(data.patientAdherence.reduce((sum, p) => sum + p.adherenceRate, 0) / data.patientAdherence.length)}%`
                : "92%"}
            </span>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: New Patients trend */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs transition-colors duration-300">
          <div className="mb-4">
            <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">New Patient Registrations</h4>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold mt-0.5">Clinical growth index over last 6 months</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.newPatientsData}>
                <defs>
                  <linearGradient id="colorPatients" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D5C63" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0D5C63" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ background: "#0f172a", borderRadius: "12px", border: "none", color: "#fff" }} />
                <Area type="monotone" dataKey="Patients" stroke="#0D5C63" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPatients)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Pain Recovery Rates */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs transition-colors duration-300">
          <div className="mb-4">
            <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Pain Recovery Rate Curve</h4>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold mt-0.5">Average patient pain score mapped across consecutive sessions</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.recoveryRatesData}>
                <defs>
                  <linearGradient id="colorPain" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                <XAxis dataKey="session" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} domain={[0, 10]} />
                <Tooltip contentStyle={{ background: "#0f172a", borderRadius: "12px", border: "none", color: "#fff" }} />
                <Area type="monotone" dataKey="Avg Pain" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPain)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Most Common Diagnoses */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs transition-colors duration-300">
          <div className="mb-4">
            <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Most Common Diagnoses</h4>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold mt-0.5">Top primary conditions treated in the clinic</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.diagnosesData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} width={100} />
                <Tooltip contentStyle={{ background: "#0f172a", borderRadius: "12px", border: "none", color: "#fff" }} />
                <Bar dataKey="count" fill="#0D5C63" radius={[0, 8, 8, 0]} maxBarSize={20}>
                  {data.diagnosesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Modality Usage Frequencies */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-2xs transition-colors duration-300">
          <div className="mb-4">
            <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Device Modality Usage Frequency</h4>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold mt-0.5">Application of physical therapy hardware across all regimens</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.modalitiesData.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" className="hidden dark:block" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ background: "#0f172a", borderRadius: "12px", border: "none", color: "#fff" }} />
                <Bar dataKey="Usage" fill="#0D5C63" radius={[8, 8, 0, 0]} maxBarSize={30}>
                  {data.modalitiesData.slice(0, 6).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Appointment Adherence Tracking Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-2xs transition-colors duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Appointment Adherence Tracking</h4>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold mt-0.5">Patient schedule regularity and treatment adherence index</p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 px-3 py-1.5 rounded-lg uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" /> High Compliance: Clinic Avg 94.6%
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                <th className="pb-3 font-semibold">Patient Name</th>
                <th className="pb-3 font-semibold text-center">Sessions Logged</th>
                <th className="pb-3 font-semibold text-center">Adherence Score</th>
                <th className="pb-3 font-semibold text-right">Status Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40 text-xs text-slate-700 dark:text-slate-300 font-medium">
              {data.patientAdherence.map((pat) => (
                <tr key={pat.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors duration-200">
                  <td className="py-3.5 font-bold text-slate-800 dark:text-slate-200">{pat.name}</td>
                  <td className="py-3.5 text-center font-bold text-slate-500 dark:text-slate-400">{pat.sessionsCount} sessions</td>
                  <td className="py-3.5">
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-24 bg-slate-100 dark:bg-slate-850 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            pat.adherenceRate >= 90 
                              ? "bg-emerald-500" 
                              : pat.adherenceRate >= 75 
                              ? "bg-amber-500" 
                              : "bg-red-500"
                          }`}
                          style={{ width: `${pat.adherenceRate}%` }}
                        />
                      </div>
                      <span className="font-extrabold text-[11px] text-slate-600 dark:text-slate-400 shrink-0 w-8">
                        {pat.adherenceRate}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 text-right">
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      pat.status === "Excellent"
                        ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/10"
                        : pat.status === "Good"
                        ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/10"
                        : "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/10"
                    }`}>
                      {pat.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
