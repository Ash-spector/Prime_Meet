import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Filter,
  GripVertical,
  MessageSquare,
  Paperclip,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  AssignmentMode,
  EnrichedTask,
  Priority,
  TaskStatus,
  User,
} from '../shared/types.ts';

interface KanbanBoardProps {
  tasks: EnrichedTask[];
  users: User[];
  onMoveTask: (task: EnrichedTask, targetStatus: TaskStatus) => Promise<void>;
  onSelectTask: (task: EnrichedTask) => void;
  onOpenCreateTask: (defaultStatus?: TaskStatus) => void;
}

const COLUMNS: Array<{
  status: TaskStatus;
  title: string;
  dotColor: string;
  headerAccent: string;
}> = [
  {
    status: TaskStatus.TODO,
    title: 'To Do',
    dotColor: 'bg-slate-400',
    headerAccent: 'border-t-slate-400',
  },
  {
    status: TaskStatus.IN_PROGRESS,
    title: 'In Progress',
    dotColor: 'bg-[#6366F1]',
    headerAccent: 'border-t-[#6366F1]',
  },
  {
    status: TaskStatus.IN_REVIEW,
    title: 'In Review',
    dotColor: 'bg-[#F59E0B]',
    headerAccent: 'border-t-[#F59E0B]',
  },
  {
    status: TaskStatus.DONE,
    title: 'Done',
    dotColor: 'bg-[#10B981]',
    headerAccent: 'border-t-[#10B981]',
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  users,
  onMoveTask,
  onSelectTask,
  onOpenCreateTask,
}) => {
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [labelFilter, setLabelFilter] = useState<string>('ALL');
  const [dueFilter, setDueFilter] = useState<string>('ALL');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const allLabels = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t) => t.labels.forEach((l) => s.add(l)));
    return Array.from(s);
  }, [tasks]);

  const nowMs = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endOfTodayMs = endOfToday.getTime();
  const sevenDaysMs = nowMs + 7 * 24 * 60 * 60 * 1000;

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matches =
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.projectName && t.projectName.toLowerCase().includes(q)) ||
          t.labels.some((l) => l.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) {
        return false;
      }
      if (assigneeFilter !== 'ALL') {
        if (assigneeFilter === 'UNASSIGNED' && t.assigneeId !== null) return false;
        if (assigneeFilter !== 'UNASSIGNED' && t.assigneeId !== assigneeFilter)
          return false;
      }
      if (labelFilter !== 'ALL' && !t.labels.includes(labelFilter)) {
        return false;
      }
      if (dueFilter !== 'ALL') {
        const dueMs = new Date(t.dueDate).getTime();
        if (dueFilter === 'OVERDUE' && !(t.status !== TaskStatus.DONE && dueMs < nowMs)) {
          return false;
        }
        if (dueFilter === 'TODAY' && !(dueMs >= nowMs - 86400000 && dueMs <= endOfTodayMs)) {
          return false;
        }
        if (dueFilter === 'THIS_WEEK' && !(dueMs >= nowMs && dueMs <= sevenDaysMs)) {
          return false;
        }
      }
      return true;
    });
  }, [
    tasks,
    search,
    priorityFilter,
    assigneeFilter,
    labelFilter,
    dueFilter,
    nowMs,
    endOfTodayMs,
    sevenDaysMs,
  ]);

  const hasActiveFilters =
    search.trim() !== '' ||
    priorityFilter !== 'ALL' ||
    assigneeFilter !== 'ALL' ||
    labelFilter !== 'ALL' ||
    dueFilter !== 'ALL';

  const clearFilters = () => {
    setSearch('');
    setPriorityFilter('ALL');
    setAssigneeFilter('ALL');
    setLabelFilter('ALL');
    setDueFilter('ALL');
  };

  const handleDragStart = (e: React.DragEvent, task: EnrichedTask) => {
    setDraggedTaskId(task.id);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);
    setDragOverColumn(null);

    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    await onMoveTask(task, targetStatus);
  };

  const priorityColor = (p: Priority) => {
    switch (p) {
      case Priority.URGENT:
        return 'text-[#EF4444] font-bold';
      case Priority.HIGH:
        return 'text-[#F59E0B] font-semibold';
      case Priority.MEDIUM:
        return 'text-[#6366F1] font-medium';
      default:
        return 'text-slate-500 dark:text-slate-400';
    }
  };

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="card-3d rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter board by task title, label, or keyword..."
            className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          <select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value={Priority.URGENT}>Urgent</option>
            <option value={Priority.HIGH}>High</option>
            <option value={Priority.MEDIUM}>Medium</option>
            <option value={Priority.LOW}>Low</option>
          </select>

          <select
            aria-label="Filter by assignee"
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">All Assignees</option>
            <option value="UNASSIGNED">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} [{u.uniqueCode}]
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by label"
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">All Labels</option>
            {allLabels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by due date"
            value={dueFilter}
            onChange={(e) => setDueFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Any Due Date</option>
            <option value="OVERDUE">Overdue Only</option>
            <option value="TODAY">Due Today</option>
            <option value="THIS_WEEK">Due This Week</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Column Horizontal Scroll / Grid Kanban Board */}
      <div className="flex lg:grid lg:grid-cols-4 gap-4 overflow-x-auto pb-4 snap-x">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks
            .filter((t) => t.status === col.status)
            .sort((a, b) => a.position - b.position);
          const isDropTarget = dragOverColumn === col.status;

          return (
            <div
              key={col.status}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(e) => handleDrop(e, col.status)}
              className={`min-w-[290px] sm:min-w-[310px] lg:min-w-0 flex-1 rounded-2xl border-t-4 ${col.headerAccent} bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-3.5 flex flex-col justify-between transition-all snap-start ${
                isDropTarget
                  ? 'ring-2 ring-[#6366F1] bg-indigo-50/50 dark:bg-indigo-950/30'
                  : ''
              }`}
            >
              <div>
                {/* Column Header */}
                <div className="flex items-center justify-between px-1 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      {col.title}
                    </h3>
                    <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      ({colTasks.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenCreateTask(col.status)}
                    title={`Add task to ${col.title}`}
                    className="p-1 rounded-lg text-slate-500 hover:text-[#6366F1] hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Column Cards */}
                <div className="space-y-3 min-h-[260px]">
                  {colTasks.length === 0 ? (
                    <div className="h-44 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center p-4 text-center">
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Drop tasks here or click + to add
                      </p>
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const isOverdue =
                        task.status !== TaskStatus.DONE &&
                        new Date(task.dueDate).getTime() < nowMs;
                      const nextStatus =
                        col.status === TaskStatus.TODO
                          ? TaskStatus.IN_PROGRESS
                          : col.status === TaskStatus.IN_PROGRESS
                          ? TaskStatus.IN_REVIEW
                          : col.status === TaskStatus.IN_REVIEW
                          ? TaskStatus.DONE
                          : null;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task)}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDragOverColumn(null);
                          }}
                          onClick={() => onSelectTask(task)}
                          className={`card-3d card-3d-interactive rounded-xl p-4 cursor-grab active:cursor-grabbing space-y-3 ${
                            draggedTaskId === task.id ? 'opacity-50 scale-95' : ''
                          }`}
                        >
                          {/* Top Meta Line */}
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 truncate">
                              <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                              <span className={priorityColor(task.priority)}>
                                {task.priority}
                              </span>
                              {task.projectName && (
                                <>
                                  <span>·</span>
                                  <span className="truncate">{task.projectName}</span>
                                </>
                              )}
                            </div>
                            <span
                              className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                task.assignmentMode === AssignmentMode.TEAM
                                  ? 'bg-emerald-500/10 text-[#10B981]'
                                  : 'bg-indigo-500/10 text-[#6366F1] dark:text-indigo-400'
                              }`}
                            >
                              {task.assignmentMode === AssignmentMode.TEAM
                                ? `TEAM (${task.teamAssignees?.length || 1})`
                                : task.assignee?.uniqueCode || 'INDIVIDUAL'}
                            </span>
                          </div>

                          {/* Task Title */}
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                            {task.title}
                          </h4>

                          {/* Unboxed Labels */}
                          {task.labels.length > 0 && (
                            <div className="text-[11px] text-[#6366F1] dark:text-indigo-400 font-medium">
                              {task.labels.join(' · ')}
                            </div>
                          )}

                          {/* Bottom Row: Assignee + Due Date + Counts */}
                          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {task.assignee ? (
                                <img
                                  src={task.assignee.avatar}
                                  alt={task.assignee.name}
                                  title={`Assigned to ${task.assignee.name}`}
                                  referrerPolicy="no-referrer"
                                  className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 dark:border-slate-700 shrink-0"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-400 flex items-center justify-center shrink-0">
                                  ?
                                </div>
                              )}
                              <span
                                className={`text-[11px] font-mono tabular-nums flex items-center gap-1 ${
                                  isOverdue
                                    ? 'text-[#EF4444] font-semibold'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {isOverdue ? (
                                  <AlertCircle className="w-3 h-3 text-[#EF4444]" />
                                ) : (
                                  <Calendar className="w-3 h-3" />
                                )}
                                {new Date(task.dueDate).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </div>

                            <div className="flex items-center gap-2.5 text-[11px] text-slate-400 tabular-nums">
                              {task.commentCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {task.commentCount}
                                </span>
                              )}
                              {task.attachmentCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <Paperclip className="w-3 h-3" />
                                  {task.attachmentCount}
                                </span>
                              )}
                              {nextStatus && (
                                <button
                                  type="button"
                                  title={`Move to ${nextStatus}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMoveTask(task, nextStatus);
                                  }}
                                  className="p-1 rounded-md hover:bg-indigo-50 dark:hover:bg-slate-800 text-[#6366F1] transition-colors cursor-pointer"
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
