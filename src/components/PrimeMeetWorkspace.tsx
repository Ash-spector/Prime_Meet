import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Command,
  Edit3,
  FolderKanban,
  Grid,
  KeyRound,
  Layers,
  LayoutDashboard,
  List,
  ListTodo,
  LogOut,
  Menu,
  Moon,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Trash2,
  UserPlus,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { api, ApiError, getStoredToken } from '../client/api.ts';
import {
  EnrichedActivityLog,
  EnrichedProject,
  EnrichedTask,
  Notification,
  Organization,
  OrganizationMember,
  Priority,
  ProjectStatus,
  TaskStatus,
  User,
  UserRole,
} from '../shared/types.ts';
import { CommandPaletteModal } from './CommandPaletteModal.tsx';
import { KanbanBoard } from './KanbanBoard.tsx';
import { RoleDashboards } from './RoleDashboards.tsx';
import { TaskDetailDrawer } from './TaskDetailDrawer.tsx';

interface PrimeMeetWorkspaceProps {
  user: User;
  onUserUpdated: (user: User) => void;
  onLogout: () => void;
  onQuickSwitchUser: (email: string) => Promise<void>;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

type MainSection =
  | 'overview'
  | 'projects'
  | 'project-detail'
  | 'tasks'
  | 'team'
  | 'analytics'
  | 'notifications'
  | 'rbac-lab'
  | 'settings';

type ProjectDetailTab =
  | 'overview'
  | 'tasks'
  | 'kanban'
  | 'team'
  | 'activity'
  | 'analytics';

interface OnlinePresenceUser {
  userId: string;
  name: string;
  avatar: string;
  role: UserRole;
  projectId: string | null;
}

interface ToastItem {
  id: string;
  type: 'success' | 'error';
  title: string;
  message: string;
  rule?: string;
}

export const PrimeMeetWorkspace: React.FC<PrimeMeetWorkspaceProps> = ({
  user,
  onUserUpdated,
  onLogout,
  onQuickSwitchUser,
  darkMode,
  onToggleDarkMode,
}) => {
  // Navigation State
  const [section, setSection] = useState<MainSection>('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectTab, setProjectTab] = useState<ProjectDetailTab>('kanban');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Data States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allProjects, setAllProjects] = useState<EnrichedProject[]>([]);
  const [paginatedProjects, setPaginatedProjects] = useState<EnrichedProject[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('ALL');
  const [projectViewMode, setProjectViewMode] = useState<'grid' | 'list'>('grid');
  const [projectPage, setProjectPage] = useState(1);
  const [projectTotalPages, setProjectTotalPages] = useState(1);

  const [tasks, setTasks] = useState<EnrichedTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<
    Array<
      Organization & {
        memberCount: number;
        projectCount: number;
        members: Array<OrganizationMember & { user?: User }>;
      }
    >
  >([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activityLogs, setActivityLogs] = useState<EnrichedActivityLog[]>([]);

  // Active Task Drawer
  const [selectedTask, setSelectedTask] = useState<EnrichedTask | null>(null);

  // Modals: Create/Edit Project, Create Task, Create Organization, Confirmation
  const [projectModal, setProjectModal] = useState<{
    mode: 'create' | 'edit';
    project?: EnrichedProject;
  } | null>(null);
  const [projFormName, setProjFormName] = useState('');
  const [projFormDesc, setProjFormDesc] = useState('');
  const [projFormStatus, setProjFormStatus] = useState<ProjectStatus>(
    ProjectStatus.ACTIVE
  );
  const [projFormPriority, setProjFormPriority] = useState<Priority>(
    Priority.HIGH
  );
  const [projFormDueDate, setProjFormDueDate] = useState('');

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskFormProjectId, setTaskFormProjectId] = useState('');
  const [taskFormTitle, setTaskFormTitle] = useState('');
  const [taskFormDesc, setTaskFormDesc] = useState('');
  const [taskFormAssigneeId, setTaskFormAssigneeId] = useState('');
  const [taskFormPriority, setTaskFormPriority] = useState<Priority>(
    Priority.MEDIUM
  );
  const [taskFormStatus, setTaskFormStatus] = useState<TaskStatus>(
    TaskStatus.TODO
  );
  const [taskFormDueDate, setTaskFormDueDate] = useState('');
  const [taskFormLabels, setTaskFormLabels] = useState('Frontend, UI');

  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [orgFormName, setOrgFormName] = useState('');
  const [orgFormSlug, setOrgFormSlug] = useState('');
  const [orgFormDesc, setOrgFormDesc] = useState('');

  // Add Member to Project state
  const [memberToAddId, setMemberToAddId] = useState('');

  // Profile Settings State
  const [profileName, setProfileName] = useState(user.name);
  const [profileAvatar, setProfileAvatar] = useState(user.avatar);

  // Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Real-time WebSocket & Online Presence
  const [onlineUsers, setOnlineUsers] = useState<OnlinePresenceUser[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // RBAC Lab Results
  const [rbacResults, setRbacResults] = useState<
    Record<
      string,
      { status: 'allowed' | 'denied'; code: number; rule?: string; message: string }
    >
  >({});

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [{ ...toast, id }, ...prev.slice(0, 3)]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  // Load all core workspace data
  const fetchWorkspaceData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [allProjRes, taskRes, usrRes, orgRes, notifRes, actRes] =
        await Promise.all([
          api.listProjects({ limit: 50 }),
          api.listTasks(),
          api.listUsers(),
          api.listOrganizations(),
          api.listNotifications(),
          api.listActivity(),
        ]);

      setAllProjects(allProjRes.projects);
      setTasks(taskRes.tasks);
      setUsers(usrRes.users);
      setOrganizations(orgRes.organizations);
      setNotifications(notifRes.notifications);
      setActivityLogs(actRes.activityLogs);

      setSelectedTask((prev) =>
        prev ? taskRes.tasks.find((t) => t.id === prev.id) || null : null
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load workspace data.'
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Load server-side paginated projects for the Projects Explorer
  const fetchPaginatedProjects = useCallback(async () => {
    try {
      const res = await api.listProjects({
        search: projectSearch,
        status: projectStatusFilter,
        page: projectPage,
        limit: 6,
      });
      setPaginatedProjects(res.projects);
      setProjectTotalPages(res.totalPages);
    } catch {
      // Handled by main loader
    }
  }, [projectSearch, projectStatusFilter, projectPage]);

  useEffect(() => {
    fetchWorkspaceData();
  }, [fetchWorkspaceData]);

  useEffect(() => {
    fetchPaginatedProjects();
  }, [fetchPaginatedProjects, allProjects]);

  // Global Keyboard Shortcut: Ctrl/Cmd + K for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen]);

  // Real-Time WebSocket Connection & Auto-Reconnect
  useEffect(() => {
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectWs = () => {
      const token = getStoredToken();
      if (!token || !active) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!active) return;
        setWsConnected(true);
        socket.send(
          JSON.stringify({
            type: 'presence:join',
            token,
            projectId: selectedProjectId,
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'presence:sync' && Array.isArray(data.onlineUsers)) {
            setOnlineUsers(data.onlineUsers);
          } else if (data.type === 'data:changed') {
            // Silently refresh live workspace data when any collaborator makes a change
            fetchWorkspaceData(true);
          }
        } catch {
          // Ignore malformed WS frames
        }
      };

      socket.onclose = () => {
        if (!active) return;
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWs, 2500);
      };
    };

    connectWs();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [fetchWorkspaceData]);

  // Notify WS when user changes active project
  useEffect(() => {
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      wsRef.current.send(
        JSON.stringify({
          type: 'presence:project',
          projectId: section === 'project-detail' ? selectedProjectId : null,
        })
      );
    }
  }, [section, selectedProjectId]);

  const currentProject = allProjects.find((p) => p.id === selectedProjectId) || null;
  const projectTasks = tasks.filter((t) => t.projectId === selectedProjectId);

  // Optimistic Kanban Task Move with Rollback on Backend Failure
  const handleOptimisticTaskMove = async (
    task: EnrichedTask,
    targetStatus: TaskStatus
  ) => {
    const previousTasks = [...tasks];
    // 1. Apply optimistic update immediately
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: targetStatus } : t))
    );

