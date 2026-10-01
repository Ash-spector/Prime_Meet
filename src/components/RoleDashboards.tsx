import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Bell,
  Briefcase,
  Calendar,
  CheckCircle2,
  FolderKanban,
  Hash,
  Layers,
  ListTodo,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  AssignmentMode,
  EnrichedActivityLog,
  EnrichedProject,
  EnrichedTask,
  Notification,
  Organization,
  Priority,
  ProjectStatus,
  PROJECT_TYPE_LABELS,
  ProjectType,
  TaskStatus,
  User,
  UserRole,
} from '../shared/types.ts';

interface RoleDashboardsProps {
  user: User;
  projects: EnrichedProject[];
  tasks: EnrichedTask[];
  users: User[];
  organizations: Array<Organization & { memberCount: number; projectCount: number }>;
  notifications: Notification[];
  activityLogs: EnrichedActivityLog[];
  onSelectProject: (projectId: string) => void;
  onSelectTask: (task: EnrichedTask) => void;
  onQuickStatusChange: (task: EnrichedTask, nextStatus: TaskStatus) => void;
  onOpenCreateProject: () => void;
  onOpenCreateTask: (preset?: {
    projectId?: string;
    assignmentMode?: AssignmentMode;
    assigneeId?: string;
    teamAssigneeIds?: string[];
  }) => void;
  onUpdateUserRole: (
    userId: string,
    updates: { role?: UserRole; specialization?: ProjectType; managerId?: string | null }
  ) => void;
  onCreateProjectDirect: (input: {
    name: string;
    projectType: ProjectType;
    managerId: string;
    description: string;
    priority: Priority;
    dueDate: string;
    assignmentMode: AssignmentMode;
  }) => Promise<void>;
  onUpdateProjectDirect: (
    projectId: string,
    updates: Partial<{
      projectType: ProjectType;
      managerId: string;
      assignmentMode: AssignmentMode;
      status: ProjectStatus;
      memberIds: string[];
    }>
  ) => Promise<void>;
  onCreateTaskDirect: (input: {
    projectId: string;
    title: string;
    description: string;
    assignmentMode: AssignmentMode;
    assigneeId: string | null;
    teamAssigneeIds: string[];
    priority: Priority;
    dueDate: string;
    labels: string[];
  }) => Promise<void>;
  onMarkNotificationRead: (notifId: string) => void;
}

