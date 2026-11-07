/**
 * DayPilot AI - Roadmap Parser & Validation Engine
 * Pure logic for format classification, sanity checking,
 * duplicate detection, missing info checks, and schedule conflict evaluation.
 */

import { ParsedRoadmap, ParsedRoadmapLesson, Task } from '../types/index.ts';
import { timeToMinutes } from './schedulingEngine.ts';

export interface ValidationResult {
  isValid: boolean;
  totalLessons: number;
  totalDays: number;
  missingFields: string[];
  duplicateLessons: string[];
  invalidDates: string[];
  invalidTimes: string[];
  potentialConflicts: { date: string; time: string; existingTaskTitle: string; lessonTitle: string }[];
}

/**
 * Detect the likely formatting of user pasted content
 */
export function detectFormatType(rawText: string): 'json' | 'table' | 'markdown' | 'bullet_points' | 'plain_text' {
  const trimmed = rawText.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // not valid json
    }
  }

  // Markdown table: lines with '|'
  const lines = trimmed.split('\n');
  const pipeLines = lines.filter((line) => line.trim().startsWith('|') && line.trim().endsWith('|'));
  if (pipeLines.length >= 3) {
    return 'table';
  }

  // Markdown headers & bold
  if (/^#{1,4}\s+/m.test(trimmed) || /\*\*[^*]+\*\*/.test(trimmed)) {
    return 'markdown';
  }

  // Bullet points or numbered lists
  if (/^\s*[-*•]\s+/m.test(trimmed) || /^\s*\d+[\.\)]\s+/m.test(trimmed)) {
    return 'bullet_points';
  }

  return 'plain_text';
}

/**
 * Validate and lint an extracted roadmap before final approval
 */
export function validateParsedRoadmap(
  roadmap: Partial<ParsedRoadmap>,
  existingTasks: Task[] = [],
  startDate?: string,
  preferredTime?: string
): ValidationResult {
  const missingFields: string[] = [];
  const duplicateLessons: string[] = [];
  const invalidDates: string[] = [];
  const invalidTimes: string[] = [];
  const potentialConflicts: { date: string; time: string; existingTaskTitle: string; lessonTitle: string }[] = [];

  // Required top-level attributes
  if (!roadmap.title || roadmap.title.trim().length === 0) {
    missingFields.push('Roadmap Title is required');
  }

  const lessons = Array.isArray(roadmap.lessons) ? roadmap.lessons : [];
  const totalLessons = lessons.length;
  const totalDays = roadmap.durationDays || totalLessons;

  if (totalLessons === 0) {
    missingFields.push('No learning lessons or daily sessions detected in the text');
  }

  // Duplicate lesson detection (by title or dayNumber)
  const seenTitles = new Set<string>();
  const seenDays = new Set<number>();

  lessons.forEach((lesson, idx) => {
    const normTitle = (lesson.title || '').trim().toLowerCase();
    if (normTitle && seenTitles.has(normTitle)) {
      duplicateLessons.push(`Duplicate lesson title: "${lesson.title}" on Day ${lesson.dayNumber || idx + 1}`);
    } else if (normTitle) {
      seenTitles.add(normTitle);
    }

    if (lesson.dayNumber && seenDays.has(lesson.dayNumber)) {
      duplicateLessons.push(`Duplicate day number: Day ${lesson.dayNumber}`);
    } else if (lesson.dayNumber) {
      seenDays.add(lesson.dayNumber);
    }
  });

  // Date validation
  const effectiveStart = startDate || roadmap.startDate;
  if (effectiveStart) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveStart) || isNaN(new Date(effectiveStart).getTime())) {
      invalidDates.push(`Invalid start date format: ${effectiveStart}`);
    }
  } else {
    missingFields.push('Start Date not specified (please choose your start date)');
  }

  // Time validation
  const effectiveTime = preferredTime || roadmap.preferredTime || '19:00';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(effectiveTime) && !/^(1[0-2]|0?[1-9]):[0-5]\d\s*(AM|PM)$/i.test(effectiveTime)) {
    invalidTimes.push(`Invalid study time format: ${effectiveTime}`);
  }

  // Check potential schedule conflicts if start date is known
  if (effectiveStart && !isNaN(new Date(effectiveStart).getTime()) && lessons.length > 0) {
    const studyStartMinutes = timeToMinutes(effectiveTime);
    const lessonDuration = roadmap.dailyDurationMinutes || 60;
    const studyEndMinutes = studyStartMinutes + lessonDuration;

    lessons.forEach((lesson, dayIdx) => {
      const d = new Date(effectiveStart);
      d.setDate(d.getDate() + dayIdx);
      const dateStr = d.toISOString().split('T')[0];

      // Check tasks already scheduled on dateStr
      const dayTasks = existingTasks.filter((t) => t.date === dateStr && !t.completed && t.startTime);
      for (const t of dayTasks) {
        if (!t.startTime) continue;
        const taskStart = timeToMinutes(t.startTime);
        const taskEnd = taskStart + (t.durationMinutes || 60);

        if (studyStartMinutes < taskEnd && studyEndMinutes > taskStart) {
          potentialConflicts.push({
            date: dateStr,
            time: effectiveTime,
            existingTaskTitle: t.title,
            lessonTitle: lesson.title || `Day ${dayIdx + 1}`,
          });
        }
      }
    });
  }

  const isValid = missingFields.length === 0 && invalidDates.length === 0 && invalidTimes.length === 0;

  return {
    isValid,
    totalLessons,
    totalDays,
    missingFields,
    duplicateLessons,
    invalidDates,
    invalidTimes,
    potentialConflicts,
  };
}

/**
 * Calculate end date string given start date and duration
 */
export function calculateScheduleEndDate(startDateStr: string, durationDays: number): string {
  try {
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return startDateStr;
    const end = new Date(start);
    end.setDate(end.getDate() + Math.max(0, durationDays - 1));
    return end.toISOString().split('T')[0];
  } catch {
    return startDateStr;
  }
}
