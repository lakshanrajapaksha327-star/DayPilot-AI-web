import React from 'react';
import {
  LayoutDashboard,
  Bot,
  Compass,
  Calendar,
  CheckSquare,
  Bell,
  TrendingUp,
  Settings,
  Plus,
  Sparkles,
  Layers,
  LogIn,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { NavSection } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';

interface SidebarProps {
  currentSection: NavSection;
  onNavigate: (section: NavSection) => void;
  onOpenQuickTask: () => void;
  onOpenRoadmapModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onNavigate,
  onOpenQuickTask,
  onOpenRoadmapModal,
}) => {
  const { user, userProfile, isGuestMode, signInWithGoogle, signOutUser } = useAuth();
  const { stats, plans, tasks, reminders } = useData();

  const pendingTasksCount = tasks.filter((t) => !t.completed).length;
  const pendingRemindersCount = reminders.filter((r) => !r.completed && r.status !== 'cancelled').length;
  const activePlan = plans.find((p) => p.status === 'active');

  const navItems: { id: NavSection; label: string; icon: React.ElementType; badge?: string | number; badgeColor?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assistant', label: 'AI Assistant', icon: Bot, badge: 'Gemini 3.8', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    { id: 'plans', label: 'My Plans', icon: Compass, badge: stats.activePlansCount > 0 ? stats.activePlansCount : undefined },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, badge: pendingTasksCount > 0 ? pendingTasksCount : undefined, badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    { id: 'reminders', label: 'Reminders', icon: Bell, badge: pendingRemindersCount > 0 ? pendingRemindersCount : undefined, badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 border-r h-screen sticky top-0 shrink-0 transition-colors border-slate-800/80 bg-slate-950/95 dark:border-slate-800/80 dark:bg-slate-950/95">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 opacity-30 blur-xs -z-10" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-cyan-200 to-blue-400 bg-clip-text text-transparent">
                DayPilot AI
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Personal Study & Productivity</p>
          </div>
        </div>
      </div>

      {/* Main Nav Items */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
          Navigation
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600/20 to-cyan-600/10 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-white'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Quick Action Buttons inside Sidebar */}
        <div className="pt-5 pb-2 px-3 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
          Quick Workflows
        </div>

        <button
          onClick={onOpenQuickTask}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all shadow-md shadow-blue-500/20 cursor-pointer active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span>Quick Add Task</span>
        </button>

        <button
          onClick={onOpenRoadmapModal}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 transition-all cursor-pointer"
        >
          <Layers className="w-4 h-4 text-purple-400" />
          <span>Roadmap Templates</span>
        </button>

        {/* Active Plan Widget */}
        {activePlan && (
          <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-b from-slate-900/90 to-slate-900/40 border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[11px] font-medium text-slate-400">Active Roadmap</span>
              <span className="text-cyan-400 font-bold text-xs">{activePlan.progress}%</span>
            </div>
            <div className="font-semibold text-xs text-white truncate mb-2">
              {activePlan.title}
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, activePlan.progress))}%` }}
              />
            </div>
            <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
              <span>{activePlan.dailyStudyMinutes}m / day</span>
              <span className="capitalize text-slate-400">{activePlan.skillLevel}</span>
            </div>
          </div>
        )}
      </div>

      {/* User Footer / Account Status */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
        {user ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-9 h-9 rounded-full border border-cyan-500/40 object-cover shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                  {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                </div>
              )}
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-white truncate">
                  {user.displayName || 'DayPilot User'}
                </div>
                <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
              </div>
            </div>
            <button
              onClick={() => signOutUser()}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : isGuestMode ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> Guest Mode
              </span>
              <button
                onClick={() => signInWithGoogle()}
                className="text-[11px] text-cyan-400 hover:underline font-semibold cursor-pointer"
              >
                Sign In
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Sign in with Google to sync all tasks and roadmaps to your Cloud Firestore.
            </p>
          </div>
        ) : (
          <button
            onClick={() => signInWithGoogle()}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer shadow-md shadow-blue-600/20"
          >
            <LogIn className="w-4 h-4" />
            <span>Connect Google Account</span>
          </button>
        )}
      </div>
    </aside>
  );
};
