import express from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import {
  registerDeviceRecord,
  removeDeviceRecord,
  getUserDevices,
  addScheduledReminder,
  cancelReminder,
  cancelRemindersForTask,
  cancelRemindersForPlan,
  getUserReminders,
  sendFCMToUserDevices,
  startReminderWorker,
} from './src/server/reminderScheduler.ts';

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI SDK per gemini-api skill instructions
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Resilient generator that tries models with fallback on 503 high demand
async function generateWithFallback(options: {
  contents: any;
  config?: any;
}) {
  const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
  let lastErr: any = null;

  for (const model of candidateModels) {
    try {
      // ThinkingLevel is not supported on gemini-3.1-flash-lite, so adjust if needed
      const res = await ai.models.generateContent({
        ...options,
        model,
      });
      return res;
    } catch (err: any) {
      lastErr = err;
      const msg = err?.message || String(err);
      console.warn(`Model ${model} returned error (${msg}). Trying fallback model...`);
    }
  }

  throw lastErr;
}

// Helper for error response
function handleApiError(res: express.Response, error: unknown, context: string) {
  console.error(`Gemini API Error [${context}]:`, error);
  const message = error instanceof Error ? error.message : String(error);
  res.status(500).json({
    error: `Failed to process request: ${message}`,
    context,
  });
}

