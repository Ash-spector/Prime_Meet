import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  Download,
  Edit3,
  FileText,
  MessageSquare,
  Paperclip,
  Send,
  Tag,
  Trash2,
  Upload,
  User as UserIcon,
  X,
} from 'lucide-react';
import { api, ApiError } from '../client/api.ts';
import {
  AssignmentMode,
  EnrichedActivityLog,
  EnrichedAttachment,
  EnrichedComment,
  EnrichedTask,
  Priority,
  TaskStatus,
  User,
} from '../shared/types.ts';

interface TaskDetailDrawerProps {
  task: EnrichedTask | null;
  currentUser: User;
  users: User[];
  onClose: () => void;
  onTaskUpdated: () => Promise<void>;
  onTaskDeleted: () => Promise<void>;
  onNotify: (toast: {
    type: 'success' | 'error';
    title: string;
    message: string;
    rule?: string;
  }) => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_SET = new Set([
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

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  task,
  currentUser,
  users,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
  onNotify,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'comments' | 'attachments' | 'activity'
  >('comments');

  // Task Editable Fields
  const [editingTaskInfo, setEditingTaskInfo] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [labelsInput, setLabelsInput] = useState('');

  // Comments
  const [comments, setComments] = useState<EnrichedComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');

  // Attachments
  const [attachments, setAttachments] = useState<EnrichedAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Activity
  const [taskActivity, setTaskActivity] = useState<EnrichedActivityLog[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const loadTaskDetails = useCallback(async (taskId: string) => {
    try {
      const [cmtRes, attRes, actRes] = await Promise.all([
        api.listComments(taskId),
        api.listAttachments(taskId),
        api.listActivity(),
      ]);
      setComments(cmtRes.comments);
      setAttachments(attRes.attachments);
      setTaskActivity(actRes.activityLogs.filter((a) => a.taskId === taskId));
    } catch {
      // Handled gracefully
    }
  }, []);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setDueDate(task.dueDate.slice(0, 10));
      setLabelsInput(task.labels.join(', '));
      setEditingTaskInfo(false);
      setUploadError(null);
      setConfirmDeleteOpen(false);
      loadTaskDetails(task.id);
    }
  }, [task, loadTaskDetails]);

  if (!task) return null;

  const handleFieldUpdate = async (
    updates: Partial<{
      title: string;
      description: string;
      status: TaskStatus;
      priority: Priority;
      assigneeId: string | null;
      assignmentMode: AssignmentMode;
      teamAssigneeIds: string[];
      dueDate: string;
      labels: string[];
    }>
  ) => {
    try {
      await api.updateTask(task.id, updates);
      await onTaskUpdated();
      await loadTaskDetails(task.id);
      onNotify({
        type: 'success',
        title: 'Task Updated',
        message: `Saved changes to "${task.title}".`,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        onNotify({
          type: 'error',
          title: 'You don\'t have permission',
          message: err.message,
          rule: err.rule,
        });
      } else {
        onNotify({
          type: 'error',
          title: 'Update Failed',
          message: err instanceof Error ? err.message : 'Failed to update task.',
        });
      }
    }
  };

  const handleSaveTaskInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLabels = labelsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await handleFieldUpdate({
      title,
      description,
      dueDate: new Date(dueDate).toISOString(),
      labels: parsedLabels,
    });
    setEditingTaskInfo(false);
  };

