import React, { useState } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit3,
  Calendar,
  Clock,
  Check,
  Tag,
  AlertCircle,
  AlertTriangle,
  MoreVertical,
  BookOpen,
  FastForward,
  SkipForward,
} from 'lucide-react';
import { useData } from '../../context/DataContext.tsx';
import { Task, PriorityLevel, TaskCategory } from '../../types/index.ts';
import { MissedSessionCard } from '../common/MissedSessionCard.tsx';
import { calculateEndTime } from '../../utils/schedulingEngine.ts';

interface TasksViewProps {
  onOpenCreateTask: () => void;
  onEditTask: (task: Task) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  onOpenCreateTask,
  onEditTask,
}) => {
  const {
    tasks,
    plans,
    missedTasks,
    conflicts,
    createTask,
    deleteTask,
    toggleTaskCompleted,
    skipLesson,
    rescheduleSession,
  } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'missed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | PriorityLevel>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TaskCategory>('all');

  // Inline Quick Add Bar State
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState<PriorityLevel>('medium');
  const [quickCategory, setQuickCategory] = useState<TaskCategory>('Study');
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    try {
      setIsQuickAdding(true);
      const todayStr = new Date().toISOString().split('T')[0];
      await createTask({
        title: quickTitle.trim(),
        priority: quickPriority,
        category: quickCategory,
        date: todayStr,
        startTime: '10:00',
        durationMinutes: 45,
        completed: false,
      });
      setQuickTitle('');
    } catch (err) {
      console.error('Quick add failed:', err);
    } finally {
      setIsQuickAdding(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = t.title.toLowerCase().includes(q);
      const matchesNotes = t.notes?.toLowerCase().includes(q);
      if (!matchesTitle && !matchesNotes) return false;
    }

    // Status
    if (statusFilter === 'pending' && t.completed) return false;
    if (statusFilter === 'completed' && !t.completed) return false;
    if (statusFilter === 'missed' && !t.isMissed && !missedTasks.some((m) => m.id === t.id)) return false;

    // Priority
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

    // Category
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;

    return true;
  });

  const priorityColors: Record<PriorityLevel, { bg: string; text: string; border: string }> = {
    low: { bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-700' },
    medium: { bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/30' },
    high: { bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/30' },
    urgent: { bg: 'bg-rose-500/10', text: 'text-rose-300', border: 'border-rose-500/30' },
  };

  const categories: TaskCategory[] = ['Study', 'Work', 'Personal', 'Project', 'Health', 'General'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-cyan-400" />
            <span>Task Manager</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Create, schedule, prioritize and track learning tasks & actionable items
          </p>
        </div>

        <button
          onClick={onOpenCreateTask}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Detailed Task</span>
        </button>
      </div>

      {/* Missed Task Management Alert */}
      <MissedSessionCard missedTasks={missedTasks} />

      {/* Inline Quick Add Bar */}
      <form
        onSubmit={handleQuickAdd}
        className="flex flex-col sm:flex-row items-center gap-2 p-2 rounded-2xl border border-slate-800 bg-slate-900/90 shadow-lg"
      >
        <div className="flex-1 flex items-center gap-2 px-3 w-full">
          <Plus className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Quick add a task (e.g., Read documentation on state machines)..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none py-1.5"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end px-2 pb-1 sm:pb-0">
          <select
            value={quickCategory}
            onChange={(e) => setQuickCategory(e.target.value as TaskCategory)}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={quickPriority}
            onChange={(e) => setQuickPriority(e.target.value as PriorityLevel)}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <button
            type="submit"
            disabled={!quickTitle.trim() || isQuickAdding}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {isQuickAdding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </form>

      {/* Filters and Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-800 bg-slate-900/60">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks by title or notes..."
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'pending', 'completed', 'missed'] as const).map((st) => {
            const count =
              st === 'all'
                ? tasks.length
                : st === 'pending'
                ? tasks.filter((t) => !t.completed).length
                : st === 'completed'
                ? tasks.filter((t) => t.completed).length
                : missedTasks.length;

            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === st
                    ? st === 'missed'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{st}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      statusFilter === st
                        ? 'bg-white/20 text-white font-bold'
                        : st === 'missed'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Priority filter dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'all' | PriorityLevel)}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          {/* Category filter dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | TaskCategory)}
            className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8">
          <CheckSquare className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No tasks matching your filter</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Try adjusting your search query or create a new task to get things done.
          </p>
          <button
            onClick={onOpenCreateTask}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-sm"
          >
            Add New Task
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task) => {
            const pStyle = priorityColors[task.priority];
            const linkedPlan = task.planId ? plans.find((p) => p.id === task.planId) : null;
            const isConflicted = conflicts.some(
              (c) => c.taskAId === task.id || c.taskBId === task.id
            );
            const isMissed = task.isMissed || missedTasks.some((m) => m.id === task.id);
            const endTime =
              task.endTime ||
              (task.startTime ? calculateEndTime(task.startTime, task.durationMinutes) : null);

            return (
              <div
                key={task.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isConflicted
                    ? 'border-amber-500/50 bg-amber-950/15'
                    : isMissed
                    ? 'border-rose-500/40 bg-rose-950/15'
                    : task.completed
                    ? 'border-slate-800/60 bg-slate-950/40 opacity-75'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700 shadow-sm'
                }`}
              >
                {/* Checkbox and Title */}
                <div className="flex items-start gap-3.5 flex-1">
                  <button
                    onClick={() => toggleTaskCompleted(task.id)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer mt-0.5 shrink-0 ${
                      task.completed
                        ? 'bg-cyan-500 border-cyan-500 text-slate-950 shadow-xs'
                        : 'border-slate-600 hover:border-cyan-400'
                    }`}
                  >
                    {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </button>

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        onClick={() => onEditTask(task)}
                        className={`text-sm font-semibold cursor-pointer hover:text-cyan-300 transition-colors ${
                          task.completed ? 'line-through text-slate-400' : 'text-white'
                        }`}
                      >
                        {task.title}
                      </span>

                      {linkedPlan && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-700 bg-slate-950 text-slate-300 flex items-center gap-1"
                          style={{ borderColor: `${linkedPlan.color}40` }}
                        >
                          <BookOpen className="w-2.5 h-2.5" style={{ color: linkedPlan.color }} />
                          <span className="truncate max-w-[120px]">{linkedPlan.title}</span>
                        </span>
                      )}

                      {isMissed && !task.completed && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-rose-500/40 bg-rose-500/20 text-rose-300 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Missed
                        </span>
                      )}

                      {isConflicted && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/20 text-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Conflict
                        </span>
                      )}
                    </div>

                    {task.notes && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{task.notes}</p>
                    )}

                    {/* Metadata tags */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-cyan-400" />
                        <span>{task.date}</span>
                      </span>
                      {task.startTime && (
                        <span className="flex items-center gap-1 text-cyan-300 font-medium">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          <span>
                            {task.startTime}
                            {endTime && ` – ${endTime}`}
                          </span>
                        </span>
                      )}
                      <span>•</span>
                      <span>{task.durationMinutes} mins</span>
                      <span>•</span>
                      <span className="text-slate-400">{task.category}</span>
                    </div>
                  </div>
                </div>

                {/* Priority & Actions */}
                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                  {isMissed && !task.completed && (
                    <div className="flex items-center gap-1.5 mr-1">
                      <button
                        onClick={() => skipLesson(task.id)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Skip this missed lesson"
                      >
                        <SkipForward className="w-3 h-3 text-amber-400" />
                        <span>Skip</span>
                      </button>
                      <button
                        onClick={() => onEditTask(task)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-600/20 hover:bg-blue-600/30 text-cyan-300 border border-blue-500/40 flex items-center gap-1 transition-colors cursor-pointer"
                        title="Reschedule session"
                      >
                        <Calendar className="w-3 h-3 text-cyan-400" />
                        <span>Reschedule</span>
                      </button>
                    </div>
                  )}

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}
                  >
                    {task.priority}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditTask(task)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit task"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
