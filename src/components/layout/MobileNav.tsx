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
} from 'lucide-react';
import { NavSection } from '../../types/index.ts';
import { useData } from '../../context/DataContext.tsx';

interface MobileNavProps {
  currentSection: NavSection;
  onNavigate: (section: NavSection) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentSection, onNavigate }) => {
  const { tasks, reminders } = useData();
  const pendingCount = tasks.filter((t) => !t.completed).length;
  const pendingRemindersCount = reminders.filter((r) => !r.completed && r.status !== 'cancelled').length;

  const tabs: { id: NavSection; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'assistant', label: 'AI Chat', icon: Bot },
    { id: 'plans', label: 'Plans', icon: Compass },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, badge: pendingCount > 0 ? pendingCount : undefined },
    { id: 'reminders', label: 'Alerts', icon: Bell, badge: pendingRemindersCount > 0 ? pendingRemindersCount : undefined },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-xl bg-slate-950/90 border-slate-800/80 px-2 py-1 safe-area-pb">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all cursor-pointer min-w-[46px] min-h-[46px] ${
                isActive
                  ? 'text-cyan-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-cyan-400' : ''}`} />
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2 bg-cyan-500 text-slate-950 text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center shadow-xs">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{tab.label}</span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-cyan-400 mt-0.5 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
