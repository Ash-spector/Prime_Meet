import {
  type Attachment,
  type Comment,
  type Project,
  type ProjectType,
  type Task,
  type User,
  UserRole,
} from '../shared/types.ts';
import type { DatabaseSchema } from './seed.ts';

export class PermissionDeniedError extends Error {
  public readonly statusCode = 403;
  public readonly code = 'PERMISSION_DENIED';
  public readonly rule: string;

  constructor(rule: string, message: string) {
    super(message);
    this.name = 'PermissionDeniedError';
    this.rule = rule;
  }
}

/**
 * Row-Level Security (RLS) & Database Access Rules Engine.
 * Enforces permissions at the data access layer for SUPER_ADMIN, PROJECT_MANAGER, and TEAM_MEMBER.
 */
export const RLS = {
  /**
   * Rule 1: Only SUPER_ADMIN can access system administration queries or mutations.
   */
  assertSuperAdmin(actor: User): void {
    if (actor.role !== UserRole.SUPER_ADMIN) {
      throw new PermissionDeniedError(
        'RLS_ADMIN_ACCESS',
        "You don't have permission to access administrator pages or manage system-wide resources."
      );
    }
  },

  /**
   * Rule 2: Organization visibility & management.
   */
  filterVisibleOrganizations(actor: User, db: DatabaseSchema) {
    if (actor.role === UserRole.SUPER_ADMIN) {
      return db.organizations;
    }
    const memberOrgIds = new Set(
      db.organizationMembers
        .filter((om) => om.userId === actor.id)
        .map((om) => om.organizationId)
    );
    return db.organizations.filter((o) => memberOrgIds.has(o.id));
  },

  assertCanManageOrganization(actor: User): void {
    if (actor.role !== UserRole.SUPER_ADMIN) {
      throw new PermissionDeniedError(
        'RLS_ORG_MANAGE',
        "You don't have permission to create, modify, or delete organizations."
      );
    }
  },

  /**
   * Rule 3: Project Row-Level Visibility.
   * - SUPER_ADMIN: all projects
   * - PROJECT_MANAGER: own managed projects + projects they are a member of
   * - TEAM_MEMBER: strictly projects they belong to in project_members
   */
  canViewProject(actor: User, project: Project, db: DatabaseSchema): boolean {
    if (actor.role === UserRole.SUPER_ADMIN) {
      return true;
    }
    if (actor.role === UserRole.PROJECT_MANAGER && project.managerId === actor.id) {
      return true;
    }
    return db.projectMembers.some(
      (pm) => pm.projectId === project.id && pm.userId === actor.id
    );
  },

  assertCanViewProject(actor: User, project: Project, db: DatabaseSchema): void {
    if (!this.canViewProject(actor, project, db)) {
      throw new PermissionDeniedError(
        'RLS_PROJECT_VIEW',
        "You don't have permission to view this project because you are not a member of it."
      );
    }
  },

  filterVisibleProjects(actor: User, db: DatabaseSchema): Project[] {
    return db.projects.filter((project) => this.canViewProject(actor, project, db));
  },

  /**
   * Rule 4: Project Creation, Modification, Archiving, Deletion & Member Management.
   * - SUPER_ADMIN: can create, edit, archive, delete any project
   * - PROJECT_MANAGER: can create projects; can edit, archive, delete, and manage members ONLY on own projects
   * - TEAM_MEMBER: cannot create, edit, archive, or delete projects, nor manage members
   */
  assertCanCreateProject(actor: User): void {
    if (actor.role !== UserRole.SUPER_ADMIN && actor.role !== UserRole.PROJECT_MANAGER) {
      throw new PermissionDeniedError(
        'RLS_PROJECT_CREATE',
        "You don't have permission to create projects. Only Project Managers and Super Admins can create projects."
      );
    }
  },

  assertCanModifyProject(actor: User, project: Project, actionLabel = 'modify'): void {
    if (actor.role === UserRole.SUPER_ADMIN) {
      return;
    }
    if (actor.role === UserRole.TEAM_MEMBER) {
      throw new PermissionDeniedError(
        'RLS_PROJECT_MEMBER_FORBIDDEN',
        `You don't have permission to ${actionLabel} projects.`
      );
    }
    if (actor.role === UserRole.PROJECT_MANAGER && project.managerId !== actor.id) {
      throw new PermissionDeniedError(
        'RLS_PROJECT_OWNERSHIP',
        `You don't have permission to ${actionLabel} a project managed by another Project Manager.`
      );
    }
  },

  /**
   * Rule 5: Task Visibility, Creation, Update, and Deletion.
   * - SUPER_ADMIN: full access
   * - PROJECT_MANAGER: create, edit, delete, and assign tasks in their own projects
   * - TEAM_MEMBER: view tasks in projects they belong to; ONLY update status (and Kanban position) of tasks assigned to them or their team
   */
  filterVisibleTasks(actor: User, db: DatabaseSchema): Task[] {
    const visibleProjectIds = new Set(
      this.filterVisibleProjects(actor, db).map((p) => p.id)
    );
    return db.tasks.filter((t) => visibleProjectIds.has(t.projectId));
  },

  assertCanCreateOrDeleteTask(actor: User, project: Project, actionLabel: 'create' | 'delete'): void {
    if (actor.role === UserRole.SUPER_ADMIN) {
      return;
    }
    if (actor.role === UserRole.PROJECT_MANAGER && project.managerId === actor.id) {
      return;
    }
    throw new PermissionDeniedError(
      `RLS_TASK_${actionLabel.toUpperCase()}`,
      `You don't have permission to ${actionLabel} tasks in this project.`
    );
  },

  assertCanUpdateTask(
    actor: User,
    project: Project,
    task: Task,
    updates: Partial<Task>,
    db: DatabaseSchema
  ): void {
    this.assertCanViewProject(actor, project, db);

    if (actor.role === UserRole.SUPER_ADMIN) {
      return;
    }

    if (actor.role === UserRole.PROJECT_MANAGER) {
      const isAssignedToPm =
        task.assigneeId === actor.id ||
        (Array.isArray(task.teamAssigneeIds) &&
          task.teamAssigneeIds.includes(actor.id));
      if (project.managerId !== actor.id && !isAssignedToPm) {
        throw new PermissionDeniedError(
          'RLS_TASK_MANAGER_OWNERSHIP',
          "You don't have permission to edit tasks in a project managed by another Project Manager."
        );
      }
      return;
    }

    // TEAM_MEMBER rules: allowed if assigned individually OR included in teamAssigneeIds
    const isAssignedToActor =
      task.assigneeId === actor.id ||
      (Array.isArray(task.teamAssigneeIds) && task.teamAssigneeIds.includes(actor.id));

    if (!isAssignedToActor) {
      throw new PermissionDeniedError(
        'RLS_TASK_ASSIGNEE_ONLY',
        "You don't have permission to update this task because it is not assigned to you."
      );
    }

    // Check if TEAM_MEMBER is trying to modify anything other than status or position
    const forbiddenKeys: Array<keyof Task> = [
      'title',
      'description',
      'assigneeId',
      'assignmentMode',
      'teamAssigneeIds',
      'priority',
      'dueDate',
      'labels',
      'projectId',
    ];

    for (const key of forbiddenKeys) {
      if (updates[key] !== undefined) {
        const currentVal = JSON.stringify(task[key]);
        const nextVal = JSON.stringify(updates[key]);
        if (currentVal !== nextVal) {
          throw new PermissionDeniedError(
            'RLS_TASK_STATUS_ONLY',
            "You don't have permission to edit task details or assignments. Team members can only update the status of tasks assigned to them."
          );
        }
      }
    }
  },

  /**
   * Rule 6: Comments.
   */
  assertCanAddComment(actor: User, project: Project, db: DatabaseSchema): void {
    this.assertCanViewProject(actor, project, db);
  },

  assertCanEditComment(actor: User, comment: Comment): void {
    if (comment.userId !== actor.id) {
      throw new PermissionDeniedError(
        'RLS_COMMENT_EDIT_OWN_ONLY',
        "You don't have permission to edit another user's comment."
      );
    }
  },

  assertCanDeleteComment(actor: User, comment: Comment): void {
    if (comment.userId !== actor.id && actor.role !== UserRole.SUPER_ADMIN) {
      throw new PermissionDeniedError(
        'RLS_COMMENT_DELETE_OWN_ONLY',
        "You don't have permission to delete another user's comment."
      );
    }
  },

  /**
   * Rule 7: Attachments.
   */
  assertCanUploadAttachment(actor: User, project: Project, db: DatabaseSchema): void {
    this.assertCanViewProject(actor, project, db);
  },

  assertCanDeleteAttachment(actor: User, attachment: Attachment, project: Project): void {
    if (
      actor.role === UserRole.SUPER_ADMIN ||
      project.managerId === actor.id ||
      attachment.uploadedById === actor.id
    ) {
      return;
    }
    throw new PermissionDeniedError(
      'RLS_ATTACHMENT_DELETE',
      "You don't have permission to delete another user's attachment."
    );
  },

  /**
   * Rule 8: User Profile & Role Updates.
   */
  assertCanUpdateUser(
    actor: User,
    targetUser: User,
    updates: {
      name?: string;
      avatar?: string;
      role?: UserRole;
      specialization?: ProjectType;
      managerId?: string | null;
    }
  ): void {
    if (actor.role === UserRole.SUPER_ADMIN) {
      return;
    }
    if (actor.id !== targetUser.id) {
      throw new PermissionDeniedError(
        'RLS_USER_EDIT_OTHER',
        "You don't have permission to edit another user's profile."
      );
    }
    if (updates.role !== undefined && updates.role !== targetUser.role) {
      throw new PermissionDeniedError(
        'RLS_USER_ROLE_ESCALATION',
        "You don't have permission to change user roles."
      );
    }
  },
};