// 1. CHAT ENDPOINT: Multi-turn, context-aware assistant with personal memory
app.post('/api/gemini/chat', async (req, res) => {
  try {
    const { message, history, userContext } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required.' });
      return;
    }

    // Build system instruction grounded in actual Firestore data & user memory
    const memoryContext = Array.isArray(userContext?.memories) && userContext.memories.length > 0
      ? userContext.memories.map((m: any) => `- [${m.category}] ${m.text}`).join('\n')
      : 'No previous memories recorded yet.';

    const activePlansContext = Array.isArray(userContext?.activePlans) && userContext.activePlans.length > 0
      ? userContext.activePlans.map((p: any) => `- Roadmap: "${p.title}" (${p.progress}% completed, ${p.dailyStudyMinutes}m/day, Level: ${p.skillLevel})`).join('\n')
      : 'No active roadmaps currently in progress.';

    const todayTasksContext = Array.isArray(userContext?.todayTasks) && userContext.todayTasks.length > 0
      ? userContext.todayTasks.map((t: any) => `- Task: "${t.title}" (${t.durationMinutes}m, Time: ${t.startTime || 'Unscheduled'}, Priority: ${t.priority}, Status: ${t.completed ? 'COMPLETED' : 'PENDING'}${t.planTitle ? `, Plan: ${t.planTitle}` : ''})`).join('\n')
      : 'No tasks scheduled for today.';

    const systemInstruction = `You are DayPilot AI, an elite Personal AI Study & Productivity Assistant.
Your mission is to help users organize learning goals, generate structured roadmaps, schedule daily timeblocks, track learning streaks, and overcome difficulties.

CURRENT USER CONTEXT (ACTUAL FIRESTORE DATA):
User Name: ${userContext?.userProfile?.displayName || 'Pilot'}
Preferred Study Time: ${userContext?.userProfile?.preferredStudyTime || 'evening'}
Preferred Language: ${userContext?.userProfile?.preferredLanguage || 'English'}
Learning Streak: ${userContext?.stats?.streakDays || 1} days
Total Study Hours: ${userContext?.stats?.totalStudyHours || 0} hrs

TODAY'S ACTUAL SCHEDULED TASKS:
${todayTasksContext}

ACTIVE LEARNING ROADMAPS:
${activePlansContext}

PERSISTENT ASSISTANT MEMORY (PREFERENCES, STRUGGLES & GOALS):
${memoryContext}

CRITICAL BEHAVIORAL DIRECTIVES:
1. When the user asks "What should I study today?" or similar, you MUST inspect TODAY'S ACTUAL SCHEDULED TASKS above and identify today's exact lessons and tasks. Never claim there are no tasks if tasks are listed above!
2. When the user mentions a learning goal or desire to create a roadmap (e.g. "I want to learn photo editing for 30 days...", "I want to learn Java in 4 weeks", etc.), detect the goal and extract parameters (subject, durationDays, skillLevel, dailyDurationMinutes, preferredTime) and inform the user that you are preparing their structured roadmap.
3. When the user mentions specific learning difficulties (e.g. "I am struggling with colour grading", "I find recursion hard"), acknowledge it constructively, provide guidance, and indicate that this has been committed to their assistant memory for future lesson recommendations.
4. Keep responses encouraging, clear, and action-oriented. Do not invent false data about the user.`;

    // Format chat history for generateContent
    const formattedContents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history) {
        formattedContents.push({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.text }],
        });
      }
    }
    // Append current user message
    formattedContents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await generateWithFallback({
      contents: formattedContents,
      config: {
        systemInstruction,
      },
    });

    const reply = response.text || "I'm here to help with your study plans!";

    // Detect if user mentioned difficulty or preference to record in memory
    let extractedMemory = null;
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('struggling with') || lowerMsg.includes('hard to understand') || lowerMsg.includes('difficult for me') || lowerMsg.includes('trouble with')) {
      const topicMatch = message.match(/struggling with ([^.?!]+)/i) || message.match(/trouble with ([^.?!]+)/i);
      const topic = topicMatch ? topicMatch[1].trim() : 'concept';
      extractedMemory = {
        category: 'difficulty',
        text: `User reported learning difficulty: ${message}`,
        topic,
      };
    } else if (lowerMsg.includes('prefer studying') || lowerMsg.includes('my preferred time') || lowerMsg.includes('i want to study at')) {
      extractedMemory = {
        category: 'preference',
        text: message,
      };
    }

    // Detect roadmap generation intent
    let roadmapIntent = false;
    let extractedParams: any = null;
    if (
      lowerMsg.includes('want to learn') ||
      lowerMsg.includes('study roadmap') ||
      lowerMsg.includes('learning plan') ||
      lowerMsg.includes('for 30 days') ||
      lowerMsg.includes('days roadmap') ||
      lowerMsg.includes('teach me')
    ) {
      roadmapIntent = true;
      // Extract days if specified (e.g. "for 30 days", "14 days", "1 month")
      let days = 30;
      const daysMatch = message.match(/(\d+)\s*(days|day)/i);
      const monthMatch = message.match(/(\d+)\s*(months|month)/i);
      if (daysMatch) {
        days = parseInt(daysMatch[1], 10);
      } else if (monthMatch) {
        days = parseInt(monthMatch[1], 10) * 30;
      } else if (lowerMsg.includes('one month') || lowerMsg.includes('1 month')) {
        days = 30;
      }

      // Extract minutes if specified (e.g. "one hour", "45 minutes")
      let dailyMins = 60;
      const minMatch = message.match(/(\d+)\s*(minutes|mins|min)/i);
      const hourMatch = message.match(/(\d+)\s*(hours|hour|hr)/i);
      if (minMatch) {
        dailyMins = parseInt(minMatch[1], 10);
      } else if (hourMatch) {
        dailyMins = parseInt(hourMatch[1], 10) * 60;
      }

      // Extract skill level
      let level = 'beginner';
      if (lowerMsg.includes('advanced')) level = 'advanced';
      else if (lowerMsg.includes('intermediate')) level = 'intermediate';

      // Extract preferred time (e.g. "at 7 PM", "evening")
      let prefTime = '19:00';
      const timeMatch = message.match(/at\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (timeMatch) prefTime = timeMatch[1];
      else if (lowerMsg.includes('morning')) prefTime = '08:00';
      else if (lowerMsg.includes('afternoon')) prefTime = '14:00';
      else if (lowerMsg.includes('evening')) prefTime = '19:00';

      extractedParams = {
        durationDays: days,
        dailyDurationMinutes: dailyMins,
        skillLevel: level,
        preferredTime: prefTime,
      };
    }

    res.json({
      reply,
      extractedMemory,
      roadmapIntent,
      extractedParams,
    });
  } catch (error) {
    handleApiError(res, error, 'chat');
  }
});

