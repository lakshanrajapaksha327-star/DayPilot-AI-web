import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Clipboard,
  UploadCloud,
  Layers,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Code,
  BrainCircuit,
  GraduationCap,
  FileText,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  Sliders,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { ParsedRoadmap, ParsedRoadmapLesson } from '../../types/index.ts';
import {
  detectFormatType,
  validateParsedRoadmap,
  calculateScheduleEndDate,
} from '../../utils/roadmapParserEngine.ts';

interface RoadmapImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoadmapImportModal: React.FC<RoadmapImportModalProps> = ({ isOpen, onClose }) => {
  const { userProfile } = useAuth();
  const { tasks, approveGeneratedRoadmap, importRoadmapTemplate } = useData();

  // Tab: AI Importer vs Curated Templates
  const [activeTab, setActiveTab] = useState<'ai_importer' | 'curated'>('ai_importer');

  // Input states
  const [rawText, setRawText] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [preferredTime, setPreferredTime] = useState('19:00'); // 7:00 PM default per spec
  const [dailyDuration, setDailyDuration] = useState(60);
  const [timeZone, setTimeZone] = useState(
    () => userProfile?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Colombo'
  );

  // Parsing & State Workflow
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedRoadmap, setParsedRoadmap] = useState<ParsedRoadmap | null>(null);

  // Preview / Edit states
  const [editableTitle, setEditableTitle] = useState('');
  const [expandedLessonIdx, setExpandedLessonIdx] = useState<number | null>(null);

  // Generation / Scheduling states
  const [isScheduling, setIsScheduling] = useState(false);
  const [schedulingProgress, setSchedulingProgress] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Preset examples for quick non-technical testing
  const presets = [
    {
      label: 'Photo Editing (30-Day Photopea → Lightroom → Photoshop)',
      prompt: `I want to become a professional photo editor. Create a 30-day programme with one hour of daily practice. Start with Photopea, continue with Lightroom, and introduce Photoshop. Include practical assignments and tutorial resources.`,
      targetDays: 30,
      duration: 60,
    },
    {
      label: 'Java Backend Sprint (14 Days, 45m daily)',
      prompt: `I want to learn Java backend fundamentals in 14 days, practicing for 45 minutes every evening. Cover OOP, Collections, Streams, Spring Boot basics and build a CRUD REST API.`,
      targetDays: 14,
      duration: 45,
    },
    {
      label: 'Public Speaking & Presentation (21 Days)',
      prompt: `Create a 21-day public speaking mastery curriculum. 30 minutes daily practice. Include vocal warmups, storytelling frameworks, slide deck design, and handling Q&A with confidence.`,
      targetDays: 21,
      duration: 30,
    },
  ];

  // Clipboard paste handler
  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setRawText(text);
          setParseError(null);
        }
      }
    } catch (e) {
      console.warn('Clipboard read failed:', e);
    }
  };

  // File upload handler (.txt, .md, .json)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        setParseError(null);
      }
    };
    reader.readAsText(file);
  };

  // AI Parsing action
  const handleParseContent = async () => {
    if (!rawText.trim()) {
      setParseError('Please paste your roadmap text, markdown, or JSON before parsing.');
      return;
    }

    try {
      setIsParsing(true);
      setParseError(null);

      const response = await fetch('/api/ai/parse-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawContent: rawText.trim(),
          userPreferences: {
            preferredStartDate: startDate,
            preferredStartTime: preferredTime,
            dailyDurationMinutes: dailyDuration,
            timeZone,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed with status ${response.status}`);
      }

      const data = await response.json();
      if (!data.roadmap) {
        throw new Error('No roadmap data returned by AI parser.');
      }

      const roadmap: ParsedRoadmap = {
        ...data.roadmap,
        rawSourceType: detectFormatType(rawText),
      };

      setParsedRoadmap(roadmap);
      setEditableTitle(roadmap.title || 'Personal Learning Roadmap');
      setDailyDuration(roadmap.dailyDurationMinutes || 60);
      if (roadmap.preferredTime) {
        setPreferredTime(roadmap.preferredTime);
      }
    } catch (err: unknown) {
      console.error('Roadmap parsing failed:', err);
      setParseError(err instanceof Error ? err.message : 'Failed to parse roadmap with AI.');
    } finally {
      setIsParsing(false);
    }
  };

  // Perform validation on the parsed roadmap
  const validation = parsedRoadmap
    ? validateParsedRoadmap(
        {
          ...parsedRoadmap,
          title: editableTitle,
          dailyDurationMinutes: dailyDuration,
          preferredTime,
          startDate,
        },
        tasks,
        startDate,
        preferredTime
      )
    : null;

  // Final approval & automated scheduling
  const handleApproveAndSchedule = async () => {
    if (!parsedRoadmap || isScheduling) return;

    try {
      setIsScheduling(true);
      setSchedulingProgress('Creating learning plan in Cloud Firestore...');

      const finalRoadmap = {
        title: editableTitle.trim() || parsedRoadmap.title,
        description: parsedRoadmap.description || 'Structured learning curriculum',
        durationDays: parsedRoadmap.durationDays,
        dailyDurationMinutes: dailyDuration,
        skillLevel: parsedRoadmap.skillLevel || 'all-levels',
        preferredTime,
        lessons: parsedRoadmap.lessons,
      };

      setSchedulingProgress(`Generating ${parsedRoadmap.durationDays} calendar sessions starting ${startDate}...`);

      const planId = await approveGeneratedRoadmap(finalRoadmap, {
        startDate,
        durationDays: parsedRoadmap.durationDays,
        dailyDurationMinutes: dailyDuration,
        preferredTime,
        scheduleType: 'daily',
        timeZone,
      });

      setSchedulingProgress('Synchronising reminders across all registered devices...');
      setCreatedPlanId(planId);
      setIsSuccess(true);
    } catch (err: unknown) {
      console.error('Approval failed:', err);
      setParseError(err instanceof Error ? err.message : 'Scheduling failed.');
    } finally {
      setIsScheduling(false);
      setSchedulingProgress(null);
    }
  };

  // Reset modal state
  const handleReset = () => {
    setParsedRoadmap(null);
    setParseError(null);
    setIsSuccess(false);
    setCreatedPlanId(null);
  };

  const detectedFormat = detectFormatType(rawText);
  const calculatedEndDate = calculateScheduleEndDate(startDate, parsedRoadmap?.durationDays || 30);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  ChatGPT & External Roadmap Importer
                </h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  AI Powered
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Copy from ChatGPT, Claude, or Notion — DayPilot extracts lessons, schedules tasks, and configures reminders
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        {!parsedRoadmap && !isSuccess && (
          <div className="px-6 pt-3 pb-1 border-b border-slate-800/60 bg-slate-950/40 flex items-center gap-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('ai_importer')}
              className={`pb-2.5 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ai_importer'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Paste from ChatGPT / Text / Markdown / JSON</span>
            </button>
            <button
              onClick={() => setActiveTab('curated')}
              className={`pb-2.5 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'curated'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Curated Templates (Full-Stack, AI, Exams)</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* SUCCESS SCREEN */}
          {isSuccess && (
            <div className="py-8 px-4 text-center space-y-5 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-extrabold text-white">Roadmap Successfully Scheduled!</h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
                  <strong>{editableTitle}</strong> has been organized into {parsedRoadmap?.durationDays} scheduled daily sessions starting <strong>{startDate}</strong> at <strong>{preferredTime}</strong>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 max-w-lg mx-auto text-left space-y-2 text-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Execution Summary:</div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Total Scheduled Sessions:</span>
                  <span className="font-bold text-white">{parsedRoadmap?.durationDays} Lessons</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Schedule Span:</span>
                  <span className="font-semibold text-white">{startDate} → {calculatedEndDate}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Daily Study Window:</span>
                  <span className="font-semibold text-white">{preferredTime} ({dailyDuration} mins/day)</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Device Push Notifications:</span>
                  <span className="font-semibold text-emerald-400">Active (15m advance warning)</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg cursor-pointer"
                >
                  View in Calendar & Schedule
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Import Another Roadmap
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: INPUT SCREEN */}
          {!parsedRoadmap && !isSuccess && activeTab === 'ai_importer' && (
            <div className="space-y-5">
              {/* Preset selection bar */}
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-300 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Try a ready-made curriculum prompt:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setRawText(preset.prompt);
                        setDailyDuration(preset.duration);
                        setParseError(null);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                    >
                      {preset.label.split(' ')[0]} ({preset.targetDays}d)
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Input Area */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>Paste Learning Curriculum / Programme</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePasteFromClipboard}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                    >
                      <Clipboard className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Paste</span>
                    </button>
                    <label className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer">
                      <UploadCloud className="w-3.5 h-3.5 text-purple-400" />
                      <span>Upload (.md, .txt, .json)</span>
                      <input
                        type="file"
                        accept=".txt,.md,.json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    {rawText && (
                      <button
                        onClick={() => {
                          setRawText('');
                          setParseError(null);
                        }}
                        className="px-2 py-1 text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={8}
                    value={rawText}
                    onChange={(e) => {
                      setRawText(e.target.value);
                      if (parseError) setParseError(null);
                    }}
                    placeholder={`Paste anything from ChatGPT here. Examples:
- "I want to become a professional photo editor. Create a 30-day programme with 1 hour of daily practice..."
- Markdown tables with Day, Topic, Assignment columns
- Structured JSON roadmaps
- Bullet-point curriculum schedules`}
                    className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 font-mono transition-all resize-y"
                  />
                  {rawText && (
                    <div className="absolute bottom-3 right-3 text-[10px] px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-slate-400">
                      Detected Format: <strong className="text-cyan-300 uppercase">{detectedFormat}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule Parameters Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Start Date</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Daily Study Time (e.g. 7 PM)</span>
                  </label>
                  <input
                    type="time"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Daily Duration</span>
                  </label>
                  <select
                    value={dailyDuration}
                    onChange={(e) => setDailyDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-500 cursor-pointer"
                  >
                    <option value={30}>30 mins / day</option>
                    <option value={45}>45 mins / day</option>
                    <option value={60}>60 mins / day (1 hour)</option>
                    <option value={90}>90 mins / day (1.5 hours)</option>
                    <option value={120}>120 mins / day (2 hours)</option>
                  </select>
                </div>
              </div>

              {parseError && (
                <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Action Button */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleParseContent}
                  disabled={isParsing || !rawText.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 transition-all shadow-lg shadow-cyan-500/20 active:scale-95 cursor-pointer"
                >
                  <Sparkles className={`w-4 h-4 ${isParsing ? 'animate-spin' : ''}`} />
                  <span>{isParsing ? 'Analyzing with Gemini AI...' : 'Analyze & Parse Roadmap'}</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & VALIDATION SCREEN */}
          {parsedRoadmap && !isSuccess && (
            <div className="space-y-6">
              {/* Back to Edit Button */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setParsedRoadmap(null)}
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-edit / Paste Different Text</span>
                </button>
                <div className="text-[11px] text-slate-400">
                  Detected Source: <strong className="text-cyan-300 uppercase">{parsedRoadmap.rawSourceType || 'Plain Text'}</strong>
                </div>
              </div>

              {/* Title & Timing Customization */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">Roadmap Title</label>
                    <input
                      type="text"
                      value={editableTitle}
                      onChange={(e) => setEditableTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm font-semibold text-white focus:border-cyan-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Daily Study Time</label>
                      <input
                        type="time"
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 italic">
                  "{parsedRoadmap.description}"
                </p>
              </div>

              {/* Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400">Total Lessons</div>
                  <div className="text-lg font-black text-cyan-400 mt-0.5">{parsedRoadmap.lessons.length}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400">Total Duration</div>
                  <div className="text-lg font-black text-white mt-0.5">{parsedRoadmap.durationDays} Days</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400">Daily Study Pace</div>
                  <div className="text-lg font-black text-purple-400 mt-0.5">{dailyDuration}m / day</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
                  <div className="text-xs text-slate-400">Schedule Window</div>
                  <div className="text-xs font-bold text-slate-200 mt-1.5">{startDate} → {calculatedEndDate}</div>
                </div>
              </div>

              {/* Validation & Linter Alerts */}
              {validation && (
                <div className="space-y-2">
                  {validation.duplicateLessons.length > 0 && (
                    <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <div>
                        <strong>Duplicate items detected in text:</strong> {validation.duplicateLessons.join(', ')}. (They have been sequentialized).
                      </div>
                    </div>
                  )}

                  {validation.potentialConflicts.length > 0 && (
                    <div className="p-3 rounded-xl border border-blue-500/40 bg-blue-500/10 text-blue-300 text-xs flex items-center gap-2">
                      <Clock className="w-4 h-4 shrink-0" />
                      <div>
                        <strong>Notice:</strong> Overlaps with {validation.potentialConflicts.length} existing task(s) on {validation.potentialConflicts[0].date}. DayPilot allows concurrent sessions or lets you reschedule in Calendar.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Extracted Learning Phases */}
              {Array.isArray(parsedRoadmap.learningPhases) && parsedRoadmap.learningPhases.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Learning Phases Detected:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {parsedRoadmap.learningPhases.map((phase, pIdx) => (
                      <div key={pIdx} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                        <div className="font-bold text-cyan-300">{phase.title}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Days {phase.startDay} - {phase.endDay}</div>
                        <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">{phase.focus}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Extracted Lessons List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-400">
                    Extracted Daily Lessons ({parsedRoadmap.lessons.length}):
                  </span>
                  <span className="text-slate-400 text-[11px]">Click any lesson to inspect objectives & assignments</span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {parsedRoadmap.lessons.map((lesson, idx) => {
                    const isExpanded = expandedLessonIdx === idx;
                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-800/80 bg-slate-900/60 overflow-hidden text-xs transition-colors"
                      >
                        <button
                          onClick={() => setExpandedLessonIdx(isExpanded ? null : idx)}
                          className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="font-black text-cyan-400 w-14 shrink-0">Day {lesson.dayNumber}:</span>
                            <span className="font-semibold text-white">{lesson.title}</span>
                            {lesson.phase && (
                              <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                {lesson.phase}
                              </span>
                            )}
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </button>

                        {isExpanded && (
                          <div className="p-3 pt-0 border-t border-slate-800/60 bg-slate-950/40 space-y-2.5 text-slate-300">
                            {lesson.assignment && (
                              <div>
                                <span className="text-[10px] font-bold text-amber-400 uppercase">Practical Assignment: </span>
                                <span className="text-xs text-white">{lesson.assignment}</span>
                              </div>
                            )}

                            {Array.isArray(lesson.objectives) && lesson.objectives.length > 0 && (
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Objectives: </span>
                                <ul className="list-disc list-inside text-[11px] text-slate-300 mt-0.5 space-y-0.5">
                                  {lesson.objectives.map((obj, oIdx) => (
                                    <li key={oIdx}>{obj}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {Array.isArray(lesson.resources) && lesson.resources.length > 0 && (
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Resources & Tools: </span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {lesson.resources.map((res, rIdx) => (
                                    <span key={rIdx} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                                      {res}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Progress Notice while Scheduling */}
              {schedulingProgress && (
                <div className="p-3.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-xs flex items-center gap-2.5 animate-pulse">
                  <RotateCcw className="w-4 h-4 animate-spin shrink-0" />
                  <span>{schedulingProgress}</span>
                </div>
              )}

              {/* Approval Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setParsedRoadmap(null)}
                  disabled={isScheduling}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleApproveAndSchedule}
                  disabled={isScheduling}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-xl shadow-emerald-500/25 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve & Schedule All {parsedRoadmap.durationDays} Lessons</span>
                </button>
              </div>
            </div>
          )}

          {/* CURATED TEMPLATES TAB */}
          {activeTab === 'curated' && !parsedRoadmap && !isSuccess && (
            <div className="space-y-4">
              <div className="text-xs text-slate-300">
                Choose a pre-architected syllabus created by DayPilot engineering:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    key: 'fullstack',
                    title: 'Full-Stack Web Engineering',
                    duration: '4 Weeks',
                    pace: '60 mins / day',
                    icon: Code,
                    desc: 'Master React 19, TypeScript architecture, secure Firestore rules, and production deployment patterns.',
                  },
                  {
                    key: 'ai-ml',
                    title: 'AI Engineering & Prompt Architecture',
                    duration: '6 Weeks',
                    pace: '50 mins / day',
                    icon: BrainCircuit,
                    desc: 'Systematic mastery of Large Language Models, function calling, tool schemas, and multi-turn agent memory.',
                  },
                  {
                    key: 'exam-sprint',
                    title: 'High-Retention Exam Sprint',
                    duration: '2 Weeks',
                    pace: '90 mins / day',
                    icon: GraduationCap,
                    desc: 'Active recall and spaced-repetition sprint designed for rapid conceptual mastery and timed practice.',
                  },
                  {
                    key: 'habits',
                    title: 'Daily Deep Work & Productivity Blueprint',
                    duration: '3 Weeks',
                    pace: '30 mins / day',
                    icon: Sparkles,
                    desc: 'Build an impenetrable morning focus routine, eliminate attention fragmentation, and conduct daily reviews.',
                  },
                ].map((template) => {
                  const Icon = template.icon;
                  return (
                    <button
                      key={template.key}
                      onClick={async () => {
                        await importRoadmapTemplate(template.key);
                        onClose();
                      }}
                      className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700 text-left transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
                            {template.title}
                          </div>
                          <div className="text-[10px] text-slate-400">{template.duration} • {template.pace}</div>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">{template.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
