import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  FolderKanban,
  ListTodo,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { EnrichedProject, EnrichedTask, User } from '../shared/types.ts';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: EnrichedProject[];
  tasks: EnrichedTask[];
  users: User[];
  onSelectProject: (projectId: string) => void;
  onSelectTask: (task: EnrichedTask) => void;
  onOpenCreateProject: () => void;
  onOpenCreateTask: () => void;
  onOpenRbacLab: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  projects,
  tasks,
  users,
  onSelectProject,
  onSelectTask,
  onOpenCreateProject,
  onOpenCreateTask,
  onOpenRbacLab,
  darkMode,
  onToggleDarkMode,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  const q = query.trim().toLowerCase();

  const matchedProjects = useMemo(() => {
    if (!q) return projects.slice(0, 3);
    return projects
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [projects, q]);

  const matchedTasks = useMemo(() => {
    if (!q) return tasks.slice(0, 4);
    return tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.labels.some((l) => l.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [tasks, q]);

  const matchedUsers = useMemo(() => {
    if (!q) return [];
    return users
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [users, q]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 p-4">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-xl card-3d rounded-2xl overflow-hidden shadow-2xl">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-4 h-4 text-[#6366F1] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, tasks, users, or run an action..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {/* Quick Actions */}
          <div>
            <div className="px-2.5 pb-1.5 text-[11px] font-semibold text-slate-400">
              Quick Actions
            </div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateTask();
                }}
                className="w-full px-3 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-800 flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Plus className="w-4 h-4 text-[#6366F1]" />
                  <span>Create New Task</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateProject();
                }}
                className="w-full px-3 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-800 flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <FolderKanban className="w-4 h-4 text-[#10B981]" />
                  <span>Create New Project</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRbacLab();
                }}
                className="w-full px-3 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-800 flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#6366F1]" />
                  <span>Open RBAC Permission Rules Verification Suite</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleDarkMode();
                  onClose();
                }}
                className="w-full px-3 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-slate-800 flex items-center justify-between text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  {darkMode ? (
                    <Sun className="w-4 h-4 text-[#F59E0B]" />
                  ) : (
                    <Moon className="w-4 h-4 text-slate-600" />
                  )}
                  <span>
                    Switch to {darkMode ? 'Light' : 'Dark'} Appearance
                  </span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Projects */}
          {matchedProjects.length > 0 && (
            <div>
              <div className="px-2.5 pb-1.5 text-[11px] font-semibold text-slate-400">
                Projects
              </div>
              <div className="space-y-1">
                {matchedProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelectProject(p.id);
                      onClose();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-xs text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FolderKanban className="w-4 h-4 text-[#6366F1] shrink-0" />
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {p.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {p.status} · {p.taskStats.progressPercent}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tasks */}
          {matchedTasks.length > 0 && (
            <div>
              <div className="px-2.5 pb-1.5 text-[11px] font-semibold text-slate-400">
                Tasks
              </div>
              <div className="space-y-1">
                {matchedTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onSelectTask(t);
                      onClose();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-xs text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ListTodo className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-900 dark:text-white truncate">
                        {t.title}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0 ml-2">
                      {t.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Users */}
          {matchedUsers.length > 0 && (
            <div>
              <div className="px-2.5 pb-1.5 text-[11px] font-semibold text-slate-400">
                Team Directory
              </div>
              <div className="space-y-1">
                {matchedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900 dark:text-white">
                        {u.name}
                      </span>
                      <span className="text-slate-400">({u.email})</span>
                    </div>
                    <span className="text-[11px] font-mono text-[#6366F1]">
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Navigate with mouse or keyboard</span>
          <span className="font-mono">ESC to close</span>
        </div>
      </div>
    </div>
  );
};