  const handleDeleteTask = async () => {
    try {
      await api.deleteTask(task.id);
      setConfirmDeleteOpen(false);
      onNotify({
        type: 'success',
        title: 'Task Deleted',
        message: `Task "${task.title}" was deleted.`,
      });
      await onTaskDeleted();
      onClose();
    } catch (err) {
      setConfirmDeleteOpen(false);
      if (err instanceof ApiError) {
        onNotify({
          type: 'error',
          title: 'You don\'t have permission',
          message: err.message,
          rule: err.rule,
        });
      }
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await api.addComment(task.id, newComment);
      setNewComment('');
      await loadTaskDetails(task.id);
      await onTaskUpdated();
      onNotify({
        type: 'success',
        title: 'Comment Posted',
        message: 'Your comment was added.',
      });
    } catch (err) {
      if (err instanceof ApiError) {
        onNotify({
          type: 'error',
          title: 'You don\'t have permission',
          message: err.message,
          rule: err.rule,
        });
      }
    }
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editingCommentContent.trim()) return;
    try {
      await api.updateComment(commentId, editingCommentContent);
      setEditingCommentId(null);
      setEditingCommentContent('');
      await loadTaskDetails(task.id);
      onNotify({
        type: 'success',
        title: 'Comment Edited',
        message: 'Comment updated successfully.',
      });
    } catch (err) {
      if (err instanceof ApiError) {
        onNotify({
          type: 'error',
          title: 'You don\'t have permission',
          message: err.message,
          rule: err.rule,
        });
      }
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.deleteComment(commentId);
      await loadTaskDetails(task.id);
      await onTaskUpdated();
      onNotify({
        type: 'success',
        title: 'Comment Deleted',
        message: 'Comment removed.',
      });
    } catch (err) {
      if (err instanceof ApiError) {
        onNotify({
          type: 'error',
          title: 'You don\'t have permission',
          message: err.message,
          rule: err.rule,
        });
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);

    if (!ALLOWED_MIME_SET.has(file.type)) {
      const msg = `Invalid file type (${file.type || file.name}). Only images, PDFs, and common documents (DOC, DOCX, XLS, XLSX, TXT, CSV) are allowed.`;
      setUploadError(msg);
      onNotify({
        type: 'error',
        title: 'Invalid File Type',
        message: msg,
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const msg = `File "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 10 MB size limit.`;
      setUploadError(msg);
      onNotify({
        type: 'error',
        title: 'File Too Large (Max 10 MB)',
        message: msg,
      });
      return;
    }

    setUploading(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsDataURL(file);
      });

      await api.uploadAttachment(task.id, {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        base64Data,
      });

      await loadTaskDetails(task.id);
      await onTaskUpdated();
      onNotify({
        type: 'success',
        title: 'Attachment Uploaded',
        message: `"${file.name}" attached to task.`,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to upload attachment.';
      setUploadError(msg);
      onNotify({
        type: 'error',
        title: 'Upload Rejected',
        message: msg,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await api.deleteAttachment(attachmentId);
      await loadTaskDetails(task.id);
      await onTaskUpdated();
      onNotify({
        type: 'success',
        title: 'Attachment Deleted',
        message: 'File removed from task.',
      });
    } catch (err) {
      if (err instanceof ApiError) {
        onNotify({
          type: 'error',
          title: 'You don\'t have permission',
          message: err.message,
          rule: err.rule,
        });
      }
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-hidden">
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-900">
          <div className="min-w-0">
            <div className="text-xs font-medium text-[#6366F1] dark:text-indigo-400 flex flex-wrap items-center gap-2">
              <span>{task.projectName || 'Project Task'}</span>
              <span>·</span>
              <span className="font-mono">{task.id}</span>
              <span
                className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                  task.assignmentMode === AssignmentMode.TEAM
                    ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20'
                    : 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20'
                }`}
              >
                {task.assignmentMode === AssignmentMode.TEAM
                  ? `TEAM ASSIGNED (${task.teamAssignees?.length || 1})`
                  : 'INDIVIDUAL ASSIGNED'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate mt-0.5">
              {task.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setEditingTaskInfo((v) => !v)}
              className="px-3 py-1.5 rounded-xl btn-3d-secondary text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{editingTaskInfo ? 'Cancel Edit' : 'Edit'}</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="p-2 rounded-xl btn-3d-secondary text-[#EF4444] hover:bg-red-50 cursor-pointer"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl btn-3d-secondary text-slate-500 hover:text-slate-800 cursor-pointer"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Delete Confirmation Inline Banner */}
        {confirmDeleteOpen && (
          <div className="p-4 bg-red-50 dark:bg-red-950/50 border-b border-red-200 dark:border-red-900 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-xs text-red-800 dark:text-red-200">
              <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
              <span>
                Permanently delete this task and its comments? (Enforced by backend RLS)
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTask}
                className="px-3 py-1 rounded-lg bg-[#EF4444] text-white text-xs font-semibold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        )}

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Edit Form or Details Display */}
          {editingTaskInfo ? (
            <form
              onSubmit={handleSaveTaskInfo}
              className="card-3d rounded-2xl p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Labels (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={labelsInput}
                    onChange={(e) => setLabelsInput(e.target.value)}
                    placeholder="Frontend, Design System"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl btn-3d-primary text-xs font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {task.description || 'No description provided.'}
              </p>

              {/* Interactive Controls Grid: Status, Priority, Assignee, Due Date */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="card-3d rounded-xl p-3">
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Status
                  </label>
                  <select
                    value={task.status}
                    onChange={(e) =>
                      handleFieldUpdate({ status: e.target.value as TaskStatus })
                    }
                    className="w-full text-xs font-semibold bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    <option value={TaskStatus.TODO}>TODO</option>
                    <option value={TaskStatus.IN_PROGRESS}>IN_PROGRESS</option>
                    <option value={TaskStatus.IN_REVIEW}>IN_REVIEW</option>
                    <option value={TaskStatus.DONE}>DONE</option>
                  </select>
                </div>

                <div className="card-3d rounded-xl p-3">
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Priority
                  </label>
                  <select
                    value={task.priority}
                    onChange={(e) =>
                      handleFieldUpdate({ priority: e.target.value as Priority })
                    }
                    className="w-full text-xs font-semibold bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    <option value={Priority.LOW}>LOW</option>
                    <option value={Priority.MEDIUM}>MEDIUM</option>
                    <option value={Priority.HIGH}>HIGH</option>
                    <option value={Priority.URGENT}>URGENT</option>
                  </select>
                </div>

                <div className="card-3d rounded-xl p-3">
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Assignee
                  </label>
                  <select
                    value={task.assigneeId || ''}
                    onChange={(e) =>
                      handleFieldUpdate({
                        assigneeId: e.target.value ? e.target.value : null,
                      })
                    }
                    className="w-full text-xs font-semibold bg-transparent text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.uniqueCode ? `[${u.uniqueCode}] ` : ''}
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="card-3d rounded-xl p-3">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Due Date
                  </div>
                  <div className="text-xs font-mono font-semibold text-slate-900 dark:text-white tabular-nums flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#6366F1]" />
                    <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Assignment Mode & Team Members Section */}
              <div className="card-3d rounded-xl p-3.5 space-y-2.5 bg-slate-50/60 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span>Assignment Mode:</span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        task.assignmentMode === AssignmentMode.TEAM
                          ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                          : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                      }`}
                    >
                      {task.assignmentMode === AssignmentMode.TEAM
                        ? 'TEAM WORK'
                        : 'INDIVIDUAL WORK'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleFieldUpdate({
                          assignmentMode: AssignmentMode.INDIVIDUAL,
                          teamAssigneeIds: task.assigneeId ? [task.assigneeId] : [],
                        })
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                        task.assignmentMode !== AssignmentMode.TEAM
                          ? 'bg-[#6366F1] text-white'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Individual
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleFieldUpdate({
                          assignmentMode: AssignmentMode.TEAM,
                        })
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                        task.assignmentMode === AssignmentMode.TEAM
                          ? 'bg-[#6366F1] text-white'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      Team
                    </button>
                  </div>
                </div>

                {task.assignmentMode === AssignmentMode.TEAM &&
                  task.teamAssignees &&
                  task.teamAssignees.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-500">Team Members:</span>
                      {task.teamAssignees.map((tm) => (
                        <span
                          key={tm.id}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200"
                        >
                          <img
                            src={tm.avatar}
                            alt={tm.name}
                            referrerPolicy="no-referrer"
                            className="w-4 h-4 rounded-full"
                          />
                          <span>{tm.name}</span>
                          {tm.uniqueCode && (
                            <span className="font-mono text-[10px] font-bold text-[#6366F1]">
                              [{tm.uniqueCode}]
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
              </div>

              {/* Metadata Footer: Labels & Created By */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-[#6366F1]" />
                  <span>
                    {task.labels.length > 0 ? task.labels.join(' · ') : 'No labels'}
                  </span>
                </div>
                <div className="flex items-center gap-2 tabular-nums">
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>
                    Assigned by {task.createdBy?.name || task.createdById}
                    {task.createdBy?.uniqueCode ? ` [${task.createdBy.uniqueCode}]` : ''} on{' '}
                    {new Date(task.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sub-navigation Tabs: Comments, Attachments, Activity */}
          <div className="border-b border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveSubTab('comments')}
              className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'comments'
                  ? 'border-[#6366F1] text-[#6366F1] dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Comments ({comments.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('attachments')}
              className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'attachments'
                  ? 'border-[#6366F1] text-[#6366F1] dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>Attachments ({attachments.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('activity')}
              className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'activity'
                  ? 'border-[#6366F1] text-[#6366F1] dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Activity ({taskActivity.length})</span>
            </button>
          </div>

          {/* SUB-TAB 1: COMMENTS */}
          {activeSubTab === 'comments' && (
            <div className="space-y-4">
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment... (Real-time synced)"
                  className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl btn-3d-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Post</span>
                </button>
              </form>

              <div className="space-y-3">
                {comments.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No comments yet. Start the conversation above.
                  </div>
                ) : (
                  comments.map((c) => {
                    const isOwn = c.userId === currentUser.id;
                    return (
                      <div key={c.id} className="card-3d rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs">
                            {c.user?.avatar && (
                              <img
                                src={c.user.avatar}
                                alt={c.user.name}
                                referrerPolicy="no-referrer"
                                className="w-6 h-6 rounded-full bg-slate-100"
                              />
                            )}
                            <span className="font-bold text-slate-900 dark:text-white">
                              {c.user?.name || c.userId}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                              {new Date(c.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCommentId(c.id);
                                setEditingCommentContent(c.content);
                              }}
                              title={
                                isOwn
                                  ? 'Edit your comment'
                                  : 'Test editing another user comment (Enforced by RLS)'
                              }
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(c.id)}
                              title={
                                isOwn
                                  ? 'Delete your comment'
                                  : 'Test deleting another user comment (Enforced by RLS)'
                              }
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {editingCommentId === c.id ? (
                          <div className="space-y-2 pt-1">
                            <textarea
                              rows={2}
                              value={editingCommentContent}
                              onChange={(e) => setEditingCommentContent(e.target.value)}
                              className="w-full p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateComment(c.id)}
                                className="px-3 py-1 rounded-lg btn-3d-primary text-xs font-medium cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCommentId(null)}
                                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                            {c.content}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 2: ATTACHMENTS */}
          {activeSubTab === 'attachments' && (
            <div className="space-y-4">
              <div className="card-3d rounded-2xl p-5 border-dashed border-2 border-slate-300 dark:border-slate-700 text-center space-y-2">
                <Upload className="w-6 h-6 text-[#6366F1] mx-auto" />
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  Upload Task Attachment (Max 10 MB)
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Permitted formats: Images (PNG, JPG, WEBP, GIF, SVG), PDF, DOC/DOCX, XLS/XLSX,
                  TXT, CSV
                </p>
                <div className="pt-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl btn-3d-primary text-xs font-semibold cursor-pointer">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{uploading ? 'Uploading...' : 'Choose File'}</span>
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploading}
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>

              {uploadError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 font-medium"
                >
                  {uploadError}
                </div>
              )}

              <div className="space-y-2.5">
                {attachments.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No files attached to this task.
                  </div>
                ) : (
                  attachments.map((att) => (
                    <div
                      key={att.id}
                      className="card-3d rounded-xl p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-[#6366F1] flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {att.fileName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            {formatBytes(att.fileSize)} · Uploaded by{' '}
                            {att.uploadedBy?.name || att.uploadedById}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={api.getAttachmentDownloadUrl(att.id)}
                          download={att.fileName}
                          className="p-2 rounded-lg btn-3d-secondary text-slate-700 dark:text-slate-200"
                          title="Download file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-2 rounded-lg btn-3d-secondary text-[#EF4444]"
                          title="Delete file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB 3: ACTIVITY */}
          {activeSubTab === 'activity' && (
            <div className="space-y-3">
              {taskActivity.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No activity recorded for this task yet.
                </div>
              ) : (
                taskActivity.map((log) => (
                  <div
                    key={log.id}
                    className="card-3d rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs"
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
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
