import { Task, SchedulingConflict, DailyWorkloadSummary, ScheduleGenerationOptions } from '../types/index.ts';

/**
 * Converts a time string (24h "19:00" or 12h "7:00 PM") into minutes from midnight (0..1439).
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().toLowerCase();

  // Handle 12-hour AM/PM format (e.g., "7:00 pm", "7 pm", "11:30 am")
  const isPm = clean.includes('pm');
  const isAm = clean.includes('am');

  const digitsOnly = clean.replace(/[^\d:]/g, '');
  const parts = digitsOnly.split(':');
  let hours = parseInt(parts[0], 10) || 0;
  const minutes = parts.length > 1 ? parseInt(parts[1], 10) || 0 : 0;

  if (isPm && hours < 12) {
    hours += 12;
  } else if (isAm && hours === 12) {
    hours = 0;
  }

  return (hours % 24) * 60 + (minutes % 60);
}

/**
 * Converts minutes from midnight into 24-hour "HH:mm" format.
 */
export function minutesToTime(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(norm / 60);
  const minutes = norm % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Calculates end time string from start time and duration in minutes.
 * E.g., calculateEndTime("19:00", 60) -> "20:00"
 */
export function calculateEndTime(startTime: string, durationMinutes: number): string {
  if (!startTime) return '00:00';
  const startMins = timeToMinutes(startTime);
  const endMins = startMins + Math.max(1, durationMinutes);
  return minutesToTime(endMins);
}

/**
 * Checks if two time intervals on the same day overlap.
 */
export function detectTimeOverlap(
  startA: string,
  durationA: number,
  startB: string,
  durationB: number
): boolean {
  if (!startA || !startB) return false;
  const aStart = timeToMinutes(startA);
  const aEnd = aStart + durationA;
  const bStart = timeToMinutes(startB);
  const bEnd = bStart + durationB;

  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

/**
 * Detects all scheduling conflicts for a target task against existing scheduled tasks.
 */
export function detectTaskConflicts(
  target: { id?: string; date: string; startTime?: string; durationMinutes: number; title: string },
  allTasks: Task[]
): SchedulingConflict[] {
  if (!target.date || !target.startTime) return [];
  const conflicts: SchedulingConflict[] = [];

  const targetStart = timeToMinutes(target.startTime);
  const targetEnd = targetStart + (target.durationMinutes || 60);

  for (const existing of allTasks) {
    // Skip self or tasks on different dates or without start times
    if (existing.id === target.id) continue;
    if (existing.date !== target.date) continue;
    if (!existing.startTime) continue;
    if (existing.completed || existing.isSkipped) continue;

    const existStart = timeToMinutes(existing.startTime);
    const existEnd = existStart + (existing.durationMinutes || 60);

    const overlapStart = Math.max(targetStart, existStart);
    const overlapEnd = Math.min(targetEnd, existEnd);
    const overlapMinutes = overlapEnd - overlapStart;

    if (overlapMinutes > 0) {
      conflicts.push({
        taskId: target.id || 'new-task',
        taskTitle: target.title,
        conflictingTaskId: existing.id,
        conflictingTaskTitle: existing.title,
        date: target.date,
        startTimeA: minutesToTime(targetStart),
        endTimeA: minutesToTime(targetEnd),
        startTimeB: minutesToTime(existStart),
        endTimeB: minutesToTime(existEnd),
        overlapMinutes,
      });
    }
  }

  return conflicts;
}

/**
 * Calculates the total workload and conflicts for a given date.
 */
export function calculateDailyWorkload(date: string, tasks: Task[]): DailyWorkloadSummary {
  const dayTasks = tasks.filter((t) => t.date === date && !t.isSkipped);
  const totalMinutes = dayTasks.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
  const sessionCount = dayTasks.length;

  // Check for internal conflicts within day tasks
  let hasConflicts = false;
  for (let i = 0; i < dayTasks.length; i++) {
    for (let j = i + 1; j < dayTasks.length; j++) {
      if (
        dayTasks[i].startTime &&
        dayTasks[j].startTime &&
        detectTimeOverlap(
          dayTasks[i].startTime!,
          dayTasks[i].durationMinutes,
          dayTasks[j].startTime!,
          dayTasks[j].durationMinutes
        )
      ) {
        hasConflicts = true;
        break;
      }
    }
    if (hasConflicts) break;
  }

  // Workload is excessive if > 150 minutes (2.5 hours) or has overlapping sessions
  const isExcessive = totalMinutes > 150 || hasConflicts;

  let recommendation: string | undefined;
  if (hasConflicts) {
    recommendation = 'You have overlapping study sessions scheduled at the same time. Consider shifting one session.';
  } else if (totalMinutes > 180) {
    recommendation = `High workload alert: ${Math.round(totalMinutes / 60 * 10) / 10} hours scheduled. We recommend spacing out deep work blocks to prevent cognitive fatigue.`;
  } else if (sessionCount >= 4) {
    recommendation = `${sessionCount} sessions today. Ensure at least 15-minute buffer breaks between blocks.`;
  }

  return {
    date,
    totalMinutes,
    sessionCount,
    tasks: dayTasks,
    isExcessive,
    hasConflicts,
    recommendation,
  };
}

/**
 * Intelligent Schedule Generator that calculates exact sequential calendar dates
 * supporting daily, weekdays, custom days of week, and multiple daily sessions.
 */
export function generateScheduleDates(
  options: ScheduleGenerationOptions
): {
  dayNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  sessionIndex: number;
}[] {
  const {
    startDate,
    durationDays,
    dailyDurationMinutes,
    preferredTime,
    secondaryTime,
    multipleSessionsPerDay,
    scheduleType,
    selectedDays = [1, 2, 3, 4, 5], // default Mon-Fri for custom
  } = options;

  const results: {
    dayNumber: number;
    date: string;
    startTime: string;
    endTime: string;
    sessionIndex: number;
  }[] = [];

  const start = new Date(startDate);
  // Ensure date starts clean at local midnight
  const curr = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  let lessonsScheduled = 0;
  let safetyCounter = 0;
  const maxDaysToScan = durationDays * 7; // safety limit against infinite loops

  const normPreferredTime = minutesToTime(timeToMinutes(preferredTime || '19:00'));
  const normSecondaryTime = secondaryTime
    ? minutesToTime(timeToMinutes(secondaryTime))
    : minutesToTime((timeToMinutes(normPreferredTime) + 120) % 1440);

  const sessionDuration = multipleSessionsPerDay
    ? Math.max(15, Math.round(dailyDurationMinutes / 2))
    : dailyDurationMinutes;

  while (lessonsScheduled < durationDays && safetyCounter < maxDaysToScan) {
    safetyCounter++;
    const dayOfWeek = curr.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
    const dateStr = curr.toISOString().split('T')[0];

    let shouldSchedule = false;

    if (scheduleType === 'daily') {
      shouldSchedule = true;
    } else if (scheduleType === 'weekdays') {
      shouldSchedule = dayOfWeek >= 1 && dayOfWeek <= 5;
    } else if (scheduleType === 'custom_days') {
      shouldSchedule = selectedDays.includes(dayOfWeek);
    }

    if (shouldSchedule) {
      if (multipleSessionsPerDay && lessonsScheduled + 1 < durationDays) {
        // Session 1: Morning/Preferred
        lessonsScheduled++;
        results.push({
          dayNumber: lessonsScheduled,
          date: dateStr,
          startTime: normPreferredTime,
          endTime: calculateEndTime(normPreferredTime, sessionDuration),
          sessionIndex: 1,
        });

        // Session 2: Evening/Secondary
        lessonsScheduled++;
        results.push({
          dayNumber: lessonsScheduled,
          date: dateStr,
          startTime: normSecondaryTime,
          endTime: calculateEndTime(normSecondaryTime, sessionDuration),
          sessionIndex: 2,
        });
      } else {
        lessonsScheduled++;
        results.push({
          dayNumber: lessonsScheduled,
          date: dateStr,
          startTime: normPreferredTime,
          endTime: calculateEndTime(normPreferredTime, sessionDuration),
          sessionIndex: 1,
        });
      }
    }

    // Advance to next day
    curr.setDate(curr.getDate() + 1);
  }

  return results;
}

/**
 * Detects missed tasks: tasks where scheduled date & end time are in the past and status is incomplete.
 */
export function detectMissedTasks(tasks: Task[], currentDateTime?: Date): Task[] {
  const now = currentDateTime || new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return tasks.filter((t) => {
    if (t.completed || t.isSkipped) return false;
    if (!t.date) return false;

    // Date is strictly in the past
    if (t.date < todayStr) return true;

    // Date is today and end time has passed
    if (t.date === todayStr && t.startTime) {
      const endMins = timeToMinutes(t.startTime) + (t.durationMinutes || 60);
      if (endMins < currentMinutes) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Finds conflict-free study times on a given date considering existing tasks.
 */
export function findConflictFreeSlots(
  date: string,
  durationMinutes: number,
  existingTasks: Task[],
  preferredTime?: string
): string[] {
  const candidates = [
    '08:00',
    '09:00',
    '10:30',
    '14:00',
    '16:00',
    '17:30',
    '19:00',
    '20:00',
    '21:00',
  ];

  if (preferredTime) {
    const norm = minutesToTime(timeToMinutes(preferredTime));
    if (!candidates.includes(norm)) {
      candidates.unshift(norm);
    }
  }

  const freeSlots: string[] = [];

  for (const timeSlot of candidates) {
    const conflicts = detectTaskConflicts(
      {
        date,
        startTime: timeSlot,
        durationMinutes,
        title: 'Candidate slot',
      },
      existingTasks
    );

    if (conflicts.length === 0) {
      freeSlots.push(timeSlot);
      if (freeSlots.length >= 4) break;
    }
  }

  return freeSlots;
}

/**
 * Shifts remaining uncompleted tasks forward by a specified number of days,
 * preserving completed historical sessions without modification.
 */
export function shiftRemainingTasks(
  planId: string,
  fromDate: string,
  daysShift: number,
  tasks: Task[]
): Task[] {
  return tasks.map((task) => {
    // Only target uncompleted tasks belonging to this plan on or after fromDate
    if (task.planId === planId && !task.completed && task.date >= fromDate) {
      const current = new Date(task.date);
      current.setDate(current.getDate() + daysShift);
      const newDateStr = current.toISOString().split('T')[0];
      return {
        ...task,
        date: newDateStr,
        updatedAt: new Date().toISOString(),
      };
    }
    return task;
  });
}