// 2. ROADMAP GENERATION ENDPOINT: Generates full structured JSON roadmap with all lessons
app.post('/api/gemini/generate-roadmap', async (req, res) => {
  try {
    const { prompt, params, userContext } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required.' });
      return;
    }

    const durationDays = params?.durationDays || 30;
    const dailyDurationMinutes = params?.dailyDurationMinutes || 60;
    const skillLevel = params?.skillLevel || 'beginner';
    const preferredTime = params?.preferredTime || '19:00';

    const memoryNotes = Array.isArray(userContext?.memories)
      ? userContext.memories.map((m: any) => `${m.category}: ${m.text}`).join('; ')
      : '';

    const systemInstruction = `You are the master curriculum architect for DayPilot AI.
Generate a comprehensive, perfectly structured learning roadmap based on the user's goal.
Duration: Exactly ${durationDays} days.
Daily Target: ${dailyDurationMinutes} minutes per day.
Target Skill Level: ${skillLevel}.
User Memory / Preferences: ${memoryNotes || 'None specified'}.

STRICT MANDATORY RULES:
1. You MUST generate EXACTLY ${durationDays} distinct lessons, with sequential dayNumber from 1 to ${durationDays}.
2. Lessons must progress logically from fundamentals to intermediate practice to advanced mastery.
3. Every lesson must contain:
   - dayNumber: integer (1 to ${durationDays})
   - title: concise descriptive topic
   - durationMinutes: integer (~${dailyDurationMinutes})
   - objectives: array of 2-3 specific learning milestones
   - steps: array of 2-4 concrete step-by-step instructions
   - resources: array of 1-2 curated learning resources, documentation or reference tools
   - assignment: 1 practical, hands-on task to reinforce today's concept
   - completionCriteria: clear objective benchmark to verify mastery
4. Avoid duplicate lessons, generic filler, or unrealistic workloads.`;

    const response = await generateWithFallback({
      contents: `Create a complete ${durationDays}-day learning roadmap for: "${prompt}". Daily duration: ${dailyDurationMinutes} minutes. Skill level: ${skillLevel}. Preferred time: ${preferredTime}. Ensure all ${durationDays} lessons are populated sequentially.`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Title of the roadmap' },
            description: { type: Type.STRING, description: 'Comprehensive roadmap summary' },
            durationDays: { type: Type.INTEGER, description: 'Total number of days' },
            dailyDurationMinutes: { type: Type.INTEGER, description: 'Daily study duration in minutes' },
            skillLevel: { type: Type.STRING, description: 'Skill level: beginner, intermediate, advanced, or all-levels' },
            preferredTime: { type: Type.STRING, description: 'Recommended daily study time' },
            lessons: {
              type: Type.ARRAY,
              description: 'Array of lessons, one for each day',
              items: {
                type: Type.OBJECT,
                properties: {
                  dayNumber: { type: Type.INTEGER, description: 'Day number (1..N)' },
                  title: { type: Type.STRING, description: 'Lesson title' },
                  durationMinutes: { type: Type.INTEGER, description: 'Estimated study duration' },
                  objectives: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Key learning goals for this day',
                  },
                  steps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Detailed study and practice steps',
                  },
                  resources: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Recommended guides or reference links',
                  },
                  assignment: { type: Type.STRING, description: 'Hands-on practical exercise' },
                  completionCriteria: { type: Type.STRING, description: 'Check criteria to mark done' },
                },
                required: ['dayNumber', 'title', 'durationMinutes', 'objectives', 'steps', 'assignment', 'completionCriteria'],
              },
            },
          },
          required: ['title', 'description', 'durationDays', 'dailyDurationMinutes', 'skillLevel', 'lessons'],
        },
      },
    });

    const rawJson = (response.text || '{}').trim();
    let roadmap: any;
    try {
      roadmap = JSON.parse(rawJson);
    } catch (parseErr) {
      console.error('Failed to parse JSON response:', rawJson);
      throw new Error('AI output was not valid JSON.');
    }

    // Validation & self-healing: Ensure lessons are sequential and populated up to durationDays
    if (!Array.isArray(roadmap.lessons) || roadmap.lessons.length === 0) {
      throw new Error('Generated roadmap does not contain any lessons.');
    }

    // Ensure day numbers are sequential 1..N
    roadmap.durationDays = durationDays;
    roadmap.dailyDurationMinutes = dailyDurationMinutes;
    roadmap.skillLevel = skillLevel;
    roadmap.preferredTime = preferredTime;

    // If model truncated or returned fewer days, pad or ensure sequential day numbering
    if (roadmap.lessons.length < durationDays) {
      const existingCount = roadmap.lessons.length;
      console.warn(`Roadmap generated ${existingCount} lessons; padding to ${durationDays}`);
      for (let day = existingCount + 1; day <= durationDays; day++) {
        const baseLesson = roadmap.lessons[(day - 1) % existingCount];
        roadmap.lessons.push({
          dayNumber: day,
          title: `Day ${day}: Advanced Application & Project Consolidation ${day - existingCount}`,
          durationMinutes: dailyDurationMinutes,
          objectives: [`Consolidate previous techniques from Day ${day - 1}`, 'Complete hands-on application challenge'],
          steps: ['Review feedback and mistakes from earlier assignments', 'Implement capstone project module'],
          resources: baseLesson.resources || ['https://daypilot.ai/resources'],
          assignment: `Produce portfolio project asset for milestone day ${day}.`,
          completionCriteria: 'Pass self-check against benchmark criteria.',
        });
      }
    }

    // Normalize day numbers
    roadmap.lessons = roadmap.lessons.slice(0, durationDays).map((l: any, idx: number) => ({
      ...l,
      dayNumber: idx + 1,
      durationMinutes: l.durationMinutes || dailyDurationMinutes,
      objectives: Array.isArray(l.objectives) && l.objectives.length > 0 ? l.objectives : ['Learn core concept'],
      steps: Array.isArray(l.steps) && l.steps.length > 0 ? l.steps : ['Read material', 'Practice exercise'],
      resources: Array.isArray(l.resources) ? l.resources : ['https://daypilot.ai/guides'],
      assignment: l.assignment || 'Complete practical exercise for this day.',
      completionCriteria: l.completionCriteria || 'Complete assignment and review results.',
    }));

    res.json({ roadmap });
  } catch (error) {
    handleApiError(res, error, 'generate-roadmap');
  }
});

