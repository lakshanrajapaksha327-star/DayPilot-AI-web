import React from 'react';
import {
  Sparkles,
  Flame,
  Sun,
  Moon,
  Plus,
  LogIn,
  LogOut,
  User as UserIcon,
  FileUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { NavSection } from '../../types/index.ts';
import { PWAInstallButton } from '../pwa/PWAInstallButton.tsx';

interface HeaderProps {
  currentSection: NavSection;
  onOpenQuickTask: () => void;
  onOpenRoadmapModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentSection,
  onOpenQuickTask,
  onOpenRoadmapModal,
}) => {
  const { user, userProfile, isGuestMode, signInWithGoogle, signOutUser, preferences, updatePreferencesInDb } = useAuth();
  const { stats } = useData();

  const sectionTitles: Record<NavSection, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Your daily command center and focus metrics' },
    assistant: { title: 'AI Study Assistant', subtitle: 'Interactive roadmap generator & schedule optimizer' },
    plans: { title: 'Learning Roadmaps', subtitle: 'Goal-driven study paths and milestone tracking' },
    calendar: { title: 'Schedule Calendar', subtitle: 'Visual timeline, time blocks and scheduled tasks' },
    tasks: { title: 'Task Manager', subtitle: 'Actionable items, priorities and durations' },
    reminders: { title: 'Reminders & Notifications', subtitle: 'Real-time FCM push notifications, device manager and in-app alerts' },
    progress: { title: 'Progress & Analytics', subtitle: 'Study streaks, completion velocity and consistency' },
    settings: { title: 'Settings', subtitle: 'Personal preferences, theme and account data' },
  };

  const isDark = preferences?.theme !== 'light';

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    updatePreferencesInDb({ theme: nextTheme });
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 py-3.5 border-b backdrop-blur-md transition-colors border-slate-800/80 bg-slate-950/70 dark:border-slate-800/80 dark:bg-slate-950/80">
      {/* Left: Section title & Date */}
      <div className="flex items-center gap-3">
        <div className="md:hidden flex items-center gap-2 mr-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-bold text-base bg-gradient-to-r from-blue-400 via-cyan-300 to-white bg-clip-text text-transparent">
            DayPilot
          </span>
        </div>

        <div className="hidden sm:block">
          <h1 className="text-lg lg:text-xl font-bold tracking-tight text-white dark:text-white">
            {sectionTitles[currentSection].title}
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-400 hidden md:block">
            {sectionTitles[currentSection].subtitle}
          </p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Date pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-slate-800 bg-slate-900/60 text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          {todayFormatted}
        </div>

        {/* Learning Streak Pill */}
        <div
          title={`${stats.streakDays} Day Learning Streak`}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-300 shadow-sm"
        >
          <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>{stats.streakDays}d Streak</span>
        </div>

        {/* PWA Install Button (conditional) */}
        <PWAInstallButton className="hidden md:flex" />

        {/* Import Roadmap Button */}
        <button
          onClick={onOpenRoadmapModal}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all cursor-pointer shadow-xs"
          title="Import roadmap from ChatGPT, Claude, DeepSeek or web text"
        >
          <FileUp className="w-3.5 h-3.5" />
          <span>Import Roadmap</span>
        </button>

        {/* Quick Add Task Button */}
        <button
          onClick={onOpenQuickTask}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Task</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-300" />}
        </button>

        {/* User Account Button */}
        {user ? (
          <div className="flex items-center gap-2 pl-1 border-l border-slate-800">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-8 h-8 rounded-full border border-cyan-500/40 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-xs font-bold text-blue-300">
                {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
              </div>
            )}
            <button
              onClick={() => signOutUser()}
              title="Sign Out"
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : isGuestMode ? (
          <div className="flex items-center gap-2 pl-1 border-l border-slate-800">
            <button
              onClick={() => signInWithGoogle()}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-cyan-300 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Connect Google</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => signInWithGoogle()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-sm"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
