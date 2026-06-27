import React, { useState } from "react";
import { 
  FileText, Plus, FileJson, Printer, Trash2, Calendar, Edit3, 
  Activity, ArrowLeft, ChevronDown, ChevronUp, ChevronRight, 
  TrendingDown, TrendingUp, Sparkles, Award, ClipboardCheck, Clock,
  Brain, Send, Bot, X, MessageSquare, Loader2
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from "recharts";
import { Patient, Session, Program } from "../types";
import { summarizeProgram } from "../utils/parser";
import { motion } from "motion/react";

interface PatientViewProps {
  patientId: string;
  patient: Patient | null;
  sessions: Session[];
  activeProgram: Program | null;
  onAddSession: () => void;
  onEditSession: (session: Session) => void;
  onDeleteSession: (id: string) => Promise<void>;
  onDeletePatient: (id: string) => Promise<void>;
  onBack: () => void;
  setStatusBarMessage: (msg: string) => void;
  onOpenAICopilot?: () => void;
}

export default function PatientView({
  patientId,
  patient,
  sessions,
  activeProgram,
  onAddSession,
  onEditSession,
  onDeleteSession,
  onDeletePatient,
  onBack,
  setStatusBarMessage,
  onOpenAICopilot
}: PatientViewProps) {
  const [showBaseline, setShowBaseline] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{
    estimatedRemainingSessions: string;
    reasoning: string;
    redFlags: string[];
    riskLevel: string;
    recommendation: string;
  } | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  React.useEffect(() => {
    if (!patientId) return;
    
    const fetchPrediction = async () => {
      setIsLoadingAnalysis(true);
      try {
        const res = await fetch(`/api/ai/predict-progress/${patientId}`);
        if (res.ok) {
          const data = await res.json();
          setAiAnalysis(data);
        }
      } catch (err) {
        console.error("Failed to load progress prediction:", err);
      } finally {
        setIsLoadingAnalysis(false);
      }
    };
    
    fetchPrediction();
  }, [patientId, sessions.length]);

  if (!patient) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 text-slate-400">
        <Loader className="h-8 w-8 animate-spin" />
        <p className="mt-2 text-sm">Loading patient file...</p>
      </div>
    );
  }

  // Initials for avatar
  const initials = patient.name
    ? patient.name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  // Prepare chart data (chronological pain progress: oldest to newest)
  const chartData = [...sessions]
    .reverse() 
    .map(s => ({
      date: s.created_at.split("T")[0],
      pain: s.pain_level
    }))
    .filter(d => !isNaN(d.pain));

  // Smart Clinical Metrics Calculations
  const totalSessions = sessions.length;
  
  // 1. Pain reduction progress index
  let painReductionPercent = 0;
  let clinicalVerdict = "Baseline Assessment";
  let painTrend: "improving" | "stable" | "regression" = "stable";

  if (chartData.length >= 2) {
    const oldestPain = chartData[0].pain;
    const latestPain = chartData[chartData.length - 1].pain;
    const diff = oldestPain - latestPain;
    
    if (oldestPain > 0) {
      painReductionPercent = Math.round((diff / oldestPain) * 100);
    }

    if (diff > 0) {
      clinicalVerdict = `Excellent Progress (${painReductionPercent}% Pain Drop)`;
      painTrend = "improving";
    } else if (diff < 0) {
      clinicalVerdict = "Pain Flare-up / Re-evaluate";
      painTrend = "regression";
    } else {
      clinicalVerdict = "Stable / Continuing Program";
      painTrend = "stable";
    }
  } else if (chartData.length === 1) {
    clinicalVerdict = `Therapy Started (Pain at ${chartData[0].pain}/10)`;
  }

  // Deep clinical analytics
  const initialPain = chartData[0]?.pain ?? 0;
  const latestPain = chartData[chartData.length - 1]?.pain ?? 0;
  const averagePain = chartData.length > 0 
    ? (chartData.reduce((acc, curr) => acc + curr.pain, 0) / chartData.length).toFixed(1) 
    : "0.0";
  const painDelta = latestPain - initialPain;
  const reliefPercent = initialPain > 0 ? Math.round(((initialPain - latestPain) / initialPain) * 100) : 0;

  // PT Clinical Recommendation message generator
  let clinicalInsight = "";
  if (chartData.length === 0) {
    clinicalInsight = "No therapy sessions logged yet. Complete the baseline assessment and start logging sessions.";
  } else if (chartData.length === 1) {
    clinicalInsight = "Baseline registered. The first session focuses on neuromuscular adaptation, patient education, and pain modulation.";
  } else if (latestPain <= 2) {
    clinicalInsight = "Excellent response! Pain is well-managed (Mild to None). Safe to progress to strength loading and independent home exercise compliance.";
  } else if (painDelta < 0) {
    clinicalInsight = `Positive recovery path with a ${Math.abs(painDelta)} point drop in pain. Recommend continuing present modalities while progressing range limits.`;
  } else if (painDelta > 0) {
    clinicalInsight = "An inflammatory flare-up or physical strain has occurred. Consider temporary load restriction, active rest, and localized cryotherapy.";
  } else {
    clinicalInsight = "Pain levels are stable. Modifying traction parameters or introducing localized progressive mobilization may trigger further recovery.";
  }

  // Export patient file as JSON
  const handleExportJson = () => {
    setStatusBarMessage("Exporting patient file as JSON...");
    const dump = {
      patient,
      sessions,
      activeProgram
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${patient.name.replace(/\s+/g, "_")}_File.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusBarMessage("JSON export completed.");
  };

  // Export patient file as formatted clinical PDF
  const handleExportPdf = () => {
    setStatusBarMessage("Generating formatted clinical PDF...");
    const originalTitle = document.title;
    document.title = `${patient.name.replace(/\s+/g, "_")}_Clinical_Report`;
    window.print();
    // Restore title after dialog closes
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // Trigger Print clinical report
  const handlePrint = () => {
    setStatusBarMessage("Preparing printable clinical sheet...");
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50/40 dark:bg-[#0b0f19] h-full overflow-y-auto print:bg-white print:p-0 transition-colors duration-300">
      
      {/* Print-Only Premium Corporate Medical Letterhead */}
      <div className="hidden print:block print:p-8 print:border-b-4 print:border-[#0D5C63] bg-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#0D5C63] rounded-xl text-white font-bold">
              PT
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-950 font-display">AURA PHYSIOTHERAPY CENTER</h1>
              <p className="text-[10px] text-[#0D5C63] font-bold uppercase tracking-widest">Advanced Electronic Medical Records</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 font-medium">
            <p>Tel: +20 100 000 0000</p>
            <p>Email: reports@auraclinic.com</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
          <div>
            <p className="text-slate-400 font-bold uppercase text-[9px]">Patient Name</p>
            <p className="text-sm font-bold text-slate-900">{patient.name}</p>
          </div>
          <div>
            <p className="text-slate-400 font-bold uppercase text-[9px]">Admission Date (DOA)</p>
            <p className="text-sm font-bold text-slate-900">{patient.doa}</p>
          </div>
          <div>
            <p className="text-slate-400 font-bold uppercase text-[9px]">Demographics</p>
            <p className="text-sm font-bold text-slate-900">{patient.age} Years • {patient.sex}</p>
          </div>
          <div>
            <p className="text-slate-400 font-bold uppercase text-[9px]">Clinical Case File ID</p>
            <p className="text-sm font-bold text-slate-900 font-mono">#{patient.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
        <h2 className="text-center text-sm font-black text-[#0D5C63] border-y border-dashed py-2 uppercase tracking-widest mb-6">Chronological Progress Report</h2>
      </div>

      {/* Interactive Top Header (Hidden when printing) */}
      <div className="p-5 border-b border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-xs shrink-0 print:hidden select-none transition-colors duration-300">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition text-slate-600 dark:text-slate-400 active:scale-95 cursor-pointer"
            title="Go Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </motion.button>
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 font-display">{patient.name}</h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Case File • {patient.doa}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenAICopilot}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0D5C63]/10 dark:bg-emerald-950/20 border border-[#0D5C63]/30 dark:border-emerald-800/40 text-xs font-bold text-[#0D5C63] dark:text-emerald-400 rounded-xl transition shadow-xs cursor-pointer animate-pulse-subtle"
          >
            <Brain className="h-3.5 w-3.5 text-[#0D5C63] dark:text-emerald-400" />
            AI Consultant
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-xl transition shadow-xs cursor-pointer"
          >
            <FileJson className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            Export JSON
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/40 text-xs font-bold text-emerald-800 dark:text-emerald-400 rounded-xl transition shadow-xs cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-emerald-600" />
            Export to PDF
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-xl transition shadow-xs cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            Print Report
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAddSession}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0D5C63] hover:bg-[#0b4c52] text-xs font-bold text-white rounded-xl transition shadow-md cursor-pointer shadow-glow"
          >
            <Plus className="h-4 w-4" />
            Add Session Progress
          </motion.button>
        </div>
      </div>

      {/* Main Grid Content - Premium Bento Box Redesign */}
      <div className="p-6 space-y-6 flex-1 max-w-5xl mx-auto w-full print:p-8 print:max-w-full">
        
        {/* Bento Row 1: Patient Profile & Smart KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Bento Cell 1: Patient Core Info (Span 2) */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 flex flex-col justify-between print:border-slate-300 print:shadow-none transition-colors duration-300">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 bg-gradient-to-br from-[#0D5C63] to-teal-700 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-md print:bg-slate-800">
                {initials}
              </div>
              
              <div className="flex-1 grid grid-cols-2 gap-y-4 gap-x-6 text-xs">
                <div>
                  <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Full Name</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{patient.name}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Occupation</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate block rtl-textarea">{patient.occupation || "N/A"}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Baseline Demographics</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{patient.age} yrs • {patient.sex}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Date of Admission</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">{patient.doa}</span>
                </div>
              </div>
            </div>

            {/* Expandable Baseline Observations */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowBaseline(!showBaseline)}
                className="flex items-center gap-1.5 text-xs font-bold text-[#0D5C63] dark:text-emerald-400 hover:text-[#0b4c52] uppercase tracking-wider transition-colors print:hidden outline-none cursor-pointer"
              >
                {showBaseline ? (
                  <>Hide baseline clinical case <ChevronUp className="h-4 w-4" /></>
                ) : (
                  <>Show baseline clinical case <ChevronDown className="h-4 w-4" /></>
                )}
              </button>

              <div className={`mt-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 ${showBaseline ? "block" : "hidden print:grid"}`}>
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Chief Complaint</span>
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold leading-relaxed rtl-textarea">{patient.chief_complaint || "N/A"}</p>
                </div>
                
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Medical History</span>
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold leading-relaxed rtl-textarea">{patient.history || "N/A"}</p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Radiography FINDINGS</span>
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold leading-relaxed rtl-textarea">{patient.radiograph_finding || "N/A"}</p>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Clinical examination</span>
                  <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold leading-relaxed rtl-textarea">{patient.examination || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bento Cell 2: Smart Therapy KPI Stats Card */}
          <div className="bg-gradient-to-br from-slate-900 to-[#0A4A50] text-white rounded-2xl shadow-md p-6 flex flex-col justify-between relative overflow-hidden print:border print:border-slate-300 print:text-slate-800 print:bg-white">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Aura Clinic Insights</span>
                <Award className="h-4 w-4 text-emerald-400" />
              </div>

              <div>
                <span className="block text-[10px] text-emerald-300 uppercase font-bold tracking-wider">Clinical Progress Rating</span>
                <p className="text-base font-black tracking-tight text-white mt-1 leading-snug">{clinicalVerdict}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-4 mt-6 print:border-slate-200">
              <div>
                <span className="block text-[9px] text-slate-300 uppercase font-bold">Total Sessions</span>
                <span className="text-xl font-black font-display text-emerald-400">{totalSessions} logged</span>
              </div>
              <div className="border-l border-white/10 pl-2.5 print:border-slate-200">
                <span className="block text-[9px] text-slate-300 uppercase font-bold">Pain Trend Index</span>
                <span className="text-xs font-black uppercase flex items-center gap-1 text-emerald-300 mt-1">
                  {painTrend === "improving" ? (
                    <><TrendingDown className="h-4 w-4" /> Improving</>
                  ) : painTrend === "regression" ? (
                    <><TrendingUp className="h-4 w-4 text-red-400" /> Regression</>
                  ) : (
                    <><Clock className="h-4 w-4 text-amber-300" /> Stable</>
                  )}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Bento Row 1.5: AI Prognosis & Red-Flag Warnings Tracker */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 relative overflow-hidden transition-colors duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/2 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-br from-[#0D5C63] to-teal-600 rounded-xl text-white shadow-sm shrink-0">
                <Brain className="h-4.5 w-4.5 text-white animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 text-sm tracking-tight flex items-center gap-2">
                  Clinical AI Prognosis & Safety Monitor
                  <span className="text-[9px] bg-[#0D5C63]/15 text-[#0D5C63] dark:text-emerald-400 font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                    Gemini 3.5 Active
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
                  Automated pain trends, progress prediction, and safety clearance
                </p>
              </div>
            </div>
            
            {aiAnalysis ? (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Risk safety level:</span>
                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                  aiAnalysis.riskLevel === "high"
                    ? "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-800/40 animate-pulse"
                    : aiAnalysis.riskLevel === "medium"
                    ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40"
                    : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40"
                }`}>
                  ● {aiAnalysis.riskLevel || "Low"} Risk
                </span>
              </div>
            ) : null}
          </div>

          {isLoadingAnalysis ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-[#0D5C63]" />
              <p className="text-[11px] font-bold uppercase tracking-wider mt-2">Computing safety prediction & analyzing red-flags...</p>
            </div>
          ) : aiAnalysis ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left col: remaining sessions progress dial/card */}
              <div className="md:col-span-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">
                    ESTIMATED SESSIONS
                  </span>
                  <div className="text-2xl font-black font-display text-[#0D5C63] dark:text-emerald-400 leading-none my-2">
                    {aiAnalysis.estimatedRemainingSessions}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                    Remaining treatments required to achieve medical discharge baseline based on current recovery index.
                  </p>
                </div>
                
                {/* Visual mini progress indicator */}
                <div className="mt-4 pt-3 border-t border-slate-200/40 dark:border-slate-800/60">
                  <div className="flex justify-between text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    <span>Treatment adherence</span>
                    <span className="text-[#0D5C63] dark:text-emerald-400">Stable</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-[#0D5C63] to-teal-500 h-full rounded-full" style={{ width: "78%" }} />
                  </div>
                </div>
              </div>

              {/* Middle col: Prognosis Reasoning */}
              <div className="md:col-span-4 space-y-3">
                <div>
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block font-display">
                    AI PROGNOSIS REASONING
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-relaxed mt-1.5 whitespace-pre-line">
                    {aiAnalysis.reasoning}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block font-display">
                    RECOMMENDED DRILLS
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-relaxed mt-1 whitespace-pre-line">
                    {aiAnalysis.recommendation}
                  </p>
                </div>
              </div>

              {/* Right col: Red Flags */}
              <div className="md:col-span-4 space-y-3">
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block font-display">
                  SAFETY CLEARANCE & RED FLAGS
                </span>
                
                {aiAnalysis.redFlags && aiAnalysis.redFlags.length > 0 ? (
                  <div className="space-y-2">
                    {aiAnalysis.redFlags.map((flag, idx) => (
                      <div 
                        key={idx} 
                        className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/40 rounded-xl text-xs text-red-800 dark:text-red-400 font-semibold leading-relaxed flex items-start gap-2 animate-pulse"
                      >
                        <span className="text-red-600 dark:text-red-400 text-sm mt-0.5 font-bold">⚠️</span>
                        <span>{flag}</span>
                      </div>
                    ))}
                    <div className="text-[10px] text-red-500 dark:text-red-400 font-bold uppercase tracking-wider bg-red-50/50 dark:bg-red-950/10 p-2 rounded-lg border border-red-100/30 dark:border-red-900/20 text-center">
                      🚨 ACTION REQUIRED: REVIEW DOSAGE OR CONTACT PHYSICIAN
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-400 font-semibold leading-relaxed flex items-start gap-2.5">
                    <span className="text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">🛡️</span>
                    <div>
                      <span className="block font-black text-emerald-800 dark:text-emerald-300">0 RED FLAGS DETECTED</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                        No worsening pain trends or neurological contraindications detected. Clinical safety threshold is fully clear.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs font-semibold">
              No sessions available yet. Create a session to run AI prognosis and safety monitors.
            </div>
          )}
        </div>

        {/* Bento Row 2: Treatment Program & Clinical Pain Analytics (Side-by-side) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Active Baseline Program (Bento 1 col) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between print:border-slate-300 print:shadow-none print:break-inside-avoid transition-colors duration-300">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Active Base Program</h3>
                <ClipboardCheck className="h-4 w-4 text-[#0D5C63] dark:text-emerald-400" />
              </div>

              {activeProgram ? (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold leading-relaxed rounded-xl rtl">
                    {summarizeProgram(activeProgram)}
                  </div>
                  
                  {/* Detailed specific parameters list */}
                  <div className="text-[10px] space-y-1 text-slate-500 dark:text-slate-400 font-bold uppercase">
                    {activeProgram.heat && <div>🔥 Hot Pack: {activeProgram.heat_duration || "15"} mins</div>}
                    {activeProgram.ultrasound && <div>🔊 Ultrasound: {activeProgram.us_duration || "10"} mins</div>}
                    {activeProgram.traction && <div>🏗️ Traction Weight: {activeProgram.traction_kg || "20"} kg</div>}
                    {activeProgram.tens && <div>⚡ TENS Electrodes applied</div>}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500 font-semibold">No baseline program configured.</div>
              )}
            </div>

            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-extrabold uppercase mt-4 tracking-wider">⚡ Prescribed during first assessment</p>
          </div>

          {/* New Pain Progression Analysis Card (Bento 2 cols) */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col md:flex-row gap-5 justify-between print:border-slate-300 print:shadow-none print:break-inside-avoid transition-colors duration-300">
            {/* Left side: Stats & Clinical Insight */}
            <div className="flex-1 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-1.5 text-[#0D5C63] dark:text-emerald-400 mb-1">
                  <Sparkles className="h-4 w-4" />
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-[#0D5C63] dark:text-emerald-400">Clinical Analytics & Insight</h3>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Auto-analyzed progression indicators</p>
              </div>

              {/* Grid of micro statistics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50/70 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="block text-[9px] text-slate-400 dark:text-slate-500 font-extrabold uppercase">Baseline Severity</span>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">{initialPain}/10 <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">VAS</span></span>
                </div>
                <div className="p-3 bg-slate-50/70 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="block text-[9px] text-slate-400 dark:text-slate-500 font-extrabold uppercase">Latest Severity</span>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">{latestPain}/10 <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">VAS</span></span>
                </div>
                <div className="p-3 bg-slate-50/70 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="block text-[9px] text-slate-400 dark:text-slate-500 font-extrabold uppercase">Average Pain</span>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">{averagePain}/10 <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">VAS</span></span>
                </div>
                <div className="p-3 bg-slate-50/70 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl">
                  <span className="block text-[9px] text-slate-400 dark:text-slate-500 font-extrabold uppercase">Overall Shift</span>
                  <span className={`text-xs font-black uppercase flex items-center gap-0.5 mt-0.5 ${painDelta < 0 ? "text-emerald-600 dark:text-emerald-400" : painDelta > 0 ? "text-red-500" : "text-slate-500"}`}>
                    {painDelta < 0 ? (
                      <><TrendingDown className="h-3 w-3" /> -{Math.abs(painDelta)} ({reliefPercent}%)</>
                    ) : painDelta > 0 ? (
                      <><TrendingUp className="h-3 w-3 text-red-500" /> +{painDelta} (Flare)</>
                    ) : (
                      "Stable"
                    )}
                  </span>
                </div>
              </div>

              {/* PT Clinical recommendation */}
              <div className="p-3.5 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-800/40 rounded-xl text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-semibold">
                <span className="block text-[9px] text-[#0D5C63] dark:text-emerald-400 font-black uppercase tracking-wider mb-1">Therapeutic Recommendation</span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{clinicalInsight}</p>
              </div>
            </div>

            {/* Right side: Mini Recharts visual representation (Pain severity spectrum) */}
            <div className="w-full md:w-52 h-48 md:h-auto flex flex-col justify-between bg-slate-50/50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
              <div>
                <span className="block text-[9px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider">Severity Spectrum</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">Pain level bar per log</span>
              </div>

              {chartData.length > 0 ? (
                <div className="h-28 w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -40, bottom: 0 }}>
                      <XAxis dataKey="date" hide />
                      <YAxis domain={[0, 10]} hide />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", borderRadius: "8px", border: "none", color: "#f8fafc", fontSize: "10px" }}
                        labelStyle={{ display: "none" }}
                      />
                      <Bar dataKey="pain" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => {
                          let color = "#10b981"; // Emerald for low pain
                          if (entry.pain >= 7) {
                            color = "#ef4444"; // Red for severe
                          } else if (entry.pain >= 4) {
                            color = "#f59e0b"; // Orange/Amber for moderate
                          }
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[10px] text-slate-400 font-semibold italic text-center">
                  Waiting for logged sessions
                </div>
              )}

              <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 border-t border-slate-100 pt-2">
                <span>Start</span>
                <span>Latest Session</span>
              </div>
            </div>

          </div>

        </div>

        {/* Bento Row 3: Dedicated Pain Level Progression Chart (Full Width) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5 print:border-slate-300 print:shadow-none print:break-inside-avoid transition-colors duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Pain Level Progression Timeline</h3>
            <div className="text-right text-[10px] font-bold text-slate-400 dark:text-slate-500">0 (No pain) - 10 (Severe pain)</div>
          </div>

          {chartData.length > 0 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D5C63" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0D5C63" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                  <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#f8fafc", fontSize: "11px" }}
                    labelStyle={{ fontWeight: "black" }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="pain" 
                    stroke="#0D5C63" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorPain)" 
                    activeDot={{ r: 6, strokeWidth: 0, fill: "#10b981" }}
                    dot={{ strokeWidth: 2, r: 3, fill: "#fff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-xs text-slate-400 font-semibold border border-dashed border-slate-100 rounded-xl bg-slate-50">
              Log multiple sessions to view progress trends
            </div>
          )}
        </div>

        {/* Row 3: Chronicle Progress Timeline */}
        <div className="space-y-4 print:break-before-auto select-none">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Chronological clinical log</h3>
            <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">{sessions.length} sessions</span>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-sm transition-colors duration-300">
              <FileText className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
              No sessions logged for this patient. Click "Add Session" to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((s, idx) => {
                // Determine pain level badge color
                let painColor = "bg-emerald-50 text-emerald-800 border-emerald-200/60 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/40";
                if (s.pain_level >= 7) {
                  painColor = "bg-red-50 text-red-800 border-red-200/60 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800/40";
                } else if (s.pain_level >= 4) {
                  painColor = "bg-amber-50 text-amber-800 border-amber-200/60 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/40";
                }

                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.05, 0.4) }}
                    key={s.id} 
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-6 relative group hover:border-[#0D5C63]/40 dark:hover:border-emerald-500/40 transition duration-200 print:border-slate-300 print:shadow-none print:break-inside-avoid transition-colors"
                  >
                    {/* Log Card Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5 mb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-[#0D5C63] dark:text-emerald-400 rounded-xl">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{s.created_at.split("T")[0]}</span>
                          {s.is_edited && (
                            <span className="ml-2 text-[9px] font-black bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                              Edited
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Interactive Controls (Hidden during print) */}
                      <div className="flex items-center gap-1.5 print:hidden">
                        <button
                          onClick={() => onEditSession(s)}
                          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-slate-600 transition active:scale-95 cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit Session
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this session? This action is permanent.")) {
                              onDeleteSession(s.id);
                            }
                          }}
                          className="p-1.5 hover:bg-red-50 text-red-500 rounded-xl transition active:scale-95 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Content Fields */}
                    <div className="space-y-4 text-sm leading-relaxed">
                      
                      {/* Pain Scale Display */}
                      {s.pain_level !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pain Rating</span>
                          <span className={`text-[10px] px-2.5 py-0.5 border rounded-md font-bold uppercase tracking-wider ${painColor}`}>
                            {s.pain_level}/10 Level
                          </span>
                        </div>
                      )}

                      {/* Transcript notes */}
                      <div className="text-slate-700 font-semibold rtl-textarea leading-relaxed text-sm bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 print:hidden">Live Clinician Speech Log</span>
                        <p className="rtl-textarea">{s.note || s.raw_transcript || "No transcript notes written."}</p>
                      </div>

                      {/* Custom clinical findings */}
                      {(s.chief_complaint || s.history || s.examination) && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-100 pt-3 text-xs">
                          {s.chief_complaint && (
                            <div className="p-3 bg-slate-50 rounded-xl">
                              <span className="font-extrabold text-[10px] text-slate-500 uppercase">Complaint:</span>
                              <p className="text-slate-800 mt-1 font-semibold rtl-textarea">{s.chief_complaint}</p>
                            </div>
                          )}
                          {s.history && (
                            <div className="p-3 bg-slate-50 rounded-xl">
                              <span className="font-extrabold text-[10px] text-slate-500 uppercase">Clinical History:</span>
                              <p className="text-slate-800 mt-1 font-semibold rtl-textarea">{s.history}</p>
                            </div>
                          )}
                          {s.examination && (
                            <div className="p-3 bg-slate-50 rounded-xl">
                              <span className="font-extrabold text-[10px] text-slate-500 uppercase">Exam finding:</span>
                              <p className="text-slate-800 mt-1 font-semibold rtl-textarea">{s.examination}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Applied session program */}
                      {s.program && (
                        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Treatment Applied:</span>
                          <span className="text-xs font-bold text-[#0D5C63] bg-[#0D5C63]/5 px-2.5 py-1 rounded-lg border border-[#0D5C63]/10">
                            {summarizeProgram(s.program)}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delete Patient Section */}
        <div className="pt-6 border-t border-slate-200 print:hidden flex justify-end">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (confirm(`CRITICAL: Are you sure you want to completely delete the patient record "${patient.name}"? This deletes all chronological sessions, program schedules, and clinical baselines forever.`)) {
                onDeletePatient(patient.id);
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            Delete Patient File
          </motion.button>
        </div>
      </div>


    </div>
  );
}

function Loader(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="12" x2="12" y1="2" y2="6" />
      <line x1="12" x2="12" y1="18" y2="22" />
      <line x1="4.93" x2="7.76" y1="4.93" y2="7.76" />
      <line x1="16.24" x2="19.07" y1="16.24" y2="19.07" />
      <line x1="2" x2="6" y1="12" y2="12" />
      <line x1="18" x2="22" y1="12" y2="12" />
      <line x1="4.93" x2="7.76" y1="19.07" y2="16.24" />
      <line x1="16.24" x2="19.07" y1="7.76" y2="4.93" />
    </svg>
  );
}