// 2b. PARSE ROADMAP ENDPOINT: Parses ChatGPT/Markdown/JSON/Table curricula into structured roadmaps
app.post('/api/ai/parse-roadmap', async (req, res) => {
  try {
    const { rawContent, userPreferences } = req.body;

    if (!rawContent || typeof rawContent !== 'string' || rawContent.trim().length === 0) {
      res.status(400).json({ error: 'Roadmap content is required.' });
      return;
    }

    const preferredStart = userPreferences?.preferredStartDate || new Date().toISOString().split('T')[0];
    const preferredTime = userPreferences?.preferredStartTime || '19:00';
    const fallbackDuration = Number(userPreferences?.dailyDurationMinutes) || 60;

    const systemInstruction = `You are an elite curriculum engineer and roadmap parsing engine for DayPilot AI.
Your objective is to ingest learning programmes copied from ChatGPT, Claude, DeepSeek, Notion, or web roadmaps, and extract a complete, pristine, structured learning roadmap.

SUPPORTED INPUT FORMATS:
- Plain conversational text (e.g. "I want to become a professional photo editor. Create a 30-day programme with one hour of daily practice...")
- Markdown formats (headers #, ##, bolding, numbered items)
- Structured JSON (raw or wrapped in codeblocks)
- Numbered daily schedules (Day 1, Day 2, ..., Day 30)
- Tables (Markdown tables, CSV, tab-delimited)
- Bullet-point roadmaps

CRITICAL EXTRACTION REQUIREMENTS:
1. Title: Create an inspiring, professional title (e.g. "Professional Photo Editing Mastery")
2. Description: 1-2 sentence overview capturing the core progression and tools
3. Duration Days: Calculate or extract the exact total number of days/sessions. If the user mentions 30 days, ensure 30 days are produced.
4. Daily Duration Minutes: Integer minutes per daily session (default to ${fallbackDuration} if unspecified)
5. Skill Level: "beginner", "intermediate", "advanced", or "all-levels"
6. Preferred Time: Extract any mentioned study time, or default to "${preferredTime}" (e.g., 7:00 PM / 19:00)
7. Learning Phases: Extract distinct phases/milestones (e.g., Phase 1: Photopea Fundamentals, Phase 2: Lightroom Color Grading, Phase 3: Photoshop Advanced Retouching)
8. Lessons: Must output every single lesson in sequential order (dayNumber 1..N):
   - dayNumber: integer (1..N)
   - title: concise, descriptive topic title
   - phase: name of the phase this lesson belongs to
   - durationMinutes: integer (~${fallbackDuration})
   - objectives: array of 2-3 specific learning milestones
   - steps: array of 2-4 concrete step-by-step instructions
   - resources: array of tools, tutorial links, or documentation (e.g., ["Photopea web app", "Lightroom Mobile/Desktop", "Adobe Photoshop guides"])
   - assignment: 1 practical hands-on task to reinforce today's concept
   - completionCriteria: objective verification criteria to mark lesson complete
9. Missing Information: Note any key missing elements in an array (e.g., "Start date was not specified in the text; defaulted to ${preferredStart}").
10. Duplicate Lessons: List any duplicated lessons or topics found in the original source text.

STRICT PRESERVATION RULES:
- Preserve the original meaning, tools, sequence, and curriculum logic.
- Do not silently remove lesson information.
- If the user specifies 30 days, you MUST generate all 30 days sequentially.
- If tools like Photopea, Lightroom, and Photoshop are specified in order, structure the lessons following that exact progression.`;

    const response = await generateWithFallback({
      contents: `Parse and extract a complete structured learning roadmap from the following content:\n\n${rawContent}\n\nDefault Start Date: ${preferredStart}, Preferred Time: ${preferredTime}, Target Duration: ${fallbackDuration}m/day.`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            durationDays: { type: Type.INTEGER },
            dailyDurationMinutes: { type: Type.INTEGER },
            skillLevel: { type: Type.STRING },
            preferredTime: { type: Type.STRING },
            learningPhases: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  phaseNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  startDay: { type: Type.INTEGER },
                  endDay: { type: Type.INTEGER },
                  focus: { type: Type.STRING },
                },
                required: ['phaseNumber', 'title', 'startDay', 'endDay', 'focus'],
              },
            },
            lessons: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dayNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  phase: { type: Type.STRING },
                  durationMinutes: { type: Type.INTEGER },
                  objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
                  steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                  resources: { type: Type.ARRAY, items: { type: Type.STRING } },
                  assignment: { type: Type.STRING },
                  completionCriteria: { type: Type.STRING },
                },
                required: ['dayNumber', 'title', 'durationMinutes', 'objectives', 'steps', 'assignment', 'completionCriteria'],
              },
            },
            missingInfo: { type: Type.ARRAY, items: { type: Type.STRING } },
            detectedDuplicates: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['title', 'description', 'durationDays', 'dailyDurationMinutes', 'skillLevel', 'lessons'],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    
    // Ensure lessons are sequential 1..N and populated up to durationDays
    const expectedDays = Math.max(parsedData.durationDays || 30, (parsedData.lessons || []).length);
    parsedData.durationDays = expectedDays;
    parsedData.dailyDurationMinutes = parsedData.dailyDurationMinutes || fallbackDuration;
    parsedData.preferredTime = parsedData.preferredTime || preferredTime;
    parsedData.startDate = preferredStart;

    // Self-healing: if model returned fewer lessons than durationDays, pad logically
    if (Array.isArray(parsedData.lessons) && parsedData.lessons.length < expectedDays) {
      const curCount = parsedData.lessons.length;
      for (let d = curCount + 1; d <= expectedDays; d++) {
        const lastLesson = parsedData.lessons[curCount - 1] || {};
        parsedData.lessons.push({
          dayNumber: d,
          title: `Day ${d}: Advanced Mastery & Portfolio Project Phase ${d - curCount}`,
          phase: lastLesson.phase || 'Mastery',
          durationMinutes: parsedData.dailyDurationMinutes,
          objectives: ['Reinforce key concepts from earlier days', 'Complete comprehensive hands-on exercise'],
          steps: ['Review earlier technique guides', 'Execute full creative project workflow'],
          resources: lastLesson.resources || ['https://daypilot.ai/resources'],
          assignment: `Develop production-ready portfolio submission for Day ${d}.`,
          completionCriteria: 'Verify project against visual benchmark.',
        });
      }
    }

    res.json({ roadmap: parsedData });
  } catch (error) {
    handleApiError(res, error, 'parse-roadmap');
  }
});

