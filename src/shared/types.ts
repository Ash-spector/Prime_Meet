export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  TEAM_MEMBER: 'TEAM_MEMBER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ProjectType = {
  WEB_DEVELOPMENT: 'WEB_DEVELOPMENT',
  MOBILE_DEVELOPMENT: 'MOBILE_DEVELOPMENT',
  AI_DATA_SCIENCE: 'AI_DATA_SCIENCE',
  CLOUD_DEVOPS: 'CLOUD_DEVOPS',
  UI_UX_DESIGN: 'UI_UX_DESIGN',
  CYBERSECURITY: 'CYBERSECURITY',
} as const;
export type ProjectType = (typeof ProjectType)[keyof typeof ProjectType];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  WEB_DEVELOPMENT: 'Web Development',
  MOBILE_DEVELOPMENT: 'Mobile App Development',
  AI_DATA_SCIENCE: 'AI & Data Science',
  CLOUD_DEVOPS: 'Cloud & DevOps',
  UI_UX_DESIGN: 'UI/UX & Product Design',
  CYBERSECURITY: 'Security & Compliance',
};

export const AssignmentMode = {
  INDIVIDUAL: 'INDIVIDUAL',
  TEAM: 'TEAM',
} as const;
export type AssignmentMode = (typeof AssignmentMode)[keyof typeof AssignmentMode];

export const ProjectStatus = {
  PLANNING: 'PLANNING',
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const TaskStatus = {
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  DONE: 'DONE',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const NotificationType = {
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  NEW_COMMENT: 'NEW_COMMENT',
  REMOVED_FROM_PROJECT: 'REMOVED_FROM_PROJECT',
  DEADLINE_APPROACHING: 'DEADLINE_APPROACHING',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export interface User {
  id: string;
  uniqueCode: string;
  name: string;
  email: string;
  avatar: string;
  role: UserRole;
  specialization: ProjectType;
  managerId?: string | null;
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
  projectType: ProjectType;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  startDate: string;
  dueDate: string;
  managerId: string;
  assignmentMode: AssignmentMode;
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
  assignmentMode?: AssignmentMode;
  teamAssigneeIds?: string[];
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
  projectType?: ProjectType;
  projectManager?: User;
  assignee?: User | null;
  teamAssignees?: User[];
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
