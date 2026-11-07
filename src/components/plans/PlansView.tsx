import React, { useState } from 'react';
import {
  Compass,
  Plus,
  Layers,
  Calendar,
  Clock,
  Target,
  MoreVertical,
  Play,
  Pause,
  CheckCircle,
  Trash2,
  Edit2,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { useData } from '../../context/DataContext.tsx';
import { Plan, PlanStatus } from '../../types/index.ts';
import { DailyWorkloadAdvisor } from '../common/DailyWorkloadAdvisor.tsx';
import { FastForward, RefreshCw, SkipForward, X } from 'lucide-react';

interface PlansViewProps {
  onOpenCreatePlan: () => void;
  onOpenImportRoadmap: () => void;
  onEditPlan: (plan: Plan) => void;
}

export const PlansView: React.FC<PlansViewProps> = ({
  onOpenCreatePlan,
  onOpenImportRoadmap,
  onEditPlan,
}) => {
  const {
    plans,
    tasks,
    pausePlan,
    resumePlan,
    deletePlanWithSessions,
    changeRecurringReminderTime,
    moveRemainingLessonsForward,
    togglePlanObjective,
    skipLesson,
    toggleTaskCompleted,
  } = useData();
  const [filter, setFilter] = useState<'all' | PlanStatus>('all');
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [rescheduleModalPlan, setRescheduleModalPlan] = useState<Plan | null>(null);
  const [newReminderTime, setNewReminderTime] = useState<string>('19:00');
  const [shiftDaysCount, setShiftDaysCount] = useState<number>(1);

  const filteredPlans = plans.filter((p) => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const toggleExpand = (planId: string) => {
    setExpandedPlanId((prev) => (prev === planId ? null : planId));
  };

  const handleStatusChange = async (planId: string, currentStatus: PlanStatus) => {
    setActionMenuOpenId(null);
    if (currentStatus === 'active') {
      await pausePlan(planId);
    } else {
      await resumePlan(planId);
    }
  };

  const handleDelete = async (planId: string) => {
    setActionMenuOpenId(null);
    if (window.confirm('Delete this plan? Completed historical tasks will be retained in your progress log.')) {
      await deletePlanWithSessions(planId, true);
    }
  };

  const handleShiftSchedule = async (planId: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    await moveRemainingLessonsForward(planId, todayStr, shiftDaysCount);
    setRescheduleModalPlan(null);
  };

  const handleChangeTime = async (planId: string) => {
    await changeRecurringReminderTime(planId, newReminderTime);
    setRescheduleModalPlan(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Compass className="w-6 h-6 text-cyan-400" />
            <span>Learning Roadmaps</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track milestones, pace, and daily study objectives with structured goals
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenImportRoadmap}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 transition-all cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Import Template</span>
          </button>
          <button
            onClick={onOpenCreatePlan}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Roadmap</span>
          </button>
        </div>
      </div>

      {/* Daily Workload & Rebalancing Advisor */}
      <DailyWorkloadAdvisor />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        {(['all', 'active', 'paused', 'completed'] as const).map((tab) => {
          const count = tab === 'all' ? plans.length : plans.filter((p) => p.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer flex items-center gap-1.5 ${
                filter === tab
                  ? 'bg-blue-600/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <span>{tab}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredPlans.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-3 text-cyan-400">
            <Compass className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No learning roadmaps found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {filter === 'all'
              ? 'Get started by creating your first personalized learning plan or importing a proven template.'
              : `No roadmaps currently marked as ${filter}.`}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={onOpenCreatePlan}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-sm"
            >
              Create New Roadmap
            </button>
            <button
              onClick={onOpenImportRoadmap}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-cyan-300 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors cursor-pointer"
            >
              Browse Curated Templates
            </button>
          </div>
        </div>
      ) : (
        /* Plans Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredPlans.map((plan) => {
            const isExpanded = expandedPlanId === plan.id;
            const completedCount = plan.objectives?.filter((o) => o.completed).length || 0;
            const totalCount = plan.objectives?.length || 0;

            const statusColors: Record<PlanStatus, { bg: string; text: string; border: string }> = {
              active: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/30' },
              paused: { bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/30' },
              completed: { bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/30' },
            };

            const statusStyle = statusColors[plan.status];

            return (
              <div
                key={plan.id}
                className="relative rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg"
              >
                {/* Header & Badges */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: plan.color || '#3B82F6' }}
                      />
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                      >
                        {plan.status}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-slate-800 bg-slate-950 text-slate-300 capitalize">
                        {plan.skillLevel}
                      </span>
                    </div>

                    {/* Actions Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setActionMenuOpenId(actionMenuOpenId === plan.id ? null : plan.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {actionMenuOpenId === plan.id && (
                        <div className="absolute right-0 mt-1 w-48 rounded-xl border border-slate-700 bg-slate-950 shadow-xl z-20 py-1 text-xs">
                          <button
                            onClick={() => {
                              setActionMenuOpenId(null);
                              onEditPlan(plan);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white text-left cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                            <span>Edit Details</span>
                          </button>
                          <button
                            onClick={() => {
                              setActionMenuOpenId(null);
                              setRescheduleModalPlan(plan);
                              setNewReminderTime(plan.preferredTime || '19:00');
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white text-left cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5 text-purple-400" />
                            <span>Reschedule / Shift Dates</span>
                          </button>
                          <button
                            onClick={() => handleStatusChange(plan.id, plan.status)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white text-left cursor-pointer"
                          >
                            {plan.status === 'active' ? (
                              <>
                                <Pause className="w-3.5 h-3.5 text-amber-400" />
                                <span>Pause Plan</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Resume Plan</span>
                              </>
                            )}
                          </button>
                          <div className="my-1 border-t border-slate-800" />
                          <button
                            onClick={() => handleDelete(plan.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-500/10 text-left cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Plan</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-base text-white mb-1.5">{plan.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                    {plan.description || 'No description provided.'}
                  </p>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-medium text-slate-400">Roadmap Progress</span>
                      <span className="font-bold text-cyan-400">{plan.progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(3, plan.progress))}%`,
                          backgroundColor: plan.color || '#06B6D4',
                        }}
                      />
                    </div>
                  </div>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 mb-4 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{plan.dailyStudyMinutes}m daily target</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-purple-400" />
                      <span>{plan.durationWeeks} weeks duration</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 col-span-2">
                      <Target className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        {completedCount} of {totalCount} objectives achieved
                      </span>
                    </div>
                  </div>
                </div>

                {/* Objectives Expandable List */}
                <div>
                  <button
                    onClick={() => toggleExpand(plan.id)}
                    className="w-full flex items-center justify-between py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer border-t border-slate-800 pt-3"
                  >
                    <span>Objectives & Milestones ({totalCount})</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isExpanded && (
                    <div className="space-y-2 mt-2 pt-1 border-t border-slate-800/60">
                      {plan.objectives?.map((obj) => (
                        <div
                          key={obj.id}
                          onClick={() => togglePlanObjective(plan.id, obj.id)}
                          className={`flex items-start gap-2.5 p-2 rounded-lg transition-all cursor-pointer ${
                            obj.completed
                              ? 'bg-emerald-500/5 text-slate-400'
                              : 'bg-slate-950/70 text-slate-200 hover:bg-slate-950'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center mt-0.5 shrink-0 ${
                              obj.completed
                                ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                                : 'border-slate-600'
                            }`}
                          >
                            {obj.completed && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span
                            className={`text-xs ${
                              obj.completed ? 'line-through text-slate-400' : 'text-slate-200'
                            }`}
                          >
                            {obj.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Reschedule & Shift Dates Modal */}
      {rescheduleModalPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl relative">
            <button
              onClick={() => setRescheduleModalPlan(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reschedule Roadmap</h3>
                <p className="text-xs text-slate-400 truncate max-w-[260px]">
                  {rescheduleModalPlan.title}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-5">
              Adjust your recurring schedule. Completed historical sessions are strictly preserved to maintain your learning streaks and logs.
            </p>

            <div className="space-y-4">
              {/* Change Recurring Daily Time */}
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    Change Recurring Daily Time
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={newReminderTime}
                    onChange={(e) => setNewReminderTime(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={() => handleChangeTime(rescheduleModalPlan.id)}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer"
                  >
                    Apply Time
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Updates preferred study time and reminders for all future pending lessons.
                </p>
              </div>

              {/* Move Remaining Lessons Forward */}
              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2.5">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <FastForward className="w-3.5 h-3.5 text-purple-400" />
                  Shift Remaining Lessons Forward
                </span>
                <p className="text-[11px] text-slate-400">
                  Need a break or missed a session? Push all remaining unfinished lessons forward without affecting past completed work.
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={shiftDaysCount}
                    onChange={(e) => setShiftDaysCount(Number(e.target.value))}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value={1}>Shift forward by +1 day</option>
                    <option value={2}>Shift forward by +2 days</option>
                    <option value={3}>Shift forward by +3 days</option>
                    <option value={7}>Shift forward by +1 week</option>
                  </select>
                  <button
                    onClick={() => handleShiftSchedule(rescheduleModalPlan.id)}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-colors cursor-pointer"
                  >
                    Shift Dates
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setRescheduleModalPlan(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
