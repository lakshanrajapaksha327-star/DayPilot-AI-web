import React from 'react';
import {
  TrendingUp,
  Flame,
  Award,
  CheckCircle2,
  Clock,
  Calendar,
  BarChart3,
  Target,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { TaskCategory } from '../../types/index.ts';

export const ProgressView: React.FC = () => {
  const { tasks, plans, stats } = useData();
  const { userProfile } = useAuth();

  // 7-day velocity calculation
  const last7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayTasks = tasks.filter((t) => t.date === dateStr);
    const completed = dayTasks.filter((t) => t.completed).length;
    const total = dayTasks.length;
    const minutes = dayTasks
      .filter((t) => t.completed)
      .reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

    return {
      dateStr,
      dayName,
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      studyHours: Math.round((minutes / 60) * 10) / 10,
    };
  });

  // Category breakdown
  const categoryCounts: Record<TaskCategory, { total: number; completed: number }> = {
    Study: { total: 0, completed: 0 },
    Work: { total: 0, completed: 0 },
    Personal: { total: 0, completed: 0 },
    Project: { total: 0, completed: 0 },
    Health: { total: 0, completed: 0 },
    General: { total: 0, completed: 0 },
  };

  tasks.forEach((t) => {
    if (categoryCounts[t.category]) {
      categoryCounts[t.category].total += 1;
      if (t.completed) categoryCounts[t.category].completed += 1;
    }
  });

  // Achievement Badges
  const badges = [
    {
      id: 'b1',
      title: 'First Flight',
      desc: 'Completed your first DayPilot study task',
      unlocked: tasks.some((t) => t.completed),
      icon: Sparkles,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    },
    {
      id: 'b2',
      title: 'Streak Pilot',
      desc: 'Maintained 3 consecutive active study days',
      unlocked: (userProfile?.streakDays || 1) >= 3,
      icon: Flame,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    },
    {
      id: 'b3',
      title: 'Roadmap Architect',
      desc: 'Created or imported an active learning roadmap',
      unlocked: plans.length > 0,
      icon: Target,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    },
    {
      id: 'b4',
      title: 'Deep Focus Master',
      desc: 'Accumulated over 5 total hours of focused learning',
      unlocked: stats.totalStudyHours >= 5,
      icon: Zap,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <TrendingUp className="w-6 h-6 text-cyan-400" />
          <span>Progress & Analytics</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Study velocity, learning consistency, category breakdown and achievement milestones
        </p>
      </div>

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Current Streak</span>
            <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-300">{stats.streakDays} Days</div>
          <p className="text-[11px] text-slate-400 mt-1">Daily consistency record</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Total Study Hours</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white">{stats.totalStudyHours} hrs</div>
          <p className="text-[11px] text-slate-400 mt-1">Across all completed sessions</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Completed Tasks</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400">
            {tasks.filter((t) => t.completed).length} / {tasks.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Total items cleared</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-xs">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Active Roadmaps</span>
            <Target className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-extrabold text-purple-300">{stats.activePlansCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Concurrent learning goals</p>
        </div>
      </div>

      {/* 7-Day Velocity Chart & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Bar Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span>7-Day Study & Completion Velocity</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Daily completed tasks and hours logged</p>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-56 pt-8 pb-2 px-2 border-b border-slate-800">
            {last7Days.map((day, idx) => {
              const heightPercent = Math.min(100, Math.max(10, day.completed * 30));
              const isToday = day.dateStr === new Date().toISOString().split('T')[0];

              return (
                <div key={idx} className="flex flex-col items-center h-full justify-end group">
                  <div className="text-[10px] font-bold text-cyan-300 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {day.completed} done
                  </div>
                  <div className="w-full max-w-[42px] bg-slate-800 rounded-t-xl overflow-hidden flex items-end justify-center h-full">
                    <div
                      className={`w-full rounded-t-xl transition-all duration-700 ${
                        isToday
                          ? 'bg-gradient-to-t from-blue-600 via-cyan-500 to-cyan-300 shadow-md shadow-cyan-500/20'
                          : 'bg-gradient-to-t from-blue-700 to-indigo-500'
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <div className="mt-2 text-center">
                    <span
                      className={`text-[11px] font-bold block ${
                        isToday ? 'text-cyan-400' : 'text-slate-400'
                      }`}
                    >
                      {day.dayName}
                    </span>
                    <span className="text-[9px] text-slate-400 block">{day.studyHours}h</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 mt-4 px-2">
            <span>Past 7 days trend</span>
            <span className="text-cyan-400 font-semibold">Weekly average: {stats.weeklyTasksCompleted} tasks</span>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-xl">
          <h3 className="font-bold text-base text-white mb-1">Category Distribution</h3>
          <p className="text-xs text-slate-400 mb-5">Tasks completed per focus domain</p>

          <div className="space-y-4">
            {(Object.keys(categoryCounts) as TaskCategory[]).map((cat) => {
              const data = categoryCounts[cat];
              const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;

              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-300">{cat}</span>
                    <span className="text-slate-400 font-semibold">
                      {data.completed}/{data.total} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Achievement Milestones */}
      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-base text-white">Study Milestones & Badges</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {badges.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.id}
                className={`p-4 rounded-xl border transition-all ${
                  b.unlocked
                    ? 'border-slate-700 bg-slate-950/80 shadow-md'
                    : 'border-slate-800/40 bg-slate-950/20 opacity-40'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-3 ${b.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-white">{b.title}</h4>
                  {b.unlocked && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Earned
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
