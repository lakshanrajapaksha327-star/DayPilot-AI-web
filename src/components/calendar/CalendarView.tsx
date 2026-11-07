import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Check,
  CheckCircle2,
  CalendarDays,
  CalendarRange,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { CalendarViewMode, Task } from '../../types/index.ts';
import { calculateEndTime } from '../../utils/schedulingEngine.ts';

interface CalendarViewProps {
  onOpenQuickTask: (defaultDate?: string) => void;
  onEditTask: (task: Task) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  onOpenQuickTask,
  onEditTask,
}) => {
  const { userProfile } = useAuth();
  const { tasks, conflicts, toggleTaskCompleted } = useData();

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Month navigation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (viewMode === 'week') {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(currentDate.getDate() - 7);
      setCurrentDate(prevWeek);
    } else {
      const prevDay = new Date(currentDate);
      prevDay.setDate(currentDate.getDate() - 1);
      setCurrentDate(prevDay);
      setSelectedDateStr(prevDay.toISOString().split('T')[0]);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (viewMode === 'week') {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(currentDate.getDate() + 7);
      setCurrentDate(nextWeek);
    } else {
      const nextDay = new Date(currentDate);
      nextDay.setDate(currentDate.getDate() + 1);
      setCurrentDate(nextDay);
      setSelectedDateStr(nextDay.toISOString().split('T')[0]);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  // Month grid calculation
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const monthGrid: { dayNumber: number; dateStr: string; isCurrentMonth: boolean }[] = [];

  // Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const d = new Date(year, month - 1, day);
    monthGrid.push({
      dayNumber: day,
      dateStr: d.toISOString().split('T')[0],
      isCurrentMonth: false,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    monthGrid.push({
      dayNumber: day,
      dateStr: d.toISOString().split('T')[0],
      isCurrentMonth: true,
    });
  }

  // Trailing next month days to fill 35 or 42 grid cells
  const remaining = (7 - (monthGrid.length % 7)) % 7;
  for (let day = 1; day <= remaining; day++) {
    const d = new Date(year, month + 1, day);
    monthGrid.push({
      dayNumber: day,
      dateStr: d.toISOString().split('T')[0],
      isCurrentMonth: false,
    });
  }

  // Week days
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return {
      date: d,
      dateStr: d.toISOString().split('T')[0],
      dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
      dayNumber: d.getDate(),
    };
  });

  const selectedDateTasks = tasks.filter((t) => t.date === selectedDateStr);

  const priorityBadge: Record<Task['priority'], string> = {
    low: 'bg-slate-800 text-slate-300 border-slate-700',
    medium: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    high: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    urgent: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <CalendarIcon className="w-6 h-6 text-cyan-400" />
              <span>{monthName}</span>
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{userProfile?.timeZone || 'Asia/Colombo'}</span>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visual productivity schedule, timeblocks, and task timeline
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View mode toggle */}
          <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'month' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'week' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'day' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Day
            </button>
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleToday}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={handlePrev}
              aria-label="Previous period"
              className="p-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              aria-label="Next period"
              className="p-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => onOpenQuickTask(selectedDateStr)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add to Date</span>
          </button>
        </div>
      </div>

      {/* VIEW: MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Month Grid (3 cols) */}
          <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md p-4 overflow-hidden shadow-xl">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 pb-3 border-b border-slate-800">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1.5 mt-2">
              {monthGrid.map((item, idx) => {
                const dayTasks = tasks.filter((t) => t.date === item.dateStr);
                const isSelected = selectedDateStr === item.dateStr;
                const isToday = item.dateStr === new Date().toISOString().split('T')[0];

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDateStr(item.dateStr)}
                    className={`min-h-[78px] sm:min-h-[96px] p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-950/40 border-cyan-400 shadow-sm ring-1 ring-cyan-500/30'
                        : item.isCurrentMonth
                        ? 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-950 hover:border-slate-700'
                        : 'bg-slate-950/20 border-slate-800/30 opacity-40 hover:opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                          isToday
                            ? 'bg-cyan-500 text-slate-950 font-black'
                            : isSelected
                            ? 'text-cyan-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {item.dayNumber}
                      </span>
                      {dayTasks.length > 0 && (
                        <span className="text-[10px] font-semibold text-slate-400">
                          {dayTasks.filter((t) => t.completed).length}/{dayTasks.length}
                        </span>
                      )}
                    </div>

                    {/* Task Pills preview */}
                    <div className="space-y-1 mt-1 overflow-hidden">
                      {dayTasks.slice(0, 2).map((t) => (
                        <div
                          key={t.id}
                          className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium ${
                            t.completed
                              ? 'bg-emerald-500/10 text-emerald-300 line-through opacity-70'
                              : 'bg-blue-500/20 text-cyan-200 border border-blue-500/30'
                          }`}
                        >
                          {t.title}
                        </div>
                      ))}
                      {dayTasks.length > 2 && (
                        <div className="text-[9px] text-slate-400 pl-1 font-semibold">
                          +{dayTasks.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Selected Date Task Details (1 col) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <div>
                  <h3 className="font-bold text-sm text-white">Date Details</h3>
                  <p className="text-xs text-cyan-400 font-semibold">{selectedDateStr}</p>
                </div>
                <button
                  onClick={() => onOpenQuickTask(selectedDateStr)}
                  className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors cursor-pointer"
                  title="Add task to this date"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {selectedDateTasks.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No tasks scheduled for {selectedDateStr}.</p>
                  <button
                    onClick={() => onOpenQuickTask(selectedDateStr)}
                    className="mt-3 text-cyan-400 hover:underline font-semibold"
                  >
                    + Schedule a task
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {selectedDateTasks.map((t) => {
                    const isConflicted = conflicts.some((c) => c.taskAId === t.id || c.taskBId === t.id);
                    const endTime = t.endTime || (t.startTime ? calculateEndTime(t.startTime, t.durationMinutes) : null);

                    return (
                      <div
                        key={t.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isConflicted
                            ? 'border-amber-500/50 bg-amber-950/15'
                            : t.completed
                            ? 'border-slate-800 bg-slate-950/40 opacity-70'
                            : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <button
                              onClick={() => toggleTaskCompleted(t.id)}
                              className={`w-4 h-4 rounded mt-0.5 border flex items-center justify-center shrink-0 cursor-pointer ${
                                t.completed
                                  ? 'bg-cyan-500 border-cyan-500 text-slate-950'
                                  : 'border-slate-600'
                              }`}
                            >
                              {t.completed && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  onClick={() => onEditTask(t)}
                                  className={`text-xs font-semibold cursor-pointer hover:text-cyan-300 transition-colors ${
                                    t.completed ? 'line-through text-slate-400' : 'text-white'
                                  }`}
                                >
                                  {t.title}
                                </span>
                                {t.planId && (
                                  <span className="text-[9px] font-semibold px-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                                    Roadmap
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                                {t.startTime && (
                                  <span className="text-cyan-300 font-medium">
                                    {t.startTime}{endTime ? ` – ${endTime}` : ''}
                                  </span>
                                )}
                                <span>•</span>
                                <span>{t.durationMinutes}m</span>
                                <span>•</span>
                                <span>{t.category}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {isConflicted && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/20 text-amber-300 flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Conflict
                              </span>
                            )}
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                                priorityBadge[t.priority]
                              }`}
                            >
                              {t.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 text-center">
              Click any task title to edit notes or schedule.
            </div>
          </div>
        </div>
      )}

      {/* VIEW: WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
          {weekDays.map((col) => {
            const colTasks = tasks.filter((t) => t.date === col.dateStr);
            const isToday = col.dateStr === new Date().toISOString().split('T')[0];

            return (
              <div
                key={col.dateStr}
                className={`rounded-2xl border p-4 flex flex-col justify-between min-h-[400px] transition-all ${
                  isToday
                    ? 'border-cyan-500/50 bg-gradient-to-b from-blue-950/30 to-slate-900/90 shadow-md shadow-cyan-500/10'
                    : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {col.dayName}
                      </div>
                      <div className={`text-base font-extrabold ${isToday ? 'text-cyan-300' : 'text-white'}`}>
                        {col.dayNumber}
                      </div>
                    </div>
                    <button
                      onClick={() => onOpenQuickTask(col.dateStr)}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                      title="Add task"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {colTasks.length === 0 ? (
                      <div className="text-[11px] text-slate-500 italic py-4 text-center">
                        Free day
                      </div>
                    ) : (
                      colTasks.map((t) => {
                        const isConflicted = conflicts.some((c) => c.taskAId === t.id || c.taskBId === t.id);
                        const endTime = t.endTime || (t.startTime ? calculateEndTime(t.startTime, t.durationMinutes) : null);

                        return (
                          <div
                            key={t.id}
                            className={`p-2.5 rounded-xl border text-xs transition-all ${
                              isConflicted
                                ? 'bg-amber-950/20 border-amber-500/40'
                                : t.completed
                                ? 'bg-slate-950/40 border-slate-800 opacity-60'
                                : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <span
                                onClick={() => onEditTask(t)}
                                className={`font-medium line-clamp-2 cursor-pointer hover:text-cyan-300 ${
                                  t.completed ? 'line-through text-slate-400' : 'text-slate-100'
                                }`}
                              >
                                {t.title}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                              <span className="text-cyan-300">
                                {t.startTime ? `${t.startTime}${endTime ? `-${endTime}` : ''}` : `${t.durationMinutes}m`}
                              </span>
                              {isConflicted && (
                                <span title="Overlapping conflict">
                                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onOpenQuickTask(col.dateStr)}
                  className="w-full mt-3 py-1.5 rounded-lg border border-dashed border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  + Add item
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW: DAILY TIMELINE VIEW */}
      {viewMode === 'day' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md p-6 max-w-4xl mx-auto shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Day Timeline Schedule</h2>
              <p className="text-xs text-cyan-400 font-semibold">{selectedDateStr}</p>
            </div>
            <button
              onClick={() => onOpenQuickTask(selectedDateStr)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </div>

          <div className="space-y-4">
            {selectedDateTasks.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No tasks scheduled for this day yet.
              </div>
            ) : (
              selectedDateTasks
                .sort((a, b) => (a.startTime || '23:59').localeCompare(b.startTime || '23:59'))
                .map((task) => {
                  const isConflicted = conflicts.some((c) => c.taskAId === task.id || c.taskBId === task.id);
                  const endTime = task.endTime || (task.startTime ? calculateEndTime(task.startTime, task.durationMinutes) : null);

                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                        isConflicted
                          ? 'border-amber-500/50 bg-amber-950/15'
                          : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-24 shrink-0 text-center">
                        <span className="text-xs font-bold text-cyan-400">
                          {task.startTime || '--:--'}
                          {endTime && ` - ${endTime}`}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">{task.durationMinutes} mins</div>
                      </div>

                      <div className="w-0.5 h-12 bg-slate-800 self-stretch shrink-0" />

                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h4
                              onClick={() => onEditTask(task)}
                              className={`text-sm font-semibold cursor-pointer hover:text-cyan-300 ${
                                task.completed ? 'line-through text-slate-400' : 'text-white'
                              }`}
                            >
                              {task.title}
                            </h4>
                            {isConflicted && (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/20 text-amber-300">
                                <AlertTriangle className="w-3 h-3" />
                                Overlap Conflict
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                              priorityBadge[task.priority]
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>
                        {task.notes && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{task.notes}</p>
                        )}
                      </div>

                      <button
                        onClick={() => toggleTaskCompleted(task.id)}
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          task.completed
                            ? 'bg-cyan-500 border-cyan-500 text-slate-950'
                            : 'border-slate-700 hover:border-cyan-400 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
