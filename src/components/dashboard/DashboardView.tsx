import {
  Sparkles,
  Flame,
  CheckCircle2,
  Clock,
  Compass,
  Plus,
  Layers,
  ArrowRight,
  Bell,
  Calendar as CalendarIcon,
  Check,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Globe,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { NavSection, Task, Plan } from '../../types/index.ts';
import { MissedSessionCard } from '../common/MissedSessionCard.tsx';
import { DailyWorkloadAdvisor } from '../common/DailyWorkloadAdvisor.tsx';
import { calculateEndTime } from '../../utils/schedulingEngine.ts';

interface DashboardViewProps {
  onNavigate: (section: NavSection) => void;
  onOpenQuickTask: () => void;
  onOpenPlanModal: () => void;
  onOpenRoadmapModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenQuickTask,
  onOpenPlanModal,
  onOpenRoadmapModal,
}) => {
  const { user, userProfile } = useAuth();
  const { tasks, plans, reminders, stats, missedTasks, conflicts, toggleTaskCompleted, toggleReminderCompleted } = useData();

  // Dynamic greeting based on current local hour
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const name = user?.displayName?.split(' ')[0] || userProfile?.displayName?.split(' ')[0] || 'Pilot';

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter((t) => t.date === todayStr);
  const upcomingTasks = tasks
    .filter((t) => !t.completed && t.date >= todayStr)
    .sort((a, b) => (a.date + (a.startTime || '')) > (b.date + (b.startTime || '')) ? 1 : -1)
    .slice(0, 5);

  const activePlans = plans.filter((p) => p.status === 'active');
  const nextReminder = stats.nextReminder;

  const priorityColors: Record<Task['priority'], string> = {
    low: 'bg-slate-800 text-slate-300 border-slate-700',
    medium: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    high: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    urgent: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero Greeting & Quick Action Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/40 p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-16 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>DayPilot AI Command Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {getGreeting()}, <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">{name}</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">
              You have <span className="text-cyan-300 font-semibold">{todayTasks.filter(t => !t.completed).length} pending tasks</span> scheduled for today. Keep your momentum going!
            </p>
          </div>

          {/* Action Button Group */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onOpenQuickTask}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all shadow-md shadow-blue-500/25 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Quick Add Task</span>
            </button>
            <button
              onClick={onOpenPlanModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-all cursor-pointer"
            >
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Create AI Roadmap</span>
            </button>
            <button
              onClick={onOpenRoadmapModal}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-900/90 hover:bg-slate-800/80 border border-slate-800 transition-all cursor-pointer"
            >
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Import Roadmap</span>
            </button>
          </div>
        </div>
      </div>

      {/* Missed Task Management Alert */}
      <MissedSessionCard missedTasks={missedTasks} />

      {/* Cognitive Workload & Conflict Advisor */}
      <DailyWorkloadAdvisor />

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Daily Completion */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Daily Completion</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">{stats.todayCompletionPercentage}%</span>
              <span className="text-xs text-slate-400">
                ({stats.todayTasksCompleted}/{stats.todayTasksTotal} tasks)
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                style={{ width: `${stats.todayCompletionPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 2: Weekly Progress */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Weekly Progress</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">{stats.weeklyCompletionPercentage}%</span>
              <span className="text-xs text-slate-400">
                ({stats.weeklyTasksCompleted}/{stats.weeklyTasksTotal} this week)
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                style={{ width: `${stats.weeklyCompletionPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Metric 3: Learning Streak */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Study Streak</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Flame className="w-4 h-4 fill-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-300">{stats.streakDays}</span>
              <span className="text-sm font-semibold text-slate-400">Days Consecutive</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Active momentum badge achieved</p>
          </div>
        </div>

        {/* Metric 4: Study Hours Logged */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Study Hours</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">{stats.totalStudyHours}</span>
              <span className="text-sm font-semibold text-slate-400">hrs completed</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">{stats.activePlansCount} active roadmaps tracked</p>
          </div>
        </div>
      </div>

      {/* Next Reminder Banner if available */}
      {nextReminder && (
        <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-300">Upcoming Reminder: {nextReminder.time}</div>
              <div className="text-xs text-amber-100/90 font-medium">{nextReminder.title}</div>
            </div>
          </div>
          <button
            onClick={() => toggleReminderCompleted(nextReminder.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 transition-colors cursor-pointer shrink-0"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Mark Done</span>
          </button>
        </div>
      )}

      {/* Main Grid: Today's Schedule & Active Roadmaps */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Today's Schedule & Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Schedule Box */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-cyan-400" />
                <h2 className="font-bold text-base text-white">Today's Focus Schedule</h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                  <Globe className="w-3 h-3 text-cyan-400" />
                  {userProfile?.timeZone || 'Asia/Colombo'}
                </span>
              </div>
              <button
                onClick={() => onNavigate('tasks')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>View all tasks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {todayTasks.length === 0 ? (
              <div className="py-8 text-center rounded-xl border border-dashed border-slate-800 p-6">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-white">No tasks scheduled for today</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Add an actionable study or work item to start your day with purpose.
                </p>
                <button
                  onClick={onOpenQuickTask}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Task for Today
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todayTasks.map((task) => {
                  const isConflicted = conflicts.some(
                    (c) => c.taskAId === task.id || c.taskBId === task.id
                  );
                  const displayEndTime =
                    task.endTime ||
                    (task.startTime ? calculateEndTime(task.startTime, task.durationMinutes) : null);

                  return (
                    <div
                      key={task.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                        isConflicted
                          ? 'border-amber-500/50 bg-amber-950/10 hover:border-amber-500/70'
                          : task.completed
                          ? 'border-slate-800/60 bg-slate-950/40 opacity-70'
                          : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleTaskCompleted(task.id)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                            task.completed
                              ? 'bg-cyan-500 border-cyan-500 text-slate-950'
                              : 'border-slate-600 hover:border-cyan-400'
                          }`}
                        >
                          {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-medium ${
                                task.completed ? 'line-through text-slate-400' : 'text-white'
                              }`}
                            >
                              {task.title}
                            </span>
                            {task.planId && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                                Roadmap
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                            {task.startTime && (
                              <span className="flex items-center gap-1 text-cyan-300 font-medium">
                                <Clock className="w-3 h-3" />
                                {task.startTime}
                                {displayEndTime && ` – ${displayEndTime}`}
                              </span>
                            )}
                            <span>•</span>
                            <span>{task.durationMinutes} mins</span>
                            <span>•</span>
                            <span className="text-slate-400">{task.category}</span>
                            {task.reminderTime && (
                              <>
                                <span>•</span>
                                <span className="text-amber-400/80 flex items-center gap-0.5">
                                  <Bell className="w-2.5 h-2.5" />
                                  {task.reminderTime}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isConflicted && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-300">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Conflict</span>
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                            priorityColors[task.priority]
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Tasks */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <h2 className="font-bold text-base text-white">Upcoming Queue</h2>
              </div>
              <button
                onClick={() => onNavigate('calendar')}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>Calendar View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingTasks.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                All upcoming tasks are cleared.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-slate-950/60 hover:bg-slate-950 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="font-medium text-slate-200">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>{t.date}</span>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded border text-[10px] ${
                          priorityColors[t.priority]
                        }`}
                      >
                        {t.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Active Learning Roadmaps & AI Quick Prompt */}
        <div className="space-y-6">
          {/* Active Learning Plans Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <h2 className="font-bold text-base text-white">Active Roadmaps</h2>
              </div>
              <button
                onClick={() => onNavigate('plans')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>Manage</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activePlans.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl p-4">
                <Compass className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h3 className="text-xs font-semibold text-white">No active roadmaps</h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Start a study track to track progress towards your goals.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    onClick={onOpenPlanModal}
                    className="w-full py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer"
                  >
                    Create Custom Roadmap
                  </button>
                  <button
                    onClick={onOpenRoadmapModal}
                    className="w-full py-1.5 rounded-lg text-xs font-medium text-cyan-300 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors cursor-pointer"
                  >
                    Import Template
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {activePlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-white truncate pr-2">{plan.title}</span>
                      <span className="text-cyan-400 font-bold shrink-0">{plan.progress}%</span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden my-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                        style={{ width: `${Math.min(100, Math.max(5, plan.progress))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{plan.dailyStudyMinutes}m / day</span>
                      <span>{plan.objectives?.filter(o => o.completed).length || 0}/{plan.objectives?.length || 0} milestones</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Assistant Quick Card */}
          <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-950/30 to-slate-900/80 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-white">DayPilot AI Assistant</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Ask your AI companion to optimize your schedule, decompose complex learning goals, or suggest high-yield review intervals.
            </p>

            <button
              onClick={() => onNavigate('assistant')}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-all shadow-md shadow-purple-600/20 cursor-pointer"
            >
              <span>Launch AI Assistant</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
