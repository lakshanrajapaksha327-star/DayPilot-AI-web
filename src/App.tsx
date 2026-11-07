/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { DataProvider } from './context/DataContext.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { Header } from './components/layout/Header.tsx';
import { MobileNav } from './components/layout/MobileNav.tsx';
import { DashboardView } from './components/dashboard/DashboardView.tsx';
import { AssistantView } from './components/assistant/AssistantView.tsx';
import { PlansView } from './components/plans/PlansView.tsx';
import { CalendarView } from './components/calendar/CalendarView.tsx';
import { TasksView } from './components/tasks/TasksView.tsx';
import { RemindersView } from './components/reminders/RemindersView.tsx';
import { ProgressView } from './components/progress/ProgressView.tsx';
import { SettingsView } from './components/settings/SettingsView.tsx';
import { TaskModal } from './components/modals/TaskModal.tsx';
import { PlanModal } from './components/modals/PlanModal.tsx';
import { RoadmapImportModal } from './components/modals/RoadmapImportModal.tsx';
import { OfflineIndicator } from './components/pwa/OfflineIndicator.tsx';
import { NavSection, Task, Plan } from './types/index.ts';
import { useData } from './context/DataContext.tsx';
import { Bell, X, ExternalLink } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { preferences, loading, user, isGuestMode, enterGuestMode, signInWithGoogle } = useAuth();
  const { activeInAppAlert, dismissInAppAlert, tasks } = useData();
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');

  // Modal States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [defaultTaskDate, setDefaultTaskDate] = useState<string | undefined>(undefined);
  const [defaultTaskPlanId, setDefaultTaskPlanId] = useState<string | undefined>(undefined);

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planToEdit, setPlanToEdit] = useState<Plan | null>(null);

  const [isRoadmapModalOpen, setIsRoadmapModalOpen] = useState(false);

  // Sync theme with preferences
  useEffect(() => {
    if (preferences?.theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [preferences?.theme]);

  // Modal open handlers
  const handleOpenQuickTask = (defaultDate?: string, planId?: string) => {
    setTaskToEdit(null);
    setDefaultTaskDate(defaultDate);
    setDefaultTaskPlanId(planId);
    setIsTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setTaskToEdit(task);
    setIsTaskModalOpen(true);
  };

  const handleOpenCreatePlan = () => {
    setPlanToEdit(null);
    setIsPlanModalOpen(true);
  };

  const handleEditPlan = (plan: Plan) => {
    setPlanToEdit(plan);
    setIsPlanModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 animate-pulse">
            <span className="font-extrabold text-base">DP</span>
          </div>
          <span className="text-sm font-semibold text-slate-300">Initializing DayPilot AI...</span>
          <span className="text-xs text-slate-500">Connecting to Cloud Firestore</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 transition-colors dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop & Tablet Sidebar */}
      <Sidebar
        currentSection={currentSection}
        onNavigate={setCurrentSection}
        onOpenQuickTask={() => handleOpenQuickTask()}
        onOpenRoadmapModal={() => setIsRoadmapModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
        <Header
          currentSection={currentSection}
          onOpenQuickTask={() => handleOpenQuickTask()}
          onOpenRoadmapModal={() => setIsRoadmapModalOpen(true)}
        />

        {/* Guest Banner if not signed in and using guest mode */}
        {!user && !isGuestMode && (
          <div className="mx-4 sm:mx-8 mt-4 p-4 rounded-2xl border border-blue-500/40 bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div>
              <div className="text-xs font-bold text-cyan-300">Welcome to DayPilot AI Foundation</div>
              <p className="text-xs text-slate-300 mt-0.5">
                Sign in with your Google account to persist all learning roadmaps and tasks to your personal Cloud Firestore database, or try Demo Mode.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => enterGuestMode()}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Try Demo Mode
              </button>
              <button
                onClick={() => signInWithGoogle()}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-md shadow-blue-600/20"
              >
                Sign In with Google
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {currentSection === 'dashboard' && (
            <DashboardView
              onNavigate={setCurrentSection}
              onOpenQuickTask={() => handleOpenQuickTask()}
              onOpenPlanModal={handleOpenCreatePlan}
              onOpenRoadmapModal={() => setIsRoadmapModalOpen(true)}
            />
          )}

          {currentSection === 'assistant' && (
            <AssistantView
              onOpenPlanModal={handleOpenCreatePlan}
              onOpenTaskModal={() => handleOpenQuickTask()}
              onOpenRoadmapModal={() => setIsRoadmapModalOpen(true)}
            />
          )}

          {currentSection === 'plans' && (
            <PlansView
              onOpenCreatePlan={handleOpenCreatePlan}
              onOpenImportRoadmap={() => setIsRoadmapModalOpen(true)}
              onEditPlan={handleEditPlan}
            />
          )}

          {currentSection === 'calendar' && (
            <CalendarView
              onOpenQuickTask={handleOpenQuickTask}
              onEditTask={handleEditTask}
            />
          )}

          {currentSection === 'tasks' && (
            <TasksView
              onOpenCreateTask={() => handleOpenQuickTask()}
              onEditTask={handleEditTask}
            />
          )}

          {currentSection === 'reminders' && <RemindersView />}

          {currentSection === 'progress' && <ProgressView />}

          {currentSection === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav currentSection={currentSection} onNavigate={setCurrentSection} />

      {/* Foreground In-App Alert Toast */}
      {activeInAppAlert && (
        <aside
          role="alert"
          aria-live="assertive"
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 max-w-sm w-[calc(100vw-2rem)] p-4 rounded-2xl border border-indigo-500/40 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-indigo-500/20 text-white animate-in slide-in-from-bottom-5 duration-300"
        >
          <div className="flex items-start gap-3">
            <div className="relative p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/30 shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-slate-900 animate-ping" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Reminder Alert
                </span>
                <button
                  onClick={dismissInAppAlert}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Dismiss notification"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h4 className="text-sm font-bold text-white mt-0.5 truncate">
                {activeInAppAlert.title}
              </h4>
              <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                {activeInAppAlert.message}
              </p>
              <div className="mt-3 flex items-center gap-2">
                {activeInAppAlert.taskId && (
                  <button
                    onClick={() => {
                      const t = tasks.find((item) => item.id === activeInAppAlert.taskId);
                      if (t) handleEditTask(t);
                      dismissInAppAlert();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shadow-xs"
                  >
                    <span>View Task</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setCurrentSection('reminders');
                    dismissInAppAlert();
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Open Reminders
                </button>
                <button
                  onClick={dismissInAppAlert}
                  className="ml-auto px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Global Modals */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        taskToEdit={taskToEdit}
        defaultDate={defaultTaskDate}
        defaultPlanId={defaultTaskPlanId}
      />

      <PlanModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        planToEdit={planToEdit}
      />

      <RoadmapImportModal
        isOpen={isRoadmapModalOpen}
        onClose={() => setIsRoadmapModalOpen(false)}
      />

      {/* Floating Offline & Sync Notification Banner */}
      <OfflineIndicator />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <MainAppContent />
      </DataProvider>
    </AuthProvider>
  );
}
