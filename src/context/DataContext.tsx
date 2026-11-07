import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors.ts';
import { useAuth } from './AuthContext.tsx';
import {
  Plan,
  Task,
  Reminder,
  ProgressRecord,
  PriorityLevel,
  TaskCategory,
  SkillLevel,
  AIMemory,
  GeneratedRoadmap,
  RoadmapLesson,
  SchedulingConflict,
  DailyWorkloadSummary,
  ScheduleGenerationOptions,
  DeviceRecord,
  ReminderSettings,
} from '../types/index.ts';
import {
  calculateEndTime,
  detectTaskConflicts,
  calculateDailyWorkload,
  generateScheduleDates,
  detectMissedTasks,
  shiftRemainingTasks,
  timeToMinutes,
} from '../utils/schedulingEngine.ts';
import {
  requestNotificationPermission,
  getFCMToken,
  registerDevice,
  unregisterDevice,
  setupForegroundMessageListener,
  getOrCreateDeviceId,
  isWebPushSupported,
  getNotificationPermission,
} from '../lib/fcm.ts';
import {
  calculateReminderDeliveryTime,
  createNotificationPayload,
} from '../utils/reminderEngine.ts';
import {
  enqueueSyncAction,
  dequeueSyncAction,
  PendingSyncAction,
} from '../utils/offlineSyncEngine.ts';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';

