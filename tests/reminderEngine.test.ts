import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAdvanceOffsetLabel,
  parseTimeString,
  calculateReminderDeliveryTime,
  shouldTriggerReminder,
  detectBrowserAndPlatform,
  isTaskReminderValid,
  createNotificationPayload,
} from '../src/utils/reminderEngine.ts';
import { Reminder, Task, Plan } from '../src/types/index.ts';

test('formatAdvanceOffsetLabel returns user friendly labels', () => {
  assert.equal(formatAdvanceOffsetLabel(0), 'At scheduled start time');
  assert.equal(formatAdvanceOffsetLabel(5), '5 minutes before');
  assert.equal(formatAdvanceOffsetLabel(15), '15 minutes before');
  assert.equal(formatAdvanceOffsetLabel(30), '30 minutes before');
  assert.equal(formatAdvanceOffsetLabel(60), '1 hour before');
});

test('parseTimeString parses 24h and 12h formats correctly', () => {
  assert.deepEqual(parseTimeString('19:30'), { hour: 19, minute: 30 });
  assert.deepEqual(parseTimeString('08:05'), { hour: 8, minute: 5 });
  assert.deepEqual(parseTimeString('7:00 PM'), { hour: 19, minute: 0 });
  assert.deepEqual(parseTimeString('12:00 PM'), { hour: 12, minute: 0 });
  assert.deepEqual(parseTimeString('12:00 AM'), { hour: 0, minute: 0 });
});

test('calculateReminderDeliveryTime subtracts advance offset minutes accurately', () => {
  // 2026-11-10 at 19:00 with 15 mins advance offset -> 18:45
  const deliveryTime = calculateReminderDeliveryTime('2026-11-10', '19:00', 15);
  const parsed = new Date(deliveryTime);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 10); // Nov is 10
  assert.equal(parsed.getDate(), 10);
  assert.equal(parsed.getHours(), 18);
  assert.equal(parsed.getMinutes(), 45);
});

test('shouldTriggerReminder evaluates whether scheduled delivery has arrived', () => {
  const pastTime = new Date(Date.now() - 60000).toISOString();
  const futureTime = new Date(Date.now() + 60000).toISOString();

  assert.equal(shouldTriggerReminder(pastTime), true);
  assert.equal(shouldTriggerReminder(futureTime), false);
});

test('detectBrowserAndPlatform identifies Windows Chrome, Windows Edge, Android Chrome, and others', () => {
  // Windows Chrome
  const winChromeUA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const winChrome = detectBrowserAndPlatform(winChromeUA);
  assert.equal(winChrome.platform, 'Windows');
  assert.equal(winChrome.browser, 'Chrome');
  assert.equal(winChrome.deviceName, 'Windows Chrome');

  // Windows Edge
  const winEdgeUA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
  const winEdge = detectBrowserAndPlatform(winEdgeUA);
  assert.equal(winEdge.platform, 'Windows');
  assert.equal(winEdge.browser, 'Edge');
  assert.equal(winEdge.deviceName, 'Windows Edge');

  // Android Chrome
  const androidUA =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
  const androidChrome = detectBrowserAndPlatform(androidUA);
  assert.equal(androidChrome.platform, 'Android');
  assert.equal(androidChrome.browser, 'Android Chrome');
  assert.equal(androidChrome.deviceName, 'Android Android Chrome');
});

test('isTaskReminderValid catches completed tasks, paused plans, and cancelled reminders', () => {
  const reminder: Reminder = {
    id: 'r1',
    userId: 'u1',
    title: 'Study Reminder',
    date: '2026-11-10',
    time: '19:00',
    status: 'pending',
    completed: false,
    createdAt: '',
    updatedAt: '',
  };

  const activeTask: Task = {
    id: 't1',
    userId: 'u1',
    title: 'Photo Editing Lesson',
    date: '2026-11-10',
    startTime: '19:00',
    durationMinutes: 60,
    priority: 'high',
    category: 'Study',
    completed: false,
    createdAt: '',
    updatedAt: '',
  };

  const activePlan: Plan = {
    id: 'p1',
    userId: 'u1',
    title: 'Photo Editing Mastery',
    description: '',
    startDate: '2026-11-10',
    endDate: '2026-12-10',
    durationWeeks: 4,
    dailyStudyMinutes: 60,
    preferredTime: '19:00',
    skillLevel: 'beginner',
    objectives: [],
    status: 'active',
    progress: 0,
    color: '#06B6D4',
    createdAt: '',
    updatedAt: '',
  };

  // Valid when task is pending and plan is active
  assert.equal(isTaskReminderValid(reminder, activeTask, activePlan).isValid, true);

  // Invalid when task completed
  const completedTask = { ...activeTask, completed: true };
  assert.equal(isTaskReminderValid(reminder, completedTask, activePlan).isValid, false);

  // Invalid when plan is paused
  const pausedPlan: Plan = { ...activePlan, status: 'paused' };
  assert.equal(isTaskReminderValid(reminder, activeTask, pausedPlan).isValid, false);

  // Invalid when reminder cancelled
  const cancelledReminder: Reminder = { ...reminder, status: 'cancelled' };
  assert.equal(isTaskReminderValid(cancelledReminder, activeTask, activePlan).isValid, false);
});

test('createNotificationPayload generates expected title and message', () => {
  const task: Task = {
    id: 't1',
    userId: 'u1',
    title: 'Day 08: Understanding Colour Theory',
    date: '2026-11-10',
    startTime: '19:00',
    durationMinutes: 60,
    priority: 'high',
    category: 'Study',
    completed: false,
    createdAt: '',
    updatedAt: '',
  };

  const plan: Plan = {
    id: 'p1',
    userId: 'u1',
    title: 'Photo Editing',
    description: '',
    startDate: '',
    endDate: '',
    durationWeeks: 4,
    dailyStudyMinutes: 60,
    preferredTime: '',
    skillLevel: 'beginner',
    objectives: [],
    status: 'active',
    progress: 0,
    color: '#06B6D4',
    createdAt: '',
    updatedAt: '',
  };

  const payload = createNotificationPayload(task, plan, 0);
  assert.equal(payload.title, 'Your learning time is here!');
  assert.equal(payload.message, 'Photo Editing — Day 08: Understanding Colour Theory');

  const advancePayload = createNotificationPayload(task, plan, 15);
  assert.equal(advancePayload.title, 'Study session starting in 15 mins');
});
