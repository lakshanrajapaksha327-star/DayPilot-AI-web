import React, { useState } from 'react';
import {
  Gauge,
  AlertTriangle,
  Clock,
  Sparkles,
  CheckCircle,
  Calendar,
  Layers,
  Check,
  X,
  ArrowRight,
} from 'lucide-react';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export const DailyWorkloadAdvisor: React.FC = () => {
  const { plans, tasks, conflicts, todayWorkload, rescheduleSession } = useData();
  const { userProfile } = useAuth();

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [advice, setAdvice] = useState<{
    status: string;
    totalDailyMinutes: number;
    analysis: string;
    recommendations: { planTitle: string; currentSchedule?: string; suggestedAdjustment: string; reasoning: string }[];
  } | null>(null);

  const activePlans = plans.filter((p) => p.status === 'active');
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter((t) => t.date === todayStr && !t.isSkipped);

  // If there are multiple active plans, high study hours (>150m), or time conflicts, render the banner
  const hasWorkloadNotice = todayWorkload.isExcessive || conflicts.length > 0 || activePlans.length >= 2;

  if (!hasWorkloadNotice) return null;

  const handleGetAiAdvice = async () => {
    try {
      setIsAiLoading(true);
      const res = await fetch('/api/gemini/workload-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activePlans: activePlans.map((p) => ({
            title: p.title,
            preferredTime: p.preferredTime,
            dailyStudyMinutes: p.dailyStudyMinutes,
          })),
          todayTasks: todayTasks.map((t) => ({
            title: t.title,
            startTime: t.startTime,
            durationMinutes: t.durationMinutes,
            priority: t.priority,
          })),
          preferredStudyTime: userProfile?.preferredStudyTime || 'evening',
        }),
      });

      if (!res.ok) throw new Error('Workload advisor request failed');
      const data = await res.json();
      setAdvice(data);
    } catch (err) {
      console.error('Workload advice error:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/40 via-slate-900/90 to-cyan-950/20 p-4 sm:p-5 shadow-xl text-slate-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 shadow-sm">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-cyan-300 border border-blue-500/30">
                Cognitive Workload Advisor
              </span>
              {conflicts.length > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {conflicts.length} Overlapping Slot{conflicts.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <h4 className="text-sm font-bold text-white mt-1">
              Today's Demand: {todayWorkload.totalMinutes} mins across {todayWorkload.sessionCount} sessions ({activePlans.length} active roadmaps)
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {todayWorkload.recommendation || 'Multiple concurrent learning tracks detected. Review optimal distribution to maintain long-term retention.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGetAiAdvice}
          disabled={isAiLoading}
          className="px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-500/20 transition-all flex items-center gap-1.5 shrink-0 self-end sm:self-center cursor-pointer disabled:opacity-50"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isAiLoading ? 'Analyzing Workload...' : 'AI Rebalance Advice'}</span>
        </button>
      </div>

      {/* AI Advice Output Details */}
      {advice && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30 text-xs space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="font-bold text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              Cognitive Pacing Recommendation
            </span>
            <button onClick={() => setAdvice(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-slate-300 leading-relaxed">{advice.analysis}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {advice.recommendations.map((rec, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white truncate">{rec.planTitle}</span>
                  {rec.currentSchedule && (
                    <span className="text-[10px] text-slate-400 font-mono">{rec.currentSchedule}</span>
                  )}
                </div>
                <div className="text-cyan-400 font-medium text-[11px]">
                  💡 {rec.suggestedAdjustment}
                </div>
                <p className="text-[11px] text-slate-400">{rec.reasoning}</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 italic">
            * DayPilot adheres to strict user consent: commitments are never automatically altered without your manual review and approval.
          </p>
        </div>
      )}
    </div>
  );
};