// 3. REGENERATE LESSON ENDPOINT: Regenerates a single day's lesson
app.post('/api/gemini/regenerate-lesson', async (req, res) => {
  try {
    const { roadmapTitle, dayNumber, currentLesson, instructions } = req.body;

    const response = await generateWithFallback({
      contents: `For the roadmap "${roadmapTitle}", regenerate Day ${dayNumber}. Current lesson title is "${currentLesson?.title}". User instructions: "${instructions || 'Make it more hands-on and practical'}".`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dayNumber: { type: Type.INTEGER },
            title: { type: Type.STRING },
            durationMinutes: { type: Type.INTEGER },
            objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
            steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            resources: { type: Type.ARRAY, items: { type: Type.STRING } },
            assignment: { type: Type.STRING },
            completionCriteria: { type: Type.STRING },
          },
          required: ['dayNumber', 'title', 'durationMinutes', 'objectives', 'steps', 'assignment', 'completionCriteria'],
        },
      },
    });

    const updatedLesson = JSON.parse(response.text || '{}');
    updatedLesson.dayNumber = dayNumber;
    res.json({ updatedLesson });
  } catch (error) {
    handleApiError(res, error, 'regenerate-lesson');
  }
});

// 4. SCHEDULE REDESIGN ENDPOINT: Intelligently rearranges missed and remaining lessons
app.post('/api/gemini/redesign-schedule', async (req, res) => {
  try {
    const { planTitle, missedTasks, remainingTasks, constraints } = req.body;

    const systemInstruction = `You are the master schedule recovery strategist for DayPilot AI.
The user has fallen behind on their learning roadmap "${planTitle}".
Analyze the missed lessons and remaining schedule, then produce an optimized, realistic reallocation.
STRICT RULES:
1. Never silently change dates without clear rationale.
2. Maintain realistic daily study durations (do not overload the user with more than 90m per day).
3. If keeping the original deadline is preferred, add light buffer blocks or utilize weekends.
4. Output strict JSON with actionable date and time recommendations.`;

    const contents = `Redesign schedule for plan: "${planTitle}".
Missed lessons: ${JSON.stringify(missedTasks || [])}.
Remaining lessons to complete: ${JSON.stringify((remainingTasks || []).slice(0, 15))}.
User constraints & preferences: ${JSON.stringify(constraints || {})}.
Produce a realistic catch-up plan.`;

    const response = await generateWithFallback({
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: 'High-level recovery strategy explanation' },
            impactOnDeadline: { type: Type.STRING, description: 'Explanation of whether deadline shifts or is maintained' },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  proposedDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
                  proposedStartTime: { type: Type.STRING, description: 'HH:mm (24h)' },
                  proposedEndTime: { type: Type.STRING, description: 'HH:mm (24h)' },
                  rationale: { type: Type.STRING, description: 'Why this new slot was chosen' },
                },
                required: ['taskId', 'title', 'proposedDate', 'proposedStartTime', 'proposedEndTime', 'rationale'],
              },
            },
          },
          required: ['summary', 'impactOnDeadline', 'recommendations'],
        },
      },
    });

    const redesignData = JSON.parse(response.text || '{}');
    res.json(redesignData);
  } catch (error) {
    handleApiError(res, error, 'redesign-schedule');
  }
});

