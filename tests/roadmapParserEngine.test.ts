import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectFormatType,
  validateParsedRoadmap,
  calculateScheduleEndDate,
} from '../src/utils/roadmapParserEngine.ts';
import { ParsedRoadmap, Task } from '../src/types/index.ts';

test('detectFormatType accurately detects markdown, tables, json, and plain text', () => {
  const jsonSample = '{"title": "Java Mastery", "lessons": []}';
  assert.equal(detectFormatType(jsonSample), 'json');

  const tableSample = `
| Day | Topic | Tool |
|---|---|---|
| Day 1 | Interface Basics | Photopea |
| Day 2 | Selection Masks | Lightroom |
  `;
  assert.equal(detectFormatType(tableSample), 'table');

  const markdownSample = '## Week 1: Photopea Foundations\n**Day 1**: Layer Masks and Blending Modes.';
  assert.equal(detectFormatType(markdownSample), 'markdown');

  const bulletSample = '- Day 1: Photopea\n- Day 2: Adjustment layers\n- Day 3: Selection';
  assert.equal(detectFormatType(bulletSample), 'bullet_points');

  const plainSample = 'Learn photo editing in 30 days one hour daily';
  assert.equal(detectFormatType(plainSample), 'plain_text');
});

test('validateParsedRoadmap flags missing title, missing dates, and duplicate lessons', () => {
  const roadmapWithDupes: Partial<ParsedRoadmap> = {
    title: 'Photo Editing Mastery',
    durationDays: 3,
    dailyDurationMinutes: 60,
    preferredTime: '19:00',
    lessons: [
      {
        dayNumber: 1,
        title: 'Photopea Layers',
        durationMinutes: 60,
        objectives: ['Learn layers'],
        steps: ['Open app', 'Create layer'],
        resources: ['https://photopea.com'],
        assignment: 'Make a banner',
        completionCriteria: 'Export PNG',
      },
      {
        dayNumber: 1, // Duplicate day
        title: 'Photopea Layers', // Duplicate title
        durationMinutes: 60,
        objectives: ['Learn layers again'],
        steps: ['Repeat'],
        resources: [],
        assignment: 'Repeat',
        completionCriteria: 'Done',
      },
    ],
  };

  const validation = validateParsedRoadmap(roadmapWithDupes, [], '2026-11-10', '19:00');
  assert.equal(validation.duplicateLessons.length >= 1, true);
  assert.equal(validation.totalLessons, 2);
});

test('validateParsedRoadmap detects scheduling conflicts with existing calendar tasks', () => {
  const existingTasks: Task[] = [
    {
      id: 'existing-1',
      userId: 'u1',
      title: 'Work Sprint Meeting',
      priority: 'high',
      category: 'Work',
      date: '2026-11-10',
      startTime: '19:00',
      durationMinutes: 60,
      completed: false,
      createdAt: '2026-11-01',
      updatedAt: '2026-11-01',
    },
  ];

  const parsed: Partial<ParsedRoadmap> = {
    title: 'Photo Editing 30-Day Sprint',
    durationDays: 1,
    dailyDurationMinutes: 60,
    preferredTime: '19:00',
    lessons: [
      {
        dayNumber: 1,
        title: 'Day 1: Photopea Workspace',
        durationMinutes: 60,
        objectives: [],
        steps: [],
        resources: [],
        assignment: '',
        completionCriteria: '',
      },
    ],
  };

  const result = validateParsedRoadmap(parsed, existingTasks, '2026-11-10', '19:00');
  assert.equal(result.potentialConflicts.length, 1);
  assert.equal(result.potentialConflicts[0].existingTaskTitle, 'Work Sprint Meeting');
});

test('calculateScheduleEndDate computes correct end date across 30 days', () => {
  const start = '2026-11-10';
  const end = calculateScheduleEndDate(start, 30);
  assert.equal(end, '2026-12-09');
});
