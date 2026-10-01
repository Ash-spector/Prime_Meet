export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  TEAM_MEMBER = 'TEAM_MEMBER',
}

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
}

export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  NEW_COMMENT = 'NEW_COMMENT',
  REMOVED_FROM_PROJECT = 'REMOVED_FROM_PROJECT',
  DEADLINE_APPROACHING = 'DEADLINE_APPROACHING',
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: UserRole;
  createdAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  startDate: string;
  dueDate: string;
  managerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'MANAGER' | 'MEMBER';
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assigneeId: string | null;
  createdById: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  labels: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  taskId: string;
  uploadedById: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  isRead: boolean;
  link: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  projectId: string | null;
  taskId: string | null;
  action: string;
  description: string;
  createdAt: string;
}

export interface EnrichedProject extends Project {
  organizationName?: string;
  manager?: User;
  members: Array<ProjectMember & { user: User }>;
  taskStats: {
    total: number;
    todo: number;
    inProgress: number;
    inReview: number;
    done: number;
    overdue: number;
    progressPercent: number;
  };
}

export interface EnrichedTask extends Task {
  projectName?: string;
  assignee?: User | null;
  createdBy?: User;
  commentCount: number;
  attachmentCount: number;
}

export interface EnrichedComment extends Comment {
  user?: User;
}

export interface EnrichedAttachment extends Attachment {
  uploadedBy?: User;
}

export interface EnrichedActivityLog extends ActivityLog {
  user?: User;
  projectName?: string;
  taskTitle?: string;
}