// 5. SMART WORKLOAD ADVISOR ENDPOINT: Analyzes concurrent roadmaps and commitments
app.post('/api/gemini/workload-advice', async (req, res) => {
  try {
    const { activePlans, todayTasks, preferredStudyTime } = req.body;

    const systemInstruction = `You are DayPilot AI's cognitive workload balance advisor.
Evaluate the user's active roadmaps and scheduled tasks to ensure realistic daily pacing.
Never automatically move existing commitments without permission.
Provide helpful rebalancing advice if total daily study time exceeds 2.5 hours or if sessions conflict.`;

    const contents = `Evaluate daily workload for:
Active roadmaps: ${JSON.stringify(activePlans || [])}
Today scheduled tasks: ${JSON.stringify(todayTasks || [])}
Preferred study time: ${preferredStudyTime || 'evening'}`;

    const response = await generateWithFallback({
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, description: 'balanced, heavy, or excessive' },
            totalDailyMinutes: { type: Type.INTEGER },
            analysis: { type: Type.STRING, description: 'Evaluation of current schedule pacing' },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  planTitle: { type: Type.STRING },
                  currentSchedule: { type: Type.STRING },
                  suggestedAdjustment: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                },
                required: ['planTitle', 'suggestedAdjustment', 'reasoning'],
              },
            },
          },
          required: ['status', 'totalDailyMinutes', 'analysis', 'recommendations'],
        },
      },
    });

    const advice = JSON.parse(response.text || '{}');
    res.json(advice);
  } catch (error) {
    handleApiError(res, error, 'workload-advice');
  }
});

