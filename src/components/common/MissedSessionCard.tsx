import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Calendar,
  FastForward,
  SkipForward,
  Sparkles,
  ArrowRight,
  CheckCircle,
  X,
  RotateCcw,
  Sliders,
  Check,
} from 'lucide-react';
import { Task } from '../../types/index.ts';
import { useData } from '../../context/DataContext.tsx';

interface MissedSessionCardProps {
  missedTasks: Task[];
}

export const MissedSessionCard: React.FC<MissedSessionCardProps> = ({ missedTasks }) => {
  const {
    plans,
    rescheduleSession,
    skipLesson,
    moveRemainingLessonsForward,
    applyAiRedesignSchedule,
  } = useData();

  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('20:00');

  // AI Redesign State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiProposal, setAiProposal] = useState<{
    summary: string;
    impactOnDeadline: string;
    recommendations: { taskId: string; title: string; proposedDate: string; proposedStartTime: string; proposedEndTime: string; rationale: string }[];
  } | null>(null);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  if (!missedTasks || missedTasks.length === 0) return null;

  const currentTask = missedTasks[Math.min(activeTaskIndex, missedTasks.length - 1)];
  const plan = currentTask.planId ? plans.find((p) => p.id === currentTask.planId) : null;

  // Action 1: Reschedule this session
  const handleRescheduleSubmit = async () => {
    if (!currentTask) return;
    await rescheduleSession(currentTask.id, newDate, newTime);
    setIsRescheduling(false);
  };

  // Action 2: Move remaining lessons forward (+1 day)
  const handleMoveRemainingForward = async () => {
    if (!currentTask.planId) return;
    await moveRemainingLessonsForward(currentTask.planId, currentTask.date, 1);
  };

  // Action 3: Keep original deadline (reschedule missed session to today/tomorrow without shifting end date)
  const handleKeepOriginalDeadline = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    await rescheduleSession(currentTask.id, todayStr, '21:00');
  };

  // Action 4: Skip the missed lesson
  const handleSkip = async () => {
    await skipLesson(currentTask.id);
  };

  // Action 5: Ask Gemini to redesign the remaining schedule
  const handleAskGeminiRedesign = async () => {
    try {
      setIsAiLoading(true);
      setAiSuccessMessage(null);

      const res = await fetch('/api/gemini/redesign-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTitle: plan?.title || currentTask.title,
          missedTasks: [{ title: currentTask.title, originalDate: currentTask.date }],
          remainingTasks: [],
          constraints: {
            preferredTime: currentTask.startTime || '19:00',
            durationMinutes: currentTask.durationMinutes || 60,
          },
        }),
      });

      if (!res.ok) throw new Error('AI redesign request failed');
      const data = await res.json();
      setAiProposal(data);
    } catch (err) {
      console.error('Error requesting schedule redesign:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Apply AI Proposed Redesign
  const handleApplyAiProposal = async () => {
    if (!aiProposal || !currentTask.planId) return;
    await applyAiRedesignSchedule(currentTask.planId, aiProposal.recommendations);
    setAiSuccessMessage('AI redesigned schedule approved and applied!');
    setTimeout(() => {
      setAiProposal(null);
      setAiSuccessMessage(null);
    }, 2000);
  };

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-amber-950/20 p-4 sm:p-5 shadow-xl text-slate-200">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Left Alert Info */}
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 shadow-sm">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Missed Session Alert
              </span>
              {missedTasks.length > 1 && (
                <span className="text-xs text-slate-400">
                  ({activeTaskIndex + 1} of {missedTasks.length} missed sessions)
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white mt-1">
              {currentTask.title}
            </h3>
            <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
              <span className="flex items-center gap-1 text-amber-300/90">
                <Calendar className="w-3.5 h-3.5" />
                Scheduled: {currentTask.date} at {currentTask.startTime || 'Unscheduled'}
              </span>
              {plan && (
                <span className="text-cyan-400 font-medium truncate max-w-xs">
                  • Roadmap: {plan.title}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Actions / Resolution Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          {/* Action 1: Reschedule button */}
          <button
            type="button"
            onClick={() => setIsRescheduling(!isRescheduling)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Reschedule Session</span>
          </button>

          {/* Action 2: Move remaining forward */}
          <button
            type="button"
            onClick={handleMoveRemainingForward}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FastForward className="w-3.5 h-3.5 text-blue-400" />
            <span>Move Schedule +1 Day</span>
          </button>

          {/* Action 3: Keep deadline */}
          <button
            type="button"
            onClick={handleKeepOriginalDeadline}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Keep Deadline</span>
          </button>

          {/* Action 4: Skip lesson */}
          <button
            type="button"
            onClick={handleSkip}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Skip Lesson</span>
          </button>

          {/* Action 5: Ask Gemini to Redesign Schedule */}
          <button
            type="button"
            onClick={handleAskGeminiRedesign}
            disabled={isAiLoading}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAiLoading ? 'Redesigning...' : 'Ask AI to Redesign'}</span>
          </button>
        </div>
      </div>

      {/* Inline Reschedule Form */}
      {isRescheduling && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-3 animate-fade-in">
          <span className="text-xs text-slate-300 font-medium">Select New Target Time:</span>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white"
          />
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white"
          />
          <button
            type="button"
            onClick={handleRescheduleSubmit}
            className="px-3 py-1 text-xs font-semibold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white transition-colors cursor-pointer"
          >
            Confirm Time
          </button>
          <button
            type="button"
            onClick={() => setIsRescheduling(false)}
            className="px-2 py-1 text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {/* AI Schedule Redesign Review Modal / Panel */}
      {aiProposal && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-purple-500/30 text-xs space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Gemini AI Schedule Recovery Proposal
            </span>
            <button
              onClick={() => setAiProposal(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-slate-300 leading-relaxed">{aiProposal.summary}</p>
          <p className="text-cyan-400 font-medium">
            Deadline Impact: {aiProposal.impactOnDeadline}
          </p>

          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {aiProposal.recommendations.map((rec) => (
              <div
                key={rec.taskId}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-white block">{rec.title}</span>
                  <span className="text-[11px] text-slate-400">{rec.rationale}</span>
                </div>
                <span className="text-cyan-400 font-mono shrink-0 ml-2">
                  {rec.proposedDate} at {rec.proposedStartTime}
                </span>
              </div>
            ))}
          </div>

          {aiSuccessMessage ? (
            <div className="p-2 rounded bg-emerald-500/20 text-emerald-300 font-medium flex items-center gap-1.5">
              <Check className="w-4 h-4" /> {aiSuccessMessage}
            </div>
          ) : (
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAiProposal(null)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                Reject AI Changes
              </button>
              <button
                type="button"
                onClick={handleApplyAiProposal}
                className="px-4 py-1.5 font-bold rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/20"
              >
                Approve & Apply AI Schedule
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
