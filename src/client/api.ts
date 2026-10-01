import {
  AssignmentMode,
  EnrichedActivityLog,
  EnrichedAttachment,
  EnrichedComment,
  EnrichedProject,
  EnrichedTask,
  Notification,
  Organization,
  OrganizationMember,
  Priority,
  ProjectStatus,
  ProjectType,
  TaskStatus,
  User,
  UserRole,
} from '../shared/types.ts';

const TOKEN_STORAGE_KEY = 'primemeet_session_token';

const clientDataCache = new Map<string, unknown>();

export function clearClientCache(): void {
  clientDataCache.clear();
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly rule?: string;

  constructor(status: number, code: string, message: string, rule?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.rule = rule;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.code || 'API_ERROR',
      data.message || `Request failed with status ${res.status}`,
      data.rule
    );
  }

  return data as T;
}

export interface DevConfigResponse {
  isDev: boolean;
  demoPassword: string | null;
  demoAccounts: Array<{
    name: string;
    email: string;
    role: UserRole;
    portalLabel: string;
  }>;
}

export interface AdminOverviewResponse {
  totals: {
    users: number;
    organizations: number;
    projects: number;
    tasks: number;
  };
  usersByRole: Record<UserRole, number>;
  projectsByStatus: Record<ProjectStatus, number>;
  newestUsers: User[];
  recentActivity: EnrichedActivityLog[];
}

export interface PaginatedProjectsResponse {
  projects: EnrichedProject[];
  total: number;
  page: number;
  totalPages: number;
}

