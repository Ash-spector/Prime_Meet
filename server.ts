import express, { NextFunction, Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import { db } from './src/server/db.ts';
import { PermissionDeniedError } from './src/server/rls.ts';
import { DEMO_PASSWORD } from './src/server/seed.ts';
import { User, UserRole } from './src/shared/types.ts';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      token?: string;
    }
  }
}

interface PresenceClient {
  ws: WebSocket;
  userId: string;
  name: string;
  avatar: string;
  role: UserRole;
  projectId: string | null;
  connectedAt: string;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: '16mb' }));

  // --- Real-Time WebSocket Server (Presence & Instant Sync) ---
  const wss = new WebSocketServer({ server, path: '/ws' });
  const presenceMap = new Map<WebSocket, PresenceClient>();

  function broadcastPresence() {
    const uniqueUsers = new Map<
      string,
      {
        userId: string;
        name: string;
        avatar: string;
        role: UserRole;
        projectId: string | null;
      }
    >();

    for (const client of presenceMap.values()) {
      uniqueUsers.set(client.userId, {
        userId: client.userId,
        name: client.name,
        avatar: client.avatar,
        role: client.role,
        projectId: client.projectId,
      });
    }

    const payload = JSON.stringify({
      type: 'presence:sync',
      onlineUsers: Array.from(uniqueUsers.values()),
    });

    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  function broadcastEvent(event: {
    type: string;
    entity: string;
    action: string;
    projectId?: string | null;
    taskId?: string | null;
    actorId?: string;
    actorName?: string;
  }) {
    const payload = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        if (msg.type === 'presence:join' && msg.token) {
          const user = db.getUserByToken(String(msg.token));
          if (user) {
            presenceMap.set(ws, {
              ws,
              userId: user.id,
              name: user.name,
              avatar: user.avatar,
              role: user.role,
              projectId: msg.projectId || null,
              connectedAt: new Date().toISOString(),
            });
            broadcastPresence();
          }
          return;
        }
        if (msg.type === 'presence:project') {
          const existing = presenceMap.get(ws);
          if (existing) {
            existing.projectId = msg.projectId || null;
            broadcastPresence();
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      if (presenceMap.has(ws)) {
        presenceMap.delete(ws);
        broadcastPresence();
      }
    });
  });

  // Authentication Middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const queryToken =
      typeof req.query.token === 'string' ? req.query.token : undefined;
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : queryToken;

    if (!token) {
      res.status(401).json({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required. Please log in.',
      });
      return;
    }
    const user = db.getUserByToken(token);
    if (!user) {
      res.status(401).json({
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired or is invalid. Please log in again.',
      });
      return;
    }
    req.user = user;
    req.token = token;
    next();
  };

  // --- Auth Routes ---
  app.get('/api/auth/dev-config', (_req, res) => {
    const isDev = process.env.NODE_ENV !== 'production';
    res.json({
      isDev,
      demoPassword: isDev ? DEMO_PASSWORD : null,
      demoAccounts: isDev
        ? [
            {
              name: 'Alex Rivera',
              email: 'alex.rivera@primemeet.io',
              role: 'SUPER_ADMIN',
              portalLabel: 'Admin Portal',
            },
            {
              name: 'Sarah Chen',
              email: 'sarah.chen@primemeet.io',
              role: 'PROJECT_MANAGER',
              portalLabel: 'Manager Portal',
            },
            {
              name: 'David Kim',
              email: 'david.kim@primemeet.io',
              role: 'TEAM_MEMBER',
              portalLabel: 'Member Portal',
            },
          ]
        : [],
    });
  });

  app.post('/api/auth/login', (req, res, next) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ message: 'Email and password are required.' });
        return;
      }
      const result = db.login(String(email), String(password));
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/signup', (req, res, next) => {
    try {
      const { name, email, password } = req.body;
      const result = db.signup({
        name: String(name || ''),
        email: String(email || ''),
        password: String(password || ''),
      });
      broadcastEvent({
        type: 'data:changed',
        entity: 'user',
        action: 'created',
        actorId: result.user.id,
        actorName: result.user.name,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/logout', requireAuth, (req, res) => {
    if (req.token) {
      db.logout(req.token);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  // --- Users & Profile ---
  app.get('/api/users', requireAuth, (req, res, next) => {
    try {
      const users = db.listUsers(req.user!);
      res.json({ users });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/users/:id', requireAuth, (req, res, next) => {
    try {
      const updated = db.updateUser(req.user!, req.params.id, req.body);
      broadcastEvent({
        type: 'data:changed',
        entity: 'user',
        action: 'updated',
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.json({ user: updated });
    } catch (err) {
      next(err);
    }
  });

  // --- Admin Endpoints (Protected by RLS.assertSuperAdmin) ---
  app.get('/api/admin/overview', requireAuth, (req, res, next) => {
    try {
      const data = db.getAdminOverview(req.user!);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/admin/reset-seed', requireAuth, (req, res, next) => {
    try {
      db.resetToSeed(req.user!);
      broadcastEvent({
        type: 'data:changed',
        entity: 'system',
        action: 'reset',
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.json({
        ok: true,
        message: 'Database reset to initial PrimeMeet Labs seed state.',
      });
    } catch (err) {
      next(err);
    }
  });

  // --- Organizations ---
  app.get('/api/organizations', requireAuth, (req, res, next) => {
    try {
      const organizations = db.listOrganizations(req.user!);
      res.json({ organizations });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/organizations', requireAuth, (req, res, next) => {
    try {
      const org = db.createOrganization(req.user!, req.body);
      broadcastEvent({
        type: 'data:changed',
        entity: 'organization',
        action: 'created',
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.status(201).json({ organization: org });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/organizations/:id', requireAuth, (req, res, next) => {
    try {
      const org = db.updateOrganization(req.user!, req.params.id, req.body);
      broadcastEvent({
        type: 'data:changed',
        entity: 'organization',
        action: 'updated',
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.json({ organization: org });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/organizations/:id', requireAuth, (req, res, next) => {
    try {
      db.deleteOrganization(req.user!, req.params.id);
      broadcastEvent({
        type: 'data:changed',
        entity: 'organization',
        action: 'deleted',
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/organizations/:id/members', requireAuth, (req, res, next) => {
    try {
      db.addOrganizationMember(
        req.user!,
        req.params.id,
        req.body.userId,
        req.body.role
      );
      broadcastEvent({
        type: 'data:changed',
        entity: 'organization',
        action: 'member_added',
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.delete(
    '/api/organizations/:id/members/:userId',
    requireAuth,
    (req, res, next) => {
      try {
        db.removeOrganizationMember(
          req.user!,
          req.params.id,
          req.params.userId
        );
        broadcastEvent({
          type: 'data:changed',
          entity: 'organization',
          action: 'member_removed',
          actorId: req.user!.id,
          actorName: req.user!.name,
        });
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Projects ---
  app.get('/api/projects', requireAuth, (req, res, next) => {
    try {
      const search =
        typeof req.query.search === 'string' ? req.query.search : undefined;
      const status =
        typeof req.query.status === 'string' ? req.query.status : undefined;
      const organizationId =
        typeof req.query.organizationId === 'string'
          ? req.query.organizationId
          : undefined;
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const result = db.listProjects(req.user!, {
        search,
        status,
        organizationId,
        page,
        limit,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/projects/:id', requireAuth, (req, res, next) => {
    try {
      const project = db.getProjectById(req.user!, req.params.id);
      res.json({ project });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/projects', requireAuth, (req, res, next) => {
    try {
      const project = db.createProject(req.user!, req.body);
      broadcastEvent({
        type: 'data:changed',
        entity: 'project',
        action: 'created',
        projectId: project.id,
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.status(201).json({ project });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/projects/:id', requireAuth, (req, res, next) => {
    try {
      const project = db.updateProject(req.user!, req.params.id, req.body);
      broadcastEvent({
        type: 'data:changed',
        entity: 'project',
        action: 'updated',
        projectId: project.id,
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.json({ project });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/projects/:id', requireAuth, (req, res, next) => {
    try {
      const pid = req.params.id;
      db.deleteProject(req.user!, pid);
      broadcastEvent({
        type: 'data:changed',
        entity: 'project',
        action: 'deleted',
        projectId: pid,
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/projects/:id/members', requireAuth, (req, res, next) => {
    try {
      const project = db.addProjectMember(
        req.user!,
        req.params.id,
        req.body.userId,
        req.body.role || 'MEMBER'
      );
      broadcastEvent({
        type: 'data:changed',
        entity: 'project',
        action: 'member_added',
        projectId: project.id,
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.json({ project });
    } catch (err) {
      next(err);
    }
  });

  app.delete(
    '/api/projects/:id/members/:userId',
    requireAuth,
    (req, res, next) => {
      try {
        const project = db.removeProjectMember(
          req.user!,
          req.params.id,
          req.params.userId
        );
        broadcastEvent({
          type: 'data:changed',
          entity: 'project',
          action: 'member_removed',
          projectId: project.id,
          actorId: req.user!.id,
          actorName: req.user!.name,
        });
        res.json({ project });
      } catch (err) {
        next(err);
      }
    }
  );

  // --- Tasks ---
  app.get('/api/tasks', requireAuth, (req, res, next) => {
    try {
      const projectId =
        typeof req.query.projectId === 'string'
          ? req.query.projectId
          : undefined;
      const tasks = db.listTasks(req.user!, projectId);
      res.json({ tasks });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/tasks', requireAuth, (req, res, next) => {
    try {
      const task = db.createTask(req.user!, req.body);
      broadcastEvent({
        type: 'data:changed',
        entity: 'task',
        action: 'created',
        projectId: task.projectId,
        taskId: task.id,
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.status(201).json({ task });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/tasks/:id', requireAuth, (req, res, next) => {
    try {
      const task = db.updateTask(req.user!, req.params.id, req.body);
      broadcastEvent({
        type: 'data:changed',
        entity: 'task',
        action: 'updated',
        projectId: task.projectId,
        taskId: task.id,
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.json({ task });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/tasks/:id', requireAuth, (req, res, next) => {
    try {
      const { projectId } = db.deleteTask(req.user!, req.params.id);
      broadcastEvent({
        type: 'data:changed',
        entity: 'task',
        action: 'deleted',
        projectId,
        taskId: req.params.id,
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // --- Comments ---
  app.get('/api/tasks/:taskId/comments', requireAuth, (req, res, next) => {
    try {
      const comments = db.listComments(req.user!, req.params.taskId);
      res.json({ comments });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/tasks/:taskId/comments', requireAuth, (req, res, next) => {
    try {
      const { comment, projectId } = db.addComment(
        req.user!,
        req.params.taskId,
        String(req.body.content || '')
      );
      broadcastEvent({
        type: 'data:changed',
        entity: 'comment',
        action: 'created',
        projectId,
        taskId: req.params.taskId,
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.status(201).json({ comment });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/comments/:id', requireAuth, (req, res, next) => {
    try {
      const { comment, projectId } = db.updateComment(
        req.user!,
        req.params.id,
        String(req.body.content || '')
      );
      broadcastEvent({
        type: 'data:changed',
        entity: 'comment',
        action: 'updated',
        projectId,
        taskId: comment.taskId,
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.json({ comment });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/comments/:id', requireAuth, (req, res, next) => {
    try {
      const { taskId, projectId } = db.deleteComment(req.user!, req.params.id);
      broadcastEvent({
        type: 'data:changed',
        entity: 'comment',
        action: 'deleted',
        projectId,
        taskId,
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // --- Attachments ---
  app.get('/api/tasks/:taskId/attachments', requireAuth, (req, res, next) => {
    try {
      const attachments = db.listAttachments(req.user!, req.params.taskId);
      res.json({ attachments });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/tasks/:taskId/attachments', requireAuth, (req, res, next) => {
    try {
      const attachment = db.uploadAttachment(req.user!, req.params.taskId, {
        fileName: String(req.body.fileName || ''),
        fileType: String(req.body.fileType || ''),
        fileSize: Number(req.body.fileSize || 0),
        base64Data: String(req.body.base64Data || ''),
      });
      broadcastEvent({
        type: 'data:changed',
        entity: 'attachment',
        action: 'created',
        taskId: req.params.taskId,
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.status(201).json({ attachment });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/attachments/:id/download', requireAuth, (req, res, next) => {
    try {
      const { attachment, diskPath } = db.getAttachmentForDownload(
        req.user!,
        req.params.id
      );
      if (diskPath) {
        res.download(diskPath, attachment.fileName);
      } else {
        // Seeded demonstration attachment content
        const content = `PrimeMeet Attachment Record\nFile: ${attachment.fileName}\nTask ID: ${attachment.taskId}\nSize: ${attachment.fileSize} bytes\nCreated: ${attachment.createdAt}\n`;
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${attachment.fileName}"`
        );
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(content);
      }
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/attachments/:id', requireAuth, (req, res, next) => {
    try {
      db.deleteAttachment(req.user!, req.params.id);
      broadcastEvent({
        type: 'data:changed',
        entity: 'attachment',
        action: 'deleted',
        actorId: req.user!.id,
        actorName: req.user!.name,
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // --- Notifications & Activity Logs ---
  app.get('/api/notifications', requireAuth, (req, res, next) => {
    try {
      const notifications = db.listNotifications(req.user!);
      res.json({ notifications });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/notifications/:id', requireAuth, (req, res, next) => {
    try {
      const notification = db.markNotificationRead(
        req.user!,
        req.params.id,
        Boolean(req.body.isRead ?? true)
      );
      res.json({ notification });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/notifications/read-all', requireAuth, (req, res, next) => {
    try {
      db.markAllNotificationsRead(req.user!);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/activity', requireAuth, (req, res, next) => {
    try {
      const projectId =
        typeof req.query.projectId === 'string'
          ? req.query.projectId
          : undefined;
      const taskId =
        typeof req.query.taskId === 'string' ? req.query.taskId : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 40;
      const activityLogs = db.listActivityLogs(req.user!, {
        projectId,
        taskId,
        limit,
      });
      res.json({ activityLogs });
    } catch (err) {
      next(err);
    }
  });

  // --- Central Error Handler ---
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof PermissionDeniedError) {
      res.status(403).json({
        code: err.code,
        rule: err.rule,
        message: err.message,
      });
      return;
    }
    const message =
      err instanceof Error
        ? err.message
        : 'An unexpected server error occurred.';
    res.status(400).json({
      code: 'BAD_REQUEST',
      message,
    });
  });

  // Mount Vite in development or serve static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PrimeMeet server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
