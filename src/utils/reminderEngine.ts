/**
 * DayPilot AI - Pure Decoupled Reminder & Push Notification Logic
 * Comprehensive calculation of delivery timestamps, browser/platform detection,
 * validity verification, and advance offsets.
 */

import { Reminder, Task, Plan } from '../types/index.ts';

/**
 * Format advance notification offset into a user-friendly label
 */
export function formatAdvanceOffsetLabel(minutes: number): string {
  if (minutes <= 0) return 'At scheduled start time';
  if (minutes === 60) return '1 hour before';
  return `${minutes} minutes before`;
}

/**
 * Parses time string (24h or 12h) to hour and minute
 */
export function parseTimeString(timeStr: string): { hour: number; minute: number } {
  if (!timeStr) return { hour: 9, minute: 0 };
  const clean = timeStr.trim();
  const is12Hour = /am|pm/i.test(clean);

  if (is12Hour) {
    const isPM = /pm/i.test(clean);
    const timeParts = clean.replace(/am|pm/i, '').trim().split(':');
    let hour = parseInt(timeParts[0], 10) || 0;
    const minute = parseInt(timeParts[1] || '0', 10) || 0;
    if (isPM && hour < 12) hour += 12;
    if (!isPM && hour === 12) hour = 0;
    return { hour, minute };
  }

  const parts = clean.split(':');
  return {
    hour: parseInt(parts[0] || '0', 10) || 0,
    minute: parseInt(parts[1] || '0', 10) || 0,
  };
}

/**
 * Calculate scheduled delivery time in ISO UTC format
 * Subtracts advanceOffsetMinutes from the scheduled task start time.
 */
export function calculateReminderDeliveryTime(
  dateStr: string,
  timeStr: string,
  offsetMinutes: number = 0
): string {
  const { hour, minute } = parseTimeString(timeStr);
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  // Construct target Date in local clock, then adjust offset
  const dateObj = new Date(year, month, day, hour, minute, 0, 0);
  if (offsetMinutes > 0) {
    dateObj.setMinutes(dateObj.getMinutes() - offsetMinutes);
  }

  return dateObj.toISOString();
}

/**
 * Determine if a scheduled reminder delivery time has arrived
 */
export function shouldTriggerReminder(scheduledTimeISO: string, nowISO?: string): boolean {
  if (!scheduledTimeISO) return false;
  const target = new Date(scheduledTimeISO).getTime();
  const current = nowISO ? new Date(nowISO).getTime() : Date.now();
  return target <= current;
}

/**
 * Pure User-Agent parser to accurately identify supported browsers and platforms
 * (Windows Chrome, Windows Edge, Android Chrome, macOS Safari, Linux, etc.)
 */
export function detectBrowserAndPlatform(userAgent: string): {
  browser: string;
  platform: string;
  deviceName: string;
} {
  const ua = userAgent || '';

  let platform = 'Unknown Platform';
  if (/android/i.test(ua)) {
    platform = 'Android';
  } else if (/windows|win32/i.test(ua)) {
    platform = 'Windows';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    platform = 'iOS';
  } else if (/macintosh|mac os x/i.test(ua)) {
    platform = 'macOS';
  } else if (/linux/i.test(ua)) {
    platform = 'Linux';
  }

  let browser = 'Web Browser';
  if (/edg\//i.test(ua)) {
    browser = 'Edge';
  } else if (/opr\/|opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/samsungbrowser/i.test(ua)) {
    browser = 'Samsung Internet';
  } else if (/chrome|crios/i.test(ua)) {
    browser = platform === 'Android' ? 'Android Chrome' : 'Chrome';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Firefox';
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    browser = 'Safari';
  }

  const deviceName = `${platform} ${browser}`;

  return { browser, platform, deviceName };
}

/**
 * Verifies that a reminder is still active and valid before firing push notification
 */
export function isTaskReminderValid(
  reminder: Reminder,
  task?: Task | null,
  plan?: Plan | null
): { isValid: boolean; reason?: string } {
  if (reminder.status === 'cancelled') {
    return { isValid: false, reason: 'Reminder was cancelled' };
  }
  if (reminder.status === 'sent') {
    return { isValid: false, reason: 'Reminder already delivered' };
  }
  if (!task) {
    return { isValid: false, reason: 'Linked task was deleted' };
  }
  if (task.completed) {
    return { isValid: false, reason: 'Linked task already completed' };
  }
  if (task.isSkipped) {
    return { isValid: false, reason: 'Linked task was skipped' };
  }
  if (plan && plan.status === 'paused') {
    return { isValid: false, reason: 'Associated learning plan is paused' };
  }

  return { isValid: true };
}

/**
 * Builds standard notification payload for reminders
 */
export function createNotificationPayload(
  task: Task,
  plan?: Plan | null,
  advanceMinutes: number = 0
): { title: string; message: string } {
  const isAdvance = advanceMinutes > 0;
  const title = isAdvance
    ? `Study session starting in ${advanceMinutes} mins`
    : 'Your learning time is here!';

  let message = task.title;
  if (plan) {
    message = `${plan.title} — ${task.title}`;
  }

  return { title, message };
}
