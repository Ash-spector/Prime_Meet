import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  type ActivityLog,
  AssignmentMode,
  type Attachment,
  type Comment,
  type EnrichedActivityLog,
  type EnrichedAttachment,
  type EnrichedComment,
  type EnrichedProject,
  type EnrichedTask,
  type Notification,
  NotificationType,
  type Organization,
  type OrganizationMember,
  Priority,
  type Project,
  type ProjectMember,
  ProjectStatus,
  PROJECT_TYPE_LABELS,
  ProjectType,
  type Task,
  TaskStatus,
  type User,
  UserRole,
} from '../shared/types.ts';
import { PermissionDeniedError, RLS } from './rls.ts';
import {
  createInitialSeedData,
  type DatabaseSchema,
  hashPassword,
  type StoredUser,
  verifyPassword,
} from './seed.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'primemeet-db.json');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export function sanitizeUser(u: StoredUser): User {
  return {
    id: u.id,
    uniqueCode: u.uniqueCode || `USR-${u.id.slice(-4).toUpperCase()}`,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    role: u.role,
    specialization: u.specialization || ProjectType.WEB_DEVELOPMENT,
    managerId: u.managerId ?? null,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

class DatabaseEngine {
  private state: DatabaseSchema;

  constructor() {
    ensureDirectories();
    this.state = this.loadOrSeed();
  }

  private migrateSchemaIfNeeded(parsed: DatabaseSchema): DatabaseSchema {
    const referenceSeed = createInitialSeedData();
    let changed = false;

    // 1. Ensure all seeded users exist and have uniqueCode, specialization, managerId
    for (const seedUser of referenceSeed.users) {
      const existing = parsed.users.find((u) => u.id === seedUser.id);
      if (!existing) {
        parsed.users.push(seedUser);
        if (parsed.organizations[0]) {
          parsed.organizationMembers.push({
            id: `org_mem_${crypto.randomBytes(4).toString('hex')}`,
            organizationId: parsed.organizations[0].id,
            userId: seedUser.id,
            role: seedUser.role,
            createdAt: seedUser.createdAt,
          });
        }
        changed = true;
      } else {
        if (!existing.uniqueCode) {
          existing.uniqueCode = seedUser.uniqueCode;
          changed = true;
        }
        if (!existing.specialization) {
          existing.specialization = seedUser.specialization;
          changed = true;
        }
        if (existing.managerId === undefined) {
          existing.managerId = seedUser.managerId;
          changed = true;
        }
      }
    }

    // Backfill any custom created users
    parsed.users.forEach((u, idx) => {
      if (!u.uniqueCode) {
        const prefix =
          u.role === UserRole.SUPER_ADMIN
            ? 'ADM'
            : u.role === UserRole.PROJECT_MANAGER
            ? 'PM'
            : 'MEM';
        u.uniqueCode = `${prefix}-${200 + idx}`;
        changed = true;
      }
      if (!u.specialization) {
        u.specialization = ProjectType.WEB_DEVELOPMENT;
        changed = true;
      }
      if (u.managerId === undefined) {
        u.managerId = u.role === UserRole.TEAM_MEMBER ? 'usr_mgr_sarah' : null;
        changed = true;
      }
    });

    // 2. Backfill projects with projectType, assignmentMode, and valid domain Project Manager
    for (const proj of parsed.projects) {
      const seedProj = referenceSeed.projects.find((sp) => sp.id === proj.id);
      if (!proj.projectType) {
        proj.projectType = seedProj?.projectType || ProjectType.WEB_DEVELOPMENT;
        changed = true;
      }
      if (!proj.assignmentMode) {
        proj.assignmentMode = seedProj?.assignmentMode || AssignmentMode.TEAM;
        changed = true;
      }
      if (proj.id === 'prj_website_redesign' && proj.status === ProjectStatus.ARCHIVED) {
        proj.status = ProjectStatus.ACTIVE;
        changed = true;
      }
      const currentMgr = parsed.users.find((u) => u.id === proj.managerId);
      if (!currentMgr || currentMgr.role !== UserRole.PROJECT_MANAGER) {
        const domainMgr =
          parsed.users.find(
            (u) =>
              u.role === UserRole.PROJECT_MANAGER &&
              u.specialization === proj.projectType
          ) ||
          parsed.users.find((u) => u.role === UserRole.PROJECT_MANAGER);
        if (domainMgr) {
          proj.managerId = domainMgr.id;
          const hasMgrMember = parsed.projectMembers.some(
            (pm) => pm.projectId === proj.id && pm.userId === domainMgr.id
          );
          if (!hasMgrMember) {
            parsed.projectMembers.push({
              id: `pm_${crypto.randomBytes(4).toString('hex')}`,
              projectId: proj.id,
              userId: domainMgr.id,
              role: 'MANAGER',
              createdAt: proj.createdAt,
            });
          }
          // Also add direct reports of this manager so the project has a full team roster
          const directReports = parsed.users.filter(
            (u) => u.role === UserRole.TEAM_MEMBER && u.managerId === domainMgr.id
          );
          for (const rep of directReports) {
            const hasRep = parsed.projectMembers.some(
              (pm) => pm.projectId === proj.id && pm.userId === rep.id
            );
            if (!hasRep) {
              parsed.projectMembers.push({
                id: `pm_${crypto.randomBytes(4).toString('hex')}`,
                projectId: proj.id,
                userId: rep.id,
                role: 'MEMBER',
                createdAt: proj.createdAt,
              });
            }
          }
          changed = true;
        }
      }
    }

    // Remove cross-manager membership on prj_marketing_platform so Sarah Chen only sees her own managed portfolio
    const beforePmLen = parsed.projectMembers.length;
    parsed.projectMembers = parsed.projectMembers.filter(
      (pm) =>
        !(
          pm.projectId === 'prj_marketing_platform' &&
          pm.userId === 'usr_mgr_sarah'
        )
    );
    if (parsed.projectMembers.length !== beforePmLen) {
      changed = true;
    }

    // Ensure Liam O'Connor is a member of prj_marketing_platform
    if (
      !parsed.projectMembers.some(
        (pm) =>
          pm.projectId === 'prj_marketing_platform' &&
          pm.userId === 'usr_mem_liam'
      )
    ) {
      parsed.projectMembers.push({
        id: 'pm_11',
        projectId: 'prj_marketing_platform',
        userId: 'usr_mem_liam',
        role: 'MEMBER',
        createdAt: new Date().toISOString(),
      });
      changed = true;
    }

    // 3. Backfill tasks with assignmentMode & teamAssigneeIds
    for (const tsk of parsed.tasks) {
      const seedTask = referenceSeed.tasks.find((st) => st.id === tsk.id);
      if (
        tsk.id === 'tsk_25' &&
        tsk.projectId === 'prj_marketing_platform' &&
        tsk.assigneeId === 'usr_mgr_sarah'
      ) {
        tsk.assigneeId = 'usr_mem_liam';
        tsk.teamAssigneeIds = ['usr_mem_liam'];
        changed = true;
      }
      if (!tsk.assignmentMode) {
        tsk.assignmentMode = seedTask?.assignmentMode || AssignmentMode.INDIVIDUAL;
        changed = true;
      }
      if (!Array.isArray(tsk.teamAssigneeIds)) {
        tsk.teamAssigneeIds =
          seedTask?.teamAssigneeIds || (tsk.assigneeId ? [tsk.assigneeId] : []);
        changed = true;
      }
    }

    if (changed) {
      this.save(parsed);
    }
    return parsed;
  }

  private loadOrSeed(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
          return this.migrateSchemaIfNeeded(parsed);
        }
      } catch (err) {
        console.error('Error loading DB file, re-seeding:', err);
      }
    }
    const seeded = createInitialSeedData();
    this.save(seeded);
    return seeded;
  }

  private save(nextState: DatabaseSchema = this.state): void {
    ensureDirectories();
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(nextState, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  public resetToSeed(actor: User): void {
    RLS.assertSuperAdmin(actor);
    const existingSessions = this.state.sessions;
    const seeded = createInitialSeedData();
    seeded.sessions = existingSessions;
    this.state = seeded;
    this.save();
  }

  // --- Activity & Notification Helpers ---
  public logActivity(params: {
    userId: string;
    projectId?: string | null;
    taskId?: string | null;
    action: string;
    description: string;
  }): ActivityLog {
    const entry: ActivityLog = {
      id: `act_${crypto.randomBytes(6).toString('hex')}`,
      userId: params.userId,
      projectId: params.projectId ?? null,
      taskId: params.taskId ?? null,
      action: params.action,
      description: params.description,
      createdAt: new Date().toISOString(),
    };
    this.state.activityLogs.unshift(entry);
    this.save();
    return entry;
  }

  public createNotification(params: {
    userId: string;
    type: NotificationType;
    message: string;
    link: string;
  }): Notification {
    const notif: Notification = {
      id: `ntf_${crypto.randomBytes(6).toString('hex')}`,
      userId: params.userId,
      type: params.type,
      message: params.message,
      isRead: false,
      link: params.link,
      createdAt: new Date().toISOString(),
    };
    this.state.notifications.unshift(notif);
    this.save();
    return notif;
  }

  // --- Auth & Sessions ---
  public login(email: string, password: string): { user: User; token: string } {
    const normalized = email.trim().toLowerCase();
    const found = this.state.users.find((u) => u.email.toLowerCase() === normalized);
    if (!found) {
      throw new Error('Invalid email or password.');
    }
    const valid = verifyPassword(password, found.passwordHash, found.passwordSalt);
    if (!valid) {
      throw new Error('Invalid email or password.');
    }
    const token = `pm_sess_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
    this.state.sessions.push({
      token,
      userId: found.id,
      expiresAt,
      createdAt: new Date().toISOString(),
    });
    this.save();
    return { user: sanitizeUser(found), token };
  }

  public signup(params: { name: string; email: string; password: string }): {
    user: User;
    token: string;
  } {
    const normalizedEmail = params.email.trim().toLowerCase();
    const cleanName = params.name.trim();
    if (!cleanName || cleanName.length < 2) {
      throw new Error('Name must be at least 2 characters.');
    }
    if (!normalizedEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!params.password || params.password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    const existing = this.state.users.find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );
    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const now = new Date().toISOString();
    const pw = hashPassword(params.password);
    const memberNumber = 200 + this.state.users.length + 1;
    // New users are ALWAYS TEAM_MEMBER
    const newUser: StoredUser = {
      id: `usr_${crypto.randomBytes(6).toString('hex')}`,
      uniqueCode: `MEM-WEB-${memberNumber}`,
      name: cleanName,
      email: normalizedEmail,
      avatar: `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(
        cleanName
      )}&backgroundColor=e0e7ff`,
      role: UserRole.TEAM_MEMBER,
      specialization: ProjectType.WEB_DEVELOPMENT,
      managerId: 'usr_mgr_sarah',
      passwordHash: pw.hash,
      passwordSalt: pw.salt,
      createdAt: now,
      updatedAt: now,
    };

    this.state.users.push(newUser);

    const defaultOrg = this.state.organizations[0];
    if (defaultOrg) {
      this.state.organizationMembers.push({
        id: `org_mem_${crypto.randomBytes(6).toString('hex')}`,
        organizationId: defaultOrg.id,
        userId: newUser.id,
        role: UserRole.TEAM_MEMBER,
        createdAt: now,
      });
    }

    const welcomeProject = this.state.projects.find(
      (p) => p.id === 'prj_website_redesign'
    );
    if (welcomeProject) {
      this.state.projectMembers.push({
        id: `pm_${crypto.randomBytes(6).toString('hex')}`,
        projectId: welcomeProject.id,
        userId: newUser.id,
        role: 'MEMBER',
        createdAt: now,
      });
    }

    const token = `pm_sess_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();
    this.state.sessions.push({
      token,
      userId: newUser.id,
      expiresAt,
      createdAt: now,
    });

    this.logActivity({
      userId: newUser.id,
      action: 'USER_REGISTERED',
      description: `${newUser.name} (${newUser.uniqueCode}) joined PrimeMeet as a Team Member`,
    });

    this.save();
    return { user: sanitizeUser(newUser), token };
  }

  public getUserByToken(token: string): User | null {
    const session = this.state.sessions.find((s) => s.token === token);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.state.sessions = this.state.sessions.filter((s) => s.token !== token);
      this.save();
      return null;
    }
    const user = this.state.users.find((u) => u.id === session.userId);
    return user ? sanitizeUser(user) : null;
  }

  public logout(token: string): void {
    this.state.sessions = this.state.sessions.filter((s) => s.token !== token);
    this.save();
  }

  // --- Users ---
  public listUsers(_actor: User): User[] {
    return this.state.users.map(sanitizeUser);
  }

  public updateUser(
    actor: User,
    targetUserId: string,
    updates: {
      name?: string;
      avatar?: string;
      role?: UserRole;
      specialization?: ProjectType;
      managerId?: string | null;
    }
  ): User {
    const target = this.state.users.find((u) => u.id === targetUserId);
    if (!target) {
      throw new Error('User not found.');
    }
    RLS.assertCanUpdateUser(actor, sanitizeUser(target), updates);

    if (updates.name !== undefined && updates.name.trim().length >= 2) {
      target.name = updates.name.trim();
    }
    if (updates.avatar !== undefined && updates.avatar.trim()) {
      target.avatar = updates.avatar.trim();
    }
    if (updates.specialization !== undefined) {
      target.specialization = updates.specialization;
    }
    if (updates.managerId !== undefined) {
      target.managerId = updates.managerId;
    }
    if (updates.role !== undefined) {
      target.role = updates.role;
      for (const om of this.state.organizationMembers) {
        if (om.userId === target.id) {
          om.role = updates.role;
        }
      }
    }
    target.updatedAt = new Date().toISOString();
    this.logActivity({
      userId: actor.id,
      action: 'USER_UPDATED',
      description: `Updated profile for ${target.name} [${target.uniqueCode}] (${target.role})`,
    });
    this.save();
    return sanitizeUser(target);
  }

  // --- Admin Only Operations ---
  public getAdminOverview(actor: User) {
    RLS.assertSuperAdmin(actor);

    const users = this.state.users.map(sanitizeUser);
    const organizations = this.state.organizations;
    const projects = this.state.projects;
    const tasks = this.state.tasks;

    const usersByRole = {
      [UserRole.SUPER_ADMIN]: users.filter((u) => u.role === UserRole.SUPER_ADMIN).length,
      [UserRole.PROJECT_MANAGER]: users.filter((u) => u.role === UserRole.PROJECT_MANAGER).length,
      [UserRole.TEAM_MEMBER]: users.filter((u) => u.role === UserRole.TEAM_MEMBER).length,
    };

    const projectsByStatus = {
      [ProjectStatus.PLANNING]: projects.filter((p) => p.status === ProjectStatus.PLANNING).length,
      [ProjectStatus.ACTIVE]: projects.filter((p) => p.status === ProjectStatus.ACTIVE).length,
      [ProjectStatus.ON_HOLD]: projects.filter((p) => p.status === ProjectStatus.ON_HOLD).length,
      [ProjectStatus.COMPLETED]: projects.filter((p) => p.status === ProjectStatus.COMPLETED).length,
      [ProjectStatus.ARCHIVED]: projects.filter((p) => p.status === ProjectStatus.ARCHIVED).length,
    };

    const newestUsers = [...users].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return {
      totals: {
        users: users.length,
        organizations: organizations.length,
        projects: projects.length,
        tasks: tasks.length,
      },
      usersByRole,
      projectsByStatus,
      newestUsers,
      recentActivity: this.listActivityLogs(actor, { limit: 15 }),
    };
  }

  // --- Organizations ---
  public listOrganizations(actor: User): Array<
    Organization & {
      memberCount: number;
      projectCount: number;
      members: Array<OrganizationMember & { user?: User }>;
    }
  > {
    const visible = RLS.filterVisibleOrganizations(actor, this.state);
    const userMap = new Map(this.state.users.map((u) => [u.id, sanitizeUser(u)]));

    return visible.map((org) => {
      const members = this.state.organizationMembers
        .filter((om) => om.organizationId === org.id)
        .map((om) => ({
          ...om,
          user: userMap.get(om.userId),
        }));
      const projectCount = RLS.filterVisibleProjects(actor, this.state).filter(
        (p) => p.organizationId === org.id
      ).length;
      return {
        ...org,
        memberCount: members.length,
        projectCount,
        members,
      };
    });
  }

  public createOrganization(
    actor: User,
    input: { name: string; slug: string; description: string }
  ): Organization {
    RLS.assertCanManageOrganization(actor);
    const now = new Date().toISOString();
    const org: Organization = {
      id: `org_${crypto.randomBytes(6).toString('hex')}`,
      name: input.name.trim(),
      slug:
        input.slug
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-') || `org-${Date.now()}`,
      description: input.description.trim(),
      createdAt: now,
      updatedAt: now,
    };
    this.state.organizations.push(org);
    this.state.organizationMembers.push({
      id: `org_mem_${crypto.randomBytes(6).toString('hex')}`,
      organizationId: org.id,
      userId: actor.id,
      role: actor.role,
      createdAt: now,
    });
    this.logActivity({
      userId: actor.id,
      action: 'ORGANIZATION_CREATED',
      description: `Created organization "${org.name}"`,
    });
    this.save();
    return org;
  }

  public updateOrganization(
    actor: User,
    orgId: string,
    updates: { name?: string; slug?: string; description?: string }
  ): Organization {
    RLS.assertCanManageOrganization(actor);
    const org = this.state.organizations.find((o) => o.id === orgId);
    if (!org) throw new Error('Organization not found.');
    if (updates.name !== undefined && updates.name.trim()) org.name = updates.name.trim();
    if (updates.slug !== undefined && updates.slug.trim()) {
      org.slug = updates.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }
    if (updates.description !== undefined) org.description = updates.description.trim();
    org.updatedAt = new Date().toISOString();

    this.logActivity({
      userId: actor.id,
      action: 'ORGANIZATION_UPDATED',
      description: `Updated organization "${org.name}"`,
    });
    this.save();
    return org;
  }

  public deleteOrganization(actor: User, orgId: string): void {
    RLS.assertCanManageOrganization(actor);
    if (this.state.organizations.length <= 1) {
      throw new Error('Cannot delete the primary workspace organization.');
    }
    const org = this.state.organizations.find((o) => o.id === orgId);
    if (!org) throw new Error('Organization not found.');
    this.state.organizations = this.state.organizations.filter((o) => o.id !== orgId);
    this.state.organizationMembers = this.state.organizationMembers.filter(
      (om) => om.organizationId !== orgId
    );
    this.logActivity({
      userId: actor.id,
      action: 'ORGANIZATION_DELETED',
      description: `Deleted organization "${org.name}"`,
    });
    this.save();
  }

  public addOrganizationMember(
    actor: User,
    orgId: string,
    userId: string,
    role?: UserRole
  ): void {
    RLS.assertCanManageOrganization(actor);
    const org = this.state.organizations.find((o) => o.id === orgId);
    if (!org) throw new Error('Organization not found.');
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found.');
    const exists = this.state.organizationMembers.some(
      (om) => om.organizationId === orgId && om.userId === userId
    );
    if (!exists) {
      this.state.organizationMembers.push({
        id: `org_mem_${crypto.randomBytes(6).toString('hex')}`,
        organizationId: orgId,
        userId,
        role: role || user.role,
        createdAt: new Date().toISOString(),
      });
      this.logActivity({
        userId: actor.id,
        action: 'ORG_MEMBER_ADDED',
        description: `Added ${user.name} to organization "${org.name}"`,
      });
      this.save();
    }
  }

  public removeOrganizationMember(actor: User, orgId: string, userId: string): void {
    RLS.assertCanManageOrganization(actor);
    const org = this.state.organizations.find((o) => o.id === orgId);
    if (!org) throw new Error('Organization not found.');
    this.state.organizationMembers = this.state.organizationMembers.filter(
      (om) => !(om.organizationId === orgId && om.userId === userId)
    );
    this.save();
  }

  // --- Projects ---
  public enrichProject(project: Project): EnrichedProject {
    const userMap = new Map(this.state.users.map((u) => [u.id, sanitizeUser(u)]));
    const org = this.state.organizations.find((o) => o.id === project.organizationId);
    const members = this.state.projectMembers
      .filter((pm) => pm.projectId === project.id)
      .map((pm) => {
        const u = userMap.get(pm.userId);
        return u ? { ...pm, user: u } : null;
      })
      .filter((x): x is ProjectMember & { user: User } => x !== null);

    const projectTasks = this.state.tasks.filter((t) => t.projectId === project.id);
    const total = projectTasks.length;
    const todo = projectTasks.filter((t) => t.status === TaskStatus.TODO).length;
    const inProgress = projectTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length;
    const inReview = projectTasks.filter((t) => t.status === TaskStatus.IN_REVIEW).length;
    const done = projectTasks.filter((t) => t.status === TaskStatus.DONE).length;
    const nowMs = Date.now();
    const overdue = projectTasks.filter(
      (t) => t.status !== TaskStatus.DONE && new Date(t.dueDate).getTime() < nowMs
    ).length;
    const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
      ...project,
      projectType: project.projectType || ProjectType.WEB_DEVELOPMENT,
      assignmentMode: project.assignmentMode || AssignmentMode.TEAM,
      organizationName: org?.name,
      manager: userMap.get(project.managerId),
      members,
      taskStats: {
        total,
        todo,
        inProgress,
        inReview,
        done,
        overdue,
        progressPercent,
      },
    };
  }

  public listProjects(
    actor: User,
    query?: {
      search?: string;
      status?: string;
      organizationId?: string;
      page?: number;
      limit?: number;
    }
  ): {
    projects: EnrichedProject[];
    total: number;
    page: number;
    totalPages: number;
  } {
    let visible = RLS.filterVisibleProjects(actor, this.state);

    if (query?.organizationId) {
      visible = visible.filter((p) => p.organizationId === query.organizationId);
    }
    if (query?.status && query.status !== 'ALL') {
      visible = visible.filter((p) => p.status === query.status);
    }
    if (query?.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      visible = visible.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    const total = visible.length;
    const page = Math.max(1, query?.page || 1);
    const limit = Math.max(1, query?.limit || 50);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const sliced = visible.slice(start, start + limit);

    return {
      projects: sliced.map((p) => this.enrichProject(p)),
      total,
      page,
      totalPages,
    };
  }

  public getProjectById(actor: User, projectId: string): EnrichedProject {
    const project = this.state.projects.find((p) => p.id === projectId);
    if (!project) {
      throw new Error('Project not found.');
    }
    RLS.assertCanViewProject(actor, project, this.state);
    return this.enrichProject(project);
  }

  public createProject(
    actor: User,
    input: {
      organizationId?: string;
      name: string;
      projectType?: ProjectType;
      description: string;
      status?: ProjectStatus;
      priority?: Priority;
      startDate?: string;
      dueDate: string;
      managerId?: string;
      assignmentMode?: AssignmentMode;
      memberIds?: string[];
    }
  ): EnrichedProject {
    RLS.assertCanCreateProject(actor);
    const now = new Date().toISOString();
    const orgId =
      input.organizationId || this.state.organizations[0]?.id || 'org_primemeet_labs';
    const projectType = input.projectType || ProjectType.WEB_DEVELOPMENT;
    const assignedManagerId = input.managerId || actor.id;
    const assignmentMode = input.assignmentMode || AssignmentMode.TEAM;

    const project: Project = {
      id: `prj_${crypto.randomBytes(6).toString('hex')}`,
      organizationId: orgId,
      name: input.name.trim(),
      projectType,
      description: input.description.trim(),
      status: input.status || ProjectStatus.PLANNING,
      priority: input.priority || Priority.MEDIUM,
      startDate: input.startDate || now,
      dueDate: input.dueDate,
      managerId: assignedManagerId,
      assignmentMode,
      createdAt: now,
      updatedAt: now,
    };

    this.state.projects.unshift(project);

    // Automatically include the assigned manager + any selected members + direct reports of that manager if TEAM mode
    const directReports =
      assignmentMode === AssignmentMode.TEAM
        ? this.state.users
            .filter((u) => u.managerId === assignedManagerId && u.role === UserRole.TEAM_MEMBER)
            .map((u) => u.id)
        : [];

    const uniqueMembers = new Set<string>([
      assignedManagerId,
      ...(input.memberIds || []),
      ...directReports,
    ]);

    for (const uid of uniqueMembers) {
      this.state.projectMembers.push({
        id: `pm_${crypto.randomBytes(6).toString('hex')}`,
        projectId: project.id,
        userId: uid,
        role: uid === assignedManagerId ? 'MANAGER' : 'MEMBER',
        createdAt: now,
      });
    }

    const assignedMgr = this.state.users.find((u) => u.id === assignedManagerId);
    const typeLabel = PROJECT_TYPE_LABELS[projectType] || projectType;

    if (assignedManagerId !== actor.id) {
      this.createNotification({
        userId: assignedManagerId,
        type: NotificationType.TASK_ASSIGNED,
        message: `${actor.name} assigned ${typeLabel} project "${project.name}" to you`,
        link: `/projects/${project.id}`,
      });
    }

    this.logActivity({
      userId: actor.id,
      projectId: project.id,
      action: 'PROJECT_CREATED',
      description: `Created ${typeLabel} project "${project.name}" assigned to ${
        assignedMgr ? `${assignedMgr.name} [${assignedMgr.uniqueCode}]` : assignedManagerId
      } (${assignmentMode})`,
    });
    this.save();
    return this.enrichProject(project);
  }

  public updateProject(
    actor: User,
    projectId: string,
    updates: Partial<
      Pick<
        Project,
        | 'name'
        | 'projectType'
        | 'description'
        | 'status'
        | 'priority'
        | 'startDate'
        | 'dueDate'
        | 'managerId'
        | 'assignmentMode'
      >
    > & { memberIds?: string[] }
  ): EnrichedProject {
    const project = this.state.projects.find((p) => p.id === projectId);
    if (!project) {
      throw new Error('Project not found.');
    }
    const actionLabel =
      updates.status === ProjectStatus.ARCHIVED ? 'archive' : 'edit';
    RLS.assertCanModifyProject(actor, project, actionLabel);

    const prevManagerId = project.managerId;

    if (updates.name !== undefined) project.name = updates.name.trim();
    if (updates.projectType !== undefined) project.projectType = updates.projectType;
    if (updates.description !== undefined)
      project.description = updates.description.trim();
    if (updates.status !== undefined) project.status = updates.status;
    if (updates.priority !== undefined) project.priority = updates.priority;
    if (updates.startDate !== undefined) project.startDate = updates.startDate;
    if (updates.dueDate !== undefined) project.dueDate = updates.dueDate;
    if (updates.assignmentMode !== undefined)
      project.assignmentMode = updates.assignmentMode;
    if (updates.managerId !== undefined && updates.managerId.trim()) {
      project.managerId = updates.managerId.trim();
      const mgrInMembers = this.state.projectMembers.find(
        (pm) => pm.projectId === project.id && pm.userId === project.managerId
      );
      if (!mgrInMembers) {
        this.state.projectMembers.push({
          id: `pm_${crypto.randomBytes(6).toString('hex')}`,
          projectId: project.id,
          userId: project.managerId,
          role: 'MANAGER',
          createdAt: new Date().toISOString(),
        });
      } else {
        mgrInMembers.role = 'MANAGER';
      }
      if (project.managerId !== prevManagerId && project.managerId !== actor.id) {
        const typeLabel = PROJECT_TYPE_LABELS[project.projectType] || project.projectType;
        this.createNotification({
          userId: project.managerId,
          type: NotificationType.TASK_ASSIGNED,
          message: `${actor.name} assigned ${typeLabel} project "${project.name}" to you`,
          link: `/projects/${project.id}`,
        });
      }
    }

    if (Array.isArray(updates.memberIds)) {
      for (const uid of updates.memberIds) {
        const exists = this.state.projectMembers.some(
          (pm) => pm.projectId === project.id && pm.userId === uid
        );
        if (!exists) {
          this.state.projectMembers.push({
            id: `pm_${crypto.randomBytes(6).toString('hex')}`,
            projectId: project.id,
            userId: uid,
            role: uid === project.managerId ? 'MANAGER' : 'MEMBER',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    project.updatedAt = new Date().toISOString();

    this.logActivity({
      userId: actor.id,
      projectId: project.id,
      action:
        updates.status === ProjectStatus.ARCHIVED
          ? 'PROJECT_ARCHIVED'
          : 'PROJECT_UPDATED',
      description:
        updates.status === ProjectStatus.ARCHIVED
          ? `Archived project "${project.name}"`
          : `Updated project "${project.name}"`,
    });
    this.save();
    return this.enrichProject(project);
  }

  public deleteProject(actor: User, projectId: string): void {
    const project = this.state.projects.find((p) => p.id === projectId);
    if (!project) {
      throw new Error('Project not found.');
    }
    RLS.assertCanModifyProject(actor, project, 'delete');

    const taskIds = new Set(
      this.state.tasks.filter((t) => t.projectId === projectId).map((t) => t.id)
    );
    this.state.projects = this.state.projects.filter((p) => p.id !== projectId);
    this.state.projectMembers = this.state.projectMembers.filter(
      (pm) => pm.projectId !== projectId
    );
    this.state.tasks = this.state.tasks.filter((t) => t.projectId !== projectId);
    this.state.comments = this.state.comments.filter((c) => !taskIds.has(c.taskId));
    this.state.attachments = this.state.attachments.filter(
      (a) => !taskIds.has(a.taskId)
    );

    this.logActivity({
      userId: actor.id,
      projectId: null,
      action: 'PROJECT_DELETED',
      description: `Deleted project "${project.name}"`,
    });
    this.save();
  }

  public addProjectMember(
    actor: User,
    projectId: string,
    userId: string,
    role: 'MANAGER' | 'MEMBER' = 'MEMBER'
  ): EnrichedProject {
    const project = this.state.projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Project not found.');
    RLS.assertCanModifyProject(actor, project, 'manage members of');

    const exists = this.state.projectMembers.some(
      (pm) => pm.projectId === projectId && pm.userId === userId
    );
    if (!exists) {
      this.state.projectMembers.push({
        id: `pm_${crypto.randomBytes(6).toString('hex')}`,
        projectId,
        userId,
        role,
        createdAt: new Date().toISOString(),
      });
      const addedUser = this.state.users.find((u) => u.id === userId);
      this.logActivity({
        userId: actor.id,
        projectId,
        action: 'MEMBER_ADDED',
        description: `Added ${addedUser?.name || userId} [${
          addedUser?.uniqueCode || ''
        }] to project "${project.name}"`,
      });
      this.save();
    }
    return this.enrichProject(project);
  }

  public removeProjectMember(
    actor: User,
    projectId: string,
    userId: string
  ): EnrichedProject {
    const project = this.state.projects.find((p) => p.id === projectId);
    if (!project) throw new Error('Project not found.');
    RLS.assertCanModifyProject(actor, project, 'manage members of');

    if (userId === project.managerId) {
      throw new Error(
        'Cannot remove the primary Project Manager from their own project.'
      );
    }

    const existed = this.state.projectMembers.some(
      (pm) => pm.projectId === projectId && pm.userId === userId
    );
    this.state.projectMembers = this.state.projectMembers.filter(
      (pm) => !(pm.projectId === projectId && pm.userId === userId)
    );
    if (existed) {
      const removedUser = this.state.users.find((u) => u.id === userId);
      this.createNotification({
        userId,
        type: NotificationType.REMOVED_FROM_PROJECT,
        message: `You were removed from project "${project.name}"`,
        link: '/projects',
      });
      this.logActivity({
        userId: actor.id,
        projectId,
        action: 'MEMBER_REMOVED',
        description: `Removed ${removedUser?.name || userId} from project "${project.name}"`,
      });
      this.save();
    }
    return this.enrichProject(project);
  }

  // --- Tasks ---
  public enrichTask(task: Task): EnrichedTask {
    const userMap = new Map(this.state.users.map((u) => [u.id, sanitizeUser(u)]));
    const project = this.state.projects.find((p) => p.id === task.projectId);
    const commentCount = this.state.comments.filter((c) => c.taskId === task.id).length;
    const attachmentCount = this.state.attachments.filter(
      (a) => a.taskId === task.id
    ).length;

    const teamIds =
      Array.isArray(task.teamAssigneeIds) && task.teamAssigneeIds.length > 0
        ? task.teamAssigneeIds
        : task.assigneeId
        ? [task.assigneeId]
        : [];
    const teamAssignees = teamIds
      .map((uid) => userMap.get(uid))
      .filter((u): u is User => u !== undefined);

    return {
      ...task,
      assignmentMode: task.assignmentMode || AssignmentMode.INDIVIDUAL,
      teamAssigneeIds: teamIds,
      projectName: project?.name,
      projectType: project?.projectType || ProjectType.WEB_DEVELOPMENT,
      projectManager: project ? userMap.get(project.managerId) : undefined,
      assignee: task.assigneeId ? userMap.get(task.assigneeId) || null : null,
      teamAssignees,
      createdBy: userMap.get(task.createdById),
      commentCount,
      attachmentCount,
    };
  }

  public listTasks(actor: User, projectId?: string): EnrichedTask[] {
    if (projectId) {
      const project = this.state.projects.find((p) => p.id === projectId);
      if (!project) throw new Error('Project not found.');
      RLS.assertCanViewProject(actor, project, this.state);
      return this.state.tasks
        .filter((t) => t.projectId === projectId)
        .sort((a, b) => a.position - b.position)
        .map((t) => this.enrichTask(t));
    }
    const visible = RLS.filterVisibleTasks(actor, this.state);
    return visible
      .sort((a, b) => a.position - b.position)
      .map((t) => this.enrichTask(t));
  }

  public createTask(
    actor: User,
    input: {
      projectId: string;
      title: string;
      description: string;
      assigneeId?: string | null;
      assignmentMode?: AssignmentMode;
      teamAssigneeIds?: string[];
      priority?: Priority;
      status?: TaskStatus;
      dueDate: string;
      labels?: string[];
    }
  ): EnrichedTask {
    const project = this.state.projects.find((p) => p.id === input.projectId);
    if (!project) throw new Error('Project not found.');
    RLS.assertCanCreateOrDeleteTask(actor, project, 'create');

    const status = input.status || TaskStatus.TODO;
    const existingInCol = this.state.tasks.filter(
      (t) => t.projectId === project.id && t.status === status
    );
    const now = new Date().toISOString();

    const assignmentMode = input.assignmentMode || AssignmentMode.INDIVIDUAL;
    let teamAssigneeIds: string[] = [];
    let primaryAssigneeId: string | null = input.assigneeId || null;

    if (assignmentMode === AssignmentMode.TEAM) {
      const rawTeam = Array.isArray(input.teamAssigneeIds)
        ? input.teamAssigneeIds.filter(Boolean)
        : [];
      if (rawTeam.length > 0) {
        teamAssigneeIds = Array.from(new Set(rawTeam));
        primaryAssigneeId = primaryAssigneeId || teamAssigneeIds[0] || null;
      } else if (primaryAssigneeId) {
        teamAssigneeIds = [primaryAssigneeId];
      }
    } else {
      teamAssigneeIds = primaryAssigneeId ? [primaryAssigneeId] : [];
    }

    // Ensure all assigned members belong to the project so RLS lets them view & progress the task
    for (const uid of teamAssigneeIds) {
      const inProj = this.state.projectMembers.some(
        (pm) => pm.projectId === project.id && pm.userId === uid
      );
      if (!inProj) {
        this.state.projectMembers.push({
          id: `pm_${crypto.randomBytes(6).toString('hex')}`,
          projectId: project.id,
          userId: uid,
          role: 'MEMBER',
          createdAt: now,
        });
      }
    }

    const task: Task = {
      id: `tsk_${crypto.randomBytes(6).toString('hex')}`,
      projectId: project.id,
      title: input.title.trim(),
      description: input.description.trim(),
      assigneeId: primaryAssigneeId,
      assignmentMode,
      teamAssigneeIds,
      createdById: actor.id,
      priority: input.priority || Priority.MEDIUM,
      status,
      dueDate: input.dueDate,
      labels: input.labels || [],
      position: existingInCol.length,
      createdAt: now,
      updatedAt: now,
    };

    this.state.tasks.push(task);

    // Notify all assigned members
    for (const recipientId of teamAssigneeIds) {
      if (recipientId && recipientId !== actor.id) {
        const modeLabel =
          assignmentMode === AssignmentMode.TEAM ? 'Team Work' : 'Individual Work';
        this.createNotification({
          userId: recipientId,
          type: NotificationType.TASK_ASSIGNED,
          message: `${actor.name} [${actor.uniqueCode}] assigned you (${modeLabel}) to "${task.title}" in ${project.name}`,
          link: `/projects/${project.id}?task=${task.id}`,
        });
      }
    }

    this.logActivity({
      userId: actor.id,
      projectId: project.id,
      taskId: task.id,
      action: 'TASK_CREATED',
      description: `Assigned ${assignmentMode} task "${task.title}" in ${project.name}`,
    });
    this.save();
    return this.enrichTask(task);
  }

  public updateTask(
    actor: User,
    taskId: string,
    updates: Partial<
      Pick<
        Task,
        | 'title'
        | 'description'
        | 'assigneeId'
        | 'assignmentMode'
        | 'teamAssigneeIds'
        | 'priority'
        | 'status'
        | 'dueDate'
        | 'labels'
        | 'position'
      >
    >
  ): EnrichedTask {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found.');
    const project = this.state.projects.find((p) => p.id === task.projectId);
    if (!project) throw new Error('Project not found.');

    RLS.assertCanUpdateTask(actor, project, task, updates, this.state);

    const prevStatus = task.status;
    const prevAssignee = task.assigneeId;

    if (updates.title !== undefined) task.title = updates.title.trim();
    if (updates.description !== undefined)
      task.description = updates.description.trim();
    if (updates.assignmentMode !== undefined)
      task.assignmentMode = updates.assignmentMode;
    if (updates.assigneeId !== undefined) {
      task.assigneeId = updates.assigneeId;
      if (task.assignmentMode !== AssignmentMode.TEAM) {
        task.teamAssigneeIds = updates.assigneeId ? [updates.assigneeId] : [];
      }
    }
    if (updates.teamAssigneeIds !== undefined) {
      task.teamAssigneeIds = updates.teamAssigneeIds;
      if (updates.teamAssigneeIds.length > 0 && !updates.assigneeId) {
        task.assigneeId = updates.teamAssigneeIds[0];
      }
    }
    if (updates.priority !== undefined) task.priority = updates.priority;
    if (updates.status !== undefined) task.status = updates.status;
    if (updates.dueDate !== undefined) task.dueDate = updates.dueDate;
    if (updates.labels !== undefined) task.labels = updates.labels;
    if (updates.position !== undefined) task.position = updates.position;
    task.updatedAt = new Date().toISOString();

    if (updates.status && updates.status !== prevStatus) {
      this.logActivity({
        userId: actor.id,
        projectId: project.id,
        taskId: task.id,
        action: 'TASK_STATUS_CHANGED',
        description: `Moved "${task.title}" from ${prevStatus} to ${task.status}`,
      });
      if (task.assigneeId && task.assigneeId !== actor.id) {
        this.createNotification({
          userId: task.assigneeId,
          type: NotificationType.STATUS_CHANGED,
          message: `${actor.name} moved "${task.title}" to ${task.status}`,
          link: `/projects/${project.id}?task=${task.id}`,
        });
      }
    } else {
      this.logActivity({
        userId: actor.id,
        projectId: project.id,
        taskId: task.id,
        action: 'TASK_UPDATED',
        description: `Updated task "${task.title}"`,
      });
    }

    if (
      updates.assigneeId !== undefined &&
      updates.assigneeId !== prevAssignee &&
      updates.assigneeId &&
      updates.assigneeId !== actor.id
    ) {
      this.createNotification({
        userId: updates.assigneeId,
        type: NotificationType.TASK_ASSIGNED,
        message: `${actor.name} [${actor.uniqueCode}] assigned you to "${task.title}"`,
        link: `/projects/${project.id}?task=${task.id}`,
      });
    }

    this.save();
    return this.enrichTask(task);
  }

  public deleteTask(actor: User, taskId: string): { projectId: string } {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found.');
    const project = this.state.projects.find((p) => p.id === task.projectId);
    if (!project) throw new Error('Project not found.');

    RLS.assertCanCreateOrDeleteTask(actor, project, 'delete');

    this.state.tasks = this.state.tasks.filter((t) => t.id !== taskId);
    this.state.comments = this.state.comments.filter((c) => c.taskId !== taskId);
    this.state.attachments = this.state.attachments.filter(
      (a) => a.taskId !== taskId
    );

    this.logActivity({
      userId: actor.id,
      projectId: project.id,
      taskId: null,
      action: 'TASK_DELETED',
      description: `Deleted task "${task.title}" from ${project.name}`,
    });
    this.save();
    return { projectId: project.id };
  }

  // --- Comments ---
  public listComments(actor: User, taskId: string): EnrichedComment[] {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found.');
    const project = this.state.projects.find((p) => p.id === task.projectId);
    if (!project) throw new Error('Project not found.');
    RLS.assertCanViewProject(actor, project, this.state);

    const userMap = new Map(this.state.users.map((u) => [u.id, sanitizeUser(u)]));
    return this.state.comments
      .filter((c) => c.taskId === taskId)
      .sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      .map((c) => ({
        ...c,
        user: userMap.get(c.userId),
      }));
  }

  public addComment(
    actor: User,
    taskId: string,
    content: string
  ): { comment: EnrichedComment; projectId: string } {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found.');
    const project = this.state.projects.find((p) => p.id === task.projectId);
    if (!project) throw new Error('Project not found.');

    RLS.assertCanAddComment(actor, project, this.state);

    const now = new Date().toISOString();
    const comment: Comment = {
      id: `cmt_${crypto.randomBytes(6).toString('hex')}`,
      taskId,
      userId: actor.id,
      content: content.trim(),
      createdAt: now,
      updatedAt: now,
    };
    this.state.comments.push(comment);

    if (task.assigneeId && task.assigneeId !== actor.id) {
      this.createNotification({
        userId: task.assigneeId,
        type: NotificationType.NEW_COMMENT,
        message: `${actor.name} commented on "${task.title}"`,
        link: `/projects/${project.id}?task=${task.id}`,
      });
    }

    this.logActivity({
      userId: actor.id,
      projectId: project.id,
      taskId: task.id,
      action: 'COMMENT_ADDED',
      description: `Commented on "${task.title}"`,
    });
    this.save();
    return {
      comment: {
        ...comment,
        user: actor,
      },
      projectId: project.id,
    };
  }

  public updateComment(
    actor: User,
    commentId: string,
    content: string
  ): { comment: EnrichedComment; projectId: string | null } {
    const comment = this.state.comments.find((c) => c.id === commentId);
    if (!comment) throw new Error('Comment not found.');
    RLS.assertCanEditComment(actor, comment);

    comment.content = content.trim();
    comment.updatedAt = new Date().toISOString();

    const task = this.state.tasks.find((t) => t.id === comment.taskId);
    this.logActivity({
      userId: actor.id,
      projectId: task?.projectId ?? null,
      taskId: comment.taskId,
      action: 'COMMENT_UPDATED',
      description: `Edited comment on "${task?.title || comment.taskId}"`,
    });
    this.save();

    const userMap = new Map(this.state.users.map((u) => [u.id, sanitizeUser(u)]));
    return {
      comment: {
        ...comment,
        user: userMap.get(comment.userId),
      },
      projectId: task?.projectId ?? null,
    };
  }

  public deleteComment(
    actor: User,
    commentId: string
  ): { taskId: string; projectId: string | null } {
    const comment = this.state.comments.find((c) => c.id === commentId);
    if (!comment) throw new Error('Comment not found.');
    RLS.assertCanDeleteComment(actor, comment);

    const task = this.state.tasks.find((t) => t.id === comment.taskId);
    this.state.comments = this.state.comments.filter((c) => c.id !== commentId);

    this.logActivity({
      userId: actor.id,
      projectId: task?.projectId ?? null,
      taskId: comment.taskId,
      action: 'COMMENT_DELETED',
      description: `Deleted comment on "${task?.title || comment.taskId}"`,
    });
    this.save();
    return { taskId: comment.taskId, projectId: task?.projectId ?? null };
  }

  // --- Attachments ---
  public listAttachments(actor: User, taskId: string): EnrichedAttachment[] {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found.');
    const project = this.state.projects.find((p) => p.id === task.projectId);
    if (!project) throw new Error('Project not found.');
    RLS.assertCanViewProject(actor, project, this.state);

    const userMap = new Map(this.state.users.map((u) => [u.id, sanitizeUser(u)]));
    return this.state.attachments
      .filter((a) => a.taskId === taskId)
      .map((a) => ({
        ...a,
        uploadedBy: userMap.get(a.uploadedById),
      }));
  }

  public uploadAttachment(
    actor: User,
    taskId: string,
    input: {
      fileName: string;
      fileType: string;
      fileSize: number;
      base64Data: string;
    }
  ): EnrichedAttachment {
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found.');
    const project = this.state.projects.find((p) => p.id === task.projectId);
    if (!project) throw new Error('Project not found.');

    RLS.assertCanUploadAttachment(actor, project, this.state);

    if (!ALLOWED_MIME_TYPES.has(input.fileType)) {
      throw new Error(
        `Invalid file type "${input.fileType || 'unknown'}". Only images (PNG, JPG, WEBP, GIF, SVG), PDFs, and common documents (TXT, CSV, DOC, DOCX, XLS, XLSX) are permitted.`
      );
    }

    if (input.fileSize > MAX_ATTACHMENT_BYTES) {
      throw new Error(
        `File "${input.fileName}" (${(input.fileSize / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum 10 MB attachment size limit.`
      );
    }

    const id = `att_${crypto.randomBytes(6).toString('hex')}`;
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const diskPath = path.join(UPLOADS_DIR, `${id}_${safeName}`);

    const cleanBase64 = input.base64Data.includes(',')
      ? input.base64Data.split(',')[1]
      : input.base64Data;
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new Error('Uploaded file payload exceeds the 10 MB limit.');
    }

    ensureDirectories();
    fs.writeFileSync(diskPath, buffer);

    const attachment: Attachment = {
      id,
      taskId,
      uploadedById: actor.id,
      fileName: input.fileName,
      fileUrl: `/api/attachments/${id}/download`,
      fileType: input.fileType,
      fileSize: input.fileSize || buffer.byteLength,
      createdAt: new Date().toISOString(),
    };

    this.state.attachments.push(attachment);
    this.logActivity({
      userId: actor.id,
      projectId: project.id,
      taskId: task.id,
      action: 'ATTACHMENT_UPLOADED',
      description: `Uploaded attachment "${attachment.fileName}" to "${task.title}"`,
    });
    this.save();

    return {
      ...attachment,
      uploadedBy: actor,
    };
  }

  public getAttachmentForDownload(
    actor: User,
    attachmentId: string
  ): { attachment: Attachment; diskPath: string | null } {
    const attachment = this.state.attachments.find((a) => a.id === attachmentId);
    if (!attachment) throw new Error('Attachment not found.');
    const task = this.state.tasks.find((t) => t.id === attachment.taskId);
    if (!task) throw new Error('Task not found.');
    const project = this.state.projects.find((p) => p.id === task.projectId);
    if (!project) throw new Error('Project not found.');
    RLS.assertCanViewProject(actor, project, this.state);

    const safeName = attachment.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const candidatePath = path.join(UPLOADS_DIR, `${attachment.id}_${safeName}`);
    return {
      attachment,
      diskPath: fs.existsSync(candidatePath) ? candidatePath : null,
    };
  }

  public deleteAttachment(actor: User, attachmentId: string): void {
    const attachment = this.state.attachments.find((a) => a.id === attachmentId);
    if (!attachment) throw new Error('Attachment not found.');
    const task = this.state.tasks.find((t) => t.id === attachment.taskId);
    if (!task) throw new Error('Task not found.');
    const project = this.state.projects.find((p) => p.id === task.projectId);
    if (!project) throw new Error('Project not found.');

    RLS.assertCanDeleteAttachment(actor, attachment, project);

    const safeName = attachment.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const candidatePath = path.join(UPLOADS_DIR, `${attachment.id}_${safeName}`);
    if (fs.existsSync(candidatePath)) {
      try {
        fs.unlinkSync(candidatePath);
      } catch {
        // Ignore file unlink errors
      }
    }

    this.state.attachments = this.state.attachments.filter(
      (a) => a.id !== attachmentId
    );
    this.logActivity({
      userId: actor.id,
      projectId: project.id,
      taskId: task.id,
      action: 'ATTACHMENT_DELETED',
      description: `Deleted attachment "${attachment.fileName}" from "${task.title}"`,
    });
    this.save();
  }

  // --- Notifications & Activity Logs ---
  public listNotifications(actor: User): Notification[] {
    return this.state.notifications
      .filter((n) => n.userId === actor.id)
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  public markNotificationRead(
    actor: User,
    notificationId: string,
    isRead = true
  ): Notification {
    const notif = this.state.notifications.find((n) => n.id === notificationId);
    if (!notif || notif.userId !== actor.id) {
      throw new PermissionDeniedError(
        'RLS_NOTIFICATION_OWNER',
        "You don't have permission to modify another user's notification."
      );
    }
    notif.isRead = isRead;
    this.save();
    return notif;
  }

  public markAllNotificationsRead(actor: User): void {
    for (const n of this.state.notifications) {
      if (n.userId === actor.id) {
        n.isRead = true;
      }
    }
    this.save();
  }

  public listActivityLogs(
    actor: User,
    options?: { projectId?: string; taskId?: string; limit?: number }
  ): EnrichedActivityLog[] {
    const visibleProjectIds = new Set(
      RLS.filterVisibleProjects(actor, this.state).map((p) => p.id)
    );
    const userMap = new Map(this.state.users.map((u) => [u.id, sanitizeUser(u)]));
    const projectMap = new Map(this.state.projects.map((p) => [p.id, p.name]));
    const taskMap = new Map(this.state.tasks.map((t) => [t.id, t.title]));

    let logs = this.state.activityLogs.filter((log) => {
      if (actor.role === UserRole.SUPER_ADMIN) return true;
      if (!log.projectId) return log.userId === actor.id;
      return visibleProjectIds.has(log.projectId);
    });

    if (options?.projectId) {
      logs = logs.filter((l) => l.projectId === options.projectId);
    }
    if (options?.taskId) {
      logs = logs.filter((l) => l.taskId === options.taskId);
    }

    const sorted = [...logs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const sliced = options?.limit ? sorted.slice(0, options.limit) : sorted;

    return sliced.map((l) => ({
      ...l,
      user: userMap.get(l.userId),
      projectName: l.projectId ? projectMap.get(l.projectId) : undefined,
      taskTitle: l.taskId ? taskMap.get(l.taskId) : undefined,
    }));
  }
}

export const db = new DatabaseEngine();