// ==========================================
// PHASE 4: PUSH NOTIFICATIONS & REMINDER API
// ==========================================

// Register or refresh device token
app.post('/api/devices/register', (req, res) => {
  try {
    const { id, userId, fcmToken, browser, platform, deviceName, enabled } = req.body;
    if (!id || !userId || !fcmToken) {
      res.status(400).json({ error: 'Device id, userId, and fcmToken are required.' });
      return;
    }

    const device = registerDeviceRecord({
      id,
      userId,
      fcmToken,
      browser: browser || 'Unknown',
      platform: platform || 'Unknown',
      deviceName: deviceName || `${platform} ${browser}`,
      enabled: enabled ?? true,
      createdAt: req.body.createdAt || new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    });

    res.json({ success: true, device });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Remove registered device
app.delete('/api/devices/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const { userId } = req.body || req.query;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const removed = removeDeviceRecord(String(userId), deviceId);
    res.json({ success: true, removed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List user's registered devices
app.get('/api/devices', (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      res.status(400).json({ error: 'userId query parameter is required' });
      return;
    }

    const devices = getUserDevices(String(userId));
    res.json({ devices });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List scheduled reminders for user
app.get('/api/reminders', (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      res.status(400).json({ error: 'userId query parameter is required' });
      return;
    }

    const reminders = getUserReminders(String(userId));
    res.json({ reminders });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Schedule a reminder
app.post('/api/reminders', (req, res) => {
  try {
    const reminder = req.body;
    if (!reminder.id || !reminder.userId || !reminder.title) {
      res.status(400).json({ error: 'Missing required reminder fields' });
      return;
    }

    const scheduled = addScheduledReminder({
      ...reminder,
      status: reminder.status || 'pending',
      createdAt: reminder.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true, reminder: scheduled });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel a reminder
app.delete('/api/reminders/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const cancelled = cancelReminder(id, reason || 'User cancelled');
    res.json({ success: true, reminder: cancelled });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel reminders for task
app.post('/api/reminders/cancel-task', (req, res) => {
  try {
    const { taskId, reason } = req.body;
    if (!taskId) {
      res.status(400).json({ error: 'taskId is required' });
      return;
    }
    const cancelledCount = cancelRemindersForTask(taskId, reason || 'Task cancelled');
    res.json({ success: true, cancelledCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel reminders for plan
app.post('/api/reminders/cancel-plan', (req, res) => {
  try {
    const { planId, reason } = req.body;
    if (!planId) {
      res.status(400).json({ error: 'planId is required' });
      return;
    }
    const cancelledCount = cancelRemindersForPlan(planId, reason || 'Plan paused or deleted');
    res.json({ success: true, cancelledCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Send an immediate test Web Push notification to user devices
app.post('/api/reminders/send-test', async (req, res) => {
  try {
    const { userId, title, message } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const notifTitle = title || 'DayPilot AI — Test Notification';
    const notifMessage = message || 'Your cross-device reminder system is active and ready!';

    const result = await sendFCMToUserDevices(userId, notifTitle, notifMessage, {
      url: '/#reminders',
      isTest: 'true',
    });

    res.json({
      success: result.success,
      deliveredDevicesCount: result.deliveredDevicesCount,
      errors: result.errors,
      devicesCount: getUserDevices(userId).length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get VAPID public key (from environment if configured, or empty)
app.get('/api/fcm/vapid-key', (req, res) => {
  const vapidKey = process.env.VAPID_PUBLIC_KEY || '';
  res.json({ vapidKey });
});

// Vite Middleware for Full-Stack SPA Dev
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  const PORT = 3000;

  // Start background reminder scheduler worker
  startReminderWorker(25000);

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DayPilot AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
