export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

export type TaskCategory = 'Study' | 'Work' | 'Personal' | 'Project' | 'Health' | 'General';

export type PlanStatus = 'active' | 'paused' | 'completed';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'all-levels';

export type StudyTimePreference = 'morning' | 'afternoon' | 'evening' | 'night';

export type ThemePreference = 'dark' | 'light' | 'system';

export type CalendarViewMode = 'month' | 'week' | 'day';

export interface UserProfile {
  userId: string;
  displayName: string;
  email: string;
  photoURL?: string;
  timeZone: string;
  preferredLanguage: string;
  preferredStudyTime: StudyTimePreference;
  streakDays: number;
  lastActiveDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanObjective {
  id: string;
  text: string;
  completed: boolean;
}

export interface Plan {
  id: string;
  userId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  durationWeeks: number;
  dailyStudyMinutes: number;
  preferredTime: string;
  skillLevel: SkillLevel;
  objectives: PlanObjective[];
  status: PlanStatus;
  progress: number; // 0 - 100
  color: string;
  scheduleConfig?: PlanScheduleConfig;
  lessons?: RoadmapLesson[];
  pausedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanScheduleConfig {
  scheduleType: 'daily' | 'weekdays' | 'custom_days';
  selectedDays?: number[]; // 0=Sunday, 1=Monday ... 6=Saturday
  startDate: string;
  preferredTime: string; // e.g. "19:00"
  secondaryTime?: string; // for multiple daily sessions
  multipleSessionsPerDay?: boolean;
  timeZone: string;
  dailyDurationMinutes: number;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  notes?: string;
  description?: string;
  priority: PriorityLevel;
  category: TaskCategory;
  planId?: string;
  lessonId?: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  timeZone?: string; // e.g. "Asia/Colombo", "UTC"
  reminderTime?: string; // e.g. "18:45" or "15 mins before"
  reminderOffsetMinutes?: number;
  durationMinutes: number; // in minutes
  completed: boolean;
  completedAt?: string;
  isMissed?: boolean;
  isSkipped?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulingConflict {
  taskId: string;
  taskTitle: string;
  conflictingTaskId: string;
  conflictingTaskTitle: string;
  taskAId?: string;
  taskBId?: string;
  date: string;
  startTimeA: string;
  endTimeA: string;
  startTimeB: string;
  endTimeB: string;
  overlapMinutes: number;
}

export interface DailyWorkloadSummary {
  date: string;
  totalMinutes: number;
  sessionCount: number;
  tasks: Task[];
  isExcessive: boolean; // > 150 mins or conflicting
  hasConflicts: boolean;
  recommendation?: string;
}

export interface ScheduleGenerationOptions {
  planTitle: string;
  startDate: string;
  durationDays: number;
  dailyDurationMinutes: number;
  preferredTime: string; // e.g. "19:00"
  secondaryTime?: string;
  multipleSessionsPerDay?: boolean;
  scheduleType: 'daily' | 'weekdays' | 'custom_days';
  selectedDays?: number[]; // [0,1,2,3,4,5,6]
  timeZone: string;
  allowOverlaps?: boolean;
}

export type ReminderStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  taskId?: string;
  planId?: string;
  scheduledTime?: string; // ISO 8601 delivery timestamp in UTC
  timeZone?: string; // e.g. "Asia/Colombo"
  notificationTitle?: string;
  notificationMessage?: string;
  status: ReminderStatus;
  advanceOffsetMinutes?: number; // 0, 5, 10, 15, 30
  attemptCount?: number;
  lastAttemptAt?: string;
  deliveryResult?: string;
  recurring?: 'none' | 'daily' | 'weekly' | 'weekdays';
  completed: boolean;
  linkedTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceRecord {
  id: string;
  userId: string;
  fcmToken: string;
  browser: string;
  platform: string;
  deviceName: string;
  enabled: boolean;
  createdAt: string;
  lastActiveAt: string;
}

export interface ReminderSettings {
  webPushEnabled: boolean;
  inAppEnabled: boolean;
  advanceOffsetMinutes: number;
  soundEnabled: boolean;
  dailyDigest: boolean;
  planRemindersEnabled: Record<string, boolean>;
}

export interface UserPreferences {
  theme: ThemePreference;
  notificationsEnabled: boolean;
  dailyDigest: boolean;
  streakWarnings: boolean;
  defaultReminderOffsetMinutes: number;
  timeZone: string;
  updatedAt: string;
}

export interface ProgressRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  tasksCompleted: number;
  tasksTotal: number;
  studyMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export type NavSection = 'dashboard' | 'assistant' | 'plans' | 'calendar' | 'tasks' | 'reminders' | 'progress' | 'settings';

export interface RoadmapLesson {
  dayNumber: number;
  title: string;
  durationMinutes: number;
  objectives: string[];
  steps: string[];
  resources: string[];
  assignment: string;
  completionCriteria: string;
}

export interface GeneratedRoadmap {
  title: string;
  description: string;
  durationDays: number;
  dailyDurationMinutes: number;
  skillLevel: SkillLevel;
  preferredTime?: string;
  lessons: RoadmapLesson[];
}

export interface AIMemory {
  id: string;
  userId: string;
  category: 'preference' | 'goal' | 'difficulty' | 'note' | 'achievement';
  text: string;
  topic?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  actionType?: 'create_plan' | 'create_task' | 'view_schedule' | 'preview_roadmap';
  actionData?: Record<string, unknown>;
  roadmapPreview?: GeneratedRoadmap;
  isError?: boolean;
}

export interface LearningPhase {
  phaseNumber: number;
  title: string;
  startDay: number;
  endDay: number;
  focus: string;
}

export interface ParsedRoadmapLesson extends RoadmapLesson {
  phase?: string;
  description?: string;
  deadlines?: string;
}

export interface ParsedRoadmap {
  title: string;
  description: string;
  durationDays: number;
  dailyDurationMinutes: number;
  skillLevel: SkillLevel;
  preferredTime: string;
  startDate?: string;
  endDate?: string;
  learningPhases: LearningPhase[];
  lessons: ParsedRoadmapLesson[];
  missingInfo: string[];
  detectedDuplicates: string[];
  rawSourceType?: 'plain_text' | 'markdown' | 'json' | 'table' | 'bullet_points';
}


