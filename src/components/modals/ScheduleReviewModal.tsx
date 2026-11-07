import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  X,
  Sliders,
  Sparkles,
  ArrowRight,
  Info,
  CalendarCheck,
  Check,
  Globe,
} from 'lucide-react';
import { GeneratedRoadmap, ScheduleGenerationOptions, Task } from '../../types/index.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import {
  generateScheduleDates,
  detectTaskConflicts,
  calculateDailyWorkload,
  findConflictFreeSlots,
  calculateEndTime,
} from '../../utils/schedulingEngine.ts';

interface ScheduleReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  roadmap: GeneratedRoadmap;
  onConfirmSchedule: (options: ScheduleGenerationOptions) => Promise<void>;
}

export const ScheduleReviewModal: React.FC<ScheduleReviewModalProps> = ({
  isOpen,
  onClose,
  roadmap,
  onConfirmSchedule,
}) => {
  const { userProfile } = useAuth();
  const { tasks } = useData();

  const userTz = userProfile?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Colombo';
  const todayStr = new Date().toISOString().split('T')[0];

  // Schedule Options state
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekdays' | 'custom_days'>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [preferredTime, setPreferredTime] = useState<string>(roadmap.preferredTime || '19:00');
  const [dailyDurationMinutes, setDailyDurationMinutes] = useState<number>(roadmap.dailyDurationMinutes || 60);
  const [multipleSessionsPerDay, setMultipleSessionsPerDay] = useState<boolean>(false);
  const [secondaryTime, setSecondaryTime] = useState<string>('09:00');
  const [allowOverlaps, setAllowOverlaps] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [resolvedConflictSlot, setResolvedConflictSlot] = useState<string | null>(null);

  // Compute calculated schedule preview
  const scheduledSlots = useMemo(() => {
    return generateScheduleDates({
      planTitle: roadmap.title,
      startDate,
      durationDays: roadmap.durationDays || roadmap.lessons.length || 30,
      dailyDurationMinutes,
      preferredTime: resolvedConflictSlot || preferredTime,
      secondaryTime,
      multipleSessionsPerDay,
      scheduleType,
      selectedDays,
      timeZone: userTz,
      allowOverlaps,
    });
  }, [
    roadmap,
    startDate,
    dailyDurationMinutes,
    preferredTime,
    resolvedConflictSlot,
    secondaryTime,
    multipleSessionsPerDay,
    scheduleType,
    selectedDays,
    userTz,
    allowOverlaps,
  ]);

  const calculatedEndDate = scheduledSlots.length > 0 ? scheduledSlots[scheduledSlots.length - 1].date : startDate;
  const totalSessions = scheduledSlots.length;

  // Detect conflicts against existing tasks in DB
  const detectedConflicts = useMemo(() => {
    const list: { slotDate: string; taskTitle: string; conflictingTitle: string; overlapMins: number }[] = [];
    for (const slot of scheduledSlots) {
      const c = detectTaskConflicts(
        {
          date: slot.date,
          startTime: slot.startTime,
          durationMinutes: dailyDurationMinutes,
          title: `Day ${slot.dayNumber}`,
        },
        tasks
      );
      if (c.length > 0) {
        list.push({
          slotDate: slot.date,
          taskTitle: `Day ${slot.dayNumber}: ${roadmap.lessons[slot.dayNumber - 1]?.title || 'Lesson'}`,
          conflictingTitle: c[0].conflictingTaskTitle,
          overlapMins: c[0].overlapMinutes,
        });
      }
    }
    return list;
  }, [scheduledSlots, tasks, dailyDurationMinutes, roadmap.lessons]);

  // Suggested conflict-free slots on conflict dates
  const freeSlots = useMemo(() => {
    if (detectedConflicts.length === 0) return [];
    return findConflictFreeSlots(
      detectedConflicts[0].slotDate,
      dailyDurationMinutes,
      tasks,
      preferredTime
    );
  }, [detectedConflicts, dailyDurationMinutes, tasks, preferredTime]);

  // Calculate workloads
  const dailyWorkloadHours = Math.round((dailyDurationMinutes / 60) * 10) / 10;
  const sessionsPerWeek = scheduleType === 'daily' ? (multipleSessionsPerDay ? 14 : 7) : (scheduleType === 'weekdays' ? 5 : selectedDays.length);
  const weeklyWorkloadHours = Math.round(((sessionsPerWeek * dailyDurationMinutes) / 60) * 10) / 10;

  const handleToggleDay = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex)
        ? (prev.length > 1 ? prev.filter((d) => d !== dayIndex) : prev)
        : [...prev, dayIndex].sort()
    );
  };

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirmSchedule({
        planTitle: roadmap.title,
        startDate,
        durationDays: roadmap.durationDays || roadmap.lessons.length || 30,
        dailyDurationMinutes,
        preferredTime: resolvedConflictSlot || preferredTime,
        secondaryTime,
        multipleSessionsPerDay,
        scheduleType,
        selectedDays,
        timeZone: userTz,
        allowOverlaps,
      });
      onClose();
    } catch (err) {
      console.error('Error confirming schedule:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-3xl my-8 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Step 2 of 2: Schedule Review
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  {userTz}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white leading-tight">
                Schedule Engine: {roadmap.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-200">
          {/* Key Metrics Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-xs text-slate-400 block mb-1">Total Sessions</span>
              <span className="text-xl font-bold text-white">{totalSessions}</span>
              <span className="text-xs text-cyan-400 block mt-0.5">Automated Lessons</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-xs text-slate-400 block mb-1">Time Horizon</span>
              <span className="text-sm font-semibold text-white truncate block">{startDate}</span>
              <span className="text-xs text-slate-400 block truncate">to {calculatedEndDate}</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-xs text-slate-400 block mb-1">Daily Workload</span>
              <span className="text-xl font-bold text-white">{dailyDurationMinutes}m</span>
              <span className="text-xs text-emerald-400 block mt-0.5">{dailyWorkloadHours}h / session</span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="text-xs text-slate-400 block mb-1">Weekly Commitment</span>
              <span className="text-xl font-bold text-white">{weeklyWorkloadHours}h</span>
              <span className="text-xs text-purple-400 block mt-0.5">{sessionsPerWeek} sessions/wk</span>
            </div>
          </div>

          {/* Conflict Warning & Resolution Box */}
          {detectedConflicts.length > 0 && !allowOverlaps && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="font-semibold text-amber-300">
                    {detectedConflicts.length} Scheduling Conflict{detectedConflicts.length > 1 ? 's' : ''} Detected
                  </div>
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    "{detectedConflicts[0].taskTitle}" overlaps with existing task{' '}
                    <span className="font-medium text-white">"{detectedConflicts[0].conflictingTitle}"</span> on{' '}
                    {detectedConflicts[0].slotDate} at {preferredTime}.
                  </p>

                  {/* 1-Click Conflict-Free Slot Resolution */}
                  {freeSlots.length > 0 && (
                    <div className="pt-1">
                      <span className="text-xs text-slate-300 block mb-1.5 font-medium">
                        Recommended Conflict-Free Slots:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {freeSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              setResolvedConflictSlot(slot);
                              setPreferredTime(slot);
                            }}
                            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                              resolvedConflictSlot === slot || preferredTime === slot
                                ? 'bg-cyan-500 text-white shadow-sm'
                                : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                            }`}
                          >
                            Use {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-1 flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="allowOverlapCheck"
                      checked={allowOverlaps}
                      onChange={(e) => setAllowOverlaps(e.target.checked)}
                      className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 bg-slate-800"
                    />
                    <label htmlFor="allowOverlapCheck" className="text-xs text-slate-300 cursor-pointer">
                      I understand and explicitly approve overlapping sessions for these dates
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Schedule Engine Controls */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-4">
            <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              Schedule Cadence & Time Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Start Date */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Preferred Time */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Daily Study Time</label>
                <input
                  type="time"
                  value={preferredTime}
                  onChange={(e) => {
                    setPreferredTime(e.target.value);
                    setResolvedConflictSlot(null);
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Duration Minutes */}
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-medium">Duration (minutes)</label>
                <input
                  type="number"
                  min="15"
                  max="180"
                  step="5"
                  value={dailyDurationMinutes}
                  onChange={(e) => setDailyDurationMinutes(parseInt(e.target.value, 10) || 60)}
                  className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Repetition Pattern Selector */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5 font-medium">Repetition Pattern</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleType('daily')}
                  className={`py-2 px-3 text-xs rounded-lg font-medium border text-center transition-all ${
                    scheduleType === 'daily'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Daily (All 7 Days)
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType('weekdays')}
                  className={`py-2 px-3 text-xs rounded-lg font-medium border text-center transition-all ${
                    scheduleType === 'weekdays'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Weekdays Only (Mon-Fri)
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType('custom_days')}
                  className={`py-2 px-3 text-xs rounded-lg font-medium border text-center transition-all ${
                    scheduleType === 'custom_days'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Custom Selected Days
                </button>
              </div>
            </div>

            {/* Custom Days Picker */}
            {scheduleType === 'custom_days' && (
              <div className="pt-2">
                <span className="text-xs text-slate-400 block mb-1.5">Select Active Study Days:</span>
                <div className="flex gap-1.5 sm:gap-2">
                  {dayLabels.map((label, idx) => {
                    const isSelected = selectedDays.includes(idx);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleToggleDay(idx)}
                        className={`flex-1 py-1.5 text-xs rounded-md font-medium border transition-colors ${
                          isSelected
                            ? 'bg-cyan-500 text-white border-cyan-400'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Multiple Daily Sessions Option */}
            <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="multiSessionCheck"
                  checked={multipleSessionsPerDay}
                  onChange={(e) => setMultipleSessionsPerDay(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 bg-slate-800"
                />
                <label htmlFor="multiSessionCheck" className="text-xs text-slate-300 cursor-pointer">
                  Split into Multiple Daily Sessions (e.g., Morning + Evening blocks)
                </label>
              </div>

              {multipleSessionsPerDay && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">Secondary Time:</span>
                  <input
                    type="time"
                    value={secondaryTime}
                    onChange={(e) => setSecondaryTime(e.target.value)}
                    className="px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded-md text-white"
                  />
                </div>
              )}
            </div>
          </div>

          {/* First 5 Sessions Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Initial Calendar Slots Preview
              </span>
              <span className="text-xs text-slate-400">
                Calculated end date:{' '}
                <strong className="text-white">{calculatedEndDate}</strong>
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {scheduledSlots.slice(0, 6).map((slot) => {
                const lesson = roadmap.lessons[slot.dayNumber - 1];
                return (
                  <div
                    key={`${slot.dayNumber}-${slot.sessionIndex}`}
                    className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                        {slot.dayNumber}
                      </span>
                      <span className="font-medium text-white truncate max-w-xs sm:max-w-md">
                        {lesson?.title || `Day ${slot.dayNumber} Lesson`}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3 text-slate-400 shrink-0">
                      <span>{slot.date}</span>
                      <span className="text-cyan-400 font-mono">
                        {slot.startTime} – {slot.endTime}
                      </span>
                    </div>
                  </div>
                );
              })}
              {scheduledSlots.length > 6 && (
                <div className="text-center py-1 text-xs text-slate-400 italic">
                  + {scheduledSlots.length - 6} additional sequential lessons scheduled...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {detectedConflicts.length > 0 && !allowOverlaps ? (
              <span className="text-amber-400 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> Please resolve conflicts or check approval above
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle className="w-3.5 h-3.5" /> All {totalSessions} sessions verified conflict-free
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Back to Lesson Editor
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || (detectedConflicts.length > 0 && !allowOverlaps)}
              className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <span>Generating Schedule...</span>
              ) : (
                <>
                  <span>Confirm & Generate Schedule</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
