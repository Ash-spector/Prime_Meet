import React from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Bell,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  FolderKanban,
  Layers,
  ListTodo,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  EnrichedActivityLog,
  EnrichedProject,
  EnrichedTask,
  Notification,
  Organization,
  ProjectStatus,
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
  onOpenCreateTask: () => void;
  onUpdateUserRole: (userId: string, role: UserRole) => void;
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
  onMarkNotificationRead,
}) => {
  const nowMs = Date.now();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const endOfTodayMs = endOfToday.getTime();
  const threeDaysMs = nowMs + 3 * 24 * 60 * 60 * 1000;
  const sevenDaysMs = nowMs + 7 * 24 * 60 * 60 * 1000;

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

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[#6366F1] dark:text-indigo-400">
              SUPER_ADMIN · Platform Governance
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
              Command Center
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenCreateProject}
              className="px-4 py-2 rounded-xl btn-3d-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
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
                  {/* Member Segment */}
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
                  {/* Manager Segment */}
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
                  {/* Admin Segment */}
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

        {/* Bottom Row: Newest Users Table + Recent Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Newest Users Table */}
          <div className="lg:col-span-7 card-3d rounded-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Directory & Role Management
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Newest users and live role assignment (Super Admin privilege)
                </p>
              </div>
              <ShieldCheck className="w-5 h-5 text-[#6366F1]" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role Assignment</th>
                    <th className="py-3 px-4 text-right">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 tabular-nums">
                  {newestUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2.5">
                        <img
                          src={u.avatar}
                          alt={u.name}
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 dark:border-slate-700"
                        />
                        <span className="truncate">{u.name}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {u.email}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          aria-label={`Change role for ${u.name}`}
                          value={u.role}
                          onChange={(e) =>
                            onUpdateUserRole(u.id, e.target.value as UserRole)
                          }
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <option value={UserRole.SUPER_ADMIN}>SUPER_ADMIN</option>
                          <option value={UserRole.PROJECT_MANAGER}>PROJECT_MANAGER</option>
                          <option value={UserRole.TEAM_MEMBER}>TEAM_MEMBER</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400 font-mono">
                        {new Date(u.createdAt).toLocaleDateString()}
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
  // 2. PROJECT_MANAGER — "PORTFOLIO" DASHBOARD
  // ============================================================================
  if (user.role === UserRole.PROJECT_MANAGER) {
    const myManagedProjects = projects.filter((p) => p.managerId === user.id);
    const portfolioProjects = myManagedProjects.length > 0 ? myManagedProjects : projects;
    const openTasks = tasks.filter((t) => t.status !== TaskStatus.DONE);
    const doneTasks = tasks.filter((t) => t.status === TaskStatus.DONE);
    const overdueTasks = openTasks.filter((t) => new Date(t.dueDate).getTime() < nowMs);
    const completionRate =
      tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

    // At-risk tasks: overdue or due within 3 days
    const atRiskTasks = openTasks
      .filter((t) => new Date(t.dueDate).getTime() <= threeDaysMs)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    // Team workload calculation
    const workloadByMember = users
      .filter((u) => u.role !== UserRole.SUPER_ADMIN)
      .map((member) => {
        const assigned = tasks.filter((t) => t.assigneeId === member.id);
        const activeCount = assigned.filter((t) => t.status !== TaskStatus.DONE).length;
        const completedCount = assigned.filter((t) => t.status === TaskStatus.DONE).length;
        return {
          member,
          activeCount,
          completedCount,
          total: assigned.length,
        };
      })
      .filter((w) => w.total > 0);

    const maxWorkload = Math.max(1, ...workloadByMember.map((w) => w.total));

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[#10B981]">
              PROJECT_MANAGER · Delivery & Capacity
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
              Portfolio Overview
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenCreateTask}
              className="px-3.5 py-2 rounded-xl btn-3d-secondary text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#6366F1]" />
              <span>Create Task</span>
            </button>
            <button
              type="button"
              onClick={onOpenCreateProject}
              className="px-4 py-2 rounded-xl btn-3d-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* 4 Manager Aggregate Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 tabular-nums">
          <div className="card-3d card-3d-interactive rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                My Projects
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                {portfolioProjects.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {projects.length} visible in organization
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-[#6366F1] flex items-center justify-center">
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
                In progress &amp; review queue
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <ListTodo className="w-6 h-6" />
            </div>
          </div>

          <div className="card-3d card-3d-interactive rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Overdue Tasks
              </div>
              <div
                className={`text-3xl font-bold mt-1 ${
                  overdueTasks.length > 0
                    ? 'text-[#EF4444]'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {overdueTasks.length}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Requires immediate attention
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-[#EF4444] flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
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
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-[#10B981] flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Project Health Cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Project Health Cards
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Click any project card to open its Kanban &amp; workspace tabs
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projects.map((project) => {
              const isOverdue =
                project.status !== ProjectStatus.COMPLETED &&
                new Date(project.dueDate).getTime() < nowMs;
              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className="card-3d card-3d-interactive rounded-2xl p-5 flex flex-col justify-between space-y-4 cursor-pointer"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold text-[#6366F1] dark:text-indigo-400">
                        {project.status}
                      </span>
                      <span>·</span>
                      <span className="font-mono">{project.priority} PRIORITY</span>
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

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex -space-x-2">
                        {project.members.slice(0, 4).map((m) => (
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
                Team Workload Distribution
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Active vs. completed tasks assigned per team member
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
                          {t.projectName} · {t.assignee?.name || 'Unassigned'} · {t.priority}
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
  // 3. TEAM_MEMBER — "MY FOCUS" DASHBOARD
  // ============================================================================
  const myTasks = tasks.filter((t) => t.assigneeId === user.id);
  const myOpenTasks = myTasks.filter((t) => t.status !== TaskStatus.DONE);

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-sky-600 dark:text-sky-400">
            TEAM_MEMBER · Personal Sprint Workspace
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
            My Focus — {user.name}
          </h1>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {myOpenTasks.length} active tasks assigned to you across {projects.length} projects
        </div>
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
                        <span className="font-mono">{t.status}</span>
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
                        <span className="font-mono">{t.status}</span>
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
        {/* 14-Day Due-Date Timeline */}
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
