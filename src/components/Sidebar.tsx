import React, { useState } from "react";
import { Plus, Search, Database, Heart, User, ClipboardList, Calendar, Sparkles, Pin, PinOff } from "lucide-react";
import { Patient } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface SidebarProps {
  patients: Patient[];
  selectedPatientId: string | null;
  onSelectPatient: (id: string) => void;
  onNewCase: () => void;
  onBackup: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export default function Sidebar({
  patients,
  selectedPatientId,
  onSelectPatient,
  onNewCase,
  onBackup,
  onImport,
  searchTerm,
  setSearchTerm,
  isPinned = false,
  onTogglePin
}: SidebarProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <aside className="w-85 border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col h-full shrink-0 select-none shadow-sm transition-colors duration-300">
      {/* Brand & Stats Dashboard Segment */}
      <div className="p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0A4A50] text-white relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-[#0D5C63]/30 rounded-full blur-xl pointer-events-none" />
        
        {/* Pin lock absolute button on top right of brand bar */}
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            className="absolute top-4 right-4 p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg border border-white/5 transition duration-200 cursor-pointer z-10"
            title={isPinned ? "Unlock / Auto-hide Sidebar" : "Pin Sidebar Permanently"}
          >
            {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
        )}

        <div className="relative flex items-center gap-3 mb-4 pr-6">
          <div className="p-2.5 bg-gradient-to-br from-emerald-400 to-[#0D5C63] rounded-xl shadow-glow">
            <Heart className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-base tracking-wide text-white">Aura PT System</span>
              <span className="text-[9px] bg-emerald-500/30 text-emerald-300 font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider">v2.1</span>
            </div>
            <p className="text-[10px] text-slate-300 font-medium">Smart Voice EMR Companion</p>
          </div>
        </div>

        {/* Stats Summary Panel */}
        <div className="grid grid-cols-2 gap-2 bg-white/5 backdrop-blur-xs p-2.5 rounded-xl border border-white/10 relative">
          <div className="text-center py-1">
            <span className="block text-lg font-black text-emerald-400 font-display leading-none">{patients.length}</span>
            <span className="text-[9px] text-slate-300 uppercase font-bold tracking-wider">Total Patients</span>
          </div>
          <div className="text-center py-1 border-l border-white/10">
            <span className="block text-lg font-black text-emerald-400 font-display leading-none">
              {patients.filter(p => p.sex?.toLowerCase() === "male" || p.sex?.includes("ذك")).length}
            </span>
            <span className="text-[9px] text-slate-300 uppercase font-bold tracking-wider">Active Programs</span>
          </div>
        </div>
      </div>

      {/* Primary New Case Action */}
      <div className="p-4 shrink-0">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewCase}
          className="w-full flex items-center gap-2 px-4 py-3.5 bg-gradient-to-r from-[#0D5C63] to-[#127F89] hover:from-[#0b4c52] hover:to-[#0D5C63] text-white font-bold rounded-xl shadow-md cursor-pointer transition-all duration-200 text-xs uppercase tracking-wider"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>New Case Assessment</span>
          <kbd className="ml-auto text-[9px] bg-white/15 border border-white/10 px-1.5 py-0.5 rounded font-mono font-black text-emerald-100 tracking-normal select-none">Ctrl+N</kbd>
        </motion.button>
      </div>

      {/* Modern Search Component */}
      <div className="px-4 pb-2 shrink-0">
        <div className={`relative transition-all duration-300 rounded-xl border ${
          isFocused 
            ? "border-[#0D5C63] shadow-xs bg-white dark:bg-slate-900" 
            : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50"
        }`}>
          <Search className={`absolute left-3.5 top-3.5 h-3.5 w-3.5 transition-colors ${isFocused ? "text-[#0D5C63]" : "text-slate-400"}`} />
          <input
            id="sidebar-search-input"
            type="text"
            placeholder="Search by name, file #..."
            value={searchTerm}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-16 py-3 bg-transparent rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none placeholder-slate-400/80 dark:placeholder-slate-500"
          />
          {searchTerm ? (
            <button 
              onClick={() => setSearchTerm("")} 
              className="absolute right-3 top-3 text-[9px] bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-md font-bold transition cursor-pointer"
            >
              Clear
            </button>
          ) : (
            <kbd className="absolute right-3 top-3 text-[9px] font-mono font-black text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 px-1.5 py-0.5 rounded-md pointer-events-none uppercase">Ctrl+F</kbd>
          )}
        </div>
      </div>

      {/* Patient Scrollable List Container */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {searchTerm ? `Search Results (${patients.length})` : "Patient Directories"}
          </span>
          <span className="text-[9px] bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold px-1.5 py-0.5 rounded-full">
            Recent
          </span>
        </div>

        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {patients.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 px-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800"
              >
                <ClipboardList className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No Patient Records</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Create a new assessment to begin tracking.</p>
              </motion.div>
            ) : (
              patients.map((p, idx) => {
                const isSelected = p.id === selectedPatientId;
                const initials = p.name
                  ? p.name
                      .trim()
                      .split(/\s+/)
                      .filter(Boolean)
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  : "?";

                return (
                  <motion.button
                     initial={{ opacity: 0, y: 8 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                     key={p.id}
                     onClick={() => onSelectPatient(p.id)}
                     className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left border relative group outline-none cursor-pointer ${
                       isSelected
                         ? "bg-slate-50 dark:bg-slate-900 border-slate-350 dark:border-slate-700 shadow-xs"
                         : "bg-white dark:bg-slate-950 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 border-slate-150 dark:border-slate-900/50"
                     }`}
                  >
                    {/* Selected Left Accent Bar */}
                    {isSelected && (
                      <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#0D5C63] rounded-r-full" />
                    )}

                    {/* Avatar Initials with gradient ring */}
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-all duration-300 shadow-xs ${
                        isSelected
                          ? "bg-[#0D5C63] text-white ring-2 ring-emerald-500/20"
                          : "bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 group-hover:bg-[#0D5C63] group-hover:text-white"
                      }`}
                    >
                      {initials || "?"}
                    </div>

                    {/* Meta info column */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate group-hover:text-[#0D5C63] dark:group-hover:text-emerald-400 transition-colors">
                          {p.name}
                        </h3>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
                          {p.doa ? p.doa.split("-").slice(1).join("/") : ""}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5 flex items-center gap-1">
                        <span className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded text-slate-600 dark:text-slate-400 font-bold">{p.age}y</span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="text-slate-600 dark:text-slate-400 truncate max-w-[110px]">{p.occupation || "N/A"}</span>
                      </p>
                      
                      {/* Arabic Tag indicator for Diagnosis / Complaint */}
                      {p.chief_complaint && (
                        <p className="text-[10px] font-medium text-[#0D5C63]/90 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100/30 dark:border-emerald-800/30 rounded-md py-0.5 px-1.5 mt-1.5 rtl truncate inline-block max-w-full">
                          {p.chief_complaint}
                        </p>
                      )}
                    </div>
                  </motion.button>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* High-fidelity Footer Database controls */}
      <div className="p-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 shrink-0">
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBackup}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
            title="Download full encrypted clinical database JSON backup"
          >
            <Database className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            Backup
          </motion.button>
          
          <motion.label
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800/40"
            title="Restore database structure from any previous backup file"
          >
            <Database className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 rotate-180" />
            Restore
            <input
              type="file"
              accept=".json"
              onChange={onImport}
              className="hidden"
            />
          </motion.label>
        </div>
        <div className="text-center mt-2">
          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold tracking-wide uppercase">⚡ Fully local backup control</p>
        </div>
      </div>
    </aside>
  );
}

