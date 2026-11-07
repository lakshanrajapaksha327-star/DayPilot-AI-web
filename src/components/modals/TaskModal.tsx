import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Flag,
  Tag,
  BookOpen,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { useData } from '../../context/DataContext.tsx';
import { Task, PriorityLevel, TaskCategory } from '../../types/index.ts';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  defaultDate?: string;
  defaultPlanId?: string;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  defaultDate,
  defaultPlanId,
}) => {
  const { createTask, updateTask, plans } = useData();

  const todayStr = new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [category, setCategory] = useState<TaskCategory>('Study');
  const [planId, setPlanId] = useState<string>('');
  const [date, setDate] = useState(defaultDate || todayStr);
  const [startTime, setStartTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setNotes(taskToEdit.notes || '');
      setPriority(taskToEdit.priority);
      setCategory(taskToEdit.category);
      setPlanId(taskToEdit.planId || '');
      setDate(taskToEdit.date);
      setStartTime(taskToEdit.startTime || '10:00');
      setDurationMinutes(taskToEdit.durationMinutes || 45);
    } else {
      setTitle('');
      setNotes('');
      setPriority('medium');
      setCategory('Study');
      setPlanId(defaultPlanId || '');
      setDate(defaultDate || todayStr);
      setStartTime('10:00');
      setDurationMinutes(45);
    }
    setError(null);
  }, [taskToEdit, isOpen, defaultDate, defaultPlanId, todayStr]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Task title is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (taskToEdit) {
        await updateTask(taskToEdit.id, {
          title: title.trim(),
          notes: notes.trim(),
          priority,
          category,
          planId: planId || undefined,
          date,
          startTime: startTime || undefined,
          durationMinutes: Number(durationMinutes),
        });
      } else {
        await createTask({
          title: title.trim(),
          notes: notes.trim(),
          priority,
          category,
          planId: planId || undefined,
          date,
          startTime: startTime || undefined,
          durationMinutes: Number(durationMinutes),
          completed: false,
        });
      }

      onClose();
    } catch (err: unknown) {
      console.error('Failed to save task:', err);
      setError(err instanceof Error ? err.message : 'Failed to save task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorityOptions: { value: PriorityLevel; label: string; color: string }[] = [
    { value: 'low', label: 'Low', color: 'border-slate-700 text-slate-300 hover:border-slate-500' },
    { value: 'medium', label: 'Medium', color: 'border-blue-500/40 text-blue-300 hover:border-blue-500' },
    { value: 'high', label: 'High', color: 'border-amber-500/40 text-amber-300 hover:border-amber-500' },
    { value: 'urgent', label: 'Urgent', color: 'border-rose-500/40 text-rose-300 hover:border-rose-500' },
  ];

  const categoryOptions: TaskCategory[] = ['Study', 'Work', 'Personal', 'Project', 'Health', 'General'];

  const durationOptions = [15, 30, 45, 60, 90, 120];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white">
              {taskToEdit ? 'Edit Task' : 'Create New Task'}
            </h2>
            <p className="text-xs text-slate-400">
              {taskToEdit ? 'Update details, schedule or linked study plan' : 'Add an actionable item to your productivity schedule'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Title input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Master React Concurrency & Hooks"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950/80 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 text-sm transition-all"
            />
          </div>

          {/* Priority selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5 text-slate-400" />
              <span>Priority</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {priorityOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setPriority(opt.value)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                    priority === opt.value
                      ? 'bg-blue-600/30 border-cyan-400 text-cyan-200 font-bold shadow-xs'
                      : `bg-slate-950/50 ${opt.color}`
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span>Category</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categoryOptions.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    category === cat
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                      : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Scheduled Date</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Start Time</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Duration Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Target Duration: {durationMinutes} mins</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {durationOptions.map((mins) => (
                <button
                  type="button"
                  key={mins}
                  onClick={() => setDurationMinutes(mins)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    durationMinutes === mins
                      ? 'bg-blue-600 border-blue-400 text-white font-bold'
                      : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          {/* Linked Learning Plan */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
              <span>Link to Learning Plan (Optional)</span>
            </label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              <option value="">No linked plan (Standalone Task)</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.status})
                </option>
              ))}
            </select>
          </div>

          {/* Notes / Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Notes & Objectives</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add key bullet points, references or instructions..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 hover:from-blue-500 hover:to-cyan-500 transition-all shadow-md shadow-cyan-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : taskToEdit ? 'Update Task' : 'Create Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
