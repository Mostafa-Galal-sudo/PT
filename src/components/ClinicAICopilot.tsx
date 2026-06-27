import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Brain, Send, Bot, X, MessageSquare, Sparkles, 
  ShieldAlert, ClipboardCheck, Dumbbell, BookOpen, 
  TrendingUp, Users, HelpCircle 
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Patient, Session, Program } from "../types";

interface ClinicAICopilotProps {
  isOpen: boolean;
  onClose: () => void;
  activePatient: Patient | null;
  activeProgram: Program | null;
  sessions: Session[];
  allPatients: Patient[];
  setStatusBarMessage: (msg: string) => void;
}

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export default function ClinicAICopilot({
  isOpen,
  onClose,
  activePatient,
  activeProgram,
  sessions,
  allPatients,
  setStatusBarMessage
}: ClinicAICopilotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [activeMode, setActiveMode] = useState<"patient" | "clinic">(
    activePatient ? "patient" : "clinic"
  );

  const lastPatientIdRef = useRef<string | undefined>(undefined);

  // Auto-generate introductory message when opening / mode changes
  useEffect(() => {
    const currentId = activePatient?.id;
    if (currentId !== lastPatientIdRef.current) {
      lastPatientIdRef.current = currentId;
      const targetMode = activePatient ? "patient" : "clinic";
      setActiveMode(targetMode);

      if (targetMode === "patient" && activePatient) {
        // Patient Mode intro
        setMessages([
          {
            role: "model",
            text: `مرحباً دكتور! تم تحميل ملف المريض **(${activePatient.name})** بنجاح. 

أنا في **وضع المريض (Patient Mode)** وجاهز لمساعدتك في:
- 📋 مراجعة تطور ألم المريض بناءً على الجلسات السابقة (Case Progression).
- ⚠️ فحص التحذيرات السريرية وموانع الاستعمال (Precautions & Contraindications).
- 💪 اقتراح وتطوير التمارين العلاجية المناسبة للتشخيص (Exercise Progression).
- 📝 صياغة دليل إرشادي مبسط للمريض باللغة العربية (Patient Education Brief).`
          }
        ]);
      } else {
        // Clinic Mode intro
        setMessages([
          {
            role: "model",
            text: `مرحباً دكتور! أنا في **وضع العيادة (Clinic Mode)**. 

لدي وصول كامل (للقراءة فقط) إلى سجلات العيادة وإحصائياتها. يمكنني مساعدتك في:
- 📊 تحليل إحصائيات المرضى والتركيبة الديموغرافية (Clinic Statistics).
- 📈 فحص اتجاهات العلاجات الفيزيائية والأجهزة الأكثر استخداماً (Treatment Trends).
- 🔍 استعراض ملخص الحالات النشطة في العيادة.`
          }
        ]);
      }
    }
  }, [activePatient?.id]);

  const handleModeChange = (newMode: "patient" | "clinic") => {
    if (newMode === activeMode) return;
    setActiveMode(newMode);

    if (newMode === "patient" && activePatient) {
      setMessages([
        {
          role: "model",
          text: `🔄 **Switched to Patient Mode — analyzing ${activePatient.name}'s file.** 

تم الانتقال إلى وضع المريض — جاري تحليل بيانات المريض **(${activePatient.name})**. اسألني عن أي شيء يخص حالته العلاجية أو تطور ألمه.`
        }
      ]);
    } else {
      setMessages([
        {
          role: "model",
          text: `🔄 **Switched to Clinic Mode — analyzing clinic-wide records.**

تم الانتقال إلى وضع العيادة — اسألني عن أي شيء يخص إحصائيات العيادة وتوجهاتها العامة، أو تفاصيل دليل الحالات النشطة.`
        }
      ]);
    }
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = textToSend || userInput;
    if (!prompt.trim() || isLoading) return;

    const newMsg: ChatMessage = { role: "user", text: prompt };
    const updatedMessages = [...messages, newMsg];
    
    setMessages(updatedMessages);
    setUserInput("");
    setIsLoading(true);
    setStatusBarMessage("AI Scribe analyzing clinical query...");

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: activeMode === "patient" && activePatient ? activePatient.id : "clinic",
          messages: updatedMessages
        })
      });

      if (!response.ok) {
        throw new Error("Failed to reach Gemini co-pilot server.");
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: "model", text: data.text }]);
      setStatusBarMessage("Clinical analysis completed.");
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [
        ...prev, 
        { 
          role: "model", 
          text: `عذراً دكتور، حدث خطأ أثناء معالجة الاستشارة الطبية: \n\n"${err.message || "Unknown error"}"\n\nيرجى التأكد من توفر مفتاح Gemini API Key في ملف البيئة الخاص بك.` 
        }
      ]);
      setStatusBarMessage("Clinical AI offline or missing API keys.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setUserInput("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end print:hidden select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
          />

          {/* Sidebar Chat Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 190 }}
            className="relative w-full max-w-lg md:max-w-xl h-full bg-white dark:bg-slate-950 border-l border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col z-10"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gradient-to-tr from-[#0D5C63] to-teal-500 rounded-xl flex items-center justify-center text-white shadow-md">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 font-display">Clinical AI Assistant</h3>
                  
                  {activeMode === "patient" && activePatient ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Patient Mode • {activePatient.name}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                      Clinic Mode • Overview
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={clearChat}
                  className="px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                  title="Clear conversation"
                >
                  Clear Chat
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Mode Switcher Segmented Control */}
            <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 text-xs">
              <span className="font-extrabold text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-display">
                Copilot Scope:
              </span>
              <div className="flex bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200/40 dark:border-slate-850 relative">
                <button
                  type="button"
                  disabled={!activePatient}
                  onClick={() => handleModeChange("patient")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all duration-200 select-none ${
                    !activePatient
                      ? "opacity-40 cursor-not-allowed text-slate-400"
                      : activeMode === "patient"
                      ? "bg-white dark:bg-slate-800 text-[#0D5C63] dark:text-emerald-400 shadow-xs border border-slate-200/30 dark:border-slate-700/30 font-extrabold"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350 cursor-pointer"
                  }`}
                  title={!activePatient ? "Open a patient profile to enable Patient Mode" : "Switch to Patient Mode"}
                >
                  <Users className="h-3.5 w-3.5" />
                  Patient Mode
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("clinic")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all duration-200 select-none ${
                    activeMode === "clinic"
                      ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200/30 dark:border-slate-700/30 font-extrabold"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350 cursor-pointer"
                  }`}
                  title="Switch to Clinic Mode"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Clinic Mode
                </button>
              </div>
            </div>

            {/* Chat Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar */}
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs ${
                      isUser 
                        ? "bg-[#0D5C63] text-white text-xs font-bold" 
                        : "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0D5C63] dark:text-emerald-400"
                    }`}>
                      {isUser ? "MD" : <Bot className="h-4 w-4" />}
                    </div>

                    {/* Bubble */}
                    <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs font-semibold leading-relaxed shadow-xs border ${
                      isUser 
                        ? "bg-slate-900 dark:bg-slate-800 border-slate-900 dark:border-slate-800 text-white rounded-tr-none whitespace-pre-wrap" 
                        : "bg-slate-50/80 dark:bg-slate-900 border-slate-200/60 dark:border-slate-800/80 text-slate-800 dark:text-slate-100 rounded-tl-none rtl-textarea"
                    }`}>
                      {isUser ? (
                        msg.text
                      ) : (
                        <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-xs font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-start gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0D5C63] dark:text-emerald-400 flex items-center justify-center shadow-xs shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl rounded-tl-none p-4 shadow-xs">
                    <div className="flex gap-1.5 items-center py-1 px-1.5">
                      <span className="w-1.5 h-1.5 bg-[#0D5C63] dark:bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                      <span className="w-1.5 h-1.5 bg-[#0D5C63] dark:bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                      <span className="w-1.5 h-1.5 bg-[#0D5C63] dark:bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Action Clinical Buttons */}
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-2">
              <span className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {activeMode === "patient" && activePatient ? "Patient-Specific Directives" : "Clinic-Wide Diagnostics"}
              </span>

              <div className="flex flex-wrap gap-2">
                {activeMode === "patient" && activePatient ? (
                  <>
                    <button
                      onClick={() => handleSendMessage("📋 مراجعة وتطور الحالة: يرجى تحليل تطور شكوى المريض وألم في الجلسات السابقة بناءً على السجل السريري واقتراح تطوير البرنامج العلاجي.")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-[#0D5C63] dark:text-emerald-400 rounded-lg cursor-pointer transition shadow-xs"
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      مراجعة وتطوير الحالة
                    </button>

                    <button
                      onClick={() => handleSendMessage("⚠️ كشف المحاذير والموانع: يرجى التحقق من وجود أي موانع سريرية (Contraindications) أو علامات حمراء بناءً على شكوى المريض والتشخيص المذكور.")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-amber-700 dark:text-amber-400 rounded-lg cursor-pointer transition shadow-xs"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      فحص الموانع والمحاذير
                    </button>

                    <button
                      onClick={() => handleSendMessage("💪 تمارين منزلية مقترحة: ما هي أهم 3 تمارين علاجية نشطة وتدريجية آمنة يمكن للمريض تطبيقها بالمنزل لتعزيز الشفاء؟")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-[#0D5C63] dark:text-emerald-400 rounded-lg cursor-pointer transition shadow-xs"
                    >
                      <Dumbbell className="h-3.5 w-3.5" />
                      برنامج تمارين منزلية
                    </button>

                    <button
                      onClick={() => handleSendMessage("📝 دليل إرشادي للمريض: يرجى كتابة ملخص نصائح إرشادية مبسطة ولطيفة باللغة العربية لشرح كيفية حماية العمود الفقري وتفادي تفاقم الألم أثناء ممارسة الأنشطة اليومية.")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-[#0D5C63] dark:text-emerald-400 rounded-lg cursor-pointer transition shadow-xs"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      صياغة إرشادات المريض
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleSendMessage("📊 تقرير عام بالعيادة: يرجى تلخيص إحصائيات المرضى في العيادة، أعدادهم، متوسط الأعمار، ونسب الذكور والإناث.")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-[#0D5C63] dark:text-emerald-400 rounded-lg cursor-pointer transition shadow-xs"
                    >
                      <Users className="h-3.5 w-3.5" />
                      إحصائيات العيادة العامة
                    </button>

                    <button
                      onClick={() => handleSendMessage("📈 تحليل اتجاهات العلاج: ما هي الأجهزة والبرامج العلاجية الأكثر استخداماً في العيادة؟ ويرجى تحليل فاعلية العلاج بناءً على نسب المرضى وتكرار الجلسات.")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-[#0D5C63] dark:text-emerald-400 rounded-lg cursor-pointer transition shadow-xs"
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      تحليل الأجهزة والبرامج
                    </button>

                    <button
                      onClick={() => handleSendMessage("🔍 استعراض دليل الحالات النشطة: لخص بشكل سريع الشكاوى الأساسية (Chief Complaints) لجميع المرضى المسجلين بالدليل السريري.")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-[#0D5C63] dark:text-emerald-400 rounded-lg cursor-pointer transition shadow-xs"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      ملخص الحالات النشطة بالدليل
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Input form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex gap-2"
            >
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={activeMode === "patient" && activePatient ? "اسأل عن ملف المريض الحالي..." : "اسأل عن إحصائيات وتوجهات العيادة..."}
                className="flex-1 text-xs font-semibold px-4 py-2.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:border-[#0D5C63] dark:focus:border-emerald-500 rtl text-right"
              />
              <button
                type="submit"
                disabled={!userInput.trim() || isLoading}
                className="p-2.5 bg-[#0D5C63] hover:bg-[#0b4c52] disabled:bg-slate-300 disabled:dark:bg-slate-800 text-white rounded-xl transition cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
