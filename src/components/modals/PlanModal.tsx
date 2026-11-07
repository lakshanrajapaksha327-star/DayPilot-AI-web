import React, { useState, useEffect } from 'react';
import {
  X,
  Compass,
  Calendar,
  Clock,
  Target,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useData } from '../../context/DataContext.tsx';
import { Plan, SkillLevel, PlanObjective } from '../../types/index.ts';

interface PlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  planToEdit?: Plan | null;
}

export const PlanModal: React.FC<PlanModalProps> = ({ isOpen, onClose, planToEdit }) => {
  const { createPlan, updatePlan } = useData();

  const todayStr = new Date().toISOString().split('T')[0];
  const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [dailyStudyMinutes, setDailyStudyMinutes] = useState(60);
  const [preferredTime, setPreferredTime] = useState('evening');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('intermediate');
  const [color, setColor] = useState('#3B82F6');
  const [objectives, setObjectives] = useState<PlanObjective[]>([
    { id: 'obj-init-1', text: '', completed: false },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (planToEdit) {
      setTitle(planToEdit.title);
      setDescription(planToEdit.description);
      setStartDate(planToEdit.startDate);
      setEndDate(planToEdit.endDate);
      setDurationWeeks(planToEdit.durationWeeks);
      setDailyStudyMinutes(planToEdit.dailyStudyMinutes);
      setPreferredTime(planToEdit.preferredTime);
      setSkillLevel(planToEdit.skillLevel);
      setColor(planToEdit.color || '#3B82F6');
      setObjectives(
        planToEdit.objectives?.length > 0
          ? planToEdit.objectives
          : [{ id: 'obj-1', text: '', completed: false }]
      );
    } else {
      setTitle('');
      setDescription('');
      setStartDate(todayStr);
      setEndDate(defaultEnd);
      setDurationWeeks(4);
      setDailyStudyMinutes(60);
      setPreferredTime('evening');
      setSkillLevel('intermediate');
      setColor('#3B82F6');
      setObjectives([
        { id: 'obj-1', text: 'Define curriculum milestones and resources', completed: false },
        { id: 'obj-2', text: 'Build hands-on practice projects', completed: false },
      ]);
    }
    setError(null);
  }, [planToEdit, isOpen, todayStr, defaultEnd]);

  if (!isOpen) return null;

  const handleAddObjective = () => {
    setObjectives((prev) => [
      ...prev,
      { id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, text: '', completed: false },
    ]);
  };

  const handleRemoveObjective = (index: number) => {
    if (objectives.length <= 1) return;
    setObjectives((prev) => prev.filter((_, i) => i !== index));
  };

  const handleObjectiveTextChange = (index: number, text: string) => {
    setObjectives((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], text };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Plan title is required.');
      return;
    }

    const filteredObjectives = objectives
      .filter((o) => o.text.trim().length > 0)
      .map((o) => ({ ...o, text: o.text.trim() }));

    if (filteredObjectives.length === 0) {
      setError('Please add at least one learning objective.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (planToEdit) {
        await updatePlan(planToEdit.id, {
          title: title.trim(),
          description: description.trim(),
          startDate,
          endDate,
          durationWeeks: Number(durationWeeks),
          dailyStudyMinutes: Number(dailyStudyMinutes),
          preferredTime,
          skillLevel,
          color,
          objectives: filteredObjectives,
        });
      } else {
        await createPlan({
          title: title.trim(),
          description: description.trim(),
          startDate,
          endDate,
          durationWeeks: Number(durationWeeks),
          dailyStudyMinutes: Number(dailyStudyMinutes),
          preferredTime,
          skillLevel,
          color,
          status: 'active',
          objectives: filteredObjectives,
        });
      }

      onClose();
    } catch (err: unknown) {
      console.error('Failed to save plan:', err);
      setError(err instanceof Error ? err.message : 'Failed to save plan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const colorOptions = [
    { label: 'Blue', hex: '#3B82F6' },
    { label: 'Cyan', hex: '#06B6D4' },
    { label: 'Purple', hex: '#8B5CF6' },
    { label: 'Emerald', hex: '#10B981' },
    { label: 'Amber', hex: '#F59E0B' },
    { label: 'Rose', hex: '#F43F5E' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-cyan-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {planToEdit ? 'Edit Learning Plan' : 'Create AI Study Roadmap'}
              </h2>
              <p className="text-xs text-slate-400">
                Structure your milestones, daily pace and objectives
              </p>
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
          <div className="mt-4 p-3 rounded-xl text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Roadmap Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Machine Learning & Deep Neural Networks"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-950/80 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Overview & Target Outcome
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What specific skills or milestones will you acquire by completing this roadmap?"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
            />
          </div>

          {/* Grid: Dates & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Start Date</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>End Date</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Duration (Weeks)</span>
              </label>
              <input
                type="number"
                min={1}
                max={52}
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Grid: Daily pace, preferred time, skill level */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Daily Study Time
              </label>
              <select
                value={dailyStudyMinutes}
                onChange={(e) => setDailyStudyMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value={20}>20 mins / day</option>
                <option value={30}>30 mins / day</option>
                <option value={45}>45 mins / day</option>
                <option value={60}>1 hour / day</option>
                <option value={90}>1.5 hours / day</option>
                <option value={120}>2 hours / day</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Preferred Time
              </label>
              <select
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="morning">Morning (06:00 - 10:00)</option>
                <option value="afternoon">Afternoon (12:00 - 16:00)</option>
                <option value="evening">Evening (17:00 - 21:00)</option>
                <option value="night">Night (21:00 - 01:00)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Skill Level
              </label>
              <select
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value as SkillLevel)}
                className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="all-levels">All Levels</option>
              </select>
            </div>
          </div>

          {/* Color theme */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Accent Color
            </label>
            <div className="flex items-center gap-2">
              {colorOptions.map((c) => (
                <button
                  type="button"
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  className={`w-7 h-7 rounded-full transition-transform cursor-pointer border-2 ${
                    color === c.hex ? 'scale-125 border-white shadow-md' : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Objectives builder */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                <span>Learning Objectives & Key Milestones</span>
              </label>
              <button
                type="button"
                onClick={handleAddObjective}
                className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Milestone
              </button>
            </div>

            <div className="space-y-2">
              {objectives.map((obj, idx) => (
                <div key={obj.id || idx} className="flex items-center gap-2">
                  <span className="w-5 text-center text-xs text-slate-400 font-bold shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    required
                    value={obj.text}
                    onChange={(e) => handleObjectiveTextChange(idx, e.target.value)}
                    placeholder={`Milestone ${idx + 1} objective...`}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950/80 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                  {objectives.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveObjective(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
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
              <span>{isSubmitting ? 'Saving...' : planToEdit ? 'Update Plan' : 'Save Roadmap'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