interface DataContextType {
  plans: Plan[];
  tasks: Task[];
  reminders: Reminder[];
  progressRecords: ProgressRecord[];
  memories: AIMemory[];
  loading: boolean;
  createTask: (taskData: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskCompleted: (taskId: string) => Promise<void>;
  createPlan: (planData: Omit<Plan, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'progress'>) => Promise<string>;
  updatePlan: (planId: string, updates: Partial<Plan>) => Promise<void>;
  deletePlan: (planId: string) => Promise<void>;
  togglePlanStatus: (planId: string, status: Plan['status']) => Promise<void>;
  togglePlanObjective: (planId: string, objectiveId: string) => Promise<void>;
  createReminder: (reminderData: Omit<Reminder, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateReminder: (reminderId: string, updates: Partial<Reminder>) => Promise<void>;
  deleteReminder: (reminderId: string) => Promise<void>;
  toggleReminderCompleted: (reminderId: string) => Promise<void>;
  importRoadmapTemplate: (templateKey: string) => Promise<void>;
  resetCompletedTasks: () => Promise<void>;
  addMemory: (category: AIMemory['category'], text: string, topic?: string) => Promise<string>;
  deleteMemory: (memoryId: string) => Promise<void>;
  clearMemories: () => Promise<void>;
  approveGeneratedRoadmap: (roadmap: GeneratedRoadmap, options?: Partial<ScheduleGenerationOptions>) => Promise<string>;
  
  // Phase 3 Scheduling Engine:
  missedTasks: Task[];
  conflicts: SchedulingConflict[];
  todayWorkload: DailyWorkloadSummary;
  pausePlan: (planId: string) => Promise<void>;
  resumePlan: (planId: string, newStartDate?: string) => Promise<void>;
  rescheduleSession: (taskId: string, newDate: string, newStartTime: string) => Promise<void>;
  skipLesson: (taskId: string) => Promise<void>;
  moveRemainingLessonsForward: (planId: string, fromDate: string, daysShift: number) => Promise<void>;
  applyAiRedesignSchedule: (planId: string, recommendations: { taskId: string; proposedDate: string; proposedStartTime: string; proposedEndTime: string }[]) => Promise<void>;
  deletePlanWithSessions: (planId: string, keepHistory?: boolean) => Promise<void>;
  changeRecurringReminderTime: (planId: string, newTime: string) => Promise<void>;
  getDailyWorkloadForDate: (date: string) => DailyWorkloadSummary;

  // Phase 4: Real Push Notifications & In-App Reminders:
  devices: DeviceRecord[];
  reminderSettings: ReminderSettings;
  activeInAppAlert: { id: string; title: string; message: string; taskId?: string } | null;
  dismissInAppAlert: () => void;
  enableWebPush: () => Promise<{ success: boolean; error?: string }>;
  disableWebPush: () => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  sendTestPushNotification: (title?: string, message?: string) => Promise<{ success: boolean; deliveredDevicesCount: number; errors: string[] }>;
  scheduleReminderForTask: (task: Task, advanceMinutes?: number) => Promise<string>;
  updateReminderSettings: (updates: Partial<ReminderSettings>) => Promise<void>;

  // Phase 5: PWA & Offline Support:
  isOnline: boolean;
  pendingSyncCount: number;
  syncPendingChanges: () => Promise<{ success: boolean; syncedCount: number; errors: string[] }>;
  clearOfflineCache: () => void;

  stats: {
    todayTasksTotal: number;
    todayTasksCompleted: number;
    todayCompletionPercentage: number;
    weeklyTasksTotal: number;
    weeklyTasksCompleted: number;
    weeklyCompletionPercentage: number;
    totalStudyHours: number;
    streakDays: number;
    activePlansCount: number;
    nextReminder: Reminder | null;
  };
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Initial starter data for Guest or empty state preview
const getSamplePlans = (userId: string): Plan[] => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const endDate = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return [
    {
      id: 'plan-fullstack-dev',
      userId,
      title: 'Full-Stack Web Engineering',
      description: 'Master modern React architecture, backend APIs, state management, and real-time cloud data pipelines.',
      startDate: todayStr,
      endDate,
      durationWeeks: 4,
      dailyStudyMinutes: 60,
      preferredTime: 'evening',
      skillLevel: 'intermediate',
      status: 'active',
      progress: 35,
      color: '#3B82F6',
      objectives: [
        { id: 'obj-1', text: 'Set up modular application state and authentication', completed: true },
        { id: 'obj-2', text: 'Master Firestore data modeling and security rules', completed: true },
        { id: 'obj-3', text: 'Integrate multi-turn conversation and context memory', completed: false },
        { id: 'obj-4', text: 'Deploy resilient cloud microservices on Google Cloud', completed: false },
      ],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: 'plan-system-design',
      userId,
      title: 'AI & Data Foundations',
      description: 'Core concepts in modern AI engineering: vector embeddings, retrieval systems, prompt pipelines, and evaluation metrics.',
      startDate: todayStr,
      endDate,
      durationWeeks: 6,
      dailyStudyMinutes: 45,
      preferredTime: 'morning',
      skillLevel: 'beginner',
      status: 'active',
      progress: 15,
      color: '#06B6D4',
      objectives: [
        { id: 'obj-ai-1', text: 'Review foundational transformer architecture', completed: true },
        { id: 'obj-ai-2', text: 'Experiment with multimodal prompts and tool calling', completed: false },
        { id: 'obj-ai-3', text: 'Build retrieval-augmented reasoning flows', completed: false },
      ],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];
};

const getSampleTasks = (userId: string): Task[] => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  return [
    {
      id: 'task-1',
      userId,
      title: 'Review DayPilot UI & Responsive Breakpoints',
      notes: 'Verify desktop sidebar, tablet layout and mobile bottom bar.',
      priority: 'high',
      category: 'Project',
      planId: 'plan-fullstack-dev',
      date: todayStr,
      startTime: '10:00',
      durationMinutes: 45,
      completed: true,
      completedAt: today.toISOString(),
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'task-2',
      userId,
      title: 'Implement Firestore Data Flow & Rules Test',
      notes: 'Validate security rules enforcement and user data isolation.',
      priority: 'urgent',
      category: 'Study',
      planId: 'plan-fullstack-dev',
      date: todayStr,
      startTime: '14:30',
      durationMinutes: 60,
      completed: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'task-3',
      userId,
      title: 'Plan Weekly Study Schedule in Calendar',
      notes: 'Organize study blocks for morning and evening review sessions.',
      priority: 'medium',
      category: 'Personal',
      date: todayStr,
      startTime: '17:00',
      durationMinutes: 30,
      completed: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'task-4',
      userId,
      title: 'Deep Dive: Vector Embeddings & Indexing',
      notes: 'Read chapter 3 on semantic vector similarity and indexing.',
      priority: 'medium',
      category: 'Study',
      planId: 'plan-system-design',
      date: tomorrowStr,
      startTime: '09:00',
      durationMinutes: 60,
      completed: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];
};

const getSampleReminders = (userId: string): Reminder[] => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  return [
    {
      id: 'rem-1',
      userId,
      taskId: 'task-2',
      planId: 'plan-fs-engineering',
      title: 'Afternoon study session starts in 15 mins',
      notificationTitle: 'Your learning time is here!',
      notificationMessage: 'Full-Stack Web Engineering — Implement Firestore Data Flow & Rules Test',
      date: todayStr,
      time: '14:15',
      scheduledTime: `${todayStr}T14:15:00.000Z`,
      timeZone: 'Asia/Colombo',
      status: 'pending',
      advanceOffsetMinutes: 15,
      recurring: 'daily',
      completed: false,
      linkedTaskId: 'task-2',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
    {
      id: 'rem-2',
      userId,
      title: 'Review today goals & log progress streak',
      notificationTitle: 'Daily Learning Review',
      notificationMessage: 'Take 5 minutes to review your accomplished tasks and lock in your streak.',
      date: todayStr,
      time: '21:00',
      scheduledTime: `${todayStr}T21:00:00.000Z`,
      timeZone: 'Asia/Colombo',
      status: 'pending',
      advanceOffsetMinutes: 0,
      recurring: 'daily',
      completed: false,
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
    },
  ];
};

const getSampleDevices = (userId: string): DeviceRecord[] => [
  {
    id: 'dev-win-edge',
    userId,
    fcmToken: 'fcm_sample_token_win_edge_38192',
    browser: 'Edge',
    platform: 'Windows',
    deviceName: 'Windows Edge (Workstation)',
    enabled: true,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    lastActiveAt: new Date().toISOString(),
  },
  {
    id: 'dev-android-pixel',
    userId,
    fcmToken: 'fcm_sample_token_android_pixel_8291',
    browser: 'Android Chrome',
    platform: 'Android',
    deviceName: 'Android Chrome (Pixel 8)',
    enabled: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    lastActiveAt: new Date().toISOString(),
  },
];

const getSampleMemories = (userId: string): AIMemory[] => [
  {
    id: 'mem-1',
    userId,
    category: 'preference',
    text: 'Prefers 45-60 min focused evening sessions with structured practical checklists.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem-2',
    userId,
    category: 'goal',
    text: 'Targeting full-stack mastery and AI application engineering.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isGuestMode, userProfile, updateUserProfileInDb } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(() => {
    try {
      const saved = localStorage.getItem('daypilot_reminder_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      webPushEnabled: false,
      inAppEnabled: true,
      advanceOffsetMinutes: 15,
      soundEnabled: true,
      dailyDigest: true,
      planRemindersEnabled: {},
    };
  });
  const [activeInAppAlert, setActiveInAppAlert] = useState<{ id: string; title: string; message: string; taskId?: string } | null>(null);
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [memories, setMemories] = useState<AIMemory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Phase 5: PWA & Offline Sync State
  const isOnline = useOnlineStatus();
  const [pendingQueue, setPendingQueue] = useState<PendingSyncAction[]>(() => {
    try {
      const stored = localStorage.getItem('daypilot_sync_queue');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  });

  const activeUserId = user ? user.uid : (isGuestMode ? 'guest-pilot' : null);

  // Synchronization worker: replaying queued offline actions when connectivity returns
  const syncPendingChanges = async (): Promise<{ success: boolean; syncedCount: number; errors: string[] }> => {
    if (!user || pendingQueue.length === 0) {
      return { success: true, syncedCount: 0, errors: [] };
    }

    const errors: string[] = [];
    let syncedCount = 0;
    let currentQueue = [...pendingQueue];

    for (const action of pendingQueue) {
      try {
        if (action.type === 'CREATE_TASK' || action.type === 'UPDATE_TASK' || action.type === 'TOGGLE_TASK') {
          await setDoc(doc(db, 'users', user.uid, 'tasks', action.entityId), action.payload, { merge: true });
        } else if (action.type === 'DELETE_TASK') {
          await deleteDoc(doc(db, 'users', user.uid, 'tasks', action.entityId));
        } else if (action.type === 'CREATE_PLAN') {
          await setDoc(doc(db, 'users', user.uid, 'plans', action.entityId), action.payload, { merge: true });
        }
        currentQueue = dequeueSyncAction(currentQueue, action.id);
        syncedCount++;
      } catch (err: any) {
        errors.push(`Sync failed for ${action.type}: ${err?.message || err}`);
      }
    }

    setPendingQueue(currentQueue);
    try {
      localStorage.setItem('daypilot_sync_queue', JSON.stringify(currentQueue));
    } catch (e) {}

    return {
      success: errors.length === 0,
      syncedCount,
      errors,
    };
  };

  // Automatically flush pending offline changes when connection returns
  useEffect(() => {
    if (isOnline && pendingQueue.length > 0 && user) {
      console.log(`[PWA Offline Sync]: Online connection detected. Syncing ${pendingQueue.length} queued action(s)...`);
      syncPendingChanges();
    }
  }, [isOnline, user]);

  const clearOfflineCache = () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith('daypilot_offline_') || key.startsWith('daypilot_cached_') || key === 'daypilot_sync_queue') {
          localStorage.removeItem(key);
        }
      });
      setPendingQueue([]);
    } catch (e) {
      console.warn('Error clearing offline cache:', e);
    }
  };

  // Foreground push message listener
  useEffect(() => {
    const cleanup = setupForegroundMessageListener((payload) => {
      setActiveInAppAlert({
        id: `alert-${Date.now()}`,
        title: payload.title,
        message: payload.body,
        taskId: payload.data?.taskId as string,
      });
    });
    return cleanup;
  }, []);

  // Firestore Sync or Guest state initialization
  useEffect(() => {
    if (!activeUserId) {
      setPlans([]);
      setTasks([]);
      setReminders([]);
      setDevices([]);
      setProgressRecords([]);
      setMemories([]);
      setLoading(false);
      return;
    }

    if (isGuestMode || !user) {
      // Guest mode: load from localStorage if previously modified, else fall back to sample
      try {
        const savedPlans = localStorage.getItem('daypilot_guest_plans');
        const savedTasks = localStorage.getItem('daypilot_guest_tasks');
        const savedReminders = localStorage.getItem('daypilot_guest_reminders');
        const savedMemories = localStorage.getItem('daypilot_guest_memories');

        setPlans(savedPlans ? JSON.parse(savedPlans) : getSamplePlans('guest-pilot'));
        setTasks(savedTasks ? JSON.parse(savedTasks) : getSampleTasks('guest-pilot'));
        setReminders(savedReminders ? JSON.parse(savedReminders) : getSampleReminders('guest-pilot'));
        setDevices(getSampleDevices('guest-pilot'));
        setMemories(savedMemories ? JSON.parse(savedMemories) : getSampleMemories('guest-pilot'));
      } catch (e) {
        console.warn('Error reading guest storage:', e);
        setPlans(getSamplePlans('guest-pilot'));
        setTasks(getSampleTasks('guest-pilot'));
        setReminders(getSampleReminders('guest-pilot'));
        setDevices(getSampleDevices('guest-pilot'));
        setMemories(getSampleMemories('guest-pilot'));
      }
      setLoading(false);
      return;
    }

    // Pre-hydrate from secure offline cache before network response arrives
    try {
      const offlineTasks = localStorage.getItem(`daypilot_offline_tasks_${user.uid}`);
      if (offlineTasks) setTasks(JSON.parse(offlineTasks));
      const offlinePlans = localStorage.getItem(`daypilot_offline_plans_${user.uid}`);
      if (offlinePlans) setPlans(JSON.parse(offlinePlans));
      const offlineReminders = localStorage.getItem(`daypilot_offline_reminders_${user.uid}`);
      if (offlineReminders) setReminders(JSON.parse(offlineReminders));
    } catch (e) {
      console.warn('Offline cache prehydration note:', e);
    }

    setLoading(true);

    // Subscriptions for Authenticated user
    const tasksPath = `users/${user.uid}/tasks`;
    const plansPath = `users/${user.uid}/plans`;
    const remindersPath = `users/${user.uid}/reminders`;
    const devicesPath = `users/${user.uid}/devices`;
    const progressPath = `users/${user.uid}/progress`;
    const memoryPath = `users/${user.uid}/memory`;

    const tasksQuery = query(collection(db, tasksPath), orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(
      tasksQuery,
      (snapshot) => {
        const loadedTasks: Task[] = snapshot.docs.map((docSnap) => docSnap.data() as Task);
        setTasks(loadedTasks);
        try {
          localStorage.setItem(`daypilot_offline_tasks_${user.uid}`, JSON.stringify(loadedTasks));
        } catch (e) {}
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, tasksPath);
      }
    );

    const plansQuery = query(collection(db, plansPath), orderBy('createdAt', 'desc'));
    const unsubPlans = onSnapshot(
      plansQuery,
      (snapshot) => {
        const loadedPlans: Plan[] = snapshot.docs.map((docSnap) => docSnap.data() as Plan);
        setPlans(loadedPlans);
        try {
          localStorage.setItem(`daypilot_offline_plans_${user.uid}`, JSON.stringify(loadedPlans));
        } catch (e) {}
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, plansPath);
      }
    );

    const remindersQuery = query(collection(db, remindersPath), orderBy('createdAt', 'desc'));
    const unsubReminders = onSnapshot(
      remindersQuery,
      (snapshot) => {
        const loadedReminders: Reminder[] = snapshot.docs.map((docSnap) => docSnap.data() as Reminder);
        setReminders(loadedReminders);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, remindersPath);
      }
    );

    const devicesQuery = query(collection(db, devicesPath));
    const unsubDevices = onSnapshot(
      devicesQuery,
      (snapshot) => {
        const loadedDevices: DeviceRecord[] = snapshot.docs.map((docSnap) => docSnap.data() as DeviceRecord);
        setDevices(loadedDevices);
      },
      (error) => {
        console.warn('Devices subscription notice:', error);
      }
    );

    const progressQuery = query(collection(db, progressPath), orderBy('date', 'desc'));
    const unsubProgress = onSnapshot(
      progressQuery,
      (snapshot) => {
        const loadedProgress: ProgressRecord[] = snapshot.docs.map((docSnap) => docSnap.data() as ProgressRecord);
        setProgressRecords(loadedProgress);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, progressPath);
      }
    );

    const memoryQuery = query(collection(db, memoryPath), orderBy('createdAt', 'desc'));
    const unsubMemory = onSnapshot(
      memoryQuery,
      (snapshot) => {
        const loadedMemories: AIMemory[] = snapshot.docs.map((docSnap) => docSnap.data() as AIMemory);
        setMemories(loadedMemories);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, memoryPath);
        setLoading(false);
      }
    );

    return () => {
      unsubTasks();
      unsubPlans();
      unsubReminders();
      unsubDevices();
      unsubProgress();
      unsubMemory();
    };
  }, [user, isGuestMode, activeUserId]);

  // Synchronize guest mode changes into localStorage
  useEffect(() => {
    if (!user && (isGuestMode || localStorage.getItem('daypilot_guest_mode') === 'true')) {
      if (plans.length > 0) localStorage.setItem('daypilot_guest_plans', JSON.stringify(plans));
      if (tasks.length > 0) localStorage.setItem('daypilot_guest_tasks', JSON.stringify(tasks));
      if (reminders.length > 0) localStorage.setItem('daypilot_guest_reminders', JSON.stringify(reminders));
      if (memories.length > 0) localStorage.setItem('daypilot_guest_memories', JSON.stringify(memories));
    }
  }, [plans, tasks, reminders, memories, isGuestMode, user]);

  // Task Operations
  const createTask = async (taskData: Omit<Task, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const nowStr = new Date().toISOString();
    const newTask: Task = {
      ...taskData,
      id,
      userId: activeUserId || 'guest',
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    // Optimistically update local state immediately
    setTasks((prev) => [newTask, ...prev]);

    if (user) {
      if (!isOnline) {
        // Enqueue offline action
        const nextQueue = enqueueSyncAction(pendingQueue, {
          id: `sync-create-${id}`,
          userId: user.uid,
          type: 'CREATE_TASK',
          entityId: id,
          payload: newTask as unknown as Record<string, unknown>,
        });
        setPendingQueue(nextQueue);
        try {
          localStorage.setItem('daypilot_sync_queue', JSON.stringify(nextQueue));
        } catch (e) {}
      } else {
        const taskPath = `users/${user.uid}/tasks/${id}`;
        try {
          await setDoc(doc(db, 'users', user.uid, 'tasks', id), newTask);
        } catch (err) {
          // Fallback to queue if network dropped during request
          const nextQueue = enqueueSyncAction(pendingQueue, {
            id: `sync-create-${id}`,
            userId: user.uid,
            type: 'CREATE_TASK',
            entityId: id,
            payload: newTask as unknown as Record<string, unknown>,
          });
          setPendingQueue(nextQueue);
          try {
            localStorage.setItem('daypilot_sync_queue', JSON.stringify(nextQueue));
          } catch (e) {}
        }
      }
    }

    return id;
  };

  const updateTask = async (taskId: string, updates: Partial<Task>): Promise<void> => {
    const nowStr = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates, updatedAt: nowStr } : t))
    );

    if (user) {
      if (!isOnline) {
        const nextQueue = enqueueSyncAction(pendingQueue, {
          id: `sync-update-${taskId}-${Date.now()}`,
          userId: user.uid,
          type: 'UPDATE_TASK',
          entityId: taskId,
          payload: { ...updates, updatedAt: nowStr } as Record<string, unknown>,
        });
        setPendingQueue(nextQueue);
        try {
          localStorage.setItem('daypilot_sync_queue', JSON.stringify(nextQueue));
        } catch (e) {}
      } else {
        const taskPath = `users/${user.uid}/tasks/${taskId}`;
        try {
          await setDoc(doc(db, 'users', user.uid, 'tasks', taskId), { ...updates, updatedAt: nowStr }, { merge: true });
        } catch (err) {
          const nextQueue = enqueueSyncAction(pendingQueue, {
            id: `sync-update-${taskId}-${Date.now()}`,
            userId: user.uid,
            type: 'UPDATE_TASK',
            entityId: taskId,
            payload: { ...updates, updatedAt: nowStr } as Record<string, unknown>,
          });
          setPendingQueue(nextQueue);
          try {
            localStorage.setItem('daypilot_sync_queue', JSON.stringify(nextQueue));
          } catch (e) {}
        }
      }
    }
  };

  const deleteTask = async (taskId: string): Promise<void> => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    if (user) {
      if (!isOnline) {
        const nextQueue = enqueueSyncAction(pendingQueue, {
          id: `sync-delete-${taskId}`,
          userId: user.uid,
          type: 'DELETE_TASK',
          entityId: taskId,
          payload: {},
        });
        setPendingQueue(nextQueue);
        try {
          localStorage.setItem('daypilot_sync_queue', JSON.stringify(nextQueue));
        } catch (e) {}
      } else {
        const taskPath = `users/${user.uid}/tasks/${taskId}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'tasks', taskId));
        } catch (err) {
          const nextQueue = enqueueSyncAction(pendingQueue, {
            id: `sync-delete-${taskId}`,
            userId: user.uid,
            type: 'DELETE_TASK',
            entityId: taskId,
            payload: {},
          });
          setPendingQueue(nextQueue);
          try {
            localStorage.setItem('daypilot_sync_queue', JSON.stringify(nextQueue));
          } catch (e) {}
        }
      }
    }
  };

  const toggleTaskCompleted = async (taskId: string): Promise<void> => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;
    const completed = !target.completed;
    const completedAt = completed ? new Date().toISOString() : undefined;

    await updateTask(taskId, { completed, completedAt });

    // Update plan progress if linked
    if (target.planId) {
      const planTasks = tasks.filter((t) => t.planId === target.planId);
      const total = planTasks.length;
      const done = planTasks.filter((t) => (t.id === taskId ? completed : t.completed)).length;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      await updatePlan(target.planId, { progress });
    }

    // Check and update streak if completed
    if (completed && userProfile) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (userProfile.lastActiveDate !== todayStr) {
        const newStreak = userProfile.streakDays + 1;
        await updateUserProfileInDb({
          streakDays: newStreak,
          lastActiveDate: todayStr,
        });
      }
    }
  };

  // Plan Operations
  const createPlan = async (
    planData: Omit<Plan, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'progress'>
  ): Promise<string> => {
    const id = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const nowStr = new Date().toISOString();
    const newPlan: Plan = {
      ...planData,
      id,
      userId: activeUserId || 'guest',
      progress: 0,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    if (user) {
      const planPath = `users/${user.uid}/plans/${id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'plans', id), newPlan);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, planPath);
      }
    } else {
      setPlans((prev) => [newPlan, ...prev]);
    }

    return id;
  };

  const updatePlan = async (planId: string, updates: Partial<Plan>): Promise<void> => {
    const nowStr = new Date().toISOString();
    if (user) {
      const planPath = `users/${user.uid}/plans/${planId}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'plans', planId), { ...updates, updatedAt: nowStr }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, planPath);
      }
    } else {
      setPlans((prev) =>
        prev.map((p) => (p.id === planId ? { ...p, ...updates, updatedAt: nowStr } : p))
      );
    }
  };

  const deletePlan = async (planId: string): Promise<void> => {
    if (user) {
      const planPath = `users/${user.uid}/plans/${planId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'plans', planId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, planPath);
      }
    } else {
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    }
  };

  const togglePlanStatus = async (planId: string, status: Plan['status']): Promise<void> => {
    await updatePlan(planId, { status });
  };

  const togglePlanObjective = async (planId: string, objectiveId: string): Promise<void> => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    const updatedObjectives = plan.objectives.map((obj) =>
      obj.id === objectiveId ? { ...obj, completed: !obj.completed } : obj
    );

    const total = updatedObjectives.length;
    const completed = updatedObjectives.filter((o) => o.completed).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    await updatePlan(planId, { objectives: updatedObjectives, progress });
  };

  // Reminder Operations
  const createReminder = async (
    reminderData: Omit<Reminder, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    const id = `rem-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const nowStr = new Date().toISOString();
    const newRem: Reminder = {
      ...reminderData,
      id,
      userId: activeUserId || 'guest',
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    if (user) {
      const remPath = `users/${user.uid}/reminders/${id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'reminders', id), newRem);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, remPath);
      }
    } else {
      setReminders((prev) => [newRem, ...prev]);
    }

    return id;
  };

  const updateReminder = async (reminderId: string, updates: Partial<Reminder>): Promise<void> => {
    const nowStr = new Date().toISOString();
    if (user) {
      const remPath = `users/${user.uid}/reminders/${reminderId}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'reminders', reminderId), { ...updates, updatedAt: nowStr }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, remPath);
      }
    } else {
      setReminders((prev) =>
        prev.map((r) => (r.id === reminderId ? { ...r, ...updates, updatedAt: nowStr } : r))
      );
    }
  };

  const deleteReminder = async (reminderId: string): Promise<void> => {
    if (user) {
      const remPath = `users/${user.uid}/reminders/${reminderId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'reminders', reminderId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, remPath);
      }
    } else {
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
    }
  };

  const toggleReminderCompleted = async (reminderId: string): Promise<void> => {
    const target = reminders.find((r) => r.id === reminderId);
    if (!target) return;
    await updateReminder(reminderId, { completed: !target.completed, status: !target.completed ? 'sent' : 'pending' });
  };

  // Phase 4: Push Notifications & Device Management Actions
  const dismissInAppAlert = () => setActiveInAppAlert(null);

  const updateReminderSettings = async (updates: Partial<ReminderSettings>): Promise<void> => {
    setReminderSettings((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem('daypilot_reminder_settings', JSON.stringify(next));
      return next;
    });

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'preferences', 'reminder_settings'), updates, { merge: true });
      } catch (e) {
        console.warn('Failed to save reminder preferences to Firestore:', e);
      }
    }
  };

  const enableWebPush = async (): Promise<{ success: boolean; error?: string }> => {
    const permResult = await requestNotificationPermission();
    if (!permResult.granted) {
      return { success: false, error: permResult.error || 'Notification permission was not granted.' };
    }

    try {
      let vapidKey = '';
      try {
        const resp = await fetch('/api/fcm/vapid-key');
        const json = await resp.json();
        vapidKey = json.vapidKey || '';
      } catch (e) {}

      const token = await getFCMToken(vapidKey || undefined);
      const effectiveToken = token || `fcm_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const devRecord = await registerDevice(activeUserId || 'guest-pilot', effectiveToken);
      setDevices((prev) => [...prev.filter((d) => d.id !== devRecord.id), devRecord]);
      await updateReminderSettings({ webPushEnabled: true });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to initialize push messaging' };
    }
  };

  const disableWebPush = async (): Promise<void> => {
    const deviceId = getOrCreateDeviceId();
    if (activeUserId) {
      await unregisterDevice(activeUserId, deviceId);
    }
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    await updateReminderSettings({ webPushEnabled: false });
  };

  const removeDevice = async (deviceId: string): Promise<void> => {
    if (activeUserId) {
      await unregisterDevice(activeUserId, deviceId);
    }
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
  };

  const sendTestPushNotification = async (title?: string, message?: string) => {
    try {
      const resp = await fetch('/api/reminders/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUserId || 'guest-pilot',
          title: title || 'DayPilot AI — Test Notification',
          message: message || 'Your cross-device reminder system is active and ready!',
        }),
      });
      const data = await resp.json();

      // Trigger local in-app alert for immediate feedback
      setActiveInAppAlert({
        id: `test-${Date.now()}`,
        title: title || 'DayPilot AI — Test Notification',
        message: message || 'Your cross-device reminder system is active and ready!',
      });

      return data;
    } catch (err: any) {
      return { success: false, deliveredDevicesCount: 0, errors: [err.message] };
    }
  };

  const scheduleReminderForTask = async (task: Task, advanceMinutes: number = 15): Promise<string> => {
    const plan = task.planId ? plans.find((p) => p.id === task.planId) : null;
    const { title, message } = createNotificationPayload(task, plan, advanceMinutes);
    const scheduledTime = calculateReminderDeliveryTime(task.date, task.startTime || '19:00', advanceMinutes);
    const reminderId = `rem-${task.id}-${advanceMinutes}`;

    const newReminder: Reminder = {
      id: reminderId,
      userId: activeUserId || 'guest',
      taskId: task.id,
      planId: task.planId,
      title,
      notificationTitle: title,
      notificationMessage: message,
      date: task.date,
      time: task.startTime || '19:00',
      scheduledTime,
      timeZone: task.timeZone || userProfile?.timeZone || 'Asia/Colombo',
      status: 'pending',
      advanceOffsetMinutes: advanceMinutes,
      completed: false,
      recurring: 'none',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'reminders', reminderId), newReminder);
      } catch (e) {
        console.warn('Failed to save reminder to Firestore:', e);
      }
    } else {
      setReminders((prev) => [...prev.filter((r) => r.id !== reminderId), newReminder]);
    }

    fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReminder),
    }).catch(console.warn);

    return reminderId;
  };

  // Roadmap templates library
  const importRoadmapTemplate = async (templateKey: string): Promise<void> => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    interface TemplateDef {
      title: string;
      description: string;
      durationWeeks: number;
      dailyStudyMinutes: number;
      preferredTime: string;
      skillLevel: SkillLevel;
      color: string;
      objectives: string[];
      tasks: { title: string; category: TaskCategory; priority: PriorityLevel; durationMinutes: number; dayOffset: number; time: string }[];
    }

    const templates: Record<string, TemplateDef> = {
      'fullstack': {
        title: 'Full-Stack Web Engineering Sprint',
        description: 'Comprehensive pathway to master React 19, TypeScript, state flows, backend REST & real-time Firestore persistence.',
        durationWeeks: 4,
        dailyStudyMinutes: 60,
        preferredTime: 'evening',
        skillLevel: 'intermediate',
        color: '#3B82F6',
        objectives: [
          'Master TypeScript advanced utility types & generic hooks',
          'Architect robust responsive component trees with Tailwind',
          'Deploy secure database rules & authorization barriers',
          'Build end-to-end continuous integration test suites',
        ],
        tasks: [
          { title: 'TypeScript Advanced Types & Interfaces Deep Dive', category: 'Study', priority: 'high', durationMinutes: 60, dayOffset: 0, time: '10:00' },
          { title: 'Build Reusable Data Fetching & Caching Hook', category: 'Project', priority: 'medium', durationMinutes: 45, dayOffset: 1, time: '14:00' },
          { title: 'Implement Zero-Trust Firestore Security Guardrails', category: 'Study', priority: 'urgent', durationMinutes: 60, dayOffset: 2, time: '16:00' },
          { title: 'End-to-End Responsive Layout QA on Mobile Viewport', category: 'Work', priority: 'medium', durationMinutes: 30, dayOffset: 3, time: '11:00' },
        ],
      },
      'ai-ml': {
        title: 'AI Engineering & Prompt Architecture',
        description: 'Practical curriculum on large language models, structured outputs, multi-turn tool calling, embeddings and reasoning loops.',
        durationWeeks: 6,
        dailyStudyMinutes: 50,
        preferredTime: 'morning',
        skillLevel: 'intermediate',
        color: '#8B5CF6',
        objectives: [
          'Understand model modalities, parameter scale and token mechanics',
          'Design strict JSON schema generation and function calling',
          'Implement vector retrieval with hybrid search techniques',
          'Evaluate agentic chains for low-latency production pipelines',
        ],
        tasks: [
          { title: 'Explore Gemini Function Calling & Tool Schemas', category: 'Study', priority: 'high', durationMinutes: 50, dayOffset: 0, time: '09:00' },
          { title: 'Benchmark Latency vs Reasoning Depth on Complex Tasks', category: 'Study', priority: 'medium', durationMinutes: 45, dayOffset: 1, time: '10:00' },
          { title: 'Build Multi-Turn Chat Memory Buffer with Context Windowing', category: 'Project', priority: 'urgent', durationMinutes: 60, dayOffset: 2, time: '15:00' },
        ],
      },
      'exam-sprint': {
        title: 'High-Retention Exam Revision Sprint',
        description: 'Accelerated spaced-repetition and active-recall blueprint designed for peak academic performance.',
        durationWeeks: 2,
        dailyStudyMinutes: 90,
        preferredTime: 'morning',
        skillLevel: 'all-levels',
        color: '#06B6D4',
        objectives: [
          'Create high-yield summary mind maps for all core chapters',
          'Complete 3 timed mock examination papers under strict conditions',
          'Review error log and patch conceptual blind spots',
          'Consolidate flashcard decks for final 48h active recall',
        ],
        tasks: [
          { title: 'Active Recall Session: Chapters 1 through 4', category: 'Study', priority: 'urgent', durationMinutes: 90, dayOffset: 0, time: '08:30' },
          { title: 'Timed Practice Exam Paper 1 & Self-Grading', category: 'Study', priority: 'high', durationMinutes: 120, dayOffset: 1, time: '09:00' },
          { title: 'Error Log Analysis: Catalog Weak Problem Archetypes', category: 'Study', priority: 'medium', durationMinutes: 45, dayOffset: 2, time: '14:00' },
        ],
      },
      'habits': {
        title: 'Daily Deep Work & Productivity Blueprint',
        description: 'Install non-negotiable morning routines, time-blocking discipline, and digital distraction shielding.',
        durationWeeks: 3,
        dailyStudyMinutes: 30,
        preferredTime: 'morning',
        skillLevel: 'beginner',
        color: '#10B981',
        objectives: [
          'Establish a 90-minute daily morning deep work block',
          'Eliminate phone checking during the first hour after waking',
          'Conduct daily evening shutdown review and tomorrow task planning',
        ],
        tasks: [
          { title: 'Morning Deep Work Block: Top Priority Task First', category: 'Work', priority: 'high', durationMinutes: 90, dayOffset: 0, time: '07:30' },
          { title: 'Evening Shutdown Routine: Triage Inbox & Plan Tomorrow', category: 'Personal', priority: 'medium', durationMinutes: 20, dayOffset: 0, time: '18:00' },
          { title: 'Weekly Cadence Review: Celebrate Wins & Adjust Schedule', category: 'Personal', priority: 'low', durationMinutes: 30, dayOffset: 6, time: '17:00' },
        ],
      },
    };

    const template = templates[templateKey] || templates['fullstack'];
    const endDate = new Date(now.getTime() + template.durationWeeks * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const planId = await createPlan({
      title: template.title,
      description: template.description,
      startDate: todayStr,
      endDate,
      durationWeeks: template.durationWeeks,
      dailyStudyMinutes: template.dailyStudyMinutes,
      preferredTime: template.preferredTime,
      skillLevel: template.skillLevel,
      color: template.color,
      status: 'active',
      objectives: template.objectives.map((text, idx) => ({
        id: `obj-${idx + 1}`,
        text,
        completed: false,
      })),
    });

    // Generate starter tasks linked to this plan
    for (const t of template.tasks) {
      const taskDate = new Date(now.getTime() + t.dayOffset * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      await createTask({
        title: t.title,
        notes: `Imported from ${template.title}`,
        priority: t.priority,
        category: t.category,
        planId,
        date: taskDate,
        startTime: t.time,
        durationMinutes: t.durationMinutes,
        completed: false,
      });
    }
  };

  const resetCompletedTasks = async (): Promise<void> => {
    const completedTasks = tasks.filter((t) => t.completed);
    for (const task of completedTasks) {
      await deleteTask(task.id);
    }
  };

  // Memory Operations
  const addMemory = async (
    category: AIMemory['category'],
    text: string,
    topic?: string
  ): Promise<string> => {
    const id = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const nowStr = new Date().toISOString();
    const newMem: AIMemory = {
      id,
      userId: activeUserId || 'guest',
      category,
      text,
      topic,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    if (user) {
      const memPath = `users/${user.uid}/memory/${id}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'memory', id), newMem);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, memPath);
      }
    } else {
      setMemories((prev) => [newMem, ...prev]);
    }

    return id;
  };

  const deleteMemory = async (memoryId: string): Promise<void> => {
    if (user) {
      const memPath = `users/${user.uid}/memory/${memoryId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'memory', memoryId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, memPath);
      }
    } else {
      setMemories((prev) => prev.filter((m) => m.id !== memoryId));
    }
  };

  const clearMemories = async (): Promise<void> => {
    if (user) {
      for (const m of memories) {
        await deleteDoc(doc(db, 'users', user.uid, 'memory', m.id));
      }
    } else {
      setMemories([]);
    }
  };

  // Phase 3: Intelligent Scheduling Engine Implementation
  const approveGeneratedRoadmap = async (
    roadmap: GeneratedRoadmap,
    options?: Partial<ScheduleGenerationOptions>
  ): Promise<string> => {
    const userTz = userProfile?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Colombo';
    const startDate = options?.startDate || new Date().toISOString().split('T')[0];
    const durationDays = roadmap.durationDays || roadmap.lessons.length || 30;
    const dailyDurationMinutes = options?.dailyDurationMinutes || roadmap.dailyDurationMinutes || 60;
    const preferredTime = options?.preferredTime || roadmap.preferredTime || '19:00';
    const scheduleType = options?.scheduleType || 'daily';
    const selectedDays = options?.selectedDays || [1, 2, 3, 4, 5];
    const multipleSessionsPerDay = options?.multipleSessionsPerDay || false;
    const secondaryTime = options?.secondaryTime || '09:00';

    // 1. Generate exact sequential calendar sessions using the pure scheduling engine
    const scheduledSlots = generateScheduleDates({
      planTitle: roadmap.title,
      startDate,
      durationDays,
      dailyDurationMinutes,
      preferredTime,
      secondaryTime,
      multipleSessionsPerDay,
      scheduleType,
      selectedDays,
      timeZone: userTz,
      allowOverlaps: options?.allowOverlaps ?? false,
    });

    const calculatedEndDate = scheduledSlots.length > 0 ? scheduledSlots[scheduledSlots.length - 1].date : startDate;
    const durationWeeks = Math.max(1, Math.round(durationDays / 7));

    // Formulate milestone objectives
    const keyObjectives = roadmap.lessons.length > 0
      ? [
          { id: 'obj-1', text: `Foundation: ${roadmap.lessons[0].title}`, completed: false },
          ...(roadmap.lessons.length > 5
            ? [{ id: 'obj-2', text: `Midpoint: ${roadmap.lessons[Math.floor(roadmap.lessons.length / 2)].title}`, completed: false }]
            : []),
          { id: 'obj-3', text: `Capstone Mastery: ${roadmap.lessons[roadmap.lessons.length - 1].title}`, completed: false },
        ]
      : [{ id: 'obj-1', text: 'Complete all daily lessons', completed: false }];

    // 2. Create the persistent Plan with complete scheduleConfig
    const planId = await createPlan({
      title: roadmap.title,
      description: roadmap.description,
      startDate,
      endDate: calculatedEndDate,
      durationWeeks,
      dailyStudyMinutes: dailyDurationMinutes,
      preferredTime,
      skillLevel: roadmap.skillLevel || 'beginner',
      color: '#06B6D4',
      status: 'active',
      objectives: keyObjectives,
      scheduleConfig: {
        scheduleType,
        selectedDays,
        startDate,
        preferredTime,
        secondaryTime,
        multipleSessionsPerDay,
        timeZone: userTz,
        dailyDurationMinutes,
      },
      lessons: roadmap.lessons,
    });

    // 3. Create all individual scheduled tasks with stable idempotent IDs
    for (let i = 0; i < roadmap.lessons.length; i++) {
      const lesson = roadmap.lessons[i];
      const slot = scheduledSlots[i] || {
        date: startDate,
        startTime: preferredTime,
        endTime: calculateEndTime(preferredTime, dailyDurationMinutes),
      };

      const notesLines = [
        lesson.objectives?.length ? `Objectives:\n• ${lesson.objectives.join('\n• ')}` : '',
        lesson.steps?.length ? `Steps:\n• ${lesson.steps.join('\n• ')}` : '',
        lesson.assignment ? `Practical Assignment:\n${lesson.assignment}` : '',
        lesson.completionCriteria ? `Completion Benchmark:\n${lesson.completionCriteria}` : '',
        lesson.resources?.length ? `Resources:\n• ${lesson.resources.join('\n• ')}` : '',
      ].filter(Boolean);

      const reminderMinsBefore = 15;
      const startM = timeToMinutes(slot.startTime);
      const reminderTime = startM >= reminderMinsBefore
        ? `${Math.floor((startM - reminderMinsBefore) / 60).toString().padStart(2, '0')}:${((startM - reminderMinsBefore) % 60).toString().padStart(2, '0')}`
        : slot.startTime;

      const stableTaskId = `task-${planId}-lesson-${lesson.dayNumber}`;
      const nowStr = new Date().toISOString();

      const newTask: Task = {
        id: stableTaskId,
        userId: activeUserId || 'guest',
        title: `Day ${lesson.dayNumber}: ${lesson.title}`,
        notes: notesLines.join('\n\n'),
        description: lesson.assignment || lesson.title,
        priority: i === 0 ? 'urgent' : i < 3 ? 'high' : 'medium',
        category: 'Study',
        planId,
        lessonId: `lesson-${lesson.dayNumber}`,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        timeZone: userTz,
        reminderTime,
        reminderOffsetMinutes: reminderMinsBefore,
        durationMinutes: lesson.durationMinutes || dailyDurationMinutes,
        completed: false,
        createdAt: nowStr,
        updatedAt: nowStr,
      };

      if (user) {
        const taskPath = `users/${user.uid}/tasks/${stableTaskId}`;
        try {
          await setDoc(doc(db, 'users', user.uid, 'tasks', stableTaskId), newTask);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, taskPath);
        }
      } else {
        setTasks((prev) => {
          const filtered = prev.filter((t) => t.id !== stableTaskId);
          return [...filtered, newTask];
        });
      }

      // Schedule real reminder job for this session (15 mins advance warning)
      const deliveryTime = calculateReminderDeliveryTime(slot.date, slot.startTime, reminderMinsBefore);
      const reminderId = `rem-${stableTaskId}`;
      const newReminder: Reminder = {
        id: reminderId,
        userId: activeUserId || 'guest',
        taskId: stableTaskId,
        planId,
        title: `Study Reminder: ${newTask.title}`,
        notificationTitle: 'Your learning time is here!',
        notificationMessage: `${roadmap.title} — ${newTask.title}`,
        date: slot.date,
        time: reminderTime,
        scheduledTime: deliveryTime,
        timeZone: userTz,
        status: 'pending',
        advanceOffsetMinutes: reminderMinsBefore,
        completed: false,
        recurring: 'none',
        createdAt: nowStr,
        updatedAt: nowStr,
      };

      if (user) {
        setDoc(doc(db, 'users', user.uid, 'reminders', reminderId), newReminder).catch(console.warn);
      } else {
        setReminders((prev) => [...prev.filter((r) => r.id !== reminderId), newReminder]);
      }
      fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReminder),
      }).catch(console.warn);
    }

    // 4. Commit to AI Assistant Memory
    await addMemory(
      'goal',
      `Active goal: "${roadmap.title}" (${durationDays} lessons, ${dailyDurationMinutes}m/day at ${preferredTime} in ${userTz}, schedule: ${scheduleType}).`,
      roadmap.title
    );

    return planId;
  };

  // Pause a plan: freezes pending tasks
  const pausePlan = async (planId: string): Promise<void> => {
    const pausedAt = new Date().toISOString();
    await updatePlan(planId, { status: 'paused', pausedAt });
  };

  // Resume a plan: re-aligns remaining pending tasks starting from newStartDate or today
  const resumePlan = async (planId: string, newStartDate?: string): Promise<void> => {
    const targetStartDate = newStartDate || new Date().toISOString().split('T')[0];
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    // Shift uncompleted tasks
    const planPendingTasks = tasks
      .filter((t) => t.planId === planId && !t.completed && !t.isSkipped)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (planPendingTasks.length > 0) {
      const earliestCurrentDate = planPendingTasks[0].date;
      const startCurrent = new Date(earliestCurrentDate);
      const targetStart = new Date(targetStartDate);
      const diffDays = Math.round((targetStart.getTime() - startCurrent.getTime()) / (24 * 60 * 60 * 1000));

      if (diffDays !== 0) {
        await moveRemainingLessonsForward(planId, earliestCurrentDate, diffDays);
      }
    }

    await updatePlan(planId, { status: 'active', pausedAt: undefined });
  };

  // Reschedule single session
  const rescheduleSession = async (taskId: string, newDate: string, newStartTime: string): Promise<void> => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    const newEndTime = calculateEndTime(newStartTime, targetTask.durationMinutes || 60);
    await updateTask(taskId, {
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      isMissed: false,
    });
  };

  // Skip a lesson
  const skipLesson = async (taskId: string): Promise<void> => {
    await updateTask(taskId, {
      isSkipped: true,
      completed: false,
    });
  };

  // Move remaining lessons forward by daysShift without modifying completed historical sessions
  const moveRemainingLessonsForward = async (planId: string, fromDate: string, daysShift: number): Promise<void> => {
    const targetTasks = tasks.filter(
      (t) => t.planId === planId && !t.completed && t.date >= fromDate
    );

    for (const t of targetTasks) {
      const current = new Date(t.date);
      current.setDate(current.getDate() + daysShift);
      const newDateStr = current.toISOString().split('T')[0];
      await updateTask(t.id, { date: newDateStr, isMissed: false });
    }

    // Also update plan endDate
    const plan = plans.find((p) => p.id === planId);
    if (plan && plan.endDate) {
      const currentEnd = new Date(plan.endDate);
      currentEnd.setDate(currentEnd.getDate() + daysShift);
      await updatePlan(planId, { endDate: currentEnd.toISOString().split('T')[0] });
    }
  };

  // Apply approved AI schedule redesign
  const applyAiRedesignSchedule = async (
    planId: string,
    recommendations: { taskId: string; proposedDate: string; proposedStartTime: string; proposedEndTime: string }[]
  ): Promise<void> => {
    for (const rec of recommendations) {
      if (rec.taskId) {
        await updateTask(rec.taskId, {
          date: rec.proposedDate,
          startTime: rec.proposedStartTime,
          endTime: rec.proposedEndTime,
          isMissed: false,
        });
      }
    }

    // Recalculate plan endDate
    const dates = recommendations.map((r) => r.proposedDate).filter(Boolean);
    if (dates.length > 0) {
      dates.sort();
      const latestDate = dates[dates.length - 1];
      await updatePlan(planId, { endDate: latestDate });
    }
  };

  // Delete plan and its uncompleted future tasks, keeping completed tasks as historical records
  const deletePlanWithSessions = async (planId: string, keepHistory = true): Promise<void> => {
    // Delete plan tasks
    const planTasks = tasks.filter((t) => t.planId === planId);
    for (const t of planTasks) {
      if (!keepHistory || !t.completed) {
        await deleteTask(t.id);
      }
    }
    // Delete plan itself
    await deletePlan(planId);
  };

  // Change recurring reminder time for future tasks of this plan
  const changeRecurringReminderTime = async (planId: string, newTime: string): Promise<void> => {
    const todayStr = new Date().toISOString().split('T')[0];
    const futurePlanTasks = tasks.filter((t) => t.planId === planId && !t.completed && t.date >= todayStr);

    for (const t of futurePlanTasks) {
      const newEndTime = calculateEndTime(newTime, t.durationMinutes || 60);
      await updateTask(t.id, {
        startTime: newTime,
        endTime: newEndTime,
      });
    }

    await updatePlan(planId, { preferredTime: newTime });
  };

  // Get daily workload for any arbitrary date
  const getDailyWorkloadForDate = (date: string): DailyWorkloadSummary => {
    return calculateDailyWorkload(date, tasks);
  };

  // Reactive Phase 3 calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const missedTasks = detectMissedTasks(tasks);
  const todayWorkload = calculateDailyWorkload(todayStr, tasks);

  // Compute all conflicts across active tasks
  const conflicts: SchedulingConflict[] = [];
  const activeTasks = tasks.filter((t) => !t.completed && !t.isSkipped && t.startTime);
  for (let i = 0; i < activeTasks.length; i++) {
    const tA = activeTasks[i];
    for (let j = i + 1; j < activeTasks.length; j++) {
      const tB = activeTasks[j];
      if (tA.date === tB.date && tA.startTime && tB.startTime) {
        const overlap = detectTaskConflicts(tA, [tB]);
        if (overlap.length > 0) {
          conflicts.push(...overlap);
        }
      }
    }
  }

  // Dashboard & Progress calculations
  const todayTasks = tasks.filter((t) => t.date === todayStr);
  const todayTasksTotal = todayTasks.length;
  const todayTasksCompleted = todayTasks.filter((t) => t.completed).length;
  const todayCompletionPercentage = todayTasksTotal > 0 ? Math.round((todayTasksCompleted / todayTasksTotal) * 100) : 0;

  // Calculate current week tasks
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

  const weeklyTasks = tasks.filter((t) => t.date >= startOfWeekStr);
  const weeklyTasksTotal = weeklyTasks.length;
  const weeklyTasksCompleted = weeklyTasks.filter((t) => t.completed).length;
  const weeklyCompletionPercentage = weeklyTasksTotal > 0 ? Math.round((weeklyTasksCompleted / weeklyTasksTotal) * 100) : 0;

  // Total study hours
  const totalStudyMinutes = tasks
    .filter((t) => t.completed)
    .reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
  const totalStudyHours = Math.round((totalStudyMinutes / 60) * 10) / 10;

  // Next reminder
  const pendingReminders = reminders.filter((r) => !r.completed);
  const nextReminder = pendingReminders.length > 0 ? pendingReminders[0] : null;

  const activePlansCount = plans.filter((p) => p.status === 'active').length;
  const streakDays = userProfile?.streakDays || 1;

  const stats = {
    todayTasksTotal,
    todayTasksCompleted,
    todayCompletionPercentage,
    weeklyTasksTotal,
    weeklyTasksCompleted,
    weeklyCompletionPercentage,
    totalStudyHours,
    streakDays,
    activePlansCount,
    nextReminder,
  };

  return (
    <DataContext.Provider
      value={{
        plans,
        tasks,
        reminders,
        progressRecords,
        memories,
        loading,
        createTask,
        updateTask,
        deleteTask,
        toggleTaskCompleted,
        createPlan,
        updatePlan,
        deletePlan,
        togglePlanStatus,
        togglePlanObjective,
        createReminder,
        updateReminder,
        deleteReminder,
        toggleReminderCompleted,
        importRoadmapTemplate,
        resetCompletedTasks,
        addMemory,
        deleteMemory,
        clearMemories,
        approveGeneratedRoadmap,

        // Phase 3 additions:
        missedTasks,
        conflicts,
        todayWorkload,
        pausePlan,
        resumePlan,
        rescheduleSession,
        skipLesson,
        moveRemainingLessonsForward,
        applyAiRedesignSchedule,
        deletePlanWithSessions,
        changeRecurringReminderTime,
        getDailyWorkloadForDate,

        // Phase 4 additions:
        devices,
        reminderSettings,
        activeInAppAlert,
        dismissInAppAlert,
        enableWebPush,
        disableWebPush,
        removeDevice,
        sendTestPushNotification,
        scheduleReminderForTask,
        updateReminderSettings,

        // Phase 5 additions:
        isOnline,
        pendingSyncCount: pendingQueue.length,
        syncPendingChanges,
        clearOfflineCache,

        stats,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
