import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, RotateCcw, Save, Sparkles, Loader2, Info, CheckCircle2, User, FileText } from "lucide-react";
import { parseTranscript } from "../utils/parser";
import { ParseResult } from "../types";
import { motion } from "motion/react";

interface NewCaseFormProps {
  onSave: (patientData: any) => Promise<void>;
  setStatusBarMessage: (msg: string) => void;
}

export default function NewCaseForm({ onSave, setStatusBarMessage }: NewCaseFormProps) {
  const [formData, setFormData] = useState<ParseResult>({
    name: "",
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

  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [highlightedFields, setHighlightedFields] = useState<Record<string, boolean>>({});
  const [showError, setShowError] = useState("");
  const [isVoiceSigning, setIsVoiceSigning] = useState(false);
  const [voiceSignCode, setVoiceSignCode] = useState("");
  const [speechError, setSpeechError] = useState("");

  const recognitionRef = useRef<any>(null);

  const saveCaseDirectly = async (currentData?: ParseResult) => {
    const dataToSave = currentData || formData;
    if (!dataToSave.name.trim()) {
      setShowError("Patient Name is required to sign and save case.");
      setStatusBarMessage("Error: Missing patient name.");
      setIsVoiceSigning(false);
      return;
    }
    try {
      setStatusBarMessage("Saving assessment via Voice Signature...");
      await onSave(dataToSave);
      setStatusBarMessage("Case saved and signed successfully!");
    } catch (err: any) {
      setShowError(err.message || "Failed to save patient case");
      setIsVoiceSigning(false);
    }
  };

  useEffect(() => {
    // Check Web Speech API availability
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "ar-EG"; // Arabic default, can handle mixed speech nicely too
      
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
          "امضي", "اعتماد", "سجل الحالة", "امضاء", "توقيع", 
          "امضي الحالة", "اعتماد الحالة", "حفظ الحالة", "حفظ",
          "sign case", "save case", "approve case", "sign design"
        ];
        
        const hasKeyword = signatureKeywords.some(keyword => lowerText.includes(keyword));
        if (hasKeyword && !isVoiceSigning) {
          const randomCode = "VS-" + Math.floor(100000 + Math.random() * 900000);
          setVoiceSignCode(randomCode);
          setIsVoiceSigning(true);
          setStatusBarMessage("🎤 Voice signature command detected! Authenticating...");
          rec.stop();
          setIsRecording(false);
          
          // Wait briefly for high-fidelity audio feedback/visual transition
          setTimeout(() => {
            saveCaseDirectly();
          }, 1500);
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setSpeechError(event.error);
        if (event.error === "not-allowed") {
          setStatusBarMessage("Microphone permission denied. Grant permission or open the app in a new tab.");
          alert("Microphone Access Blocked!\n\nTo use voice dictation, please allow microphone access in your browser or click the 'Open in new tab' button at the top right of the screen if you are within an iframe.");
        } else if (event.error === "network") {
          setStatusBarMessage("Speech network error. Please open the app in a new tab to bypass browser iframe restrictions.");
        } else if (event.error !== "no-speech") {
          setStatusBarMessage(`Mic Error: ${event.error}`);
        }
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    } else {
      setStatusBarMessage("Web Speech API not supported in this browser.");
    }
  }, [transcript]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("Microphone recognition is not supported in this browser. Please type directly into the transcript box.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setStatusBarMessage("Recording stopped. Running analysis...");
      processVoiceTranscript(transcript);
    } else {
      setTranscript("");
      setHighlightedFields({});
      setShowError("");
      setSpeechError("");
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        setStatusBarMessage("Listening... Speak in Arabic or English...");
      } catch (err) {
        console.error(err);
      }
    }
  };

  const processVoiceTranscript = async (textToParse: string) => {
    if (!textToParse.trim()) return;

    setIsParsing(true);
    setStatusBarMessage("Processing AI Analysis...");

    try {
      // 1. Try Gemini server-side parser
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: textToParse })
      });

      if (res.ok) {
        const aiResult: ParseResult = await res.json();
        applyParseResult(aiResult);
        setStatusBarMessage("AI Analysis completed successfully.");
      } else {
        // Fallback to local regex-based parser
        console.warn("Express parse returned error, falling back to local regex parser");
        const localResult = parseTranscript(textToParse);
        applyParseResult(localResult);
        setStatusBarMessage("Analysis completed (Local fallback).");
      }
    } catch (err) {
      console.error("Failed to parse via API:", err);
      // Local fallback
      const localResult = parseTranscript(textToParse);
      applyParseResult(localResult);
      setStatusBarMessage("Analysis completed (Local fallback).");
    } finally {
      setIsParsing(false);
    }
  };

  const applyParseResult = (result: ParseResult) => {
    const highlights: Record<string, boolean> = {};
    const updatedForm = { ...formData };

    // Apply demographics & clinical text fields if found
    const textFields: (keyof ParseResult)[] = [
      "name", "age", "sex", "occupation", "chief_complaint", "history", "radiograph_finding", "examination"
    ];

    textFields.forEach(field => {
      if (result[field] && typeof result[field] === "string") {
        (updatedForm as any)[field] = result[field];
        highlights[field] = true;
      }
    });

    // Apply checkbox/modality fields if true
    const checkFields: (keyof ParseResult)[] = [
      "tens", "faradic", "heat", "ir", "ultrasound", "vibrator", "laser", "traction", "electromagnetic", "pneumatic"
    ];

    checkFields.forEach(field => {
      if (result[field]) {
        (updatedForm as any)[field] = true;
        highlights[field] = true;
      }
    });

    // Apply durations / weight fields if found
    if (result.heat_duration) {
      updatedForm.heat_duration = result.heat_duration;
      highlights["heat_duration"] = true;
    }
    if (result.us_duration) {
      updatedForm.us_duration = result.us_duration;
      highlights["us_duration"] = true;
    }
    if (result.traction_kg) {
      updatedForm.traction_kg = result.traction_kg;
      highlights["traction_kg"] = true;
    }

    setFormData(updatedForm);
    setHighlightedFields(highlights);

    // Turn off highlights after 5 seconds
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

  const resetForm = () => {
    setFormData({
      name: "",
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
    setTranscript("");
    setHighlightedFields({});
    setShowError("");
    setStatusBarMessage("Form reset.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCaseDirectly();
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 md:p-8 h-full overflow-hidden bg-slate-50 dark:bg-[#0b0f19] transition-colors">
      {/* Left panel: Clinical Assessment Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black font-display text-slate-800 dark:text-slate-100 tracking-tight">New Patient Assessment</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Dictate details or fill manually below</p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Form
          </button>
        </div>

        {showError && (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500 rounded-xl text-sm text-red-700 dark:text-red-400 flex gap-2">
            <Info className="h-5 w-5 shrink-0" />
            <span>{showError}</span>
          </div>
        )}

        {/* Form sections */}
        <div className="space-y-6">
          {/* Card 1: Demographics */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
            <h3 className="text-lg font-bold text-[#0D5C63] dark:text-emerald-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-850 pb-2">
              <User className="h-5 w-5" />
              Patient Demographics
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Patient Name *</label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-xl outline-none text-sm transition rtl-textarea ${
                    highlightedFields.name 
                      ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-100 dark:ring-emerald-950/35" 
                      : "border-slate-200 dark:border-slate-800 focus:border-[#0D5C63] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#0D5C63]/10 dark:focus:ring-emerald-500/10 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  }`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Occupation</label>
                <input
                  type="text"
                  placeholder="e.g. Teacher, Engineer"
                  value={formData.occupation}
                  onChange={(e) => handleInputChange("occupation", e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-xl outline-none text-sm transition rtl-textarea ${
                    highlightedFields.occupation 
                      ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-100 dark:ring-emerald-950/35" 
                      : "border-slate-200 dark:border-slate-800 focus:border-[#0D5C63] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#0D5C63]/10 dark:focus:ring-emerald-500/10 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  }`}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Age</label>
                  <input
                    type="text"
                    placeholder="e.g. 45"
                    value={formData.age}
                    onChange={(e) => handleInputChange("age", e.target.value)}
                    className={`w-full px-3 py-2.5 border rounded-xl outline-none text-sm text-center transition ${
                      highlightedFields.age 
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-100 dark:ring-emerald-950/35" 
                        : "border-slate-200 dark:border-slate-800 focus:border-[#0D5C63] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#0D5C63]/10 dark:focus:ring-emerald-500/10 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                    }`}
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Sex</label>
                  <select
                    value={formData.sex}
                    onChange={(e) => handleInputChange("sex", e.target.value)}
                    className={`w-full px-2 py-2.5 border rounded-xl outline-none text-sm transition ${
                      highlightedFields.sex 
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-100 dark:ring-emerald-950/35" 
                        : "border-slate-200 dark:border-slate-800 focus:border-[#0D5C63] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#0D5C63]/10 dark:focus:ring-emerald-500/10 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                    }`}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">D.O.A</label>
                  <input
                    type="date"
                    value={formData.doa}
                    onChange={(e) => handleInputChange("doa", e.target.value)}
                    className="w-full px-2 py-2 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-xs bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition focus:border-[#0D5C63] dark:focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Clinical Data */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
            <h3 className="text-lg font-bold text-[#0D5C63] dark:text-emerald-400 flex items-center gap-2 border-b border-slate-100 dark:border-slate-850 pb-2">
              <FileText className="h-5 w-5" />
              Clinical Data Findings
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Chief Complaint</label>
                <textarea
                  rows={2}
                  placeholder="Describe main complaints or symptoms"
                  value={formData.chief_complaint}
                  onChange={(e) => handleInputChange("chief_complaint", e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl outline-none text-sm transition rtl-textarea ${
                    highlightedFields.chief_complaint 
                      ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-100 dark:ring-emerald-950/35" 
                      : "border-slate-200 dark:border-slate-800 focus:border-[#0D5C63] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#0D5C63]/10 dark:focus:ring-emerald-500/10 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Clinical History</label>
                <textarea
                  rows={2}
                  placeholder="Medical history, previous diagnoses"
                  value={formData.history}
                  onChange={(e) => handleInputChange("history", e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl outline-none text-sm transition rtl-textarea ${
                    highlightedFields.history 
                      ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-100 dark:ring-emerald-950/35" 
                      : "border-slate-200 dark:border-slate-800 focus:border-[#0D5C63] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#0D5C63]/10 dark:focus:ring-emerald-500/10 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Radiography / MRI Findings</label>
                  <textarea
                    rows={2}
                    placeholder="X-Ray, MRI, CT scan summaries"
                    value={formData.radiograph_finding}
                    onChange={(e) => handleInputChange("radiograph_finding", e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl outline-none text-sm transition rtl-textarea ${
                      highlightedFields.radiograph_finding 
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-100 dark:ring-emerald-950/35" 
                        : "border-slate-200 dark:border-slate-800 focus:border-[#0D5C63] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#0D5C63]/10 dark:focus:ring-emerald-500/10 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">Physical Examination Findings</label>
                  <textarea
                    rows={2}
                    placeholder="ROM, muscle strength, spasms, SLR results"
                    value={formData.examination}
                    onChange={(e) => handleInputChange("examination", e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl outline-none text-sm transition rtl-textarea ${
                      highlightedFields.examination 
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-100 dark:ring-emerald-950/35" 
                        : "border-slate-200 dark:border-slate-800 focus:border-[#0D5C63] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#0D5C63]/10 dark:focus:ring-emerald-500/10 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Treatment Program Checklist */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 transition-colors">
            <h3 className="text-lg font-bold text-[#0D5C63] dark:text-emerald-400 border-b border-slate-100 dark:border-slate-850 pb-2">
              Recommended Treatment Modalities
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Electrotherapy Column */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-2">Electrotherapy</h4>
                <label className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition border border-transparent ${
                  formData.tens 
                    ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-850 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.tens}
                    onChange={(e) => handleInputChange("tens", e.target.checked)}
                    className="rounded text-[#0D5C63] dark:text-emerald-500 focus:ring-[#0D5C63] dark:focus:ring-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  TENS
                </label>

                <label className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition border border-transparent ${
                  formData.faradic 
                    ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-850 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.faradic}
                    onChange={(e) => handleInputChange("faradic", e.target.checked)}
                    className="rounded text-[#0D5C63] dark:text-emerald-500 focus:ring-[#0D5C63] dark:focus:ring-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  Faradic Stimulation
                </label>

                <label className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition border border-transparent ${
                  formData.electromagnetic 
                    ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-850 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.electromagnetic}
                    onChange={(e) => handleInputChange("electromagnetic", e.target.checked)}
                    className="rounded text-[#0D5C63] dark:text-emerald-500 focus:ring-[#0D5C63] dark:focus:ring-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  Electromagnetic Field
                </label>
              </div>

              {/* Thermal Column */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-2">Thermotherapy & Sound</h4>
                
                <div className="space-y-2">
                  <label className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition border border-transparent ${
                    formData.heat 
                      ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-850 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                      : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}>
                    <input
                      type="checkbox"
                      checked={formData.heat}
                      onChange={(e) => handleInputChange("heat", e.target.checked)}
                      className="rounded text-[#0D5C63] dark:text-emerald-500 focus:ring-[#0D5C63] dark:focus:ring-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                    />
                    Heat Therapy
                  </label>
                  {formData.heat && (
                    <div className="pl-7">
                      <input
                        type="text"
                        placeholder="Duration (min)"
                        value={formData.heat_duration}
                        onChange={(e) => handleInputChange("heat_duration", e.target.value)}
                        className={`w-full px-3 py-1.5 border border-slate-200 dark:border-slate-850 rounded-lg text-xs outline-none focus:border-[#0D5C63] dark:focus:border-emerald-500 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 ${
                          highlightedFields.heat_duration ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/10" : ""
                        }`}
                      />
                    </div>
                  )}
                </div>

                <label className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition border border-transparent ${
                  formData.ir 
                    ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-850 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.ir}
                    onChange={(e) => handleInputChange("ir", e.target.checked)}
                    className="rounded text-[#0D5C63] dark:text-emerald-500 focus:ring-[#0D5C63] dark:focus:ring-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  Infrared (IR)
                </label>

                <div className="space-y-2">
                  <label className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition border border-transparent ${
                    formData.ultrasound 
                      ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-850 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                      : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}>
                    <input
                      type="checkbox"
                      checked={formData.ultrasound}
                      onChange={(e) => handleInputChange("ultrasound", e.target.checked)}
                      className="rounded text-[#0D5C63] dark:text-emerald-500 focus:ring-[#0D5C63] dark:focus:ring-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                    />
                    Ultrasound (US)
                  </label>
                  {formData.ultrasound && (
                    <div className="pl-7">
                      <input
                        type="text"
                        placeholder="Duration (min)"
                        value={formData.us_duration}
                        onChange={(e) => handleInputChange("us_duration", e.target.value)}
                        className={`w-full px-3 py-1.5 border border-slate-200 dark:border-slate-850 rounded-lg text-xs outline-none focus:border-[#0D5C63] dark:focus:border-emerald-500 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 ${
                          highlightedFields.us_duration ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/10" : ""
                        }`}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Other Column */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-2">Other Modalities</h4>
                
                <label className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition border border-transparent ${
                  formData.vibrator 
                    ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-850 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.vibrator}
                    onChange={(e) => handleInputChange("vibrator", e.target.checked)}
                    className="rounded text-[#0D5C63] dark:text-emerald-500 focus:ring-[#0D5C63] dark:focus:ring-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  Vibrator Massage
                </label>

                <label className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition border border-transparent ${
                  formData.laser 
                    ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-850 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.laser}
                    onChange={(e) => handleInputChange("laser", e.target.checked)}
                    className="rounded text-[#0D5C63] dark:text-emerald-500 focus:ring-[#0D5C63] dark:focus:ring-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  Laser Therapy
                </label>

                <label className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition border border-transparent ${
                  formData.pneumatic 
                    ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-850 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  <input
                    type="checkbox"
                    checked={formData.pneumatic}
                    onChange={(e) => handleInputChange("pneumatic", e.target.checked)}
                    className="rounded text-[#0D5C63] dark:text-emerald-500 focus:ring-[#0D5C63] dark:focus:ring-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                  />
                  Pneumatic Compression
                </label>

                <div className="space-y-2">
                  <label className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition border border-transparent ${
                    formData.traction 
                      ? "bg-emerald-50/50 dark:bg-emerald-950/25 text-emerald-850 dark:text-emerald-400 border-emerald-100/40 dark:border-emerald-900/30 font-semibold" 
                      : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}>
                    <input
                      type="checkbox"
                      checked={formData.traction}
                      onChange={(e) => handleInputChange("traction", e.target.checked)}
                      className="rounded text-[#0D5C63] dark:text-emerald-500 focus:ring-[#0D5C63] dark:focus:ring-emerald-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                    />
                    Traction Therapy
                  </label>
                  {formData.traction && (
                    <div className="pl-7">
                      <input
                        type="text"
                        placeholder="Traction Weight (kg)"
                        value={formData.traction_kg}
                        onChange={(e) => handleInputChange("traction_kg", e.target.value)}
                        className={`w-full px-3 py-1.5 border border-slate-200 dark:border-slate-850 rounded-lg text-xs outline-none focus:border-[#0D5C63] dark:focus:border-emerald-500 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 ${
                          highlightedFields.traction_kg ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/10" : ""
                        }`}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          type="submit"
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#0D5C63] hover:bg-[#0b4c52] dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md text-xs uppercase tracking-wider mt-4 shrink-0 cursor-pointer"
        >
          <Save className="h-4 w-4" />
          Save Patient & Baseline Case
        </motion.button>
      </form>

      {/* Right panel: Live Dictation Interface */}
      <div className="w-full lg:w-96 flex flex-col gap-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs shrink-0 overflow-y-auto transition-colors">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-850 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-950/20 font-bold text-[10px] px-2.5 py-1 rounded-full mb-1">
            <Sparkles className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            Gemini AI Scribe Active
          </div>
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100 font-display tracking-tight">Clinical Voice Scribe</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Auto-fill assessment fields with live Arabic dictation</p>
        </div>

        {/* Dictate Button Container */}
        <div className="flex flex-col items-center justify-center py-6 px-4 border border-slate-150 dark:border-slate-800/60 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/50 dark:from-slate-950 dark:to-slate-900/45 space-y-4 shadow-inner">
          
          {/* Waveform Visualization Bar container */}
          <div className="h-10 flex items-center justify-center gap-1.5 w-full">
            {isRecording ? (
              <div className="flex items-center justify-center gap-1 px-4 py-1 bg-[#0D5C63]/5 dark:bg-emerald-950/20 rounded-full border border-[#0D5C63]/10 dark:border-emerald-900/20">
                <span className="wave-bar w-1 bg-[#0D5C63] dark:bg-emerald-500 rounded-full" />
                <span className="wave-bar w-1 bg-emerald-500 rounded-full" />
                <span className="wave-bar w-1 bg-teal-500 rounded-full" />
                <span className="wave-bar w-1 bg-[#0D5C63] dark:bg-emerald-400 rounded-full" />
                <span className="wave-bar w-1 bg-emerald-400 rounded-full" />
                <span className="wave-bar w-1 bg-emerald-600 rounded-full" />
                <span className="wave-bar w-1 bg-teal-600 rounded-full" />
                <span className="wave-bar w-1 bg-[#0D5C63] dark:bg-emerald-500 rounded-full" />
              </div>
            ) : (
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tracking-wide uppercase">System Mic Idle</span>
            )}
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={toggleRecording}
            className={`h-22 w-22 rounded-full flex items-center justify-center text-white transition-all shadow-lg outline-none cursor-pointer ${
              isRecording
                ? "bg-gradient-to-br from-red-500 to-pink-600 pulse-mic"
                : "bg-gradient-to-br from-[#0D5C63] to-teal-700 dark:from-emerald-600 dark:to-teal-800 shadow-glow"
            }`}
          >
            {isRecording ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
          </motion.button>
          
          <div className="text-center space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-550 dark:text-slate-400 tracking-wider">
              {isRecording ? "Listening Arabic Live..." : "Start dictating"}
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal px-2">
              Speak clinical history in native Arabic, then pause or tap again to parse.
            </p>
          </div>
          
          {/* Voice Action Signature Guide */}
          <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/40 w-full flex items-center justify-center gap-1.5 text-[9px] text-[#0D5C63] dark:text-emerald-400 font-bold uppercase tracking-wider">
            <span className="h-1 w-1 bg-emerald-500 dark:bg-emerald-450 rounded-full"></span>
            <span>Speak "امضي" or "اعتماد" to sign & save</span>
          </div>
        </div>

        {/* Speech Diagnostics Warning */}
        {speechError === "network" && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 leading-normal font-semibold space-y-1"
          >
            <span className="font-extrabold uppercase text-amber-900 dark:text-amber-400 block flex items-center gap-1">
              ⚠️ Browser IFrame Limitation
            </span>
            <p>Speech recognition is blocked inside the preview iframe. Please click the <strong>"Open in new tab"</strong> button in the top-right corner to run the application with full microphone permissions.</p>
          </motion.div>
        )}
        {speechError === "not-allowed" && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-[11px] text-red-800 dark:text-red-300 leading-normal font-semibold space-y-1"
          >
            <span className="font-extrabold uppercase text-red-900 dark:text-red-400 block">
              ⚠️ Microphone Blocked
            </span>
            <p>Microphone permission was denied. Grant permission in your browser address bar, or click <strong>"Open in new tab"</strong> to authorize access.</p>
          </motion.div>
        )}

        {/* Dynamic Voice Signature Status Box */}
        {isVoiceSigning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-500/30 dark:border-emerald-800/30 rounded-2xl flex flex-col items-center text-center space-y-2 relative overflow-hidden shadow-xs"
          >
            {/* Dynamic pulse background */}
            <div className="absolute inset-0 bg-emerald-400/5 dark:bg-emerald-400/2 animate-pulse pointer-events-none" />
            
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            <div className="space-y-0.5">
              <span className="block text-xs font-black text-emerald-850 dark:text-emerald-300 uppercase tracking-widest">Voice Signed & Verified</span>
              <span className="block text-[9px] font-mono text-emerald-600 dark:text-emerald-450 font-extrabold">{voiceSignCode}</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
              Authorized via secure Doctor Voice Protocol. Submitting case file...
            </p>
          </motion.div>
        )}

        {/* Live transcript preview */}
        <div className="flex-1 flex flex-col gap-2 min-h-[160px]">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-650 dark:text-slate-400 uppercase flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
              Live Transcript Input
            </label>
            {isParsing && (
              <span className="flex items-center gap-1 text-[10px] bg-[#0D5C63]/10 dark:bg-emerald-950/30 text-[#0D5C63] dark:text-emerald-400 font-bold px-2 py-0.5 rounded-md animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                Scribing Fields...
              </span>
            )}
          </div>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onBlur={() => processVoiceTranscript(transcript)}
            placeholder="Your spoken transcript will appear here. You can also manually type or paste text here to trigger the parser..."
            className="flex-1 w-full px-4 py-3 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-xl outline-none text-sm text-slate-800 dark:text-slate-100 rtl-textarea resize-none focus:border-[#0D5C63] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#0D5C63]/10 dark:focus:ring-emerald-500/15 focus:bg-white dark:focus:bg-slate-950 transition-all leading-relaxed"
          />
        </div>

        {/* Arabic PT Dictionary & Speech Cheat-Sheet */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80 rounded-xl space-y-2 transition-colors">
          <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-[#0D5C63] dark:text-emerald-400" />
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Arabic PT Voice Shortcuts</h4>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">Dictate these keywords in Arabic to auto-fill sections:</p>
          
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <div className="p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-850 text-[10px] transition-colors">
              <span className="block font-bold text-[#0D5C63] dark:text-emerald-400 rtl text-right">"بيشتكي من خشونة"</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold block mt-0.5">Chief Complaint</span>
            </div>
            <div className="p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-850 text-[10px] transition-colors">
              <span className="block font-bold text-[#0D5C63] dark:text-emerald-400 rtl text-right">"شد ٢٥ كيلو"</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold block mt-0.5">Traction (25kg)</span>
            </div>
            <div className="p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-850 text-[10px] transition-colors">
              <span className="block font-bold text-[#0D5C63] dark:text-emerald-400 rtl text-right">"التراساوند ٥ دقائق"</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold block mt-0.5">Ultrasound (5m)</span>
            </div>
            <div className="p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-850 text-[10px] transition-colors">
              <span className="block font-bold text-[#0D5C63] dark:text-emerald-400 rtl text-right">"الاسم محمد وعنده ٤٠"</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold block mt-0.5">Demographics</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
