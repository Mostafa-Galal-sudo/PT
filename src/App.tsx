import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import NewCaseForm from "./components/NewCaseForm";
import PatientView from "./components/PatientView";
import SessionEditorModal from "./components/SessionEditorModal";
import ClinicAICopilot from "./components/ClinicAICopilot";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import { Patient, Session, Program } from "./types";
import { Activity, Clock, Heart, Users, Calendar, Sparkles, Sun, Moon, Pin, Menu, Brain, Plus } from "lucide-react";

export default function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  
  const [viewState, setViewState] = useState<"welcome" | "new-case" | "patient-view">("welcome");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusBarMessage, setStatusBarMessage] = useState("System Ready");
  
  // Theme & Sidebar States
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("pt-clinical-theme");
    return (saved as "light" | "dark") || "light";
  });
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isAICopilotOpen, setIsAICopilotOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("pt-clinical-theme", theme);
    
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, [theme]);

  // Session Modals
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<Session | null>(null);

  // Digital Live Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N or Cmd+N for New Case
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setSelectedPatientId(null);
        setViewState("new-case");
        setStatusBarMessage("Shortcut: Starting new assessment form...");
      }
      // Ctrl+F or Cmd+F for Focus Search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        const searchInput = document.getElementById("sidebar-search-input");
        if (searchInput) {
          searchInput.focus();
          // Select all content inside for easy overwrite
          (searchInput as HTMLInputElement).select();
          setStatusBarMessage("Shortcut: Search input focused");
        }
      }
      // Esc to go back or close modals
      if (e.key === "Escape") {
        if (isSessionModalOpen) {
          setIsSessionModalOpen(false);
          setStatusBarMessage("Session dialog closed");
        } else if (viewState !== "welcome") {
          setViewState("welcome");
          setSelectedPatientId(null);
          setStatusBarMessage("Returned to dashboard");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSessionModalOpen, viewState]);

  // Initial load & when searchTerm changes
  useEffect(() => {
    loadPatients();
  }, [searchTerm]);

  const loadPatients = async () => {
    try {
      const url = searchTerm 
        ? `/api/patients?search=${encodeURIComponent(searchTerm)}` 
        : "/api/patients";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPatients(data);
      }
    } catch (err) {
      console.error("Failed to load patients:", err);
      setStatusBarMessage("Error syncing with patient database");
    }
  };

  const handleSelectPatient = async (id: string) => {
    setStatusBarMessage(`Loading record: ${id}...`);
    try {
      // 1. Get patient record
      const patRes = await fetch(`/api/patients/${id}`);
      if (!patRes.ok) throw new Error("Patient not found");
      const patientData = await patRes.json();
      
      // 2. Get baseline treatment program
      const progRes = await fetch(`/api/patients/${id}/program`);
      const programData = progRes.ok ? await progRes.json() : null;

      // 3. Get sessions history
      const sessRes = await fetch(`/api/patients/${id}/sessions`);
      const sessionsData = sessRes.ok ? await sessRes.json() : [];

      setSelectedPatientId(id);
      setSelectedPatient(patientData);
      setActiveProgram(programData);
      setSessions(sessionsData);
      
      setViewState("patient-view");
      setStatusBarMessage(`Patient record loaded: ${patientData.name}`);
    } catch (err: any) {
      console.error(err);
      setStatusBarMessage(`Failed to load patient: ${err.message}`);
    }
  };

  const handleSaveNewCase = async (formData: any) => {
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save assessment");
      }

      const saved = await res.json();
      setStatusBarMessage(`New assessment saved: ${saved.patient.name}`);
      
      // Reload lists and select the newly created patient automatically!
      await loadPatients();
      handleSelectPatient(saved.patient.id);
    } catch (err: any) {
      console.error(err);
      setStatusBarMessage(`Error: ${err.message}`);
      throw err;
    }
  };

  const handleOpenAddSession = () => {
    setSessionToEdit(null);
    setIsSessionModalOpen(true);
  };

  const handleOpenEditSession = (session: Session) => {
    setSessionToEdit(session);
    setIsSessionModalOpen(true);
  };

  const handleSaveSession = async (sessionData: any) => {
    if (!selectedPatientId) return;
    
    setStatusBarMessage("Saving session log...");
    try {
      const url = sessionToEdit
        ? `/api/patients/${selectedPatientId}/sessions/${sessionToEdit.id}`
        : `/api/patients/${selectedPatientId}/sessions`;
      
      const method = sessionToEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionData)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to log session");
      }

      setStatusBarMessage("Session saved successfully.");
      setIsSessionModalOpen(false);
      setSessionToEdit(null);
      
      // Reload patient details to update timelines and progress charts!
      handleSelectPatient(selectedPatientId);
    } catch (err: any) {
      console.error(err);
      setStatusBarMessage(`Session save failed: ${err.message}`);
    }
  };

  const handleDeleteSession = async (sid: string) => {
    if (!selectedPatientId) return;
    setStatusBarMessage("Deleting session...");
    try {
      const res = await fetch(`/api/patients/${selectedPatientId}/sessions/${sid}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setStatusBarMessage("Session deleted.");
        handleSelectPatient(selectedPatientId);
      }
    } catch (err) {
      console.error(err);
      setStatusBarMessage("Failed to delete session.");
    }
  };

  const handleDeletePatient = async (pid: string) => {
    setStatusBarMessage("Deleting patient record...");
    try {
      const res = await fetch(`/api/patients/${pid}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setStatusBarMessage("Patient record completely deleted.");
        setSelectedPatientId(null);
        setSelectedPatient(null);
        setSessions([]);
        setActiveProgram(null);
        setViewState("welcome");
        loadPatients();
      }
    } catch (err) {
      console.error(err);
      setStatusBarMessage("Failed to delete patient record.");
    }
  };

  const handleBackup = async () => {
    try {
      const res = await fetch("/api/backup");
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `PT_Voice_Backup_${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatusBarMessage("Database backup downloaded.");
      }
    } catch (err) {
      console.error(err);
      setStatusBarMessage("Backup failed.");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed)
        });

        if (res.ok) {
          setStatusBarMessage("Database restored from backup.");
          loadPatients();
        } else {
          setStatusBarMessage("Database restore failed: Invalid data.");
        }
      } catch (err) {
        console.error(err);
        setStatusBarMessage("Database restore failed: JSON error.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 font-sans print:h-auto print:overflow-visible transition-colors duration-300">
      {/* Top Header Bar (Hidden during print) */}
      <header className="h-16 bg-slate-900 dark:bg-slate-950 text-white px-6 flex items-center justify-between shadow-md shrink-0 print:hidden select-none transition-colors duration-300">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarHovered(!isSidebarHovered)}
            className="md:hidden p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white border border-white/5 transition duration-200 cursor-pointer"
            title="Toggle Menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="p-1.5 bg-[#0D5C63] rounded-lg">
            <Heart className="h-5 w-5 text-emerald-400 fill-emerald-400" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-widest uppercase text-slate-200">PT Clinical Assist</h1>
            <p className="text-[10px] text-emerald-300 font-semibold tracking-wide">Intelligent Voice Dictation EMR</p>
          </div>
        </div>

        {/* Theme Toggle & Clock */}
        <div className="flex items-center gap-3">
          {/* Theme Switcher Button */}
          <button
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white border border-white/5 transition duration-200 cursor-pointer"
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-400" />}
          </button>

          {/* Dynamic Digital Clock */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
            <Clock className="h-4 w-4 text-emerald-400" />
            <span>{currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
      </header>

      {/* Main Body Section */}
      <div className="flex-1 flex overflow-hidden min-h-0 print:overflow-visible relative">
        
        {/* Left Hover Trigger Bar / Collapsed Strip (Only when not pinned) */}
        {!isSidebarPinned && (
          <div
            onMouseEnter={() => setIsSidebarHovered(true)}
            className="absolute left-0 top-0 bottom-0 w-3 z-40 bg-transparent cursor-pointer flex items-center justify-center transition-all group hover:bg-slate-200/20 dark:hover:bg-slate-800/10"
            title="Hover to view Patient Directory"
          >
            <div className="w-1 h-12 bg-slate-300 dark:bg-slate-700 rounded-full group-hover:bg-[#0D5C63] transition-colors" />
          </div>
        )}

        {/* Sidebar Left Navigation (Hidden during print) */}
        <div
          className={`print:hidden h-full transition-all duration-300 ${
            isSidebarPinned
              ? "md:relative md:z-30 md:shrink-0 md:w-85 absolute left-0 top-0 bottom-0 z-50 w-85 shadow-2xl md:shadow-none"
              : "absolute left-0 top-0 bottom-0 z-50 w-85 shadow-2xl"
          }`}
          style={{
            transform: isSidebarPinned || isSidebarHovered ? "translateX(0)" : "translateX(-340px)",
            transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
        >
          <Sidebar
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelectPatient={(id) => {
              handleSelectPatient(id);
              if (!isSidebarPinned) setIsSidebarHovered(false); // auto-close on select for slick layout
            }}
            onNewCase={() => {
              setSelectedPatientId(null);
              setViewState("new-case");
              setStatusBarMessage("Starting new assessment form...");
              if (!isSidebarPinned) setIsSidebarHovered(false);
            }}
            onBackup={handleBackup}
            onImport={handleImport}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            isPinned={isSidebarPinned}
            onTogglePin={() => setIsSidebarPinned(!isSidebarPinned)}
          />
        </div>

        {/* Central Dashboard Panel */}
        <main className={`flex-1 overflow-hidden h-full flex flex-col min-w-0 print:overflow-visible print:h-auto transition-all duration-300 bg-slate-50 dark:bg-[#0b0f19] ${
          isSidebarPinned ? "pl-0" : "pl-3"
        }`}>
          {viewState === "welcome" && (
            <div className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto bg-slate-50 dark:bg-[#0b0f19] transition-colors">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 relative overflow-hidden transition-colors duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#0D5C63]/5 dark:bg-[#0D5C63]/20 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2 text-left">
                    <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                      PT Voice Clinic Analytics Hub
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed max-w-2xl">
                      Welcome back! Here is a clinic-wide diagnostic dashboard mapping growth parameters, pain recovery index gradients, modality usage, and patient session adherence.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setViewState("new-case")}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#0D5C63] to-teal-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider hover:opacity-90 shadow-sm cursor-pointer transition-all shrink-0"
                    >
                      <Plus className="h-4 w-4" /> New Case Intake
                    </button>
                  </div>
                </div>
              </div>

              <AnalyticsDashboard />
            </div>
          )}

          {viewState === "new-case" && (
            <NewCaseForm
              onSave={handleSaveNewCase}
              setStatusBarMessage={setStatusBarMessage}
            />
          )}

          {viewState === "patient-view" && (
            <PatientView
              patientId={selectedPatientId || ""}
              patient={selectedPatient}
              sessions={sessions}
              activeProgram={activeProgram}
              onAddSession={handleOpenAddSession}
              onEditSession={handleOpenEditSession}
              onDeleteSession={handleDeleteSession}
              onDeletePatient={handleDeletePatient}
              onBack={() => {
                setSelectedPatientId(null);
                setViewState("welcome");
              }}
              setStatusBarMessage={setStatusBarMessage}
              onOpenAICopilot={() => setIsAICopilotOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Interactive Session Editor Modal (Creates / Edits sessions) */}
      {selectedPatient && (
        <SessionEditorModal
          isOpen={isSessionModalOpen}
          onClose={() => setIsSessionModalOpen(false)}
          onSave={handleSaveSession}
          patientId={selectedPatientId || ""}
          patientName={selectedPatient.name}
          sessionToEdit={sessionToEdit}
          setStatusBarMessage={setStatusBarMessage}
        />
      )}

      {/* Global Embedded Clinical AI Copilot Sidebar */}
      <ClinicAICopilot
        isOpen={isAICopilotOpen}
        onClose={() => setIsAICopilotOpen(false)}
        activePatient={selectedPatient}
        activeProgram={activeProgram}
        sessions={sessions}
        allPatients={patients}
        setStatusBarMessage={setStatusBarMessage}
      />

      {/* Floating Glowing Brain Trigger Button for AI Copilot */}
      <div className="fixed bottom-12 right-6 z-40 print:hidden select-none">
        <button
          onClick={() => setIsAICopilotOpen(true)}
          className="h-14 w-14 bg-gradient-to-tr from-[#0D5C63] to-teal-500 hover:from-teal-600 hover:to-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-emerald-500/25 border-2 border-white dark:border-slate-800 transition-all duration-300 transform hover:scale-108 active:scale-95 group cursor-pointer relative"
          title="Open Clinical AI Assistant"
        >
          {/* Pulsing indicator aura */}
          <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping opacity-75"></span>
          <Brain className="h-6 w-6 group-hover:rotate-12 transition-transform" />
          
          <span className="absolute -top-1 -right-1 bg-red-500 text-white font-black text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider scale-90 border border-white dark:border-slate-800">
            AI
          </span>
        </button>
      </div>

      {/* Bottom Status Notification Bar (Hidden during print) */}
      <footer className="h-8 bg-[#0D5C63] border-t border-[#0b4c52] text-[11px] text-emerald-100 px-6 flex items-center justify-between shrink-0 font-semibold select-none print:hidden">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Status: <span className="text-white">{statusBarMessage}</span>
        </span>
        <span className="opacity-80 text-[10px]">PT Voice System v2.0 • Web EMR</span>
      </footer>
    </div>
  );
}
