import React, { useState } from 'react';
import {
  X,
  Compass,
  Calendar,
  Clock,
  Target,
  CheckCircle,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  BookOpen,
  ArrowRight,
  AlertCircle,
  Check,
} from 'lucide-react';
import { GeneratedRoadmap, RoadmapLesson, ScheduleGenerationOptions } from '../../types/index.ts';
import { ScheduleReviewModal } from './ScheduleReviewModal.tsx';

interface RoadmapPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  roadmap: GeneratedRoadmap | null;
  onApprove: (approvedRoadmap: GeneratedRoadmap, options?: ScheduleGenerationOptions) => Promise<void>;
  onReject: () => void;
}

export const RoadmapPreviewModal: React.FC<RoadmapPreviewModalProps> = ({
  isOpen,
  onClose,
  roadmap: initialRoadmap,
  onApprove,
  onReject,
}) => {
  if (!isOpen || !initialRoadmap) return null;

  const [roadmap, setRoadmap] = useState<GeneratedRoadmap>(initialRoadmap);
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Edit Lesson state
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState(60);
  const [editObjectives, setEditObjectives] = useState('');
  const [editSteps, setEditSteps] = useState('');
  const [editAssignment, setEditAssignment] = useState('');
  const [editCriteria, setEditCriteria] = useState('');
  const [editResources, setEditResources] = useState('');

  // Regeneration state
  const [regeneratingDay, setRegeneratingDay] = useState<number | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEditing = (lesson: RoadmapLesson) => {
    setEditingDay(lesson.dayNumber);
    setEditTitle(lesson.title);
    setEditDuration(lesson.durationMinutes);
    setEditObjectives(lesson.objectives.join('\n'));
    setEditSteps(lesson.steps.join('\n'));
    setEditAssignment(lesson.assignment);
    setEditCriteria(lesson.completionCriteria);
    setEditResources(lesson.resources.join('\n'));
  };

  const saveEditedLesson = () => {
    if (editingDay === null) return;
    setRoadmap((prev) => {
      const updatedLessons = prev.lessons.map((l) => {
        if (l.dayNumber === editingDay) {
          return {
            ...l,
            title: editTitle.trim() || l.title,
            durationMinutes: Number(editDuration) || l.durationMinutes,
            objectives: editObjectives.split('\n').map((s) => s.trim()).filter(Boolean),
            steps: editSteps.split('\n').map((s) => s.trim()).filter(Boolean),
            assignment: editAssignment.trim() || l.assignment,
            completionCriteria: editCriteria.trim() || l.completionCriteria,
            resources: editResources.split('\n').map((s) => s.trim()).filter(Boolean),
          };
        }
        return l;
      });
      return { ...prev, lessons: updatedLessons };
    });
    setEditingDay(null);
  };

  const handleRegenerateLesson = async (dayNumber: number) => {
    const target = roadmap.lessons.find((l) => l.dayNumber === dayNumber);
    if (!target) return;

    try {
      setRegeneratingDay(dayNumber);
      setError(null);
      const res = await fetch('/api/gemini/regenerate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmapTitle: roadmap.title,
          dayNumber,
          currentLesson: target,
          instructions: 'Make it more comprehensive, hands-on, and engaging.',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to regenerate lesson.');
      }

      const data = await res.json();
      if (data.updatedLesson) {
        setRoadmap((prev) => ({
          ...prev,
          lessons: prev.lessons.map((l) => (l.dayNumber === dayNumber ? data.updatedLesson : l)),
        }));
      }
    } catch (err: unknown) {
      console.error('Regenerate error:', err);
      setError(err instanceof Error ? err.message : 'Regeneration failed.');
    } finally {
      setRegeneratingDay(null);
    }
  };

  const handleRemoveLesson = (dayNumber: number) => {
    if (roadmap.lessons.length <= 1) {
      alert('A roadmap must have at least one lesson.');
      return;
    }
    setRoadmap((prev) => {
      const remaining = prev.lessons.filter((l) => l.dayNumber !== dayNumber);
      // Re-index days sequentially 1..N
      const reindexed = remaining.map((l, idx) => ({ ...l, dayNumber: idx + 1 }));
      return {
        ...prev,
        durationDays: reindexed.length,
        lessons: reindexed,
      };
    });
  };

  const handleAddLesson = () => {
    setRoadmap((prev) => {
      const newDay = prev.lessons.length + 1;
      const newLesson: RoadmapLesson = {
        dayNumber: newDay,
        title: `Day ${newDay}: Advanced Project & Milestone Review`,
        durationMinutes: prev.dailyDurationMinutes || 60,
        objectives: ['Consolidate learned techniques', 'Produce capstone deliverable'],
        steps: ['Review past days challenges', 'Implement solution independently'],
        resources: ['https://daypilot.ai/resources'],
        assignment: `Build independent mini-project for day ${newDay}.`,
        completionCriteria: 'Verify all project requirements are met.',
      };
      return {
        ...prev,
        durationDays: newDay,
        lessons: [...prev.lessons, newLesson],
      };
    });
    setExpandedDay(roadmap.lessons.length + 1);
  };

  const handleApprove = async () => {
    try {
      setIsApproving(true);
      setError(null);
      await onApprove(roadmap);
      onClose();
    } catch (err: unknown) {
      console.error('Approval failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve and save roadmap.');
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  AI Generated Roadmap Preview
                </span>
                <span className="text-[10px] font-semibold text-slate-400 capitalize">
                  {roadmap.skillLevel}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">{roadmap.title}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 shrink-0">
            {error}
          </div>
        )}

        {/* Roadmap Overview & Controls Bar */}
        <div className="py-3 px-4 my-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 text-slate-300">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                <strong className="text-white">{roadmap.lessons.length}</strong> Days Total
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>
                <strong className="text-white">{roadmap.dailyDurationMinutes}</strong>m / day
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Preferred: <strong className="text-white">{roadmap.preferredTime || '19:00'}</strong>
              </span>
            </div>
          </div>

          <button
            onClick={handleAddLesson}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-cyan-300 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Extra Day</span>
          </button>
        </div>

        {/* Scrollable Lessons List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {roadmap.lessons.map((lesson) => {
            const isExpanded = expandedDay === lesson.dayNumber;
            const isEditing = editingDay === lesson.dayNumber;
            const isRegenerating = regeneratingDay === lesson.dayNumber;

            return (
              <div
                key={lesson.dayNumber}
                className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden transition-all hover:border-slate-700"
              >
                {/* Lesson Header Row */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div
                    onClick={() => setExpandedDay(isExpanded ? null : lesson.dayNumber)}
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                  >
                    <span className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-cyan-300 shrink-0">
                      {lesson.dayNumber}
                    </span>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-white">{lesson.title}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        <span>{lesson.durationMinutes} mins</span>
                        <span>•</span>
                        <span>{lesson.objectives?.length || 0} objectives</span>
                        <span>•</span>
                        <span className="text-cyan-400">Practical Assignment included</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for this day */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleRegenerateLesson(lesson.dayNumber)}
                      disabled={isRegenerating}
                      title="AI Regenerate this lesson"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-cyan-400' : ''}`} />
                    </button>
                    <button
                      onClick={() => (isEditing ? setEditingDay(null) : startEditing(lesson))}
                      title="Edit lesson details"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                    </button>
                    <button
                      onClick={() => handleRemoveLesson(lesson.dayNumber)}
                      title="Remove lesson"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setExpandedDay(isExpanded ? null : lesson.dayNumber)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Inline Lesson Editor */}
                {isEditing && (
                  <div className="p-4 border-t border-slate-800 bg-slate-900/90 space-y-3 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Edit2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Editing Day {lesson.dayNumber} Lesson</span>
                      </span>
                      <span className="text-[11px] text-slate-400">Save changes below</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Title</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Duration (mins)</label>
                        <input
                          type="number"
                          value={editDuration}
                          onChange={(e) => setEditDuration(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Objectives (one per line)</label>
                      <textarea
                        rows={2}
                        value={editObjectives}
                        onChange={(e) => setEditObjectives(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Practical Assignment</label>
                      <textarea
                        rows={2}
                        value={editAssignment}
                        onChange={(e) => setEditAssignment(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Completion Benchmark</label>
                      <input
                        type="text"
                        value={editCriteria}
                        onChange={(e) => setEditCriteria(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingDay(null)}
                        className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveEditedLesson}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Lesson</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Expanded Lesson Details */}
                {isExpanded && !isEditing && (
                  <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3 text-xs">
                    {/* Objectives */}
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block mb-1">
                        Learning Objectives
                      </span>
                      <ul className="space-y-1 list-disc list-inside text-slate-300">
                        {lesson.objectives?.map((obj, i) => (
                          <li key={i}>{obj}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Steps */}
                    {lesson.steps?.length > 0 && (
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 block mb-1">
                          Step-by-Step Study Guide
                        </span>
                        <div className="space-y-1">
                          {lesson.steps.map((st, i) => (
                            <div key={i} className="flex items-start gap-2 text-slate-300">
                              <span className="text-slate-500 font-mono text-[10px]">{i + 1}.</span>
                              <span>{st}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assignment */}
                    {lesson.assignment && (
                      <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-900/40">
                        <span className="text-[11px] font-bold text-cyan-300 block mb-0.5">
                          Practical Assignment:
                        </span>
                        <p className="text-slate-200">{lesson.assignment}</p>
                      </div>
                    )}

                    {/* Completion Criteria */}
                    {lesson.completionCriteria && (
                      <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-900/30">
                        <span className="text-[11px] font-bold text-emerald-300 block mb-0.5">
                          Completion Criteria:
                        </span>
                        <p className="text-slate-200">{lesson.completionCriteria}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions: Approve / Reject */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-800 shrink-0 mt-3">
          <p className="text-xs text-slate-400">
            Approving this roadmap will create the study plan and schedule all{' '}
            <strong className="text-white">{roadmap.lessons.length} daily lessons</strong> into your calendar.
          </p>

          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={() => {
                onReject();
                onClose();
              }}
              disabled={isApproving}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Reject / Discard
            </button>
            <button
              type="button"
              onClick={() => setIsReviewOpen(true)}
              disabled={isApproving}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4" />
              <span>Review Cadence & Conflicts</span>
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isApproving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-500 hover:to-cyan-500 transition-all shadow-md shadow-cyan-500/25 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isApproving ? 'Saving & Scheduling...' : 'Approve & Create Schedule'}</span>
            </button>
          </div>
        </div>

        {/* Schedule Review & Conflict Modal */}
        {isReviewOpen && (
          <ScheduleReviewModal
            isOpen={isReviewOpen}
            onClose={() => setIsReviewOpen(false)}
            roadmap={roadmap}
            onConfirmSchedule={async (options) => {
              setIsReviewOpen(false);
              await onApprove(roadmap, options);
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
};
