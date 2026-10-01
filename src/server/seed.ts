import crypto from 'crypto';
import {
  ActivityLog,
  Attachment,
  Comment,
  Notification,
  NotificationType,
  Organization,
  OrganizationMember,
  Priority,
  Project,
  ProjectMember,
  ProjectStatus,
  Task,
  TaskStatus,
  User,
  UserRole,
} from '../shared/types.ts';

export interface StoredUser extends User {
  passwordHash: string;
  passwordSalt: string;
}

export interface StoredSession {
  token: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

export interface DatabaseSchema {
  users: StoredUser[];
  organizations: Organization[];
  organizationMembers: OrganizationMember[];
  projects: Project[];
  projectMembers: ProjectMember[];
  tasks: Task[];
  comments: Comment[];
  attachments: Attachment[];
  notifications: Notification[];
  activityLogs: ActivityLog[];
  sessions: StoredSession[];
}

export const DEMO_PASSWORD = 'PrimeMeet2026!';

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computed = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function hoursAgo(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

export function createInitialSeedData(): DatabaseSchema {
  const now = new Date().toISOString();
  const pw = hashPassword(DEMO_PASSWORD);

  // 1. Seed Users
  const users: StoredUser[] = [
    {
      id: 'usr_admin_alex',
      name: 'Alex Rivera',
      email: 'alex.rivera@primemeet.io',
      avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=AlexRivera&backgroundColor=e0e7ff',
      role: UserRole.SUPER_ADMIN,
      passwordHash: pw.hash,
      passwordSalt: pw.salt,
      createdAt: daysFromNow(-60),
      updatedAt: daysFromNow(-5),
    },
    {
      id: 'usr_mgr_sarah',
      name: 'Sarah Chen',
      email: 'sarah.chen@primemeet.io',
      avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=SarahChen&backgroundColor=d1fae5',
      role: UserRole.PROJECT_MANAGER,
      passwordHash: pw.hash,
      passwordSalt: pw.salt,
      createdAt: daysFromNow(-55),
      updatedAt: daysFromNow(-3),
    },
    {
      id: 'usr_mem_david',
      name: 'David Kim',
      email: 'david.kim@primemeet.io',
      avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=DavidKim&backgroundColor=fef3c7',
      role: UserRole.TEAM_MEMBER,
      passwordHash: pw.hash,
      passwordSalt: pw.salt,
      createdAt: daysFromNow(-48),
      updatedAt: daysFromNow(-1),
    },
    {
      id: 'usr_mem_elena',
      name: 'Elena Rostova',
      email: 'elena.rostova@primemeet.io',
      avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=ElenaRostova&backgroundColor=fce7f3',
      role: UserRole.TEAM_MEMBER,
      passwordHash: pw.hash,
      passwordSalt: pw.salt,
      createdAt: daysFromNow(-42),
      updatedAt: daysFromNow(-2),
    },
    {
      id: 'usr_mgr_marcus',
      name: 'Marcus Vance',
      email: 'marcus.vance@primemeet.io',
      avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=MarcusVance&backgroundColor=e0f2fe',
      role: UserRole.PROJECT_MANAGER,
      passwordHash: pw.hash,
      passwordSalt: pw.salt,
      createdAt: daysFromNow(-38),
      updatedAt: daysFromNow(-4),
    },
    {
      id: 'usr_mem_priya',
      name: 'Priya Patel',
      email: 'priya.patel@primemeet.io',
      avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=PriyaPatel&backgroundColor=ede9fe',
      role: UserRole.TEAM_MEMBER,
      passwordHash: pw.hash,
      passwordSalt: pw.salt,
      createdAt: daysFromNow(-25),
      updatedAt: daysFromNow(-1),
    },
  ];

  // 2. Seed Organization
  const organizations: Organization[] = [
    {
      id: 'org_primemeet_labs',
      name: 'PrimeMeet Labs',
      slug: 'primemeet-labs',
      description: 'Core product engineering, design systems, and collaborative infrastructure for high-velocity teams.',
      createdAt: daysFromNow(-60),
      updatedAt: daysFromNow(-2),
    },
  ];

  // 3. Seed OrganizationMembers
  const organizationMembers: OrganizationMember[] = users.map((u, idx) => ({
    id: `org_mem_${idx + 1}`,
    organizationId: 'org_primemeet_labs',
    userId: u.id,
    role: u.role,
    createdAt: u.createdAt,
  }));

  // 4. Seed Projects (3 projects in PrimeMeet Labs)
  const projects: Project[] = [
    {
      id: 'prj_website_redesign',
      organizationId: 'org_primemeet_labs',
      name: 'Website Redesign',
      description: 'Complete architectural overhaul of the primemeet.io web experience, interactive command palette showcase, and documentation portal.',
      status: ProjectStatus.ACTIVE,
      priority: Priority.HIGH,
      startDate: daysFromNow(-30),
      dueDate: daysFromNow(12),
      managerId: 'usr_mgr_sarah',
      createdAt: daysFromNow(-30),
      updatedAt: hoursAgo(4),
    },
    {
      id: 'prj_mobile_app',
      organizationId: 'org_primemeet_labs',
      name: 'Mobile Application',
      description: 'iOS and Android companion app featuring offline Kanban state synchronization, real-time notifications, and biometric sign-in.',
      status: ProjectStatus.ACTIVE,
      priority: Priority.URGENT,
      startDate: daysFromNow(-21),
      dueDate: daysFromNow(2),
      managerId: 'usr_mgr_sarah',
      createdAt: daysFromNow(-21),
      updatedAt: hoursAgo(2),
    },
    {
      id: 'prj_marketing_platform',
      organizationId: 'org_primemeet_labs',
      name: 'Marketing Platform',
      description: 'Attribution telemetry pipeline, automated onboarding lifecycle sequences, and self-serve enterprise trial provisioning.',
      status: ProjectStatus.PLANNING,
      priority: Priority.MEDIUM,
      startDate: daysFromNow(-10),
      dueDate: daysFromNow(24),
      managerId: 'usr_mgr_marcus',
      createdAt: daysFromNow(-10),
      updatedAt: hoursAgo(12),
    },
  ];

  // 5. Seed ProjectMembers
  // Note: David Kim (usr_mem_david) is a member of Website Redesign and Mobile Application,
  // and intentionally NOT a member of Marketing Platform so row-level project visibility can be tested immediately.
  const projectMembers: ProjectMember[] = [
    // Website Redesign members
    { id: 'pm_1', projectId: 'prj_website_redesign', userId: 'usr_mgr_sarah', role: 'MANAGER', createdAt: daysFromNow(-30) },
    { id: 'pm_2', projectId: 'prj_website_redesign', userId: 'usr_mem_david', role: 'MEMBER', createdAt: daysFromNow(-29) },
    { id: 'pm_3', projectId: 'prj_website_redesign', userId: 'usr_mem_elena', role: 'MEMBER', createdAt: daysFromNow(-29) },
    { id: 'pm_4', projectId: 'prj_website_redesign', userId: 'usr_mem_priya', role: 'MEMBER', createdAt: daysFromNow(-20) },

    // Mobile Application members
    { id: 'pm_5', projectId: 'prj_mobile_app', userId: 'usr_mgr_sarah', role: 'MANAGER', createdAt: daysFromNow(-21) },
    { id: 'pm_6', projectId: 'prj_mobile_app', userId: 'usr_mem_david', role: 'MEMBER', createdAt: daysFromNow(-20) },
    { id: 'pm_7', projectId: 'prj_mobile_app', userId: 'usr_mem_priya', role: 'MEMBER', createdAt: daysFromNow(-18) },

    // Marketing Platform members (David Kim is NOT a member here)
    { id: 'pm_8', projectId: 'prj_marketing_platform', userId: 'usr_mgr_marcus', role: 'MANAGER', createdAt: daysFromNow(-10) },
    { id: 'pm_9', projectId: 'prj_marketing_platform', userId: 'usr_mgr_sarah', role: 'MEMBER', createdAt: daysFromNow(-9) },
    { id: 'pm_10', projectId: 'prj_marketing_platform', userId: 'usr_mem_elena', role: 'MEMBER', createdAt: daysFromNow(-9) },
  ];

  // 6. Seed 25 Tasks across the 3 projects
  const tasks: Task[] = [
    // --- Project 1: Website Redesign (10 tasks) ---
    {
      id: 'tsk_01',
      projectId: 'prj_website_redesign',
      title: 'Design system token audit & dark mode contrast verification',
      description: 'Verify WCAG AA contrast across all #0F172A dark surfaces and #F8FAFC light surfaces with tabular numeric scales.',
      assigneeId: 'usr_mem_david',
      createdById: 'usr_mgr_sarah',
      priority: Priority.HIGH,
      status: TaskStatus.DONE,
      dueDate: daysFromNow(-6),
      labels: ['Design System', 'Accessibility'],
      position: 0,
      createdAt: daysFromNow(-25),
      updatedAt: daysFromNow(-7),
    },
    {
      id: 'tsk_02',
      projectId: 'prj_website_redesign',
      title: 'Build interactive hero preview with role-based glass cards',
      description: 'Implement layered dot-grid surface and interactive portal switcher for Admin, Manager, and Member personas.',
      assigneeId: 'usr_mem_david',
      createdById: 'usr_mgr_sarah',
      priority: Priority.URGENT,
      status: TaskStatus.IN_PROGRESS,
      dueDate: daysFromNow(0), // Due today
      labels: ['Frontend', 'UI'],
      position: 0,
      createdAt: daysFromNow(-14),
      updatedAt: hoursAgo(3),
    },
    {
      id: 'tsk_03',
      projectId: 'prj_website_redesign',
      title: 'Migrate documentation search index to sub-50ms query engine',
      description: 'Index all API reference articles and keyboard shortcuts for instant command palette retrieval.',
      assigneeId: 'usr_mem_elena',
      createdById: 'usr_mgr_sarah',
      priority: Priority.HIGH,
      status: TaskStatus.IN_REVIEW,
      dueDate: daysFromNow(-2), // Overdue!
      labels: ['Search', 'Performance'],
      position: 0,
      createdAt: daysFromNow(-12),
      updatedAt: hoursAgo(6),
    },
    {
      id: 'tsk_04',
      projectId: 'prj_website_redesign',
      title: 'Optimize OpenGraph dynamic social card generation pipeline',
      description: 'Generate custom OG preview cards for shared project roadmaps and public changelog releases.',
      assigneeId: 'usr_mem_priya',
      createdById: 'usr_mgr_sarah',
      priority: Priority.MEDIUM,
      status: TaskStatus.TODO,
      dueDate: daysFromNow(4), // Due this week
      labels: ['SEO', 'Edge'],
      position: 0,
      createdAt: daysFromNow(-10),
      updatedAt: daysFromNow(-5),
    },
    {
      id: 'tsk_05',
      projectId: 'prj_website_redesign',
      title: 'Implement responsive drawer navigation for mobile viewports',
      description: 'Replace desktop left sidebar with touch-friendly slide-over drawer and horizontal Kanban scroll snap.',
      assigneeId: 'usr_mem_david',
      createdById: 'usr_mgr_sarah',
      priority: Priority.HIGH,
      status: TaskStatus.TODO,
      dueDate: daysFromNow(-1), // Overdue for David!
      labels: ['Responsive', 'Frontend'],
      position: 1,
      createdAt: daysFromNow(-9),
      updatedAt: daysFromNow(-2),
    },
    {
      id: 'tsk_06',
      projectId: 'prj_website_redesign',
      title: 'Configure enterprise SSO documentation & security whitepaper page',
      description: 'Detail row-level security enforcement, audit log retention, and RBAC permission boundaries.',
      assigneeId: 'usr_mem_elena',
      createdById: 'usr_mgr_sarah',
      priority: Priority.LOW,
      status: TaskStatus.DONE,
      dueDate: daysFromNow(-4),
      labels: ['Security', 'Docs'],
      position: 1,
      createdAt: daysFromNow(-18),
      updatedAt: daysFromNow(-4),
    },
    {
      id: 'tsk_07',
      projectId: 'prj_website_redesign',
      title: 'Build pricing tier comparison calculator with seat slider',
      description: 'Interactive seat estimator with annual/monthly toggle and clear feature matrix.',
      assigneeId: 'usr_mem_priya',
      createdById: 'usr_mgr_sarah',
      priority: Priority.MEDIUM,
      status: TaskStatus.IN_PROGRESS,
      dueDate: daysFromNow(3), // Due this week
      labels: ['Growth', 'Frontend'],
      position: 1,
      createdAt: daysFromNow(-8),
      updatedAt: hoursAgo(10),
    },
    {
      id: 'tsk_08',
      projectId: 'prj_website_redesign',
      title: 'Audit Core Web Vitals and eliminate layout shift on font load',
      description: 'Preload Inter and JetBrains Mono font subsets and enforce strict aspect-ratio containers.',
      assigneeId: 'usr_mem_david',
      createdById: 'usr_mgr_sarah',
      priority: Priority.MEDIUM,
      status: TaskStatus.IN_REVIEW,
      dueDate: daysFromNow(2), // Due this week
      labels: ['Performance', 'Frontend'],
      position: 1,
      createdAt: daysFromNow(-7),
      updatedAt: hoursAgo(5),
    },
    {
      id: 'tsk_09',
      projectId: 'prj_website_redesign',
      title: 'Create interactive changelog timeline with filterable release tags',
      description: 'Allow users to filter product updates by Kanban, API, Security, and Mobile categories.',
      assigneeId: 'usr_mem_elena',
      createdById: 'usr_mgr_sarah',
      priority: Priority.LOW,
      status: TaskStatus.TODO,
      dueDate: daysFromNow(9),
      labels: ['Content', 'UI'],
      position: 2,
      createdAt: daysFromNow(-6),
      updatedAt: daysFromNow(-6),
    },
    {
      id: 'tsk_10',
      projectId: 'prj_website_redesign',
      title: 'Final QA sign-off on cross-browser keyboard navigation shortcuts',
      description: 'Verify Cmd+K palette, Escape modal dismissal, and focus ring visibility in Safari, Chrome, and Firefox.',
      assigneeId: 'usr_mgr_sarah',
      createdById: 'usr_mgr_sarah',
      priority: Priority.HIGH,
      status: TaskStatus.DONE,
      dueDate: daysFromNow(-3),
      labels: ['QA', 'Accessibility'],
      position: 2,
      createdAt: daysFromNow(-15),
      updatedAt: daysFromNow(-3),
    },

    // --- Project 2: Mobile Application (9 tasks) ---
    {
      id: 'tsk_11',
      projectId: 'prj_mobile_app',
      title: 'Implement optimistic drag-and-drop state engine with rollback',
      description: 'Ensure Kanban card moves update immediately in UI and revert cleanly with an error toast if the server rejects the mutation.',
      assigneeId: 'usr_mem_david',
      createdById: 'usr_mgr_sarah',
      priority: Priority.URGENT,
      status: TaskStatus.IN_PROGRESS,
      dueDate: daysFromNow(1), // Due tomorrow (this week & at-risk)
      labels: ['Mobile', 'Sync'],
      position: 0,
      createdAt: daysFromNow(-14),
      updatedAt: hoursAgo(1),
    },
    {
      id: 'tsk_12',
      projectId: 'prj_mobile_app',
      title: 'WebSocket reconnection handler & live presence indicator',
      description: 'Broadcast active project viewers and synchronize task moves and comments across connected clients in real time.',
      assigneeId: 'usr_mem_david',
      createdById: 'usr_mgr_sarah',
      priority: Priority.HIGH,
      status: TaskStatus.TODO,
      dueDate: daysFromNow(5), // Due this week
      labels: ['Realtime', 'WebSockets'],
      position: 0,
      createdAt: daysFromNow(-11),
      updatedAt: daysFromNow(-2),
    },
    {
      id: 'tsk_13',
      projectId: 'prj_mobile_app',
      title: 'Biometric session persistence and secure token refresh',
      description: 'Persist authentication tokens safely across app restarts and purge local cache immediately on sign-out.',
      assigneeId: 'usr_mem_priya',
      createdById: 'usr_mgr_sarah',
      priority: Priority.URGENT,
      status: TaskStatus.DONE,
      dueDate: daysFromNow(-5),
      labels: ['Security', 'Auth'],
      position: 0,
      createdAt: daysFromNow(-19),
      updatedAt: daysFromNow(-5),
    },
    {
      id: 'tsk_14',
      projectId: 'prj_mobile_app',
      title: 'Push notification dispatcher for approaching task deadlines',
      description: 'Trigger in-app and push alerts when tasks enter the 72-hour due window or when comments are posted.',
      assigneeId: 'usr_mem_priya',
      createdById: 'usr_mgr_sarah',
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      dueDate: daysFromNow(-3), // Overdue!
      labels: ['Notifications', 'Backend'],
      position: 1,
      createdAt: daysFromNow(-13),
      updatedAt: hoursAgo(8),
    },
    {
      id: 'tsk_15',
      projectId: 'prj_mobile_app',
      title: 'Attachment uploader with 10MB validation and MIME allowlist',
      description: 'Restrict uploads strictly to images, PDFs, and standard docs up to 10 MB with clear user-facing error states.',
      assigneeId: 'usr_mem_david',
      createdById: 'usr_mgr_sarah',
      priority: Priority.MEDIUM,
      status: TaskStatus.IN_REVIEW,
      dueDate: daysFromNow(0), // Due today
      labels: ['Storage', 'Security'],
      position: 0,
      createdAt: daysFromNow(-10),
      updatedAt: hoursAgo(4),
    },
    {
      id: 'tsk_16',
      projectId: 'prj_mobile_app',
      title: 'Offline SQLite queue for comments created in airplane mode',
      description: 'Queue comment creations locally with idempotency keys and flush upon network restoration.',
      assigneeId: 'usr_mem_priya',
      createdById: 'usr_mgr_sarah',
      priority: Priority.MEDIUM,
      status: TaskStatus.TODO,
      dueDate: daysFromNow(6), // Due this week
      labels: ['Mobile', 'Offline'],
      position: 1,
      createdAt: daysFromNow(-8),
      updatedAt: daysFromNow(-4),
    },
    {
      id: 'tsk_17',
      projectId: 'prj_mobile_app',
      title: 'Resolve iOS keyboard avoidance overlap in task detail drawer',
      description: 'Ensure the comment input box remains visible above the virtual keyboard on compact viewports.',
      assigneeId: 'usr_mem_david',
      createdById: 'usr_mgr_sarah',
      priority: Priority.LOW,
      status: TaskStatus.DONE,
      dueDate: daysFromNow(-8),
      labels: ['Mobile', 'UI'],
      position: 1,
      createdAt: daysFromNow(-16),
      updatedAt: daysFromNow(-8),
    },
    {
      id: 'tsk_18',
      projectId: 'prj_mobile_app',
      title: 'Memory profiling for 500-card Kanban board virtualization',
      description: 'Benchmark frame times during rapid horizontal column scrolling on mid-tier Android devices.',
      assigneeId: 'usr_mgr_sarah',
      createdById: 'usr_mgr_sarah',
      priority: Priority.HIGH,
      status: TaskStatus.IN_REVIEW,
      dueDate: daysFromNow(2), // Due within 3 days
      labels: ['Performance', 'Mobile'],
      position: 1,
      createdAt: daysFromNow(-9),
      updatedAt: hoursAgo(7),
    },
    {
      id: 'tsk_19',
      projectId: 'prj_mobile_app',
      title: 'App Store & Google Play release candidate signing pipeline',
      description: 'Automate build notarization and test track deployment via CI workflow.',
      assigneeId: 'usr_mgr_sarah',
      createdById: 'usr_mgr_sarah',
      priority: Priority.URGENT,
      status: TaskStatus.TODO,
      dueDate: daysFromNow(-1), // Overdue!
      labels: ['DevOps', 'Release'],
      position: 2,
      createdAt: daysFromNow(-7),
      updatedAt: daysFromNow(-1),
    },

    // --- Project 3: Marketing Platform (6 tasks) ---
    {
      id: 'tsk_20',
      projectId: 'prj_marketing_platform',
      title: 'Architect multi-touch attribution schema for enterprise workspaces',
      description: 'Track conversion cohorts from initial landing page visit through team workspace activation.',
      assigneeId: 'usr_mgr_marcus',
      createdById: 'usr_mgr_marcus',
      priority: Priority.HIGH,
      status: TaskStatus.DONE,
      dueDate: daysFromNow(-4),
      labels: ['Analytics', 'Data'],
      position: 0,
      createdAt: daysFromNow(-10),
      updatedAt: daysFromNow(-4),
    },
    {
      id: 'tsk_21',
      projectId: 'prj_marketing_platform',
      title: 'Implement automated trial-to-paid lifecycle webhook handlers',
      description: 'Sync organization billing tier updates with CRM and trigger onboarding specialist alerts.',
      assigneeId: 'usr_mem_elena',
      createdById: 'usr_mgr_marcus',
      priority: Priority.HIGH,
      status: TaskStatus.IN_PROGRESS,
      dueDate: daysFromNow(3), // Due within 3 days
      labels: ['API', 'Backend'],
      position: 0,
      createdAt: daysFromNow(-8),
      updatedAt: hoursAgo(5),
    },
    {
      id: 'tsk_22',
      projectId: 'prj_marketing_platform',
      title: 'Design executive ROI benchmark report template',
      description: 'Generate downloadable PDF and interactive web views summarizing team velocity gains.',
      assigneeId: 'usr_mem_elena',
      createdById: 'usr_mgr_marcus',
      priority: Priority.MEDIUM,
      status: TaskStatus.TODO,
      dueDate: daysFromNow(8),
      labels: ['Design', 'Growth'],
      position: 0,
      createdAt: daysFromNow(-6),
      updatedAt: daysFromNow(-3),
    },
    {
      id: 'tsk_23',
      projectId: 'prj_marketing_platform',
      title: 'Audit GDPR & SOC2 consent banner telemetry compliance',
      description: 'Ensure zero analytics cookies fire prior to explicit opt-in across EU regional endpoints.',
      assigneeId: 'usr_mgr_marcus',
      createdById: 'usr_mgr_marcus',
      priority: Priority.URGENT,
      status: TaskStatus.IN_REVIEW,
      dueDate: daysFromNow(-2), // Overdue!
      labels: ['Security', 'Compliance'],
      position: 0,
      createdAt: daysFromNow(-9),
      updatedAt: hoursAgo(9),
    },
    {
      id: 'tsk_24',
      projectId: 'prj_marketing_platform',
      title: 'Build webhook retry dead-letter queue inspector',
      description: 'Allow project managers to inspect and replay failed outbound marketing automation events.',
      assigneeId: 'usr_mem_elena',
      createdById: 'usr_mgr_marcus',
      priority: Priority.MEDIUM,
      status: TaskStatus.TODO,
      dueDate: daysFromNow(11),
      labels: ['Backend', 'Infrastructure'],
      position: 1,
      createdAt: daysFromNow(-5),
      updatedAt: daysFromNow(-2),
    },
    {
      id: 'tsk_25',
      projectId: 'prj_marketing_platform',
      title: 'Set up A/B experiment cohorts for interactive product tour',
      description: 'Measure activation lift between guided 3-step workspace setup vs instant template provisioning.',
      assigneeId: 'usr_mgr_sarah',
      createdById: 'usr_mgr_marcus',
      priority: Priority.LOW,
      status: TaskStatus.TODO,
      dueDate: daysFromNow(14),
      labels: ['Experiments', 'Growth'],
      position: 2,
      createdAt: daysFromNow(-4),
      updatedAt: daysFromNow(-1),
    },
  ];

  // 7. Seed Comments (authored by Sarah, David, Alex, and Elena so ownership rules can be tested)
  const comments: Comment[] = [
    {
      id: 'cmt_01',
      taskId: 'tsk_02',
      userId: 'usr_mgr_sarah',
      content: 'Make sure the Admin, Manager, and Member portal cards each display authentic UI fragments with zero placeholder copy.',
      createdAt: hoursAgo(18),
      updatedAt: hoursAgo(18),
    },
    {
      id: 'cmt_02',
      taskId: 'tsk_02',
      userId: 'usr_mem_david',
      content: 'Implemented the split-screen hero with role-specific glass cards and subtle dot-grid background. Ready for design review this afternoon.',
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(6),
    },
    {
      id: 'cmt_03',
      taskId: 'tsk_11',
      userId: 'usr_admin_alex',
      content: 'Security check: remember that if a Team Member drags a task not assigned to them, the backend RLS policy will reject the mutation and the board must roll back cleanly.',
      createdAt: hoursAgo(14),
      updatedAt: hoursAgo(14),
    },
    {
      id: 'cmt_04',
      taskId: 'tsk_11',
      userId: 'usr_mem_david',
      content: 'Confirmed! Added optimistic state snapshot prior to PATCH /api/tasks/:id so any 403 or 500 response restores the exact column ordering and triggers an error toast.',
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(2),
    },
    {
      id: 'cmt_05',
      taskId: 'tsk_03',
      userId: 'usr_mem_elena',
      content: 'Index size reduced by 62% after stripping stop words. Benchmarks show 11ms p99 latency.',
      createdAt: hoursAgo(9),
      updatedAt: hoursAgo(9),
    },
    {
      id: 'cmt_06',
      taskId: 'tsk_15',
      userId: 'usr_mgr_sarah',
      content: 'Verified MIME validation on PDF, PNG, JPEG, WEBP, DOC, DOCX, and TXT files with the strict 10 MB ceiling.',
      createdAt: hoursAgo(4),
      updatedAt: hoursAgo(4),
    },
  ];

  // 8. Seed Attachments
  const attachments: Attachment[] = [
    {
      id: 'att_01',
      taskId: 'tsk_02',
      uploadedById: 'usr_mgr_sarah',
      fileName: 'primemeet-design-tokens-v2.pdf',
      fileUrl: '/api/attachments/att_01/download',
      fileType: 'application/pdf',
      fileSize: 428500,
      createdAt: hoursAgo(16),
    },
    {
      id: 'att_02',
      taskId: 'tsk_11',
      uploadedById: 'usr_mem_david',
      fileName: 'kanban-optimistic-rollback-spec.txt',
      fileUrl: '/api/attachments/att_02/download',
      fileType: 'text/plain',
      fileSize: 18420,
      createdAt: hoursAgo(5),
    },
  ];

  // 9. Seed Notifications
  const notifications: Notification[] = [
    {
      id: 'ntf_01',
      userId: 'usr_mem_david',
      type: NotificationType.TASK_ASSIGNED,
      message: 'Sarah Chen assigned you to "Implement optimistic drag-and-drop state engine with rollback"',
      isRead: false,
      link: '/projects/prj_mobile_app?task=tsk_11',
      createdAt: hoursAgo(12),
    },
    {
      id: 'ntf_02',
      userId: 'usr_mem_david',
      type: NotificationType.NEW_COMMENT,
      message: 'Alex Rivera commented on "Implement optimistic drag-and-drop state engine with rollback"',
      isRead: false,
      link: '/projects/prj_mobile_app?task=tsk_11',
      createdAt: hoursAgo(8),
    },
    {
      id: 'ntf_03',
      userId: 'usr_mem_david',
      type: NotificationType.DEADLINE_APPROACHING,
      message: 'Task "Build interactive hero preview with role-based glass cards" is due today',
      isRead: false,
      link: '/projects/prj_website_redesign?task=tsk_02',
      createdAt: hoursAgo(3),
    },
    {
      id: 'ntf_04',
      userId: 'usr_mem_david',
      type: NotificationType.STATUS_CHANGED,
      message: 'Sarah Chen moved "Attachment uploader with 10MB validation" to IN_REVIEW',
      isRead: true,
      link: '/projects/prj_mobile_app?task=tsk_15',
      createdAt: hoursAgo(24),
    },
    {
      id: 'ntf_05',
      userId: 'usr_mgr_sarah',
      type: NotificationType.NEW_COMMENT,
      message: 'David Kim commented on "Build interactive hero preview with role-based glass cards"',
      isRead: false,
      link: '/projects/prj_website_redesign?task=tsk_02',
      createdAt: hoursAgo(6),
    },
    {
      id: 'ntf_06',
      userId: 'usr_mgr_sarah',
      type: NotificationType.DEADLINE_APPROACHING,
      message: 'Project "Mobile Application" has 2 overdue tasks requiring attention',
      isRead: false,
      link: '/projects/prj_mobile_app',
      createdAt: hoursAgo(2),
    },
    {
      id: 'ntf_07',
      userId: 'usr_admin_alex',
      type: NotificationType.STATUS_CHANGED,
      message: 'Elena Rostova moved "Migrate documentation search index" to IN_REVIEW',
      isRead: false,
      link: '/projects/prj_website_redesign?task=tsk_03',
      createdAt: hoursAgo(5),
    },
  ];

  // 10. Seed ActivityLogs
  const activityLogs: ActivityLog[] = [
    {
      id: 'act_01',
      userId: 'usr_admin_alex',
      projectId: null,
      taskId: null,
      action: 'ORGANIZATION_CREATED',
      description: 'Created organization "PrimeMeet Labs" (primemeet-labs)',
      createdAt: daysFromNow(-30),
    },
    {
      id: 'act_02',
      userId: 'usr_mgr_sarah',
      projectId: 'prj_website_redesign',
      taskId: null,
      action: 'PROJECT_CREATED',
      description: 'Created project "Website Redesign" with HIGH priority',
      createdAt: daysFromNow(-29),
    },
    {
      id: 'act_03',
      userId: 'usr_mgr_sarah',
      projectId: 'prj_mobile_app',
      taskId: null,
      action: 'PROJECT_CREATED',
      description: 'Created project "Mobile Application" with URGENT priority',
      createdAt: daysFromNow(-21),
    },
    {
      id: 'act_04',
      userId: 'usr_mgr_marcus',
      projectId: 'prj_marketing_platform',
      taskId: null,
      action: 'PROJECT_CREATED',
      description: 'Created project "Marketing Platform" in PLANNING status',
      createdAt: daysFromNow(-10),
    },
    {
      id: 'act_05',
      userId: 'usr_mem_david',
      projectId: 'prj_mobile_app',
      taskId: 'tsk_15',
      action: 'TASK_STATUS_CHANGED',
      description: 'Moved task "Attachment uploader with 10MB validation and MIME allowlist" from IN_PROGRESS to IN_REVIEW',
      createdAt: hoursAgo(4),
    },
    {
      id: 'act_06',
      userId: 'usr_mem_david',
      projectId: 'prj_mobile_app',
      taskId: 'tsk_11',
      action: 'COMMENT_ADDED',
      description: 'Added a comment on "Implement optimistic drag-and-drop state engine with rollback"',
      createdAt: hoursAgo(2),
    },
    {
      id: 'act_07',
      userId: 'usr_mem_elena',
      projectId: 'prj_website_redesign',
      taskId: 'tsk_03',
      action: 'TASK_STATUS_CHANGED',
      description: 'Moved task "Migrate documentation search index to sub-50ms query engine" to IN_REVIEW',
      createdAt: hoursAgo(6),
    },
  ];

  return {
    users,
    organizations,
    organizationMembers,
    projects,
    projectMembers,
    tasks,
    comments,
    attachments,
    notifications,
    activityLogs,
    sessions: [],
  };
}