export const RoleDashboards: React.FC<RoleDashboardsProps> = ({
  user,
  projects,
  tasks,
  users,
  organizations,
  notifications,
  activityLogs,
  onSelectProject,
  onSelectTask,
  onQuickStatusChange,
  onOpenCreateProject,
  onOpenCreateTask,
  onUpdateUserRole,
  onCreateProjectDirect,
  onUpdateProjectDirect,
  onCreateTaskDirect,
  onMarkNotificationRead,
}) => {
  const nowMs = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endOfTodayMs = endOfToday.getTime();
  const threeDaysMs = nowMs + 3 * 24 * 60 * 60 * 1000;
  const sevenDaysMs = nowMs + 7 * 24 * 60 * 60 * 1000;

  // --- State for Admin Domain Project Assignment Console ---
  const [adminProjName, setAdminProjName] = useState('');
  const [adminProjType, setAdminProjType] = useState<ProjectType>(
    ProjectType.WEB_DEVELOPMENT
  );
  const [adminShowAllManagers, setAdminShowAllManagers] = useState(false);
  const [adminSelectedManagerId, setAdminSelectedManagerId] = useState<string>('');
  const [adminProjDesc, setAdminProjDesc] = useState('');
  const [adminProjPriority, setAdminProjPriority] = useState<Priority>(Priority.HIGH);
  const [adminProjMode, setAdminProjMode] = useState<AssignmentMode>(AssignmentMode.TEAM);
  const [adminProjDueDate, setAdminProjDueDate] = useState(() =>
    new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  );
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  // All Project Managers in the workspace
  const allManagers = useMemo(
    () => users.filter((u) => u.role === UserRole.PROJECT_MANAGER),
    [users]
  );

  // Filtered Project Managers matching the chosen Project Type
  const matchingDomainManagers = useMemo(
    () => allManagers.filter((m) => m.specialization === adminProjType),
    [allManagers, adminProjType]
  );

  const displayedAdminManagers =
    adminShowAllManagers || matchingDomainManagers.length === 0
      ? allManagers
      : matchingDomainManagers;

  const effectiveAdminManagerId = useMemo(() => {
    if (
      adminSelectedManagerId &&
      displayedAdminManagers.some((m) => m.id === adminSelectedManagerId)
    ) {
      return adminSelectedManagerId;
    }
    return displayedAdminManagers[0]?.id || allManagers[0]?.id || user.id;
  }, [adminSelectedManagerId, displayedAdminManagers, allManagers, user.id]);

  // --- State for Project Manager Work Assignment Studio ---
  const [pmTargetProjectId, setPmTargetProjectId] = useState<string>('');
  const [pmAssignmentMode, setPmAssignmentMode] = useState<AssignmentMode>(
    AssignmentMode.INDIVIDUAL
  );
  const [pmIndividualMemberId, setPmIndividualMemberId] = useState<string>('');
  const [pmSelectedTeamIds, setPmSelectedTeamIds] = useState<string[]>([]);
  const [pmTaskTitle, setPmTaskTitle] = useState('');
  const [pmTaskDesc, setPmTaskDesc] = useState('');
  const [pmTaskPriority, setPmTaskPriority] = useState<Priority>(Priority.HIGH);
  const [pmTaskDueDate, setPmTaskDueDate] = useState(() =>
    new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10)
  );
  const [pmSubmitting, setPmSubmitting] = useState(false);

  // --- State for Team Member Assigned Work Filter ---
  const [memberModeFilter, setMemberModeFilter] = useState<
    'ALL' | AssignmentMode
  >('ALL');

  // ============================================================================
  // 1. SUPER_ADMIN — "COMMAND CENTER" DASHBOARD
  // ============================================================================
  if (user.role === UserRole.SUPER_ADMIN) {
    const adminCount = users.filter((u) => u.role === UserRole.SUPER_ADMIN).length;
    const managerCount = users.filter((u) => u.role === UserRole.PROJECT_MANAGER).length;
    const memberCount = users.filter((u) => u.role === UserRole.TEAM_MEMBER).length;
    const totalUsers = Math.max(1, users.length);

    // SVG Donut calculations (r = 52, circumference = 2 * pi * 52 ≈ 326.7)
    const circumference = 2 * Math.PI * 52;
    const adminArc = (adminCount / totalUsers) * circumference;
    const managerArc = (managerCount / totalUsers) * circumference;
    const memberArc = (memberCount / totalUsers) * circumference;

    const statusCounts: Record<ProjectStatus, number> = {
      [ProjectStatus.PLANNING]: projects.filter((p) => p.status === ProjectStatus.PLANNING).length,
      [ProjectStatus.ACTIVE]: projects.filter((p) => p.status === ProjectStatus.ACTIVE).length,
      [ProjectStatus.ON_HOLD]: projects.filter((p) => p.status === ProjectStatus.ON_HOLD).length,
      [ProjectStatus.COMPLETED]: projects.filter((p) => p.status === ProjectStatus.COMPLETED).length,
      [ProjectStatus.ARCHIVED]: projects.filter((p) => p.status === ProjectStatus.ARCHIVED).length,
    };
    const maxStatusCount = Math.max(1, ...Object.values(statusCounts));

    const newestUsers = [...users].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const handleAdminCreateAndAssignProject = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!adminProjName.trim() || !adminProjDesc.trim()) return;
      setAdminSubmitting(true);
      try {
        await onCreateProjectDirect({
          name: adminProjName.trim(),
          projectType: adminProjType,
          managerId: effectiveAdminManagerId,
          description: adminProjDesc.trim(),
          priority: adminProjPriority,
          dueDate: new Date(adminProjDueDate).toISOString(),
          assignmentMode: adminProjMode,
        });
        setAdminProjName('');
        setAdminProjDesc('');
      } finally {
        setAdminSubmitting(false);
      }
    };

    return (
      <div className="space-y-6">
        {/* Header with Unified Side-by-Side Action Group */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[#6366F1] dark:text-indigo-400 flex items-center gap-2">
              <span>SUPER_ADMIN · Platform Governance</span>
              <span>·</span>
              <span className="font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 text-[#6366F1] dark:text-indigo-300">
                ID: {user.uniqueCode}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
              Command Center
            </h1>
          </div>

          {/* Unified Quick-Create Action Cluster (New Project + New Task side-by-side) */}
          <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={onOpenCreateProject}
              className="px-3.5 py-2 rounded-xl btn-3d-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenCreateTask()}
              className="px-3.5 py-2 rounded-xl btn-3d-secondary text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <ListTodo className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* 4 Top Aggregate 3D Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 tabular-nums">
          <div className="card-3d card-3d-interactive rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Users
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                {users.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {adminCount} Admin · {managerCount} Managers · {memberCount} Members
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-[#6366F1] flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="card-3d card-3d-interactive rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Organizations
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                {organizations.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Active multi-team workspaces
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-[#10B981] flex items-center justify-center shrink-0">
              <Layers className="w-6 h-6" />
            </div>
          </div>

          <div className="card-3d card-3d-interactive rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Projects
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                {projects.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {statusCounts.ACTIVE} Active · {statusCounts.PLANNING} Planning
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-[#F59E0B] flex items-center justify-center shrink-0">
              <FolderKanban className="w-6 h-6" />
            </div>
          </div>

          <div className="card-3d card-3d-interactive rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Total Tasks
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                {tasks.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {tasks.filter((t) => t.status === TaskStatus.DONE).length} completed across orgs
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <ListTodo className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* ADMIN PROJECT TYPE & DOMAIN-MATCHED MANAGER ASSIGNMENT CONSOLE      */}
        {/* =================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Create & Assign Project by Type -> Matching Domain Manager */}
          <div className="lg:col-span-5 card-3d rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
              <div>
                <div className="text-[11px] font-mono font-bold text-[#6366F1] uppercase">
                  Admin Project Dispatch
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  Assign Project to Domain Manager
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select Project Type first to filter matching Project Managers
                </p>
              </div>
              <Sparkles className="w-5 h-5 text-[#6366F1] shrink-0" />
            </div>

            <form onSubmit={handleAdminCreateAndAssignProject} className="space-y-3.5">
              {/* 1. Project Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  1. Project Name
                </label>
                <input
                  type="text"
                  required
                  value={adminProjName}
                  onChange={(e) => setAdminProjName(e.target.value)}
                  placeholder="e.g., Next-Gen Customer Web Portal"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              {/* 2. Project Type (BEFORE Description!) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  2. Project Type (Filters Specialist Project Manager)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).map((typeKey) => {
                    const active = adminProjType === typeKey;
                    const countForType = allManagers.filter(
                      (m) => m.specialization === typeKey
                    ).length;
                    return (
                      <button
                        key={typeKey}
                        type="button"
                        onClick={() => {
                          setAdminProjType(typeKey);
                          const firstMatch = allManagers.find(
                            (m) => m.specialization === typeKey
                          );
                          if (firstMatch) {
                            setAdminSelectedManagerId(firstMatch.id);
                          }
                        }}
                        className={`text-left px-3 py-2 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between ${
                          active
                            ? 'border-[#6366F1] bg-indigo-50/80 dark:bg-indigo-950/50 text-[#6366F1] dark:text-indigo-300 font-bold ring-2 ring-indigo-500/15'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <span className="truncate">{PROJECT_TYPE_LABELS[typeKey]}</span>
                        <span className="text-[10px] font-mono opacity-75 shrink-0 ml-1">
                          {countForType} PM
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Domain-Matched Project Manager Selector (BEFORE Description!) */}
              <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#6366F1]" />
                    <span>
                      3. Assign to {PROJECT_TYPE_LABELS[adminProjType]} Manager
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setAdminShowAllManagers((v) => !v)}
                    className="text-[11px] font-medium text-[#6366F1] dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {adminShowAllManagers
                      ? `Filter by ${PROJECT_TYPE_LABELS[adminProjType]} only`
                      : 'Show all managers'}
                  </button>
                </div>

                <select
                  aria-label="Select Project Manager"
                  value={effectiveAdminManagerId}
                  onChange={(e) => setAdminSelectedManagerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
                >
                  {displayedAdminManagers.map((mgr) => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.name} [{mgr.uniqueCode}] — {PROJECT_TYPE_LABELS[mgr.specialization]} Manager
                    </option>
                  ))}
                </select>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>
                    {matchingDomainManagers.length > 0 && !adminShowAllManagers
                      ? `Showing only ${PROJECT_TYPE_LABELS[adminProjType]} manager (${matchingDomainManagers.length} matched)`
                      : `Showing all ${allManagers.length} project managers`}
                  </span>
                  <span className="font-mono text-[#6366F1] dark:text-indigo-400 font-semibold">
                    {users.find((u) => u.id === effectiveAdminManagerId)?.uniqueCode}
                  </span>
                </div>
              </div>

              {/* 4. Project Description (Comes AFTER Project Type & Manager!) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  4. Project Description
                </label>
                <textarea
                  rows={2}
                  required
                  value={adminProjDesc}
                  onChange={(e) => setAdminProjDesc(e.target.value)}
                  placeholder="Describe scope, deliverables, and technical goals..."
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Priority
                  </label>
                  <select
                    value={adminProjPriority}
                    onChange={(e) => setAdminProjPriority(e.target.value as Priority)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value={Priority.LOW}>LOW</option>
                    <option value={Priority.MEDIUM}>MEDIUM</option>
                    <option value={Priority.HIGH}>HIGH</option>
                    <option value={Priority.URGENT}>URGENT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Delivery Mode
                  </label>
                  <select
                    value={adminProjMode}
                    onChange={(e) =>
                      setAdminProjMode(e.target.value as AssignmentMode)
                    }
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value={AssignmentMode.TEAM}>TEAM</option>
                    <option value={AssignmentMode.INDIVIDUAL}>INDIVIDUAL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={adminProjDueDate}
                    onChange={(e) => setAdminProjDueDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={adminSubmitting}
                className="w-full py-2.5 px-4 rounded-xl btn-3d-primary text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {adminSubmitting
                    ? 'Assigning Project...'
                    : `Create & Assign to ${
                        users.find((u) => u.id === effectiveAdminManagerId)?.name ||
                        'Manager'
                      }`}
                </span>
              </button>
            </form>
          </div>

          {/* Right: Active Projects & Domain Manager Matrix */}
          <div className="lg:col-span-7 card-3d rounded-2xl overflow-hidden flex flex-col justify-between">
            <div>
              <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Projects &amp; Domain Manager Assignment Matrix
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Change a project&apos;s type to filter and assign its specialized Project Manager
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[#6366F1] tabular-nums">
                  {projects.length} projects
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4">Project</th>
                      <th className="py-3 px-4">Project Type</th>
                      <th className="py-3 px-4">Assigned Domain Manager</th>
                      <th className="py-3 px-4">Mode</th>
                      <th className="py-3 px-4 text-right">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 tabular-nums">
                    {projects.map((proj) => {
                      const pType = proj.projectType || ProjectType.WEB_DEVELOPMENT;
                      // Filter managers matching this project's type
                      const domainMgrs = allManagers.filter(
                        (m) => m.specialization === pType
                      );
                      const currentMgrUser = users.find(
                        (u) => u.id === proj.managerId
                      );
                      const baseOptions =
                        domainMgrs.length > 0 ? domainMgrs : allManagers;
                      const mgrOptions =
                        currentMgrUser &&
                        !baseOptions.some((m) => m.id === currentMgrUser.id)
                          ? [currentMgrUser, ...baseOptions]
                          : baseOptions;
                      const recommendedDomainMgr = domainMgrs[0];
                      const isDomainMatched =
                        currentMgrUser?.role === UserRole.PROJECT_MANAGER &&
                        currentMgrUser.specialization === pType;

                      return (
                        <tr
                          key={proj.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => onSelectProject(proj.id)}
                              className="font-bold text-slate-900 dark:text-white hover:text-[#6366F1] text-left cursor-pointer"
                            >
                              {proj.name}
                            </button>
                            <div className="text-[11px] text-slate-400 line-clamp-1">
                              {proj.description}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              aria-label={`Project type for ${proj.name}`}
                              value={pType}
                              onChange={async (e) => {
                                const nextType = e.target.value as ProjectType;
                                const matchingMgr = allManagers.find(
                                  (m) => m.specialization === nextType
                                );
                                await onUpdateProjectDirect(proj.id, {
                                  projectType: nextType,
                                  ...(matchingMgr ? { managerId: matchingMgr.id } : {}),
                                });
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-[#6366F1] dark:text-indigo-400 cursor-pointer"
                            >
                              {(Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).map(
                                (tKey) => (
                                  <option key={tKey} value={tKey}>
                                    {PROJECT_TYPE_LABELS[tKey]}
                                  </option>
                                )
                              )}
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <select
                                aria-label={`Assign manager for ${proj.name}`}
                                value={proj.managerId}
                                onChange={async (e) => {
                                  await onUpdateProjectDirect(proj.id, {
                                    managerId: e.target.value,
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                              >
                                {mgrOptions.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.name} [{m.uniqueCode}] (
                                    {PROJECT_TYPE_LABELS[m.specialization] || m.role})
                                  </option>
                                ))}
                              </select>
                              {!isDomainMatched && recommendedDomainMgr && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onUpdateProjectDirect(proj.id, {
                                      managerId: recommendedDomainMgr.id,
                                    });
                                  }}
                                  className="px-2 py-1 rounded-lg btn-3d-primary text-[10px] font-semibold whitespace-nowrap cursor-pointer"
                                >
                                  Assign {recommendedDomainMgr.name.split(' ')[0]}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px]">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                              {proj.assignmentMode || 'TEAM'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {proj.taskStats.progressPercent}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row: Users-by-Role Donut + Projects-by-Status Bar Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Users by Role Donut */}
          <div className="lg:col-span-5 card-3d rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Users by System Role
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time distribution of RBAC access tiers
              </p>
            </div>

            <div className="my-6 flex flex-col sm:flex-row items-center justify-center gap-8">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 128 128">
                  <circle
                    cx="64"
                    cy="64"
                    r="52"
                    fill="transparent"
                    stroke="currentColor"
                    strokeWidth="14"
                    className="text-slate-100 dark:text-slate-800"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="52"
                    fill="transparent"
                    stroke="#0EA5E9"
                    strokeWidth="14"
                    strokeDasharray={`${memberArc} ${circumference}`}
                    strokeDashoffset={0}
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="52"
                    fill="transparent"
                    stroke="#10B981"
                    strokeWidth="14"
                    strokeDasharray={`${managerArc} ${circumference}`}
                    strokeDashoffset={-memberArc}
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="52"
                    fill="transparent"
                    stroke="#6366F1"
                    strokeWidth="14"
                    strokeDasharray={`${adminArc} ${circumference}`}
                    strokeDashoffset={-(memberArc + managerArc)}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center tabular-nums">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {users.length}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Total Users
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-xs tabular-nums w-full sm:w-auto">
                <div className="flex items-center justify-between gap-6">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                    <span className="w-3 h-3 rounded-sm bg-[#6366F1]" />
                    Super Admin
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {adminCount} ({Math.round((adminCount / totalUsers) * 100)}%)
                  </span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                    <span className="w-3 h-3 rounded-sm bg-[#10B981]" />
                    Project Manager
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {managerCount} ({Math.round((managerCount / totalUsers) * 100)}%)
                  </span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                    <span className="w-3 h-3 rounded-sm bg-sky-500" />
                    Team Member
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {memberCount} ({Math.round((memberCount / totalUsers) * 100)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Projects by Status Bar Chart */}
          <div className="lg:col-span-7 card-3d rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Projects by Status
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live portfolio breakdown across all lifecycle states
              </p>
            </div>

            <div className="space-y-3.5 my-auto pt-4 tabular-nums">
              {(
                [
                  { status: ProjectStatus.PLANNING, label: 'Planning', color: 'bg-sky-500' },
                  { status: ProjectStatus.ACTIVE, label: 'Active', color: 'bg-[#6366F1]' },
                  { status: ProjectStatus.ON_HOLD, label: 'On Hold', color: 'bg-[#F59E0B]' },
                  { status: ProjectStatus.COMPLETED, label: 'Completed', color: 'bg-[#10B981]' },
                  { status: ProjectStatus.ARCHIVED, label: 'Archived', color: 'bg-slate-400' },
                ] as const
              ).map((row) => {
                const count = statusCounts[row.status];
                const widthPct = Math.round((count / maxStatusCount) * 100);
                return (
                  <div key={row.status} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {row.label}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {count} {count === 1 ? 'project' : 'projects'}
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${row.color}`}
                        style={{ width: `${Math.max(count > 0 ? 8 : 0, widthPct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Row: Directory & Role/Specialization Management + Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 card-3d rounded-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Directory, Unique IDs &amp; Domain Specialization
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage system roles, domain specializations, and reporting lines
                </p>
              </div>
              <ShieldCheck className="w-5 h-5 text-[#6366F1]" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">User &amp; Unique ID</th>
                    <th className="py-3 px-4">Domain Specialization</th>
                    <th className="py-3 px-4">Role Assignment</th>
                    <th className="py-3 px-4">Reports To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 tabular-nums">
                  {newestUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={u.avatar}
                            alt={u.name}
                            referrerPolicy="no-referrer"
                            className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 dark:border-slate-700"
                          />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {u.name}
                            </div>
                            <div className="text-[10px] font-mono text-[#6366F1] dark:text-indigo-400">
                              {u.uniqueCode} · {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          aria-label={`Change specialization for ${u.name}`}
                          value={u.specialization || ProjectType.WEB_DEVELOPMENT}
                          onChange={(e) =>
                            onUpdateUserRole(u.id, {
                              specialization: e.target.value as ProjectType,
                            })
                          }
                          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                        >
                          {(Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).map(
                            (tKey) => (
                              <option key={tKey} value={tKey}>
                                {PROJECT_TYPE_LABELS[tKey]}
                              </option>
                            )
                          )}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          aria-label={`Change role for ${u.name}`}
                          value={u.role}
                          onChange={(e) =>
                            onUpdateUserRole(u.id, {
                              role: e.target.value as UserRole,
                            })
                          }
                          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <option value={UserRole.SUPER_ADMIN}>SUPER_ADMIN</option>
                          <option value={UserRole.PROJECT_MANAGER}>PROJECT_MANAGER</option>
                          <option value={UserRole.TEAM_MEMBER}>TEAM_MEMBER</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        {u.role === UserRole.TEAM_MEMBER ? (
                          <select
                            aria-label={`Assign manager for ${u.name}`}
                            value={u.managerId || ''}
                            onChange={(e) =>
                              onUpdateUserRole(u.id, {
                                managerId: e.target.value || null,
                              })
                            }
                            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                          >
                            <option value="">Unassigned</option>
                            {allManagers.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} [{m.uniqueCode}]
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-400">
                            {u.role === UserRole.PROJECT_MANAGER
                              ? 'Reports to Admin'
                              : 'System Root'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Activity Feed */}
          <div className="lg:col-span-5 card-3d rounded-2xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Recent Platform Activity
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Automatic audit trail of creates, moves, and updates
                </p>
              </div>
              <Activity className="w-5 h-5 text-[#10B981]" />
            </div>

            <div className="space-y-3.5 max-h-80 overflow-y-auto pr-1">
              {activityLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 text-xs pb-3 border-b border-slate-100 dark:border-slate-800/70 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-start gap-2.5">
                    {log.user?.avatar ? (
                      <img
                        src={log.user.avatar}
                        alt={log.user.name}
                        referrerPolicy="no-referrer"
                        className="w-6 h-6 rounded-full bg-slate-100 shrink-0 mt-0.5"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-[#6366F1] flex items-center justify-center shrink-0 mt-0.5 font-bold">
                        P
                      </div>
                    )}
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {log.user?.name || 'System'}
                      </span>{' '}
                      <span className="text-slate-600 dark:text-slate-300">
                        {log.description}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
                    {new Date(log.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. PROJECT_MANAGER — "PORTFOLIO & WORK ASSIGNMENT" DASHBOARD
  // ============================================================================
  if (user.role === UserRole.PROJECT_MANAGER) {
    const myManagedProjects = projects.filter((p) => p.managerId === user.id);
    const portfolioProjects = myManagedProjects.length > 0 ? myManagedProjects : projects;

    // Members under this Project Manager:
    // Includes team members who report to this manager (u.managerId === user.id) OR are in projects managed by this manager
    const memberIdsInMyProjects = new Set<string>();
    portfolioProjects.forEach((p) =>
      p.members.forEach((m) => {
        if (m.userId !== user.id) memberIdsInMyProjects.add(m.userId);
      })
    );

    const membersUnderManager = users.filter(
      (u) =>
        u.role === UserRole.TEAM_MEMBER &&
        (u.managerId === user.id || memberIdsInMyProjects.has(u.id))
    );

    const activeTargetProjectId =
      pmTargetProjectId && portfolioProjects.some((p) => p.id === pmTargetProjectId)
        ? pmTargetProjectId
        : portfolioProjects[0]?.id || '';

    const activeIndividualMemberId =
      pmIndividualMemberId &&
      membersUnderManager.some((m) => m.id === pmIndividualMemberId)
        ? pmIndividualMemberId
        : membersUnderManager[0]?.id || '';

    const portfolioProjectIds = new Set(portfolioProjects.map((p) => p.id));
    const portfolioTasks = tasks.filter((t) => portfolioProjectIds.has(t.projectId));

    const openTasks = portfolioTasks.filter((t) => t.status !== TaskStatus.DONE);
    const doneTasks = portfolioTasks.filter((t) => t.status === TaskStatus.DONE);
    const overdueTasks = openTasks.filter((t) => new Date(t.dueDate).getTime() < nowMs);
    const completionRate =
      portfolioTasks.length > 0
        ? Math.round((doneTasks.length / portfolioTasks.length) * 100)
        : 0;

    // At-risk tasks: overdue or due within 3 days
    const atRiskTasks = openTasks
      .filter((t) => new Date(t.dueDate).getTime() <= threeDaysMs)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    // Team workload calculation
    const workloadByMember = membersUnderManager.map((member) => {
      const assigned = tasks.filter(
        (t) =>
          t.assigneeId === member.id ||
          (Array.isArray(t.teamAssigneeIds) && t.teamAssigneeIds.includes(member.id))
      );
      const individualCount = assigned.filter(
        (t) => t.assignmentMode !== AssignmentMode.TEAM && t.status !== TaskStatus.DONE
      ).length;
      const teamCount = assigned.filter(
        (t) => t.assignmentMode === AssignmentMode.TEAM && t.status !== TaskStatus.DONE
      ).length;
      const activeCount = assigned.filter((t) => t.status !== TaskStatus.DONE).length;
      const completedCount = assigned.filter((t) => t.status === TaskStatus.DONE).length;
      return {
        member,
        individualCount,
        teamCount,
        activeCount,
        completedCount,
        total: assigned.length,
      };
    });

    const maxWorkload = Math.max(1, ...workloadByMember.map((w) => w.total));

    const toggleTeamMemberSelection = (memberId: string) => {
      setPmSelectedTeamIds((prev) =>
        prev.includes(memberId)
          ? prev.filter((id) => id !== memberId)
          : [...prev, memberId]
      );
    };

    const handlePmAssignWorkSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeTargetProjectId || !pmTaskTitle.trim()) return;
      const teamIds =
        pmAssignmentMode === AssignmentMode.TEAM
          ? pmSelectedTeamIds.length > 0
            ? pmSelectedTeamIds
            : membersUnderManager.map((m) => m.id)
          : activeIndividualMemberId
          ? [activeIndividualMemberId]
          : [];

      const primaryAssignee =
        pmAssignmentMode === AssignmentMode.INDIVIDUAL
          ? activeIndividualMemberId || null
          : teamIds[0] || null;

      setPmSubmitting(true);
      try {
        // Also sync the project's assignmentMode and memberIds so the project reflects Individual or Team mode
        await onUpdateProjectDirect(activeTargetProjectId, {
          assignmentMode: pmAssignmentMode,
          memberIds: teamIds,
        });

        await onCreateTaskDirect({
          projectId: activeTargetProjectId,
          title: pmTaskTitle.trim(),
          description:
            pmTaskDesc.trim() ||
            `Assigned as ${pmAssignmentMode} deliverable by ${user.name} [${user.uniqueCode}].`,
          assignmentMode: pmAssignmentMode,
          assigneeId: primaryAssignee,
          teamAssigneeIds: teamIds,
          priority: pmTaskPriority,
          dueDate: new Date(pmTaskDueDate).toISOString(),
          labels: [
            pmAssignmentMode === AssignmentMode.TEAM ? 'Team Work' : 'Individual Work',
            PROJECT_TYPE_LABELS[user.specialization] || 'Delivery',
          ],
        });
        setPmTaskTitle('');
        setPmTaskDesc('');
      } finally {
        setPmSubmitting(false);
      }
    };

    return (
      <div className="space-y-6">
        {/* Header with Unified Side-by-Side Action Cluster */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[#10B981] flex flex-wrap items-center gap-2">
              <span>
                PROJECT_MANAGER · {PROJECT_TYPE_LABELS[user.specialization]} Lead
              </span>
              <span>·</span>
              <span className="font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-[#10B981]">
                ID: {user.uniqueCode}
              </span>
              <span>·</span>
              <span className="font-mono text-slate-600 dark:text-slate-300">
                {membersUnderManager.length} Members Under You
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
              Portfolio &amp; Team Work Assignment
            </h1>
          </div>

          {/* Unified Quick-Create Action Cluster (New Project + New Task side-by-side) */}
          <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={onOpenCreateProject}
              className="px-3.5 py-2 rounded-xl btn-3d-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenCreateTask()}
              className="px-3.5 py-2 rounded-xl btn-3d-secondary text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <ListTodo className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>New Task</span>
            </button>
          </div>
        </div>

        {/* 4 Manager Aggregate Cards (including Members Under Manager with Unique IDs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 tabular-nums">
          <div className="card-3d card-3d-interactive rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Members Under Manager
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                {membersUnderManager.length}
              </div>
              <div className="text-xs text-[#10B981] font-mono mt-1">
                {membersUnderManager.map((m) => m.uniqueCode).join(' · ')}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-[#10B981] flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="card-3d card-3d-interactive rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Managed Projects
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                {portfolioProjects.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {PROJECT_TYPE_LABELS[user.specialization]} Portfolio
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-[#6366F1] flex items-center justify-center shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
          </div>

          <div className="card-3d card-3d-interactive rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Open Tasks
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                {openTasks.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {overdueTasks.length} overdue deliverables
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <ListTodo className="w-6 h-6" />
            </div>
          </div>

          <div className="card-3d card-3d-interactive rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Completion Rate
              </div>
              <div className="text-3xl font-bold text-[#10B981] mt-1">
                {completionRate}%
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {doneTasks.length} of {tasks.length} tasks shipped
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-[#10B981] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* PROJECT MANAGER: MEMBERS UNDER MANAGER (WITH UNIQUE ID) &           */}
        {/* INDIVIDUAL vs TEAM WORK ASSIGNMENT STUDIO                           */}
        {/* =================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Cols: Members Under This Manager with Unique IDs */}
          <div className="lg:col-span-7 card-3d rounded-2xl overflow-hidden flex flex-col justify-between">
            <div>
              <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono font-bold text-[#10B981] uppercase">
                    Direct Team Roster · {membersUnderManager.length} Members Under {user.name}
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    Members Under Your Management &amp; Unique IDs
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Select any member by their Unique ID to assign Individual or Team work
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-[#10B981] font-mono text-xs font-bold tabular-nums">
                  Total: {membersUnderManager.length} Members
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500">
                      <th className="py-3 px-4">Unique ID</th>
                      <th className="py-3 px-4">Member Name</th>
                      <th className="py-3 px-4">Specialization</th>
                      <th className="py-3 px-4">Assigned Work</th>
                      <th className="py-3 px-4 text-right">Quick Assign</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 tabular-nums">
                    {workloadByMember.map(
                      ({ member, individualCount, teamCount, completedCount }) => (
                        <tr
                          key={member.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-[#6366F1] dark:text-indigo-300 font-mono font-bold text-xs">
                              <Hash className="w-3 h-3" />
                              {member.uniqueCode}
                            </span>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                              {member.id}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={member.avatar}
                                alt={member.name}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 dark:border-slate-700"
                              />
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {member.name}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {member.email}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                            {PROJECT_TYPE_LABELS[member.specialization]}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px]">
                            <div className="text-slate-800 dark:text-slate-200 font-semibold">
                              {individualCount} Individual · {teamCount} Team
                            </div>
                            <div className="text-slate-400">{completedCount} Completed</div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setPmAssignmentMode(AssignmentMode.INDIVIDUAL);
                                  setPmIndividualMemberId(member.id);
                                  onOpenCreateTask({
                                    projectId: activeTargetProjectId,
                                    assignmentMode: AssignmentMode.INDIVIDUAL,
                                    assigneeId: member.id,
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-lg btn-3d-secondary text-[11px] font-semibold text-[#6366F1] dark:text-indigo-400 cursor-pointer"
                              >
                                + Individual
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPmAssignmentMode(AssignmentMode.TEAM);
                                  const allIds = membersUnderManager.map((m) => m.id);
                                  setPmSelectedTeamIds(allIds);
                                  onOpenCreateTask({
                                    projectId: activeTargetProjectId,
                                    assignmentMode: AssignmentMode.TEAM,
                                    assigneeId: member.id,
                                    teamAssigneeIds: allIds,
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-lg btn-3d-secondary text-[11px] font-semibold text-[#10B981] cursor-pointer"
                              >
                                + Team
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Assign Project / Task Work (Individual vs Team) */}
          <div className="lg:col-span-5 card-3d rounded-2xl p-6 space-y-4">
            <div className="border-b border-slate-200/80 dark:border-slate-800 pb-3">
              <div className="text-[11px] font-mono font-bold text-[#6366F1] uppercase">
                Work Assignment Studio
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                Assign Project &amp; Task Work
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose Individual or Team mode and select members by Unique ID
              </p>
            </div>

            <form onSubmit={handlePmAssignWorkSubmit} className="space-y-3.5">
              {/* Step 1: Select Project */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  1. Select Project
                </label>
                <select
                  value={activeTargetProjectId}
                  onChange={(e) => setPmTargetProjectId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
                >
                  {portfolioProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({PROJECT_TYPE_LABELS[p.projectType || ProjectType.WEB_DEVELOPMENT]})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Select Assignment Mode (Individual vs Team) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  2. Select Work Mode (Individual or Team)
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPmAssignmentMode(AssignmentMode.INDIVIDUAL)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      pmAssignmentMode === AssignmentMode.INDIVIDUAL
                        ? 'border-[#6366F1] bg-indigo-50/80 dark:bg-indigo-950/50 text-[#6366F1] dark:text-indigo-300 font-bold ring-2 ring-indigo-500/15'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <UserIcon className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Individual</div>
                      <div className="text-[10px] opacity-80">Single Member ID</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPmAssignmentMode(AssignmentMode.TEAM);
                      if (pmSelectedTeamIds.length === 0) {
                        setPmSelectedTeamIds(membersUnderManager.map((m) => m.id));
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                      pmAssignmentMode === AssignmentMode.TEAM
                        ? 'border-[#10B981] bg-emerald-50/80 dark:bg-emerald-950/50 text-[#10B981] font-bold ring-2 ring-emerald-500/15'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Team Squad</div>
                      <div className="text-[10px] opacity-80">
                        Multiple Member IDs
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Step 3: Select Member(s) with Unique ID */}
              {pmAssignmentMode === AssignmentMode.INDIVIDUAL ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    3. Assign to Member (with Unique ID)
                  </label>
                  <select
                    value={activeIndividualMemberId}
                    onChange={(e) => setPmIndividualMemberId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-mono font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer"
                  >
                    {membersUnderManager.map((m) => (
                      <option key={m.id} value={m.id}>
                        [{m.uniqueCode}] {m.name} — {PROJECT_TYPE_LABELS[m.specialization]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      3. Select Team Members ({pmSelectedTeamIds.length || membersUnderManager.length} selected)
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setPmSelectedTeamIds(membersUnderManager.map((m) => m.id))
                      }
                      className="text-[11px] font-medium text-[#10B981] hover:underline cursor-pointer"
                    >
                      Select All {membersUnderManager.length}
                    </button>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40">
                    {membersUnderManager.map((m) => {
                      const checked = pmSelectedTeamIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTeamMemberSelection(m.id)}
                              className="rounded border-slate-300 text-[#10B981] focus:ring-[#10B981]"
                            />
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {m.name}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] font-bold text-[#6366F1] dark:text-indigo-400">
                            {m.uniqueCode}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 4: Deliverable Title & Details */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  4. Work / Task Title
                </label>
                <input
                  type="text"
                  required
                  value={pmTaskTitle}
                  onChange={(e) => setPmTaskTitle(e.target.value)}
                  placeholder="e.g., Ship responsive checkout flow & API integration"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Priority
                  </label>
                  <select
                    value={pmTaskPriority}
                    onChange={(e) => setPmTaskPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value={Priority.LOW}>LOW</option>
                    <option value={Priority.MEDIUM}>MEDIUM</option>
                    <option value={Priority.HIGH}>HIGH</option>
                    <option value={Priority.URGENT}>URGENT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={pmTaskDueDate}
                    onChange={(e) => setPmTaskDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={pmSubmitting}
                className="w-full py-2.5 px-4 rounded-xl btn-3d-primary text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {pmSubmitting
                    ? 'Assigning Work...'
                    : pmAssignmentMode === AssignmentMode.TEAM
                    ? `Assign Team Work (${
                        pmSelectedTeamIds.length || membersUnderManager.length
                      } Members)`
                    : `Assign Individual Work`}
                </span>
              </button>
            </form>
          </div>
        </div>

        {/* Project Health Cards with Project Type & Individual/Team Toggle */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Project Health Cards
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Toggle Individual or Team mode or click any project to open its Kanban board
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {portfolioProjects.map((project) => {
              const isOverdue =
                project.status !== ProjectStatus.COMPLETED &&
                new Date(project.dueDate).getTime() < nowMs;
              const pTypeLabel =
                PROJECT_TYPE_LABELS[project.projectType || ProjectType.WEB_DEVELOPMENT];
              const pMode = project.assignmentMode || AssignmentMode.TEAM;

              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className="card-3d card-3d-interactive rounded-2xl p-5 flex flex-col justify-between space-y-4 cursor-pointer"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold text-[#6366F1] dark:text-indigo-400">
                        {pTypeLabel}
                      </span>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const nextMode =
                            pMode === AssignmentMode.TEAM
                              ? AssignmentMode.INDIVIDUAL
                              : AssignmentMode.TEAM;
                          await onUpdateProjectDirect(project.id, {
                            assignmentMode: nextMode,
                          });
                        }}
                        title="Click to switch project between Individual and Team mode"
                        className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold cursor-pointer ${
                          pMode === AssignmentMode.TEAM
                            ? 'bg-emerald-500/10 text-[#10B981]'
                            : 'bg-indigo-500/10 text-[#6366F1]'
                        }`}
                      >
                        {pMode} MODE
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {project.name}
                      </h3>
                      <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-slate-200/70 dark:border-slate-800">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5 tabular-nums">
                        <span className="text-slate-500 dark:text-slate-400">
                          {project.taskStats.done} of {project.taskStats.total} tasks done
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {project.taskStats.progressPercent}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-[#6366F1] rounded-full transition-all duration-300"
                          style={{ width: `${project.taskStats.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Assigned Member Unique IDs */}
                    <div className="flex flex-wrap gap-1">
                      {project.members.slice(0, 4).map((m) => (
                        <span
                          key={m.id}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          title={m.user.name}
                        >
                          {m.user.uniqueCode}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex -space-x-2">
                        {project.members.slice(0, 4).map((m) => (
                          <img
                            key={m.id}
                            src={m.user.avatar}
                            alt={m.user.name}
                            title={`${m.user.name} (${m.user.uniqueCode})`}
                            referrerPolicy="no-referrer"
                            className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100"
                          />
                        ))}
                      </div>
                      <span
                        className={`text-xs font-mono tabular-nums ${
                          isOverdue
                            ? 'text-[#EF4444] font-semibold'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Due {new Date(project.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team Workload Bar Chart + At-Risk List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Team Workload Bar Chart */}
          <div className="lg:col-span-6 card-3d rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Team Workload Distribution (By Unique ID)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Active vs. completed tasks across members under your management
              </p>
            </div>

            <div className="space-y-4 pt-2 tabular-nums">
              {workloadByMember.map(({ member, activeCount, completedCount, total }) => {
                const activeWidth = Math.round((activeCount / maxWorkload) * 100);
                const doneWidth = Math.round((completedCount / maxWorkload) * 100);
                return (
                  <div key={member.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                        <img
                          src={member.avatar}
                          alt={member.name}
                          referrerPolicy="no-referrer"
                          className="w-5 h-5 rounded-full bg-slate-100"
                        />
                        <span>{member.name}</span>
                        <span className="font-mono text-[10px] text-[#6366F1] dark:text-indigo-400">
                          [{member.uniqueCode}]
                        </span>
                      </div>
                      <span className="text-slate-500 dark:text-slate-400 font-mono">
                        {activeCount} open · {completedCount} done ({total})
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                      <div
                        className="h-full bg-[#6366F1]"
                        style={{ width: `${activeWidth}%` }}
                        title={`${activeCount} Open`}
                      />
                      <div
                        className="h-full bg-[#10B981]"
                        style={{ width: `${doneWidth}%` }}
                        title={`${completedCount} Completed`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* At-Risk List (Overdue or Due within 3 days) */}
          <div className="lg:col-span-6 card-3d rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  At-Risk Deliverables
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tasks overdue or due within the next 72 hours
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-[#EF4444] tabular-nums">
                {atRiskTasks.length} at risk
              </span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {atRiskTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No tasks are overdue or due within 3 days.
                </div>
              ) : (
                atRiskTasks.map((t) => {
                  const isOverdue = new Date(t.dueDate).getTime() < nowMs;
                  return (
                    <div
                      key={t.id}
                      onClick={() => onSelectTask(t)}
                      className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-[#6366F1] bg-slate-50/70 dark:bg-slate-800/40 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {t.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {t.projectName} · {t.assignee?.name || 'Unassigned'}{' '}
                          {t.assignee?.uniqueCode ? `[${t.assignee.uniqueCode}]` : ''} ·{' '}
                          {t.assignmentMode || 'INDIVIDUAL'}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-mono font-semibold tabular-nums shrink-0 ${
                          isOverdue ? 'text-[#EF4444]' : 'text-[#F59E0B]'
                        }`}
                      >
                        {isOverdue
                          ? 'Overdue'
                          : `Due ${new Date(t.dueDate).toLocaleDateString()}`}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 3. TEAM_MEMBER — "MY FOCUS & WORK ASSIGNED BY PROJECT MANAGER" DASHBOARD
  // ============================================================================
  const myTasks = tasks.filter(
    (t) =>
      t.assigneeId === user.id ||
      (Array.isArray(t.teamAssigneeIds) && t.teamAssigneeIds.includes(user.id))
  );
  const myIndividualTasks = myTasks.filter(
    (t) => (t.assignmentMode || AssignmentMode.INDIVIDUAL) === AssignmentMode.INDIVIDUAL
  );
  const myTeamTasks = myTasks.filter(
    (t) => t.assignmentMode === AssignmentMode.TEAM
  );

  const filteredMemberTasks =
    memberModeFilter === 'ALL'
      ? myTasks
      : memberModeFilter === AssignmentMode.INDIVIDUAL
      ? myIndividualTasks
      : myTeamTasks;

  const myOpenTasks = myTasks.filter((t) => t.status !== TaskStatus.DONE);
  const reportingManager = users.find((u) => u.id === user.managerId);

  const dueTodayOrOverdue = myOpenTasks.filter(
    (t) => new Date(t.dueDate).getTime() <= endOfTodayMs
  );
  const dueThisWeek = myOpenTasks.filter((t) => {
    const ms = new Date(t.dueDate).getTime();
    return ms > endOfTodayMs && ms <= sevenDaysMs;
  });

  const statusCounts = {
    [TaskStatus.TODO]: myTasks.filter((t) => t.status === TaskStatus.TODO).length,
    [TaskStatus.IN_PROGRESS]: myTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
    [TaskStatus.IN_REVIEW]: myTasks.filter((t) => t.status === TaskStatus.IN_REVIEW).length,
    [TaskStatus.DONE]: myTasks.filter((t) => t.status === TaskStatus.DONE).length,
  };

  // Build 14-day due-date timeline
  const timelineDays = Array.from({ length: 14 }, (_, idx) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + idx);
    const nextD = new Date(d);
    nextD.setDate(nextD.getDate() + 1);
    const dayTasks = myTasks.filter((t) => {
      const tMs = new Date(t.dueDate).getTime();
      return tMs >= d.getTime() && tMs < nextD.getTime();
    });
    return {
      date: d,
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      dayNum: d.getDate(),
      tasks: dayTasks,
    };
  });

  return (
    <div className="space-y-6">
      {/* Member Identity & Supervising Project Manager Header */}
      <div className="card-3d rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-sky-600 dark:text-sky-400 flex flex-wrap items-center gap-2">
            <span>TEAM_MEMBER · {PROJECT_TYPE_LABELS[user.specialization]}</span>
            <span>·</span>
            <span className="font-mono px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold">
              Your Unique ID: {user.uniqueCode}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            My Focus — {user.name}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {myOpenTasks.length} active deliverables assigned to you ({myIndividualTasks.length}{' '}
            Individual · {myTeamTasks.length} Team) across {projects.length} projects
          </p>
        </div>

        {reportingManager && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
            <img
              src={reportingManager.avatar}
              alt={reportingManager.name}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full bg-white border border-slate-200"
            />
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Your Project Manager
              </div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {reportingManager.name}{' '}
                <span className="font-mono text-[#6366F1]">
                  [{reportingManager.uniqueCode}]
                </span>
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {PROJECT_TYPE_LABELS[reportingManager.specialization]} Lead
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compact Personal Status Board */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        {(
          [
            { status: TaskStatus.TODO, label: 'To Do', accent: 'text-slate-700 dark:text-slate-200' },
            { status: TaskStatus.IN_PROGRESS, label: 'In Progress', accent: 'text-[#6366F1]' },
            { status: TaskStatus.IN_REVIEW, label: 'In Review', accent: 'text-[#F59E0B]' },
            { status: TaskStatus.DONE, label: 'Completed', accent: 'text-[#10B981]' },
          ] as const
        ).map((col) => (
          <div
            key={col.status}
            className="card-3d card-3d-interactive rounded-2xl p-5 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {col.label}
              </span>
              <span className="text-xs font-mono text-slate-400">{col.status}</span>
            </div>
            <div className={`text-3xl font-bold mt-2 ${col.accent}`}>
              {statusCounts[col.status]}
            </div>
          </div>
        ))}
      </div>

      {/* =================================================================== */}
      {/* STRUCTURED SECTION: WORK ASSIGNED BY YOUR PROJECT MANAGER           */}
      {/* =================================================================== */}
      <div className="card-3d rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-4">
          <div>
            <div className="text-[11px] font-mono font-bold text-[#6366F1] uppercase">
              Structured Work Queue · ID {user.uniqueCode}
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              Work Assigned to You by Your Project Manager
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              View whether each task was assigned as Individual work or Team collaboration and progress status in one click
            </p>
          </div>

          {/* Filter Pills: All vs Individual vs Team */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 self-start">
            {(
              [
                { id: 'ALL', label: `All Work (${myTasks.length})` },
                {
                  id: AssignmentMode.INDIVIDUAL,
                  label: `Individual (${myIndividualTasks.length})`,
                },
                {
                  id: AssignmentMode.TEAM,
                  label: `Team Squad (${myTeamTasks.length})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMemberModeFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  memberModeFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-[#6366F1] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredMemberTasks.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No assigned work matches this filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMemberTasks.map((t) => {
              const isTeam = t.assignmentMode === AssignmentMode.TEAM;
              const mgr = t.projectManager || t.createdBy || reportingManager;
              const isOverdue =
                t.status !== TaskStatus.DONE &&
                new Date(t.dueDate).getTime() < nowMs;
              const nextStatus =
                t.status === TaskStatus.TODO
                  ? TaskStatus.IN_PROGRESS
                  : t.status === TaskStatus.IN_PROGRESS
                  ? TaskStatus.IN_REVIEW
                  : t.status === TaskStatus.IN_REVIEW
                  ? TaskStatus.DONE
                  : null;

              return (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col justify-between gap-4 hover:border-[#6366F1] transition-all"
                >
                  <div className="space-y-2.5">
                    {/* Top Attribution Row: Assignment Mode Badge + Project Type */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold ${
                          isTeam
                            ? 'bg-emerald-500/10 text-[#10B981]'
                            : 'bg-indigo-500/10 text-[#6366F1] dark:text-indigo-300'
                        }`}
                      >
                        {isTeam ? (
                          <>
                            <Users className="w-3.5 h-3.5" />
                            <span>TEAM ASSIGNMENT</span>
                          </>
                        ) : (
                          <>
                            <UserIcon className="w-3.5 h-3.5" />
                            <span>INDIVIDUAL · {user.uniqueCode}</span>
                          </>
                        )}
                      </span>

                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {t.projectName} ·{' '}
                        {PROJECT_TYPE_LABELS[t.projectType || ProjectType.WEB_DEVELOPMENT]}
                      </span>
                    </div>

                    {/* Task Title & Description */}
                    <div
                      onClick={() => onSelectTask(t)}
                      className="cursor-pointer group"
                    >
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#6366F1] transition-colors">
                        {t.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-1">
                        {t.description}
                      </p>
                    </div>

                    {/* Assigned By Project Manager & Collaborating Team IDs */}
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Assigned by Manager:</span>
                        <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {mgr?.avatar && (
                            <img
                              src={mgr.avatar}
                              alt={mgr.name}
                              referrerPolicy="no-referrer"
                              className="w-4 h-4 rounded-full"
                            />
                          )}
                          <span>{mgr?.name || 'Project Manager'}</span>
                          {mgr?.uniqueCode && (
                            <span className="font-mono text-[10px] text-[#6366F1]">
                              [{mgr.uniqueCode}]
                            </span>
                          )}
                        </span>
                      </div>

                      {isTeam && t.teamAssignees && t.teamAssignees.length > 0 && (
                        <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-slate-500 shrink-0">Team Squad IDs:</span>
                          <div className="flex flex-wrap justify-end gap-1">
                            {t.teamAssignees.map((mate) => (
                              <span
                                key={mate.id}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[#10B981] font-mono text-[10px] font-semibold"
                              >
                                {mate.name.split(' ')[0]} [{mate.uniqueCode}]
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Status & 1-Click Progression */}
                  <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs tabular-nums">
                      <span className="font-mono font-bold text-[#6366F1]">
                        {t.status}
                      </span>
                      <span>·</span>
                      <span
                        className={
                          isOverdue
                            ? 'text-[#EF4444] font-semibold'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        Due {new Date(t.dueDate).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {nextStatus ? (
                        <button
                          type="button"
                          onClick={() => onQuickStatusChange(t, nextStatus)}
                          className="px-3 py-1.5 rounded-xl btn-3d-primary text-xs font-semibold cursor-pointer"
                        >
                          Move to {nextStatus.replace('_', ' ')}
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-[#10B981] font-mono text-xs font-bold">
                          COMPLETED
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My Tasks Grouped by Today & This Week */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today & Overdue */}
        <div className="card-3d rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Due Today &amp; Overdue
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                High-priority deliverables requiring immediate focus
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#EF4444] tabular-nums">
              {dueTodayOrOverdue.length} tasks
            </span>
          </div>

          <div className="space-y-3">
            {dueTodayOrOverdue.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                You are all caught up for today!
              </div>
            ) : (
              dueTodayOrOverdue.map((t) => {
                const isOverdue = new Date(t.dueDate).getTime() < nowMs;
                const nextStatus =
                  t.status === TaskStatus.TODO
                    ? TaskStatus.IN_PROGRESS
                    : t.status === TaskStatus.IN_PROGRESS
                    ? TaskStatus.IN_REVIEW
                    : TaskStatus.DONE;
                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div
                      onClick={() => onSelectTask(t)}
                      className="cursor-pointer space-y-1 flex-1"
                    >
                      <div className="text-sm font-semibold text-slate-900 dark:text-white hover:text-[#6366F1] transition-colors">
                        {t.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                        <span>{t.projectName}</span>
                        <span>·</span>
                        <span className="font-mono">
                          {t.assignmentMode || 'INDIVIDUAL'}
                        </span>
                        <span>·</span>
                        <span
                          className={
                            isOverdue
                              ? 'text-[#EF4444] font-semibold'
                              : 'text-[#F59E0B] font-medium'
                          }
                        >
                          {isOverdue ? 'Overdue' : 'Due Today'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onQuickStatusChange(t, nextStatus)}
                      className="px-3 py-1.5 rounded-xl btn-3d-secondary text-xs font-semibold text-[#6366F1] dark:text-indigo-400 shrink-0 cursor-pointer"
                    >
                      Move to {nextStatus.replace('_', ' ')}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Due This Week */}
        <div className="card-3d rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Due This Week
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upcoming milestones over the next 7 days
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#6366F1] tabular-nums">
              {dueThisWeek.length} tasks
            </span>
          </div>

          <div className="space-y-3">
            {dueThisWeek.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No additional tasks due this week.
              </div>
            ) : (
              dueThisWeek.map((t) => {
                const nextStatus =
                  t.status === TaskStatus.TODO
                    ? TaskStatus.IN_PROGRESS
                    : t.status === TaskStatus.IN_PROGRESS
                    ? TaskStatus.IN_REVIEW
                    : TaskStatus.DONE;
                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div
                      onClick={() => onSelectTask(t)}
                      className="cursor-pointer space-y-1 flex-1"
                    >
                      <div className="text-sm font-semibold text-slate-900 dark:text-white hover:text-[#6366F1] transition-colors">
                        {t.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 tabular-nums">
                        <span>{t.projectName}</span>
                        <span>·</span>
                        <span className="font-mono">
                          {t.assignmentMode || 'INDIVIDUAL'}
                        </span>
                        <span>·</span>
                        <span>Due {new Date(t.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onQuickStatusChange(t, nextStatus)}
                      className="px-3 py-1.5 rounded-xl btn-3d-secondary text-xs font-semibold text-[#6366F1] dark:text-indigo-400 shrink-0 cursor-pointer"
                    >
                      Move to {nextStatus.replace('_', ' ')}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 14-Day Due-Date Timeline + Recent Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 card-3d rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                14-Day Due-Date Timeline
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your two-week deliverable horizon
              </p>
            </div>
            <Calendar className="w-5 h-5 text-[#6366F1]" />
          </div>

          <div className="grid grid-cols-7 gap-2 pt-2 tabular-nums">
            {timelineDays.map((day, idx) => {
              const hasTasks = day.tasks.length > 0;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (day.tasks[0]) onSelectTask(day.tasks[0]);
                  }}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    hasTasks
                      ? 'border-[#6366F1] bg-indigo-50/70 dark:bg-indigo-950/40 cursor-pointer hover:-translate-y-0.5'
                      : 'border-slate-200/70 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20'
                  }`}
                >
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {day.label}
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {day.dayNum}
                  </div>
                  <div className="mt-1.5 text-[10px] font-mono font-semibold text-[#6366F1] dark:text-indigo-400">
                    {hasTasks ? `${day.tasks.length} due` : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="lg:col-span-5 card-3d rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Recent Notifications
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Task assignments, comments, and deadline alerts
              </p>
            </div>
            <Bell className="w-5 h-5 text-[#F59E0B]" />
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No notifications yet.
              </div>
            ) : (
              notifications.slice(0, 6).map((n) => (
                <div
                  key={n.id}
                  onClick={() => onMarkNotificationRead(n.id)}
                  className={`p-3 rounded-xl border text-xs transition-colors cursor-pointer ${
                    n.isRead
                      ? 'border-slate-200/60 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 text-slate-500'
                      : 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 text-slate-900 dark:text-white font-medium'
                  }`}
                >
                  <div>{n.message}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1 flex items-center justify-between">
                    <span>{n.type}</span>
                    <span>{n.isRead ? 'Read' : 'Unread · Click to mark read'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