    try {
      // 2. Persist to real database
      await api.updateTask(task.id, { status: targetStatus });
      addToast({
        type: 'success',
        title: 'Task Moved',
        message: `"${task.title}" moved to ${targetStatus.replace('_', ' ')}.`,
      });
      await fetchWorkspaceData(true);
    } catch (err) {
      // 3. Rollback local state if backend rejects (e.g. RLS 403)
      setTasks(previousTasks);
      if (err instanceof ApiError) {
        addToast({
          type: 'error',
          title: 'You don\'t have permission (Rolled Back)',
          message: err.message,
          rule: err.rule,
        });
      } else {
        addToast({
          type: 'error',
          title: 'Move Failed (Rolled Back)',
          message: 'Could not save task status change. Reverted board state.',
        });
      }
    }
  };

  // Open Project Modal
  const openCreateProjectModal = () => {
    setProjFormName('');
    setProjFormDesc('');
    setProjFormStatus(ProjectStatus.ACTIVE);
    setProjFormPriority(Priority.HIGH);
    const twoWeeks = new Date(Date.now() + 14 * 86400000)
      .toISOString()
      .slice(0, 10);
    setProjFormDueDate(twoWeeks);
    setProjectModal({ mode: 'create' });
  };

  const openEditProjectModal = (proj: EnrichedProject) => {
    setProjFormName(proj.name);
    setProjFormDesc(proj.description);
    setProjFormStatus(proj.status);
    setProjFormPriority(proj.priority);
    setProjFormDueDate(proj.dueDate.slice(0, 10));
    setProjectModal({ mode: 'edit', project: proj });
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectModal) return;
    try {
      if (projectModal.mode === 'create') {
        const res = await api.createProject({
          name: projFormName,
          description: projFormDesc,
          status: projFormStatus,
          priority: projFormPriority,
          dueDate: new Date(projFormDueDate).toISOString(),
        });
        addToast({
          type: 'success',
          title: 'Project Created',
          message: `"${res.project.name}" added to PrimeMeet Labs.`,
        });
        setSelectedProjectId(res.project.id);
        setSection('project-detail');
      } else if (projectModal.project) {
        const res = await api.updateProject(projectModal.project.id, {
          name: projFormName,
          description: projFormDesc,
          status: projFormStatus,
          priority: projFormPriority,
          dueDate: new Date(projFormDueDate).toISOString(),
        });
        addToast({
          type: 'success',
          title: 'Project Updated',
          message: `Saved changes to "${res.project.name}".`,
        });
      }
      setProjectModal(null);
      await fetchWorkspaceData(true);
    } catch (err) {
      if (err instanceof ApiError) {
        addToast({
          type: 'error',
          title: 'You don\'t have permission',
          message: err.message,
          rule: err.rule,
        });
      }
    }
  };

  const handleOpenCreateTaskModal = (defaultStatus = TaskStatus.TODO) => {
    setTaskFormProjectId(
      selectedProjectId || allProjects[0]?.id || 'prj_website_redesign'
    );
    setTaskFormTitle('');
    setTaskFormDesc('');
    setTaskFormAssigneeId(user.id);
    setTaskFormPriority(Priority.HIGH);
    setTaskFormStatus(defaultStatus);
    setTaskFormDueDate(
      new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
    );
    setTaskFormLabels('Frontend, UI');
    setTaskModalOpen(true);
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const labels = taskFormLabels
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await api.createTask({
        projectId: taskFormProjectId,
        title: taskFormTitle,
        description: taskFormDesc,
        assigneeId: taskFormAssigneeId || null,
        priority: taskFormPriority,
        status: taskFormStatus,
        dueDate: new Date(taskFormDueDate).toISOString(),
        labels,
      });
      setTaskModalOpen(false);
      addToast({
        type: 'success',
        title: 'Task Created',
        message: `"${res.task.title}" added to board.`,
      });
      await fetchWorkspaceData(true);
    } catch (err) {
      if (err instanceof ApiError) {
        addToast({
          type: 'error',
          title: 'You don\'t have permission',
          message: err.message,
          rule: err.rule,
        });
      }
    }
  };

  const handleCreateOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createOrganization({
        name: orgFormName,
        slug: orgFormSlug,
        description: orgFormDesc,
      });
      setOrgModalOpen(false);
      setOrgFormName('');
      setOrgFormSlug('');
      setOrgFormDesc('');
      addToast({
        type: 'success',
        title: 'Organization Created',
        message: `"${res.organization.name}" is now active.`,
      });
      await fetchWorkspaceData(true);
    } catch (err) {
      if (err instanceof ApiError) {
        addToast({
          type: 'error',
          title: 'You don\'t have permission',
          message: err.message,
          rule: err.rule,
        });
      }
    }
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen w-full flex bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Toast Notifications Stack */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto card-3d p-4 rounded-2xl flex items-start gap-3 ${
              t.type === 'error'
                ? 'border-l-4 border-l-[#EF4444]'
                : 'border-l-4 border-l-[#10B981]'
            }`}
          >
            {t.type === 'error' ? (
              <ShieldAlert className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2">
                <span>{t.title}</span>
                {t.rule && (
                  <span className="font-mono text-[10px] text-[#EF4444]">
                    {t.rule}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {t.message}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((item) => item.id !== t.id))
              }
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Command Palette (Ctrl/Cmd + K) */}
      <CommandPaletteModal
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        projects={allProjects}
        tasks={tasks}
        users={users}
        onSelectProject={(projectId) => {
          setSelectedProjectId(projectId);
          setSection('project-detail');
        }}
        onSelectTask={(t) => setSelectedTask(t)}
        onOpenCreateProject={openCreateProjectModal}
        onOpenCreateTask={() => handleOpenCreateTaskModal()}
        onOpenRbacLab={() => setSection('rbac-lab')}
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
      />

      {/* Task Detail Slide-Over Drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        currentUser={user}
        users={users}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={() => fetchWorkspaceData(true)}
        onTaskDeleted={() => fetchWorkspaceData(true)}
        onNotify={addToast}
      />

      {/* Create / Edit Project Modal */}
      {projectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="card-3d rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {projectModal.mode === 'create'
                  ? 'Create New Project'
                  : `Edit Project: ${projectModal.project?.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setProjectModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={projFormName}
                  onChange={(e) => setProjFormName(e.target.value)}
                  placeholder="e.g., Enterprise API Gateway"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  value={projFormDesc}
                  onChange={(e) => setProjFormDesc(e.target.value)}
                  placeholder="Describe project goals, deliverables, and architecture..."
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={projFormStatus}
                    onChange={(e) =>
                      setProjFormStatus(e.target.value as ProjectStatus)
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value={ProjectStatus.PLANNING}>PLANNING</option>
                    <option value={ProjectStatus.ACTIVE}>ACTIVE</option>
                    <option value={ProjectStatus.ON_HOLD}>ON_HOLD</option>
                    <option value={ProjectStatus.COMPLETED}>COMPLETED</option>
                    <option value={ProjectStatus.ARCHIVED}>ARCHIVED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={projFormPriority}
                    onChange={(e) =>
                      setProjFormPriority(e.target.value as Priority)
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value={Priority.LOW}>LOW</option>
                    <option value={Priority.MEDIUM}>MEDIUM</option>
                    <option value={Priority.HIGH}>HIGH</option>
                    <option value={Priority.URGENT}>URGENT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={projFormDueDate}
                    onChange={(e) => setProjFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProjectModal(null)}
                  className="px-4 py-2 rounded-xl btn-3d-secondary text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-3d-primary text-xs font-semibold cursor-pointer"
                >
                  {projectModal.mode === 'create'
                    ? 'Create Project'
                    : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="card-3d rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Create New Task
              </h3>
              <button
                type="button"
                onClick={() => setTaskModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTaskSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Project
                </label>
                <select
                  value={taskFormProjectId}
                  onChange={(e) => setTaskFormProjectId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {allProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={taskFormTitle}
                  onChange={(e) => setTaskFormTitle(e.target.value)}
                  placeholder="e.g., Implement real-time WebSocket presence indicator"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={taskFormDesc}
                  onChange={(e) => setTaskFormDesc(e.target.value)}
                  placeholder="Provide acceptance criteria and context..."
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Assignee
                  </label>
                  <select
                    value={taskFormAssigneeId}
                    onChange={(e) => setTaskFormAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={taskFormDueDate}
                    onChange={(e) => setTaskFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={taskFormStatus}
                    onChange={(e) =>
                      setTaskFormStatus(e.target.value as TaskStatus)
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value={TaskStatus.TODO}>TODO</option>
                    <option value={TaskStatus.IN_PROGRESS}>IN_PROGRESS</option>
                    <option value={TaskStatus.IN_REVIEW}>IN_REVIEW</option>
                    <option value={TaskStatus.DONE}>DONE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={taskFormPriority}
                    onChange={(e) =>
                      setTaskFormPriority(e.target.value as Priority)
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value={Priority.LOW}>LOW</option>
                    <option value={Priority.MEDIUM}>MEDIUM</option>
                    <option value={Priority.HIGH}>HIGH</option>
                    <option value={Priority.URGENT}>URGENT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Labels
                  </label>
                  <input
                    type="text"
                    value={taskFormLabels}
                    onChange={(e) => setTaskFormLabels(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl btn-3d-secondary text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-3d-primary text-xs font-semibold cursor-pointer"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Organization Modal */}
      {orgModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="card-3d rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Create New Organization
              </h3>
              <button
                type="button"
                onClick={() => setOrgModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateOrgSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={orgFormName}
                  onChange={(e) => {
                    setOrgFormName(e.target.value);
                    setOrgFormSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '')
                    );
                  }}
                  placeholder="PrimeMeet Enterprise"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  required
                  value={orgFormSlug}
                  onChange={(e) => setOrgFormSlug(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={orgFormDesc}
                  onChange={(e) => setOrgFormDesc(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOrgModalOpen(false)}
                  className="px-4 py-2 rounded-xl btn-3d-secondary text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-3d-primary text-xs font-semibold cursor-pointer"
                >
                  Create Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Destructive Actions */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="card-3d rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-[#EF4444] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {confirmDialog.title}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {confirmDialog.description}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl btn-3d-secondary text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const fn = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await fn();
                }}
                className="px-4 py-2 rounded-xl bg-[#EF4444] hover:bg-red-600 text-white text-xs font-semibold cursor-pointer"
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer Scrim */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* ===================================================================== */}
      {/* LEFT SIDEBAR                                                          */}
      {/* ===================================================================== */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-68 bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 flex flex-col justify-between transition-transform duration-200 ${
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-5 space-y-6 overflow-y-auto">
          {/* Brand Logo */}
          <div className="flex items-center justify-between">
            <div
              onClick={() => setSection('overview')}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl btn-3d-primary flex items-center justify-center text-white">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                  PrimeMeet
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Plan · Collaborate · Ship
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Navigation Links */}
          <nav className="space-y-1">
            {(
              [
                { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                { id: 'projects', label: 'Projects', icon: FolderKanban },
                { id: 'tasks', label: 'Tasks & Kanban', icon: ListTodo },
                { id: 'team', label: 'Organizations & Team', icon: Users },
                { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                {
                  id: 'notifications',
                  label: `Notifications${
                    unreadNotificationsCount > 0 ? ` (${unreadNotificationsCount})` : ''
                  }`,
                  icon: Bell,
                },
                { id: 'rbac-lab', label: 'Security & RBAC Check', icon: ShieldCheck },
                { id: 'settings', label: 'Settings', icon: Settings },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSection(item.id);
                    setMobileDrawerOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'btn-3d-primary text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Project List */}
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                Projects ({allProjects.length})
              </span>
              <button
                type="button"
                onClick={openCreateProjectModal}
                title="Create new project"
                className="p-1 rounded-lg text-slate-400 hover:text-[#6366F1] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1">
              {allProjects.map((p) => {
                const isSelected =
                  section === 'project-detail' && selectedProjectId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProjectId(p.id);
                      setSection('project-detail');
                      setMobileDrawerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-[#6366F1] dark:text-indigo-400 font-bold border border-indigo-200/80 dark:border-indigo-900'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800 font-medium'
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {p.taskStats.progressPercent}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Role Switcher (Dev Helper for Instant RBAC Testing) */}
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800">
            <div className="px-2 mb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>Switch Demo Role</span>
            </div>
            <div className="space-y-1.5">
              {[
                {
                  name: 'Alex Rivera',
                  email: 'alex.rivera@primemeet.io',
                  role: UserRole.SUPER_ADMIN,
                },
                {
                  name: 'Sarah Chen',
                  email: 'sarah.chen@primemeet.io',
                  role: UserRole.PROJECT_MANAGER,
                },
                {
                  name: 'David Kim',
                  email: 'david.kim@primemeet.io',
                  role: UserRole.TEAM_MEMBER,
                },
              ].map((demo) => {
                const isCurrent = user.email === demo.email;
                return (
                  <button
                    key={demo.email}
                    type="button"
                    disabled={isCurrent}
                    onClick={() => onQuickSwitchUser(demo.email)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all cursor-pointer ${
                      isCurrent
                        ? 'card-3d border-[#6366F1] font-bold text-slate-900 dark:text-white'
                        : 'border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{demo.name}</span>
                      <span className="font-mono text-[10px] text-[#6366F1] dark:text-indigo-400">
                        {demo.role.split('_')[0]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom User Profile Card */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <img
              src={user.avatar}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full bg-indigo-100 border border-slate-200 dark:border-slate-700 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {user.name}
              </div>
              <div className="text-[11px] font-mono text-[#6366F1] dark:text-indigo-400 truncate">
                {user.role}
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Sign out"
              className="p-2 rounded-xl btn-3d-secondary text-slate-500 hover:text-[#EF4444] cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* MAIN CONTENT VIEWPORT (Full width beside sidebar)                     */}
      {/* ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract (3 Zones: Brand/Breadcrumb — Search/Cmd+K — Actions) */}
        <header className="h-16 px-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-4 sticky top-0 z-30">
          {/* Zone 1: Mobile Hamburger + Context Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl btn-3d-secondary text-slate-600 dark:text-slate-300"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {section === 'project-detail' && currentProject
                ? `Projects / ${currentProject.name}`
                : `PrimeMeet / ${section.replace('-', ' ').toUpperCase()}`}
            </span>
          </div>

          {/* Zone 2: Search & Ctrl+K Command Palette Trigger */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="w-full px-3.5 py-2 rounded-xl btn-3d-secondary flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>Search projects, tasks, users...</span>
              </span>
              <span className="font-mono text-[11px] text-slate-400 flex items-center gap-0.5">
                <Command className="w-3 h-3" />K
              </span>
            </button>
          </div>

          {/* Zone 3: Online Presence + Notifications + Theme Toggle + New Task */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Live Online Presence Avatars */}
            <div
              className="hidden sm:flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-slate-800"
              title={
                wsConnected
                  ? 'Real-time WebSocket connected'
                  : 'Reconnecting real-time sync...'
              }
            >
              <Wifi
                className={`w-3.5 h-3.5 ${
                  wsConnected ? 'text-[#10B981]' : 'text-slate-400'
                }`}
              />
              <div className="flex -space-x-2">
                {onlineUsers.slice(0, 4).map((ou) => (
                  <img
                    key={ou.userId}
                    src={ou.avatar}
                    alt={ou.name}
                    title={`${ou.name} (Online)`}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100"
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSection('notifications')}
              aria-label="Open notifications"
              className="relative p-2 rounded-xl btn-3d-secondary text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label="Toggle light or dark theme"
              className="p-2 rounded-xl btn-3d-secondary text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-[#F59E0B]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateTaskModal()}
              className="px-3.5 py-2 rounded-xl btn-3d-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>New Task</span>
            </button>
          </div>
        </header>

        {/* Main Scrollable Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-36 rounded-2xl card-3d p-5 animate-pulse space-y-3"
                >
                  <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-8 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-3/4 bg-slate-100 dark:bg-slate-800 rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="card-3d rounded-2xl p-8 text-center space-y-3 max-w-lg mx-auto">
              <AlertCircle className="w-8 h-8 text-[#EF4444] mx-auto" />
              <div className="text-base font-bold text-slate-900 dark:text-white">
                Unable to Load Workspace Data
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{error}</p>
              <button
                type="button"
                onClick={() => fetchWorkspaceData()}
                className="px-4 py-2 rounded-xl btn-3d-primary text-xs font-semibold cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* ============================================================= */}
              {/* 1. OVERVIEW (ROLE-SPECIFIC DASHBOARDS)                        */}
              {/* ============================================================= */}
              {section === 'overview' && (
                <RoleDashboards
                  user={user}
                  projects={allProjects}
                  tasks={tasks}
                  users={users}
                  organizations={organizations}
                  notifications={notifications}
                  activityLogs={activityLogs}
                  onSelectProject={(pid) => {
                    setSelectedProjectId(pid);
                    setSection('project-detail');
                  }}
                  onSelectTask={(t) => setSelectedTask(t)}
                  onQuickStatusChange={handleOptimisticTaskMove}
                  onOpenCreateProject={openCreateProjectModal}
                  onOpenCreateTask={() => handleOpenCreateTaskModal()}
                  onUpdateUserRole={async (uid, nextRole) => {
                    try {
                      await api.updateUser(uid, { role: nextRole });
                      addToast({
                        type: 'success',
                        title: 'Role Updated',
                        message: `User role updated to ${nextRole}.`,
                      });
                      await fetchWorkspaceData(true);
                    } catch (err) {
                      if (err instanceof ApiError) {
                        addToast({
                          type: 'error',
                          title: 'You don\'t have permission',
                          message: err.message,
                          rule: err.rule,
                        });
                      }
                    }
                  }}
                  onMarkNotificationRead={async (nid) => {
                    await api.markNotificationRead(nid, true);
                    await fetchWorkspaceData(true);
                  }}
                />
              )}

              {/* ============================================================= */}
              {/* 2. PROJECTS EXPLORER (Grid/List, Search, Filter, Pagination)  */}
              {/* ============================================================= */}
              {section === 'projects' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Projects Directory
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Row-level filtered projects across PrimeMeet Labs
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openCreateProjectModal}
                      className="px-4 py-2 rounded-xl btn-3d-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Project</span>
                    </button>
                  </div>

                  {/* Filter, Search & View Toggle Bar */}
                  <div className="card-3d rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                      <Search className="w-4 h-4 text-slate-400 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={projectSearch}
                        onChange={(e) => {
                          setProjectSearch(e.target.value);
                          setProjectPage(1);
                        }}
                        placeholder="Search projects by name or description..."
                        className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                      />
                    </div>

                    <div className="flex items-center gap-2.5">
                      <select
                        aria-label="Filter projects by status"
                        value={projectStatusFilter}
                        onChange={(e) => {
                          setProjectStatusFilter(e.target.value);
                          setProjectPage(1);
                        }}
                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium cursor-pointer"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value={ProjectStatus.PLANNING}>Planning</option>
                        <option value={ProjectStatus.ACTIVE}>Active</option>
                        <option value={ProjectStatus.ON_HOLD}>On Hold</option>
                        <option value={ProjectStatus.COMPLETED}>Completed</option>
                        <option value={ProjectStatus.ARCHIVED}>Archived</option>
                      </select>

                      <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                        <button
                          type="button"
                          onClick={() => setProjectViewMode('grid')}
                          className={`p-1.5 rounded-lg cursor-pointer ${
                            projectViewMode === 'grid'
                              ? 'bg-white dark:bg-slate-900 text-[#6366F1] shadow-xs'
                              : 'text-slate-500'
                          }`}
                          title="Card Grid View"
                        >
                          <Grid className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setProjectViewMode('list')}
                          className={`p-1.5 rounded-lg cursor-pointer ${
                            projectViewMode === 'list'
                              ? 'bg-white dark:bg-slate-900 text-[#6366F1] shadow-xs'
                              : 'text-slate-500'
                          }`}
                          title="Table List View"
                        >
                          <List className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {paginatedProjects.length === 0 ? (
                    <div className="card-3d rounded-2xl p-12 text-center space-y-3">
                      <FolderKanban className="w-8 h-8 text-slate-400 mx-auto" />
                      <div className="text-base font-bold text-slate-900 dark:text-white">
                        No Matching Projects Found
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Adjust your search filters or create a new project to get started.
                      </p>
                      <button
                        type="button"
                        onClick={openCreateProjectModal}
                        className="px-4 py-2 rounded-xl btn-3d-primary text-xs font-semibold cursor-pointer"
                      >
                        Create Project
                      </button>
                    </div>
                  ) : projectViewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {paginatedProjects.map((proj) => (
                        <div
                          key={proj.id}
                          className="card-3d card-3d-interactive rounded-2xl p-6 flex flex-col justify-between space-y-5"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-mono font-semibold text-[#6366F1] dark:text-indigo-400">
                                {proj.status}
                              </span>
                              <span>·</span>
                              <span className="font-mono">{proj.priority}</span>
                            </div>

                            <h3
                              onClick={() => {
                                setSelectedProjectId(proj.id);
                                setSection('project-detail');
                              }}
                              className="text-lg font-bold text-slate-900 dark:text-white hover:text-[#6366F1] cursor-pointer transition-colors"
                            >
                              {proj.name}
                            </h3>

                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                              {proj.description}
                            </p>
                          </div>

                          <div className="space-y-4 pt-4 border-t border-slate-200/70 dark:border-slate-800">
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1.5 tabular-nums">
                                <span className="text-slate-500 dark:text-slate-400">
                                  Progress ({proj.taskStats.done}/{proj.taskStats.total} tasks)
                                </span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {proj.taskStats.progressPercent}%
                                </span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full bg-[#6366F1] rounded-full"
                                  style={{
                                    width: `${proj.taskStats.progressPercent}%`,
                                  }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex -space-x-2">
                                {proj.members.slice(0, 4).map((m) => (
                                  <img
                                    key={m.id}
                                    src={m.user.avatar}
                                    alt={m.user.name}
                                    title={m.user.name}
                                    referrerPolicy="no-referrer"
                                    className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100"
                                  />
                                ))}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditProjectModal(proj)}
                                  title="Edit project"
                                  className="p-1.5 rounded-lg btn-3d-secondary text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await api.updateProject(proj.id, {
                                        status: ProjectStatus.ARCHIVED,
                                      });
                                      addToast({
                                        type: 'success',
                                        title: 'Project Archived',
                                        message: `"${proj.name}" moved to archive.`,
                                      });
                                      await fetchWorkspaceData(true);
                                    } catch (err) {
                                      if (err instanceof ApiError) {
                                        addToast({
                                          type: 'error',
                                          title: 'You don\'t have permission',
                                          message: err.message,
                                          rule: err.rule,
                                        });
                                      }
                                    }
                                  }}
                                  title="Archive project"
                                  className="p-1.5 rounded-lg btn-3d-secondary text-amber-600 cursor-pointer"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDialog({
                                      title: `Delete "${proj.name}"?`,
                                      description:
                                        'This will permanently delete the project and its tasks. Team Members will be rejected by backend access rules.',
                                      confirmLabel: 'Delete Project',
                                      onConfirm: async () => {
                                        try {
                                          await api.deleteProject(proj.id);
                                          addToast({
                                            type: 'success',
                                            title: 'Project Deleted',
                                            message: `"${proj.name}" was deleted.`,
                                          });
                                          await fetchWorkspaceData(true);
                                        } catch (err) {
                                          if (err instanceof ApiError) {
                                            addToast({
                                              type: 'error',
                                              title: 'You don\'t have permission',
                                              message: err.message,
                                              rule: err.rule,
                                            });
                                          }
                                        }
                                      },
                                    })
                                  }
                                  title="Delete project"
                                  className="p-1.5 rounded-lg btn-3d-secondary text-[#EF4444] cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="card-3d rounded-2xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500">
                            <th className="py-3.5 px-4">Project</th>
                            <th className="py-3.5 px-4">Status</th>
                            <th className="py-3.5 px-4">Priority</th>
                            <th className="py-3.5 px-4">Manager</th>
                            <th className="py-3.5 px-4">Progress</th>
                            <th className="py-3.5 px-4 text-right">Due Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 tabular-nums">
                          {paginatedProjects.map((proj) => (
                            <tr
                              key={proj.id}
                              onClick={() => {
                                setSelectedProjectId(proj.id);
                                setSection('project-detail');
                              }}
                              className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 cursor-pointer"
                            >
                              <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                                {proj.name}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-[#6366F1]">
                                {proj.status}
                              </td>
                              <td className="py-3.5 px-4 font-mono">{proj.priority}</td>
                              <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                                {proj.manager?.name || proj.managerId}
                              </td>
                              <td className="py-3.5 px-4 font-mono font-semibold">
                                {proj.taskStats.progressPercent}% ({proj.taskStats.done}/
                                {proj.taskStats.total})
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                                {new Date(proj.dueDate).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Server-Side Pagination Controls */}
                  <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
                    <span>
                      Page {projectPage} of {projectTotalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={projectPage <= 1}
                        onClick={() => setProjectPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-xl btn-3d-secondary disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Previous</span>
                      </button>
                      <button
                        type="button"
                        disabled={projectPage >= projectTotalPages}
                        onClick={() =>
                          setProjectPage((p) => Math.min(projectTotalPages, p + 1))
                        }
                        className="px-3 py-1.5 rounded-xl btn-3d-secondary disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* 3. PROJECT DETAIL PAGE (6 Tabs: Overview, Tasks, Kanban,      */}
              {/*    Team, Activity, Analytics + Live Online Presence)          */}
              {/* ============================================================= */}
              {section === 'project-detail' && currentProject && (
                <div className="space-y-6">
                  {/* Project Header Card */}
                  <div className="card-3d rounded-2xl p-6 space-y-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono font-bold text-[#6366F1]">
                            {currentProject.status}
                          </span>
                          <span>·</span>
                          <span className="font-mono">
                            {currentProject.priority} PRIORITY
                          </span>
                          <span>·</span>
                          <span className="tabular-nums">
                            Due {new Date(currentProject.dueDate).toLocaleDateString()}
                          </span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                          {currentProject.name}
                        </h1>
                        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl">
                          {currentProject.description}
                        </p>
                      </div>

                      {/* Online Presence on this Project + Actions */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
                          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                          <span className="font-medium">
                            {onlineUsers.length} online in workspace
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => openEditProjectModal(currentProject)}
                          className="px-3.5 py-2 rounded-xl btn-3d-secondary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Project</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenCreateTaskModal()}
                          className="px-4 py-2 rounded-xl btn-3d-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Task</span>
                        </button>
                      </div>
                    </div>

                    {/* 6 Project Page Tabs */}
                    <div className="flex flex-wrap items-center gap-1 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                      {(
                        [
                          { id: 'overview', label: 'Overview' },
                          {
                            id: 'tasks',
                            label: `Tasks (${projectTasks.length})`,
                          },
                          { id: 'kanban', label: 'Kanban Board' },
                          {
                            id: 'team',
                            label: `Team (${currentProject.members.length})`,
                          },
                          { id: 'activity', label: 'Activity' },
                          { id: 'analytics', label: 'Analytics' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setProjectTab(tab.id)}
                          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            projectTab === tab.id
                              ? 'btn-3d-primary text-white'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* PROJECT TAB 1: OVERVIEW */}
                  {projectTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      <div className="lg:col-span-8 card-3d rounded-2xl p-6 space-y-5">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                          Project Progress &amp; Milestone Summary
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 tabular-nums">
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700">
                            <div className="text-xs text-slate-500">Total Tasks</div>
                            <div className="text-2xl font-bold mt-1">
                              {currentProject.taskStats.total}
                            </div>
                          </div>
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700">
                            <div className="text-xs text-slate-500">In Progress</div>
                            <div className="text-2xl font-bold text-[#6366F1] mt-1">
                              {currentProject.taskStats.inProgress}
                            </div>
                          </div>
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700">
                            <div className="text-xs text-slate-500">Completed</div>
                            <div className="text-2xl font-bold text-[#10B981] mt-1">
                              {currentProject.taskStats.done}
                            </div>
                          </div>
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700">
                            <div className="text-xs text-slate-500">Overdue</div>
                            <div className="text-2xl font-bold text-[#EF4444] mt-1">
                              {currentProject.taskStats.overdue}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-4 card-3d rounded-2xl p-6 space-y-4">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                          Project Governance
                        </h2>
                        <div className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Project Manager:</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {currentProject.manager?.name || currentProject.managerId}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Start Date:</span>
                            <span className="font-mono tabular-nums">
                              {new Date(currentProject.startDate).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Target Due Date:</span>
                            <span className="font-mono tabular-nums">
                              {new Date(currentProject.dueDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PROJECT TAB 2: TASKS LIST */}
                  {projectTab === 'tasks' && (
                    <div className="card-3d rounded-2xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500">
                            <th className="py-3.5 px-4">Task</th>
                            <th className="py-3.5 px-4">Status</th>
                            <th className="py-3.5 px-4">Priority</th>
                            <th className="py-3.5 px-4">Assignee</th>
                            <th className="py-3.5 px-4 text-right">Due Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 tabular-nums">
                          {projectTasks.map((t) => (
                            <tr
                              key={t.id}
                              onClick={() => setSelectedTask(t)}
                              className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 cursor-pointer"
                            >
                              <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                                <div>{t.title}</div>
                                <div className="text-[11px] font-normal text-slate-400">
                                  {t.labels.join(' · ')}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-[#6366F1]">
                                {t.status}
                              </td>
                              <td className="py-3.5 px-4 font-mono">{t.priority}</td>
                              <td className="py-3.5 px-4">
                                {t.assignee?.name || 'Unassigned'}
                              </td>
                              <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                                {new Date(t.dueDate).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* PROJECT TAB 3: KANBAN BOARD */}
                  {projectTab === 'kanban' && (
                    <KanbanBoard
                      tasks={projectTasks}
                      users={users}
                      onMoveTask={handleOptimisticTaskMove}
                      onSelectTask={(t) => setSelectedTask(t)}
                      onOpenCreateTask={(st) => handleOpenCreateTaskModal(st)}
                    />
                  )}

                  {/* PROJECT TAB 4: TEAM MEMBERS */}
                  {projectTab === 'team' && (
                    <div className="space-y-5">
                      <div className="card-3d rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Project Team Roster
                          </h3>
                          <p className="text-xs text-slate-500">
                            Add or remove members (enforced by RLS project ownership)
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            aria-label="Select user to add to project"
                            value={memberToAddId}
                            onChange={(e) => setMemberToAddId(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                          >
                            <option value="">Select user to add...</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.role})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!memberToAddId) return;
                              try {
                                await api.addProjectMember(
                                  currentProject.id,
                                  memberToAddId
                                );
                                setMemberToAddId('');
                                addToast({
                                  type: 'success',
                                  title: 'Member Added',
                                  message: 'User added to project.',
                                });
                                await fetchWorkspaceData(true);
                              } catch (err) {
                                if (err instanceof ApiError) {
                                  addToast({
                                    type: 'error',
                                    title: 'You don\'t have permission',
                                    message: err.message,
                                    rule: err.rule,
                                  });
                                }
                              }
                            }}
                            className="px-3.5 py-2 rounded-xl btn-3d-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Add Member</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {currentProject.members.map((pm) => (
                          <div
                            key={pm.id}
                            className="card-3d rounded-2xl p-5 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={pm.user.avatar}
                                alt={pm.user.name}
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200"
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {pm.user.name}
                                </div>
                                <div className="text-xs text-slate-500 font-mono">
                                  {pm.role} · {pm.user.role}
                                </div>
                              </div>
                            </div>

                            {pm.userId !== currentProject.managerId && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await api.removeProjectMember(
                                      currentProject.id,
                                      pm.userId
                                    );
                                    addToast({
                                      type: 'success',
                                      title: 'Member Removed',
                                      message: `Removed ${pm.user.name} from project.`,
                                    });
                                    await fetchWorkspaceData(true);
                                  } catch (err) {
                                    if (err instanceof ApiError) {
                                      addToast({
                                        type: 'error',
                                        title: 'You don\'t have permission',
                                        message: err.message,
                                        rule: err.rule,
                                      });
                                    }
                                  }
                                }}
                                className="p-2 rounded-xl btn-3d-secondary text-[#EF4444] cursor-pointer"
                                title="Remove from project"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PROJECT TAB 5: ACTIVITY */}
                  {projectTab === 'activity' && (
                    <div className="card-3d rounded-2xl divide-y divide-slate-200/60 dark:divide-slate-800">
                      {activityLogs
                        .filter((a) => a.projectId === currentProject.id)
                        .map((log) => (
                          <div
                            key={log.id}
                            className="p-4 flex items-center justify-between gap-4 text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {log.user?.name || log.userId}
                              </span>{' '}
                              <span className="text-slate-600 dark:text-slate-300">
                                {log.description}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}

                  {/* PROJECT TAB 6: ANALYTICS */}
                  {projectTab === 'analytics' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 tabular-nums">
                      <div className="card-3d rounded-2xl p-6 space-y-4">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          Tasks by Status Breakdown
                        </h3>
                        {(
                          [
                            {
                              label: 'To Do',
                              count: currentProject.taskStats.todo,
                              color: 'bg-slate-400',
                            },
                            {
                              label: 'In Progress',
                              count: currentProject.taskStats.inProgress,
                              color: 'bg-[#6366F1]',
                            },
                            {
                              label: 'In Review',
                              count: currentProject.taskStats.inReview,
                              color: 'bg-[#F59E0B]',
                            },
                            {
                              label: 'Done',
                              count: currentProject.taskStats.done,
                              color: 'bg-[#10B981]',
                            },
                          ] as const
                        ).map((bar) => {
                          const pct =
                            currentProject.taskStats.total > 0
                              ? Math.round(
                                  (bar.count / currentProject.taskStats.total) * 100
                                )
                              : 0;
                          return (
                            <div key={bar.label} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>{bar.label}</span>
                                <span className="font-mono font-bold">
                                  {bar.count} ({pct}%)
                                </span>
                              </div>
                              <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${bar.color}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="card-3d rounded-2xl p-6 space-y-4">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          Tasks by Priority
                        </h3>
                        {(
                          [
                            Priority.URGENT,
                            Priority.HIGH,
                            Priority.MEDIUM,
                            Priority.LOW,
                          ] as const
                        ).map((prio) => {
                          const count = projectTasks.filter(
                            (t) => t.priority === prio
                          ).length;
                          const pct =
                            projectTasks.length > 0
                              ? Math.round((count / projectTasks.length) * 100)
                              : 0;
                          return (
                            <div key={prio} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>{prio}</span>
                                <span className="font-mono font-bold">
                                  {count} ({pct}%)
                                </span>
                              </div>
                              <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#6366F1]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================= */}
              {/* 4. GLOBAL TASKS & KANBAN BOARD                                */}
              {/* ============================================================= */}
              {section === 'tasks' && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Kanban Board &amp; Task Queue
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Drag and drop tasks across columns. Unauthorized moves roll back
                        optimistically with an error toast.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenCreateTaskModal()}
                      className="px-4 py-2 rounded-xl btn-3d-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Task</span>
                    </button>
                  </div>

                  <KanbanBoard
                    tasks={tasks}
                    users={users}
                    onMoveTask={handleOptimisticTaskMove}
                    onSelectTask={(t) => setSelectedTask(t)}
                    onOpenCreateTask={(st) => handleOpenCreateTaskModal(st)}
                  />
                </div>
              )}

              {/* ============================================================= */}
              {/* 5. ORGANIZATIONS & TEAM                                       */}
              {/* ============================================================= */}
              {section === 'team' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Organizations &amp; Team Directory
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Workspace organizations and member role assignments
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOrgModalOpen(true)}
                      className="px-4 py-2 rounded-xl btn-3d-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>New Organization</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {organizations.map((org) => (
                      <div key={org.id} className="card-3d rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                              {org.name}
                            </h2>
                            <div className="text-xs font-mono text-[#6366F1]">
                              /{org.slug}
                            </div>
                          </div>
                          <span className="text-xs font-mono text-slate-500 tabular-nums">
                            {org.memberCount} members · {org.projectCount} projects
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {org.description}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="card-3d rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Workspace Members ({users.length})
                      </h3>
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500">
                          <th className="py-3.5 px-4">Member</th>
                          <th className="py-3.5 px-4">Email</th>
                          <th className="py-3.5 px-4">Role</th>
                          <th className="py-3.5 px-4 text-right">Assigned Tasks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 tabular-nums">
                        {users.map((u) => (
                          <tr key={u.id}>
                            <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2.5">
                              <img
                                src={u.avatar}
                                alt={u.name}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-full bg-slate-100"
                              />
                              <span>{u.name}</span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                              {u.email}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[#6366F1]">
                              {u.role}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold">
                              {tasks.filter((t) => t.assigneeId === u.id).length}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* 6. ANALYTICS                                                  */}
              {/* ============================================================= */}
              {section === 'analytics' && (
                <div className="space-y-6 tabular-nums">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Workspace Delivery Analytics
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Real-time metrics computed directly from visible projects and tasks
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {allProjects.map((proj) => (
                      <div key={proj.id} className="card-3d rounded-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            {proj.name}
                          </h3>
                          <span className="text-lg font-bold text-[#6366F1]">
                            {proj.taskStats.progressPercent}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-[#6366F1] rounded-full"
                            style={{
                              width: `${proj.taskStats.progressPercent}%`,
                            }}
                          />
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center text-xs pt-2">
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <div className="text-[10px] text-slate-400">TODO</div>
                            <div className="font-bold mt-0.5">{proj.taskStats.todo}</div>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <div className="text-[10px] text-slate-400">ACTIVE</div>
                            <div className="font-bold text-[#6366F1] mt-0.5">
                              {proj.taskStats.inProgress}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <div className="text-[10px] text-slate-400">REVIEW</div>
                            <div className="font-bold text-[#F59E0B] mt-0.5">
                              {proj.taskStats.inReview}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <div className="text-[10px] text-slate-400">DONE</div>
                            <div className="font-bold text-[#10B981] mt-0.5">
                              {proj.taskStats.done}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* 7. NOTIFICATIONS                                              */}
              {/* ============================================================= */}
              {section === 'notifications' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Notifications Center
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Assignments, status updates, comments, and deadline alerts
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.markAllNotificationsRead();
                        await fetchWorkspaceData(true);
                        addToast({
                          type: 'success',
                          title: 'All Marked as Read',
                          message: 'Cleared unread notification indicators.',
                        });
                      }}
                      className="px-3.5 py-2 rounded-xl btn-3d-secondary text-xs font-semibold cursor-pointer"
                    >
                      Mark All as Read
                    </button>
                  </div>

                  <div className="card-3d rounded-2xl divide-y divide-slate-200/70 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <div className="p-10 text-center text-xs text-slate-400">
                        You have no notifications.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={async () => {
                            if (!n.isRead) {
                              await api.markNotificationRead(n.id, true);
                              await fetchWorkspaceData(true);
                            }
                            if (n.link.includes('task=')) {
                              const taskId = n.link.split('task=')[1];
                              const found = tasks.find((t) => t.id === taskId);
                              if (found) setSelectedTask(found);
                            } else if (n.link.startsWith('/projects/')) {
                              const pid = n.link.replace('/projects/', '').split('?')[0];
                              setSelectedProjectId(pid);
                              setSection('project-detail');
                            }
                          }}
                          className={`p-4 flex items-center justify-between gap-4 text-xs cursor-pointer transition-colors ${
                            n.isRead
                              ? 'opacity-70 hover:opacity-100'
                              : 'bg-indigo-50/40 dark:bg-indigo-950/30 font-semibold'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="text-slate-900 dark:text-white">
                              {n.message}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                              {n.type} · {new Date(n.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <span className="text-[11px] font-mono text-[#6366F1] shrink-0">
                            {n.isRead ? 'Read' : 'Unread · Open'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* 8. RBAC SECURITY & PERMISSION RULES VERIFICATION SUITE        */}
              {/* ============================================================= */}
              {section === 'rbac-lab' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Row-Level Security &amp; RBAC Permission Verification Lab
                    </h1>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Test live backend security rules directly with your current role (
                      <span className="font-mono font-bold text-[#6366F1]">
                        {user.role}
                      </span>
                      ). Switch roles in the left sidebar to compare{' '}
                      <span className="font-mono">TEAM_MEMBER</span> vs{' '}
                      <span className="font-mono">PROJECT_MANAGER</span> vs{' '}
                      <span className="font-mono">SUPER_ADMIN</span>.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[
                      {
                        id: 'del_proj',
                        title: '1. Delete Project Request',
                        endpoint: 'DELETE /api/projects/prj_website_redesign',
                        desc: 'A TEAM_MEMBER trying to delete a project must be rejected by backend rules (403).',
                        run: async () => {
                          if (user.role === UserRole.TEAM_MEMBER) {
                            await api.deleteProject('prj_website_redesign');
                            return 'Deleted project';
                          }
                          const temp = await api.createProject({
                            name: 'Temp Verification Project',
                            description: 'Created and deleted to verify permission',
                            dueDate: new Date().toISOString(),
                          });
                          await api.deleteProject(temp.project.id);
                          return `Created & deleted project "${temp.project.name}" (Allowed for ${user.role}).`;
                        },
                      },
                      {
                        id: 'admin_gate',
                        title: '2. Open Admin Command Center API',
                        endpoint: 'GET /api/admin/overview',
                        desc: 'Only SUPER_ADMIN can access system administration stats. Rejected with 403 for Member & Manager.',
                        run: async () => {
                          const res = await api.getAdminOverview();
                          return `Loaded system stats (${res.totals.users} users, ${res.totals.tasks} tasks).`;
                        },
                      },
                      {
                        id: 'edit_other_comment',
                        title: "3. Edit Another User's Comment",
                        endpoint: 'PATCH /api/comments/cmt_01',
                        desc: 'Comment cmt_01 belongs to Sarah Chen. Editing it as David Kim or Alex Rivera is rejected with 403.',
                        run: async () => {
                          await api.updateComment(
                            'cmt_01',
                            'Make sure the Admin, Manager, and Member portal cards each display authentic UI fragments with zero placeholder copy.'
                          );
                          return 'Updated comment cmt_01 (You are the author Sarah Chen).';
                        },
                      },
                      {
                        id: 'view_non_member_project',
                        title: '4. View Non-Member Project',
                        endpoint: 'GET /api/projects/prj_marketing_platform',
                        desc: 'David Kim is not a member of Marketing Platform. Direct fetch is rejected by RLS_PROJECT_VIEW.',
                        run: async () => {
                          const res = await api.getProject('prj_marketing_platform');
                          return `Access granted to "${res.project.name}".`;
                        },
                      },
                      {
                        id: 'update_unassigned_task',
                        title: '5. Update Task Assigned to Another Member',
                        endpoint: 'PATCH /api/tasks/tsk_03',
                        desc: 'Task tsk_03 is assigned to Elena. Team Member David Kim is blocked by RLS_TASK_ASSIGNEE_ONLY.',
                        run: async () => {
                          const res = await api.updateTask('tsk_03', {
                            status: TaskStatus.IN_REVIEW,
                          });
                          return `Task "${res.task.title}" updated to ${res.task.status}.`;
                        },
                      },
                      {
                        id: 'update_own_task',
                        title: "6. Update Own Assigned Task (David's Task)",
                        endpoint: 'PATCH /api/tasks/tsk_02',
                        desc: 'Task tsk_02 is assigned to David Kim. Updating its status succeeds for David Kim, Manager, and Admin.',
                        run: async () => {
                          const res = await api.updateTask('tsk_02', {
                            status: TaskStatus.IN_PROGRESS,
                          });
                          return `Updated own task "${res.task.title}" status to ${res.task.status}.`;
                        },
                      },
                    ].map((test) => {
                      const result = rbacResults[test.id];
                      return (
                        <div
                          key={test.id}
                          className="card-3d rounded-2xl p-5 flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-mono text-slate-400">
                              {test.endpoint}
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              {test.title}
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                              {test.desc}
                            </p>
                          </div>

                          <div className="space-y-3">
                            {result && (
                              <div
                                className={`p-3 rounded-xl text-xs border ${
                                  result.status === 'denied'
                                    ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                <div className="font-bold">
                                  HTTP {result.code} · {result.rule || 'ALLOWED'}
                                </div>
                                <div className="mt-1">{result.message}</div>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const msg = await test.run();
                                  setRbacResults((prev) => ({
                                    ...prev,
                                    [test.id]: {
                                      status: 'allowed',
                                      code: 200,
                                      message: msg,
                                    },
                                  }));
                                  addToast({
                                    type: 'success',
                                    title: 'Permitted (200 OK)',
                                    message: msg,
                                  });
                                  await fetchWorkspaceData(true);
                                } catch (err) {
                                  if (err instanceof ApiError) {
                                    setRbacResults((prev) => ({
                                      ...prev,
                                      [test.id]: {
                                        status: 'denied',
                                        code: err.status,
                                        rule: err.rule,
                                        message: err.message,
                                      },
                                    }));
                                    addToast({
                                      type: 'error',
                                      title: 'You don\'t have permission',
                                      message: err.message,
                                      rule: err.rule,
                                    });
                                  }
                                }
                              }}
                              className="w-full py-2 px-3.5 rounded-xl btn-3d-secondary text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 text-[#6366F1]" />
                              <span>Run Permission Check</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ============================================================= */}
              {/* 9. SETTINGS & PROFILE                                         */}
              {/* ============================================================= */}
              {section === 'settings' && (
                <div className="max-w-xl space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Profile &amp; Workspace Settings
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Update your personal profile information and appearance preferences
                    </p>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const res = await api.updateUser(user.id, {
                          name: profileName,
                          avatar: profileAvatar,
                        });
                        onUserUpdated(res.user);
                        addToast({
                          type: 'success',
                          title: 'Profile Saved',
                          message: 'Your profile has been updated.',
                        });
                      } catch (err) {
                        if (err instanceof ApiError) {
                          addToast({
                            type: 'error',
                            title: 'You don\'t have permission',
                            message: err.message,
                            rule: err.rule,
                          });
                        }
                      }
                    }}
                    className="card-3d rounded-2xl p-6 space-y-4"
                  >
                    <div className="flex items-center gap-4 pb-3 border-b border-slate-200/70 dark:border-slate-800">
                      <img
                        src={profileAvatar}
                        alt={profileName}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200"
                      />
                      <div>
                        <div className="text-base font-bold text-slate-900 dark:text-white">
                          {user.name}
                        </div>
                        <div className="text-xs font-mono text-[#6366F1]">
                          {user.role} · {user.email}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Avatar URL
                      </label>
                      <input
                        type="url"
                        required
                        value={profileAvatar}
                        onChange={(e) => setProfileAvatar(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>

                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl btn-3d-primary text-xs font-semibold cursor-pointer"
                    >
                      Save Profile
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
