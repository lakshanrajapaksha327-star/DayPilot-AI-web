import test from 'node:test';
import assert from 'node:assert/strict';
import {
  timeToMinutes,
  minutesToTime,
  calculateEndTime,
  detectTimeOverlap,
  detectTaskConflicts,
  calculateDailyWorkload,
  generateScheduleDates,
  detectMissedTasks,
  findConflictFreeSlots,
  shiftRemainingTasks,
} from '../src/utils/schedulingEngine.ts';
import { Task } from '../src/types/index.ts';

test('timeToMinutes converts 24h and 12h formats accurately', () => {
  assert.equal(timeToMinutes('00:00'), 0);
  assert.equal(timeToMinutes('19:00'), 1140);
  assert.equal(timeToMinutes('7:00 PM'), 1140);
  assert.equal(timeToMinutes('7:00 AM'), 420);
  assert.equal(timeToMinutes('12:00 PM'), 720);
  assert.equal(timeToMinutes('12:00 AM'), 0);
});

test('calculateEndTime accurately computes end time across durations', () => {
  assert.equal(calculateEndTime('19:00', 60), '20:00');
  assert.equal(calculateEndTime('23:30', 45), '00:15');
  assert.equal(calculateEndTime('08:15', 30), '08:45');
});

test('detectTimeOverlap catches true overlaps and ignores disjoint intervals', () => {
  // 19:00 - 20:00 and 19:30 - 20:30 (overlap)
  assert.equal(detectTimeOverlap('19:00', 60, '19:30', 60), true);

  // 19:00 - 20:00 and 20:00 - 21:00 (adjacent touching intervals - not overlapping)
  assert.equal(detectTimeOverlap('19:00', 60, '20:00', 60), false);

  // 10:00 - 11:00 and 14:00 - 15:00 (completely separate)
  assert.equal(detectTimeOverlap('10:00', 60, '14:00', 60), false);
});

test('detectTaskConflicts detects overlapping sessions on same date', () => {
  const existingTasks: Task[] = [
    {
      id: 'task-1',
      userId: 'u1',
      title: 'Full-Stack Study',
      date: '2026-11-10',
      startTime: '19:00',
      durationMinutes: 60,
      priority: 'high',
      category: 'Study',
      completed: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'task-2',
      userId: 'u1',
      title: 'Workout Session',
      date: '2026-11-10',
      startTime: '21:00',
      durationMinutes: 45,
      priority: 'low',
      category: 'Health',
      completed: false,
      createdAt: '',
      updatedAt: '',
    },
  ];

  // A new task at 19:30 on 2026-11-10 should conflict with task-1
  const conflicts = detectTaskConflicts(
    {
      date: '2026-11-10',
      startTime: '19:30',
      durationMinutes: 60,
      title: 'Java Practice',
    },
    existingTasks
  );

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].conflictingTaskId, 'task-1');
  assert.equal(conflicts[0].overlapMinutes, 30);

  // A task at 17:00 should not conflict
  const noConflicts = detectTaskConflicts(
    {
      date: '2026-11-10',
      startTime: '17:00',
      durationMinutes: 60,
      title: 'Reading',
    },
    existingTasks
  );
  assert.equal(noConflicts.length, 0);
});

test('generateScheduleDates generates 30 daily lessons accurately', () => {
  const dates = generateScheduleDates({
    planTitle: 'Photo Editing',
    startDate: '2026-11-10',
    durationDays: 30,
    dailyDurationMinutes: 60,
    preferredTime: '19:00',
    scheduleType: 'daily',
    timeZone: 'Asia/Colombo',
  });

  assert.equal(dates.length, 30);
  assert.equal(dates[0].dayNumber, 1);
  assert.equal(dates[0].date, '2026-11-10');
  assert.equal(dates[0].startTime, '19:00');
  assert.equal(dates[0].endTime, '20:00');

  // Verify sequential days
  assert.equal(dates[29].dayNumber, 30);
  assert.equal(dates[29].date, '2026-12-09');
});

test('generateScheduleDates respects selected weekdays schedule', () => {
  // Tuesday Nov 10, 2026 to Thursday Nov 12, etc. (Weekdays: Mon-Fri only)
  const dates = generateScheduleDates({
    planTitle: 'Weekdays Study',
    startDate: '2026-11-10',
    durationDays: 5,
    dailyDurationMinutes: 45,
    preferredTime: '10:00',
    scheduleType: 'weekdays',
    timeZone: 'UTC',
  });

  assert.equal(dates.length, 5);
  // Ensure no Saturdays or Sundays are scheduled
  for (const d of dates) {
    const day = new Date(d.date).getDay();
    assert.ok(day >= 1 && day <= 5, `Date ${d.date} is not a weekday`);
  }
});

test('detectMissedTasks correctly identifies past uncompleted tasks', () => {
  const testNow = new Date('2026-11-10T12:00:00Z');
  const tasks: Task[] = [
    {
      id: 'task-past',
      userId: 'u1',
      title: 'Yesterday Lesson',
      date: '2026-11-09',
      startTime: '19:00',
      durationMinutes: 60,
      priority: 'high',
      category: 'Study',
      completed: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'task-done',
      userId: 'u1',
      title: 'Completed Lesson',
      date: '2026-11-09',
      startTime: '10:00',
      durationMinutes: 60,
      priority: 'medium',
      category: 'Study',
      completed: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'task-future',
      userId: 'u1',
      title: 'Tomorrow Lesson',
      date: '2026-11-11',
      startTime: '19:00',
      durationMinutes: 60,
      priority: 'high',
      category: 'Study',
      completed: false,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const missed = detectMissedTasks(tasks, testNow);
  assert.equal(missed.length, 1);
  assert.equal(missed[0].id, 'task-past');
});

test('shiftRemainingTasks shifts future tasks without altering completed ones', () => {
  const tasks: Task[] = [
    {
      id: 't1',
      userId: 'u1',
      planId: 'plan-1',
      title: 'Lesson 1',
      date: '2026-11-08',
      completed: true,
      priority: 'high',
      category: 'Study',
      durationMinutes: 60,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 't2',
      userId: 'u1',
      planId: 'plan-1',
      title: 'Lesson 2',
      date: '2026-11-09',
      completed: false,
      priority: 'high',
      category: 'Study',
      durationMinutes: 60,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 't3',
      userId: 'u1',
      planId: 'plan-1',
      title: 'Lesson 3',
      date: '2026-11-10',
      completed: false,
      priority: 'high',
      category: 'Study',
      durationMinutes: 60,
      createdAt: '',
      updatedAt: '',
    },
  ];

  // Shift remaining from 2026-11-09 forward by +2 days
  const shifted = shiftRemainingTasks('plan-1', '2026-11-09', 2, tasks);

  assert.equal(shifted.find((t) => t.id === 't1')?.date, '2026-11-08'); // historical completed kept!
  assert.equal(shifted.find((t) => t.id === 't2')?.date, '2026-11-11'); // 9 + 2 = 11
  assert.equal(shifted.find((t) => t.id === 't3')?.date, '2026-11-12'); // 10 + 2 = 12
});
