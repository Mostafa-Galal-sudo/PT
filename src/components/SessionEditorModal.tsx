import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, X, Save, RotateCcw, Sparkles, Loader2, Calendar, FileText } from "lucide-react";
import { parseTranscript } from "../utils/parser";
import { Session, ParseResult } from "../types";

interface SessionEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sessionData: any) => Promise<void>;
  patientId: string;
  patientName: string;
  sessionToEdit: Session | null;
  setStatusBarMessage: (msg: string) => void;
}

export default function SessionEditorModal({
  isOpen,
  onClose,
  onSave,
  patientId,
  patientName,
  sessionToEdit,
  setStatusBarMessage
}: SessionEditorModalProps) {
  const [formData, setFormData] = useState<ParseResult>({
    name: "",
    age: "",
    sex: "",
    doa: new Date().toISOString().split("T")[0], // used as date in sessions
    occupation: "",
    chief_complaint: "",
    history: "",
    radiograph_finding: "",
    examination: "",
    tens: false,
    faradic: false,
    heat: false,
    heat_duration: "",
    ir: false,
    ultrasound: false,
    us_duration: "",
    vibrator: false,
    laser: false,
    traction: false,
    traction_kg: "",
    electromagnetic: false,
    pneumatic: false
  });

  const [painLevel, setPainLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [highlightedFields, setHighlightedFields] = useState<Record<string, boolean>>({});
  const [isVoiceSigning, setIsVoiceSigning] = useState(false);
  const [voiceSignCode, setVoiceSignCode] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [speechError, setSpeechError] = useState("");

  const handleAISummarize = async () => {
    if (!transcript.trim()) {
      setStatusBarMessage("Please dictate or type notes before summarizing.");
      return;
    }
    setIsSummarizing(true);
    setStatusBarMessage("AI Scribe formatting and structuring your clinical note...");
    try {
      const res = await fetch("/api/ai/summarize-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          pain_level: painLevel,
          patientId
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTranscript(data.summary);
        setStatusBarMessage("Clinical note formatted and structured with AI!");
      } else {
        setStatusBarMessage("Failed to summarize note with AI.");
      }
    } catch (err) {
      console.error(err);
      setStatusBarMessage("Error summarizing note with AI.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const recognitionRef = useRef<any>(null);

  const saveSessionDirectly = (currentTranscript?: string) => {
    const payload = {
      ...formData,
      pain_level: painLevel,
      note: currentTranscript !== undefined ? currentTranscript : transcript,
      raw_transcript: currentTranscript !== undefined ? currentTranscript : transcript,
      is_edited: !!sessionToEdit
    };
    onSave(payload);
  };

  useEffect(() => {
    if (isOpen) {
      setIsVoiceSigning(false);
      setVoiceSignCode("");
      if (sessionToEdit) {
        // Load existing session values
        setFormData({
          name: patientName,
          age: "",
          sex: "",
          doa: sessionToEdit.created_at.split("T")[0],
          occupation: "",
          chief_complaint: sessionToEdit.chief_complaint || "",
          history: sessionToEdit.history || "",
          radiograph_finding: sessionToEdit.radiograph_finding || "",
          examination: sessionToEdit.examination || "",
          
          // Load specific session program checkboxes
          tens: !!sessionToEdit.program?.tens,
          faradic: !!sessionToEdit.program?.faradic,
          heat: !!sessionToEdit.program?.heat,
          heat_duration: sessionToEdit.program?.heat_duration || "",
          ir: !!sessionToEdit.program?.ir,
          ultrasound: !!sessionToEdit.program?.ultrasound,
          us_duration: sessionToEdit.program?.us_duration || "",
          vibrator: !!sessionToEdit.program?.vibrator,
          laser: !!sessionToEdit.program?.laser,
          traction: !!sessionToEdit.program?.traction,
          traction_kg: sessionToEdit.program?.traction_kg || "",
          electromagnetic: !!sessionToEdit.program?.electromagnetic,
          pneumatic: !!sessionToEdit.program?.pneumatic
        });
        setPainLevel(sessionToEdit.pain_level || 0);
        setTranscript(sessionToEdit.note || sessionToEdit.raw_transcript || "");
      } else {
        // New session: prefill fields
        setFormData({
          name: patientName,
          age: "",
          sex: "",
          doa: new Date().toISOString().split("T")[0],
          occupation: "",
          chief_complaint: "",
          history: "",
          radiograph_finding: "",
          examination: "",
          tens: false,
          faradic: false,
          heat: false,
          heat_duration: "",
          ir: false,
          ultrasound: false,
          us_duration: "",
          vibrator: false,
          laser: false,
          traction: false,
          traction_kg: "",
          electromagnetic: false,
          pneumatic: false
        });
        setPainLevel(0);
        setTranscript("");
      }
      setHighlightedFields({});
    }
  }, [isOpen, sessionToEdit, patientName]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "ar-EG";

      rec.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const fullText = (transcript + " " + finalTranscript + " " + interimTranscript).trim();
        setTranscript(fullText);

        // Check for Voice Signature / Approval commands in Arabic & English
        const lowerText = fullText.toLowerCase();
        const signatureKeywords = [
          "امضي", "اعتماد", "سجل الحالة", "امضاء", "توقيع", "حفظ",
          "سجل الجلسة", "اعتماد الجلسة", "حفظ الجلسة",
          "sign case", "save case", "approve case", "sign session", "save session"
        ];
        
        const hasKeyword = signatureKeywords.some(keyword => lowerText.includes(keyword));
        if (hasKeyword && !isVoiceSigning) {
          const randomCode = "VS-" + Math.floor(100000 + Math.random() * 900000);
          setVoiceSignCode(randomCode);
          setIsVoiceSigning(true);
          setStatusBarMessage("🎤 Voice signature command detected! Authenticating session...");
          rec.stop();
          setIsRecording(false);
          
          // Wait briefly for visual/audio feedback transition
          setTimeout(() => {
            saveSessionDirectly(fullText);
          }, 1500);
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        setSpeechError(event.error);
        if (event.error === "not-allowed") {
          setStatusBarMessage("Microphone permission denied. Grant permission or open the app in a new tab.");
          alert("Microphone Access Blocked!\n\nTo use voice dictation, please allow microphone access in your browser or click the 'Open in new tab' button at the top right of the screen if you are within an iframe.");
        } else if (event.error === "network") {
          setStatusBarMessage("Speech network error. Please open the app in a new tab to bypass browser iframe restrictions.");
        } else {
          setStatusBarMessage(`Mic Error: ${event.error}`);
        }
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    }
  }, [transcript, isOpen]);

  if (!isOpen) return null;

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Microphone recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setStatusBarMessage("Session notes dictation stopped. Parsing findings...");
      processVoiceTranscript(transcript);
    } else {
      setTranscript("");
      setHighlightedFields({});
      setSpeechError("");
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        setStatusBarMessage("Recording session notes live...");
      } catch (err) {
        console.error(err);
      }
    }
  };

  const processVoiceTranscript = async (textToParse: string) => {
    if (!textToParse.trim()) return;

    setIsParsing(true);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: textToParse })
      });

      if (res.ok) {
        const result: ParseResult = await res.json();
        applyParseResult(result);
        setStatusBarMessage("Session findings auto-filled with AI.");
      } else {
        const localResult = parseTranscript(textToParse);
        applyParseResult(localResult);
        setStatusBarMessage("Session findings parsed (fallback).");
      }
    } catch (err) {
      console.error(err);
      const localResult = parseTranscript(textToParse);
      applyParseResult(localResult);
      setStatusBarMessage("Session findings parsed (fallback).");
    } finally {
      setIsParsing(false);
    }
  };

  const applyParseResult = (result: ParseResult) => {
    const highlights: Record<string, boolean> = {};
    const updatedForm = { ...formData };

    const fieldsToParse: (keyof ParseResult)[] = [
      "chief_complaint", "history", "radiograph_finding", "examination",
      "tens", "faradic", "heat", "heat_duration", "ir", "ultrasound", "us_duration",
      "vibrator", "laser", "traction", "traction_kg", "electromagnetic", "pneumatic"
    ];

    fieldsToParse.forEach(field => {
      if (result[field] !== undefined && result[field] !== "" && result[field] !== false) {
        (updatedForm as any)[field] = result[field];
        highlights[field] = true;
      }
    });

    setFormData(updatedForm);
    setHighlightedFields(highlights);

    setTimeout(() => {
      setHighlightedFields({});
    }, 5000);
  };

  const handleInputChange = (field: keyof ParseResult, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSessionDirectly();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden select-none transition-colors">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-br from-slate-950 to-[#0D5C63] dark:to-teal-950 text-white">
          <div>
            <h3 className="text-base font-black font-display tracking-tight">
              {sessionToEdit ? `Edit Session Record • ${patientName}` : `Log Treatment Session • ${patientName}`}
            </h3>
            <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Physiotherapy progression log</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Row 1: Date & Interactive Pain Scale Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 transition-colors">
            <div>
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Session Log Date</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={formData.doa}
                  onChange={(e) => handleInputChange("doa", e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 focus:border-[#0D5C63] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#0D5C63]/10 dark:focus:ring-emerald-500/10 bg-white dark:bg-slate-900 rounded-xl outline-none text-xs font-bold text-slate-700 dark:text-slate-300 transition"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Patient Pain Scale Indicator</label>
                <span className="text-xs font-extrabold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-100/60 dark:border-red-900/30 px-2.5 py-0.5 rounded-full">
                  {painLevel}/10 Score
                </span>
              </div>
              
              {/* Tactile Score Pill Buttons */}
              <div className="flex items-center justify-between gap-1 mt-1">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                  const isActive = painLevel === num;
                  // Color spectrum from Emerald to Orange to Red
                  let hoverColor = "hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600";
                  let activeBg = "bg-emerald-600 text-white dark:bg-emerald-500";
                  if (num >= 7) {
                    hoverColor = "hover:bg-red-500 hover:text-white dark:hover:bg-red-600";
                    activeBg = "bg-red-600 text-white dark:bg-red-500";
                  } else if (num >= 4) {
                    hoverColor = "hover:bg-amber-500 hover:text-white dark:hover:bg-amber-600";
                    activeBg = "bg-amber-500 text-white dark:bg-amber-500";
                  }

                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPainLevel(num)}
                      className={`flex-1 text-[11px] font-black h-8 rounded-lg border transition-all duration-150 cursor-pointer ${
                        isActive
                          ? `${activeBg} border-transparent shadow-xs scale-105`
                          : `bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 ${hoverColor}`
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 font-bold tracking-wide uppercase mt-1.5 px-1">
                <span>0 No pain</span>
                <span>5 Moderate</span>
                <span>10 Severe</span>
              </div>
            </div>
          </div>

          {/* Row 2: Transcription scribe */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Live Voice dictation / session log notes</label>
              {isParsing && (
                <span className="text-[10px] text-[#0D5C63] dark:text-emerald-400 font-bold animate-pulse flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Gemini Scribing...
                </span>
              )}
            </div>
            
            <div className="relative border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950 p-4 shadow-inner flex flex-col gap-3">
              
              {/* Active Sound Waves Viz */}
              <div className="h-6 flex items-center justify-end gap-1 px-2.5">
                {isRecording ? (
                  <div className="flex items-center gap-0.5">
                    <span className="wave-bar w-0.5 bg-[#0D5C63] dark:bg-emerald-500 rounded-full" />
                    <span className="wave-bar w-0.5 bg-emerald-500 rounded-full" />
                    <span className="wave-bar w-0.5 bg-teal-500 rounded-full" />
                    <span className="wave-bar w-0.5 bg-[#0D5C63] dark:bg-emerald-450 rounded-full" />
                  </div>
                ) : (
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">System Mic Standby</span>
                )}
              </div>

              <div className="flex gap-4">
                <textarea
                  rows={3}
                  placeholder="Dictate live or enter session progress notes... (e.g. المريض اتحسن كتير وعنده وجع خفيف، اشتغلنا شد ٢٥ كيلو وموجات التراساوند ٥ دقايق)"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  onBlur={() => processVoiceTranscript(transcript)}
                  className="flex-1 bg-transparent text-slate-800 dark:text-slate-100 outline-none text-sm rtl-textarea leading-relaxed resize-none"
                />
                
                <div className="shrink-0 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`h-12 w-12 rounded-full flex items-center justify-center text-white transition shadow-md cursor-pointer ${
                      isRecording 
                        ? "bg-gradient-to-br from-red-500 to-pink-600 pulse-mic" 
                        : "bg-gradient-to-br from-[#0D5C63] to-teal-700 dark:from-emerald-600 dark:to-teal-800"
                    }`}
                    title={isRecording ? "Stop Recording" : "Start Recording"}
                  >
                    {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Speech Diagnostics Warning */}
              {speechError === "network" && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 leading-normal font-semibold space-y-1">
                  <span className="font-extrabold uppercase text-amber-900 dark:text-amber-400 block flex items-center gap-1">
                    ⚠️ Browser IFrame Limitation
                  </span>
                  <p>Speech recognition is restricted in the preview iframe. Click the <strong>"Open in new tab"</strong> button in the top-right corner to run with full microphone permissions.</p>
                </div>
              )}
              {speechError === "not-allowed" && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-[11px] text-red-800 dark:text-red-300 leading-normal font-semibold space-y-1">
                  <span className="font-extrabold uppercase text-red-900 dark:text-red-400 block">
                    ⚠️ Microphone Blocked
                  </span>
                  <p>Microphone permission denied. Grant permission in your browser address bar or click <strong>"Open in new tab"</strong> to authorize.</p>
                </div>
              )}

              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold border-t border-slate-100 dark:border-slate-800/80 pt-2 flex items-center justify-between gap-4">
                <span>{isRecording ? "🔴 RECORDING ARABIC VOICE LIVE..." : "🎙️ Dictate findings. AI Scribe parses parameters automatically."}</span>
                <button
                  type="button"
                  onClick={handleAISummarize}
                  disabled={isSummarizing || !transcript.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 dark:bg-[#0D5C63]/10 hover:bg-teal-100 dark:hover:bg-[#0D5C63]/20 text-[#0D5C63] dark:text-emerald-400 font-bold rounded-lg border border-teal-150 dark:border-[#0D5C63]/30 transition text-[10px] uppercase tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {isSummarizing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Structuring...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                      AI Clean & SOAP Summary
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Modal Clinical Fields */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 space-y-4 transition-colors">
            <h4 className="text-[11px] font-black text-[#0D5C63] dark:text-emerald-400 uppercase tracking-wider">Clinical Progress Observations</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Chief Complaint</label>
                <input
                  type="text"
                  placeholder="Update complaints"
                  value={formData.chief_complaint}
                  onChange={(e) => handleInputChange("chief_complaint", e.target.value)}
                  className={`w-full px-4 py-2 border rounded-xl outline-none text-xs transition bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rtl-textarea ${
                    highlightedFields.chief_complaint ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/25 shadow-glow-emerald" : "border-slate-200 dark:border-slate-800 focus:border-[#0D5C63] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#0D5C63]/10 dark:focus:ring-emerald-500/10"
                  }`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Physical Examination</label>
                <input
                  type="text"
                  placeholder="Update exams"
                  value={formData.examination}
                  onChange={(e) => handleInputChange("examination", e.target.value)}
                  className={`w-full px-4 py-2 border rounded-xl outline-none text-xs transition bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rtl-textarea ${
                    highlightedFields.examination ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/25 shadow-glow-emerald" : "border-slate-200 dark:border-slate-800 focus:border-[#0D5C63] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#0D5C63]/10 dark:focus:ring-emerald-500/10"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Row 4: Treatment checkbox program applied in this specific session */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4 transition-colors">
            <h4 className="text-xs font-extrabold text-[#0D5C63] dark:text-emerald-400 uppercase tracking-wider">Treatment Modalities Applied This Session</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              {/* Col 1 */}
              <div className="space-y-2">
                <label className={`flex items-center gap-2.5 p-1.5 rounded-lg cursor-pointer transition border border-transparent ${
                  formData.tens 
                    ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-855 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.tens}
                    onChange={(e) => handleInputChange("tens", e.target.checked)}
                    className="rounded text-[#0D5C63] dark:text-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  TENS
                </label>

                <label className={`flex items-center gap-2.5 p-1.5 rounded-lg cursor-pointer transition border border-transparent ${
                  formData.faradic 
                    ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-855 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.faradic}
                    onChange={(e) => handleInputChange("faradic", e.target.checked)}
                    className="rounded text-[#0D5C63] dark:text-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  Faradic Stimulation
                </label>

                <label className={`flex items-center gap-2.5 p-1.5 rounded-lg cursor-pointer transition border border-transparent ${
                  formData.electromagnetic 
                    ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-855 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.electromagnetic}
                    onChange={(e) => handleInputChange("electromagnetic", e.target.checked)}
                    className="rounded text-[#0D5C63] dark:text-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  Electromagnetic Field
                </label>
              </div>

              {/* Col 2 */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className={`flex items-center gap-2.5 p-1.5 rounded-lg cursor-pointer transition border border-transparent ${
                    formData.heat 
                      ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-855 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                      : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}>
                    <input
                      type="checkbox"
                      checked={formData.heat}
                      onChange={(e) => handleInputChange("heat", e.target.checked)}
                      className="rounded text-[#0D5C63] dark:text-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                    />
                    Heat Therapy
                  </label>
                  {formData.heat && (
                    <input
                      type="text"
                      placeholder="Duration (min)"
                      value={formData.heat_duration}
                      onChange={(e) => handleInputChange("heat_duration", e.target.value)}
                      className="ml-6 w-24 px-2 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-lg text-xs outline-none focus:border-[#0D5C63]"
                    />
                  )}
                </div>

                <label className={`flex items-center gap-2.5 p-1.5 rounded-lg cursor-pointer transition border border-transparent ${
                  formData.ir 
                    ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-855 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.ir}
                    onChange={(e) => handleInputChange("ir", e.target.checked)}
                    className="rounded text-[#0D5C63] dark:text-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  Infrared (IR)
                </label>

                <div className="space-y-1">
                  <label className={`flex items-center gap-2.5 p-1.5 rounded-lg cursor-pointer transition border border-transparent ${
                    formData.ultrasound 
                      ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-855 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                      : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}>
                    <input
                      type="checkbox"
                      checked={formData.ultrasound}
                      onChange={(e) => handleInputChange("ultrasound", e.target.checked)}
                      className="rounded text-[#0D5C63] dark:text-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                    />
                    Ultrasound (US)
                  </label>
                  {formData.ultrasound && (
                    <input
                      type="text"
                      placeholder="Duration (min)"
                      value={formData.us_duration}
                      onChange={(e) => handleInputChange("us_duration", e.target.value)}
                      className="ml-6 w-24 px-2 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-lg text-xs outline-none focus:border-[#0D5C63]"
                    />
                  )}
                </div>
              </div>

              {/* Col 3 */}
              <div className="space-y-2">
                <label className={`flex items-center gap-2.5 p-1.5 rounded-lg cursor-pointer transition border border-transparent ${
                  formData.vibrator 
                    ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-855 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.vibrator}
                    onChange={(e) => handleInputChange("vibrator", e.target.checked)}
                    className="rounded text-[#0D5C63] dark:text-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  Vibrator Massage
                </label>

                <label className={`flex items-center gap-2.5 p-1.5 rounded-lg cursor-pointer transition border border-transparent ${
                  formData.laser 
                    ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-855 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.laser}
                    onChange={(e) => handleInputChange("laser", e.target.checked)}
                    className="rounded text-[#0D5C63] dark:text-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  Laser Therapy
                </label>

                <div className="space-y-1">
                  <label className={`flex items-center gap-2.5 p-1.5 rounded-lg cursor-pointer transition border border-transparent ${
                    formData.traction 
                      ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-855 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                      : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}>
                    <input
                      type="checkbox"
                      checked={formData.traction}
                      onChange={(e) => handleInputChange("traction", e.target.checked)}
                      className="rounded text-[#0D5C63] dark:text-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                    />
                    Traction
                  </label>
                  {formData.traction && (
                    <input
                      type="text"
                      placeholder="Weight (kg)"
                      value={formData.traction_kg}
                      onChange={(e) => handleInputChange("traction_kg", e.target.value)}
                      className="ml-6 w-24 px-2 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-lg text-xs outline-none focus:border-[#0D5C63]"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

        </form>

        {/* Modal Footer Controls */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950 transition-colors">
          <div className="flex-1 flex items-center">
            {isVoiceSigning ? (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/20 px-3.5 py-1.5 rounded-xl shadow-xs">
                <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-450 uppercase tracking-wider font-mono">Voice Signature Captured ({voiceSignCode})</span>
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
                🎙️ Speak "امضي" or "حفظ الجلسة" to voice sign
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 transition cursor-pointer"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSubmit}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#0D5C63] hover:bg-[#0b4c52] dark:bg-emerald-600 dark:hover:bg-emerald-700 text-xs font-bold text-white rounded-xl transition shadow-md active:scale-95 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              Save Session Progress
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