export const api = {
  // Auth
  getDevConfig: () => request<DevConfigResponse>('/api/auth/dev-config'),

  login: async (email: string, password: string) => {
    clearClientCache();
    const res = await request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  signup: async (name: string, email: string, password: string) => {
    clearClientCache();
    const res = await request<{ user: User; token: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  logout: async () => {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network/expired errors during logout
    } finally {
      clearClientCache();
      setStoredToken(null);
    }
  },

  getMe: () => request<{ user: User }>('/api/auth/me'),

  // Users
  listUsers: () => request<{ users: User[] }>('/api/users'),

  updateUser: (
    userId: string,
    updates: {
      name?: string;
      avatar?: string;
      role?: UserRole;
      specialization?: ProjectType;
      managerId?: string | null;
    }
  ) =>
    request<{ user: User }>(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  // Admin
  getAdminOverview: () => request<AdminOverviewResponse>('/api/admin/overview'),

  resetSeed: () =>
    request<{ ok: boolean; message: string }>('/api/admin/reset-seed', {
      method: 'POST',
    }),

  // Organizations
  listOrganizations: () =>
    request<{
      organizations: Array<
        Organization & {
          memberCount: number;
          projectCount: number;
          members: Array<OrganizationMember & { user?: User }>;
        }
      >;
    }>('/api/organizations'),

  createOrganization: (input: { name: string; slug: string; description: string }) =>
    request<{ organization: Organization }>('/api/organizations', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateOrganization: (
    orgId: string,
    updates: { name?: string; slug?: string; description?: string }
  ) =>
    request<{ organization: Organization }>(`/api/organizations/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteOrganization: (orgId: string) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}`, {
      method: 'DELETE',
    }),

  addOrganizationMember: (orgId: string, userId: string, role?: UserRole) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    }),

  removeOrganizationMember: (orgId: string, userId: string) =>
    request<{ ok: boolean }>(`/api/organizations/${orgId}/members/${userId}`, {
      method: 'DELETE',
    }),

  // Projects
  listProjects: (params?: {
    search?: string;
    status?: string;
    organizationId?: string;
    page?: number;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status && params.status !== 'ALL') qs.set('status', params.status);
    if (params?.organizationId) qs.set('organizationId', params.organizationId);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const queryStr = qs.toString();
    return request<PaginatedProjectsResponse>(
      queryStr ? `/api/projects?${queryStr}` : '/api/projects'
    );
  },

  getProject: (projectId: string) =>
    request<{ project: EnrichedProject }>(`/api/projects/${projectId}`),

  createProject: (input: {
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
  }) =>
    request<{ project: EnrichedProject }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateProject: (
    projectId: string,
    updates: Partial<{
      name: string;
      projectType: ProjectType;
      description: string;
      status: ProjectStatus;
      priority: Priority;
      startDate: string;
      dueDate: string;
      managerId: string;
      assignmentMode: AssignmentMode;
      memberIds: string[];
    }>
  ) =>
    request<{ project: EnrichedProject }>(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteProject: (projectId: string) =>
    request<{ ok: boolean }>(`/api/projects/${projectId}`, {
      method: 'DELETE',
    }),

  addProjectMember: (
    projectId: string,
    userId: string,
    role: 'MANAGER' | 'MEMBER' = 'MEMBER'
  ) =>
    request<{ project: EnrichedProject }>(`/api/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId, role }),
    }),

  removeProjectMember: (projectId: string, userId: string) =>
    request<{ project: EnrichedProject }>(
      `/api/projects/${projectId}/members/${userId}`,
      {
        method: 'DELETE',
      }
    ),

  // Tasks
  listTasks: (projectId?: string) =>
    request<{ tasks: EnrichedTask[] }>(
      projectId ? `/api/tasks?projectId=${encodeURIComponent(projectId)}` : '/api/tasks'
    ),

  createTask: (input: {
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
  }) =>
    request<{ task: EnrichedTask }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateTask: (
    taskId: string,
    updates: Partial<{
      title: string;
      description: string;
      assigneeId: string | null;
      assignmentMode: AssignmentMode;
      teamAssigneeIds: string[];
      priority: Priority;
      status: TaskStatus;
      dueDate: string;
      labels: string[];
      position: number;
    }>
  ) =>
    request<{ task: EnrichedTask }>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteTask: (taskId: string) =>
    request<{ ok: boolean }>(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    }),

  // Comments
  listComments: (taskId: string) =>
    request<{ comments: EnrichedComment[] }>(`/api/tasks/${taskId}/comments`),

  addComment: (taskId: string, content: string) =>
    request<{ comment: EnrichedComment }>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  updateComment: (commentId: string, content: string) =>
    request<{ comment: EnrichedComment }>(`/api/comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  deleteComment: (commentId: string) =>
    request<{ ok: boolean }>(`/api/comments/${commentId}`, {
      method: 'DELETE',
    }),

  // Attachments
  listAttachments: (taskId: string) =>
    request<{ attachments: EnrichedAttachment[] }>(`/api/tasks/${taskId}/attachments`),

  uploadAttachment: (
    taskId: string,
    input: {
      fileName: string;
      fileType: string;
      fileSize: number;
      base64Data: string;
    }
  ) =>
    request<{ attachment: EnrichedAttachment }>(`/api/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  deleteAttachment: (attachmentId: string) =>
    request<{ ok: boolean }>(`/api/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),

  getAttachmentDownloadUrl: (attachmentId: string) => {
    const token = getStoredToken();
    return `/api/attachments/${attachmentId}/download?token=${encodeURIComponent(
      token || ''
    )}`;
  },

  // Notifications & Activity
  listNotifications: () =>
    request<{ notifications: Notification[] }>('/api/notifications'),

  markNotificationRead: (notificationId: string, isRead = true) =>
    request<{ notification: Notification }>(`/api/notifications/${notificationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead }),
    }),

  markAllNotificationsRead: () =>
    request<{ ok: boolean }>('/api/notifications/read-all', {
      method: 'POST',
    }),

  listActivity: (projectId?: string) =>
    request<{ activityLogs: EnrichedActivityLog[] }>(
      projectId
        ? `/api/activity?projectId=${encodeURIComponent(projectId)}`
        : '/api/activity'
    ),
};
