
// frontend/src/components/tasks/CommentsTab.tsx
import React, { useEffect, useState, useRef } from 'react';
import { taskCommentsService, type TaskComment } from '../../services/taskComments';
import { useAuthStore } from '../../store/authStore';
import { Send, Trash2, Loader2, User, Paperclip, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { attachmentsService } from '../../services/attachments';
import { eventsService } from '../../services/events';
import { MentionList } from './MentionList';
import { HighlightMentions } from '../ui/HighlightMentions';

interface CommentsTabProps {
    eventId: string;
    taskId: string;
    canComment: boolean;
}

export const CommentsTab: React.FC<CommentsTabProps> = ({ eventId, taskId, canComment }) => {
    const [comments, setComments] = useState<TaskComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [files, setFiles] = useState<{ file: File }[]>([]);

    // Mentions state
    const [allUsers, setAllUsers] = useState<{ id: string; fullName?: string; email?: string; profileImage?: string }[]>([]);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [trackedMentions, setTrackedMentions] = useState<Set<string>>(new Set()); // Set of user IDs

    const currentUser = useAuthStore((s) => s.currentUser);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial load
    useEffect(() => {
        loadComments();
        loadUsers();
    }, [eventId, taskId]);

    const loadComments = async () => {
        try {
            const data = await taskCommentsService.list(eventId, taskId);
            setComments(data || []);
            // Scroll to bottom on initial load
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch (e) {
            console.error('Failed to load comments', e);
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        try {
            const members = await eventsService.members.list(eventId);
            // Map to simpler user object
            const users = members.map(m => ({
                id: m.userId,
                fullName: m.user?.fullName || 'User',
                email: m.user?.email,
                profileImage: m.user?.profileImage
            })).filter(u => u.id !== currentUser?.id); // Exclude self? Or allow tagging self? Usually exclude self but let's allow for test.
            setAllUsers(users);
        } catch (e) {
            console.error('Failed to load users for mentions', e);
        }
    };

    const handleSubmit = async () => {
        if ((!newComment.trim() && files.length === 0) || submitting) return;
        setSubmitting(true);
        try {
            let finalBody = newComment;

            // Prepare attachments
            let uploadedNames: string[] = [];
            if (files.length > 0) {
                uploadedNames = await Promise.all(files.map(async (f) => {
                    // Upload with skipAudit=true to prevent spamming activity log
                    // We will log everything in the comment log
                    await attachmentsService.upload(eventId, 'Task', taskId, f.file, true);
                    return f.file.name;
                }));

                // Append separate "Attached: ..." lines to content
                if (finalBody.trim()) finalBody += '\n\n';
                finalBody += uploadedNames.map(name => 'Attached: ' + name).join('\n');
            }

            // Verify mentions are still in text
            // Simple heuristic: if we tracked a user ID, check if their name (prefixed with @) is present
            // This is loose matching (doesn't handle duplicate names well) but standard for simple implementations without Rich Text Editor
            const actualMentionedIds = Array.from(trackedMentions).filter(uid => {
                const user = allUsers.find(u => u.id === uid);
                return user && finalBody.includes('@' + (user.fullName || user.email));
            });

            await taskCommentsService.create(eventId, taskId, finalBody, actualMentionedIds);

            // Reset
            setNewComment('');
            setFiles([]);
            setTrackedMentions(new Set());
            loadComments();
            // Scroll to bottom
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch (e: any) {
            alert(e.message || 'Failed to add comment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!confirm('Delete this comment?')) return;
        setDeleting(commentId);
        try {
            await taskCommentsService.delete(eventId, taskId, commentId);
            setComments((prev) => prev.filter((c) => c.id !== commentId));
        } catch (e: any) {
            alert(e.message || 'Failed to delete comment');
        } finally {
            setDeleting(null);
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setNewComment(val);

        // Detect @ mention
        // Get cursor position
        const cursor = e.target.selectionStart;
        // Find the word immediately before cursor
        // Look backwards from cursor until space or newline
        const textBefore = val.substring(0, cursor);
        const lastAt = textBefore.lastIndexOf('@');

        if (lastAt !== -1) {
            // Check if there's a space before @ (or it's start of line)
            // AND no space between @ and cursor (searching)
            const prefix = textBefore.substring(lastAt);
            // prefix is "@abc..."
            const isStart = lastAt === 0 || /\s/.test(textBefore[lastAt - 1]);
            const hasSpaceInside = /\s/.test(prefix);

            if (isStart && !hasSpaceInside) {
                // We are typing a mention!
                const query = prefix.substring(1); // remove @
                setMentionQuery(query);
                setMentionIndex(0);
                return;
            }
        }

        setMentionQuery(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (mentionQuery !== null) {
            const filtered = allUsers.filter(u =>
                (u.fullName || '').toLowerCase().includes(mentionQuery.toLowerCase()) ||
                (u.email || '').toLowerCase().includes(mentionQuery.toLowerCase())
            );

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(i => (i + 1) % filtered.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(i => (i - 1 + filtered.length) % filtered.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (filtered[mentionIndex]) {
                    selectUser(filtered[mentionIndex]);
                } else {
                    // Close menu if no match
                    setMentionQuery(null);
                }
                return;
            }
            if (e.key === 'Escape') {
                setMentionQuery(null);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const selectUser = (user: typeof allUsers[0]) => {
        if (!inputRef.current) return;
        const textarea = inputRef.current;
        const cursor = textarea.selectionStart;
        const text = newComment;

        // Find the @ before cursor
        const textBefore = text.substring(0, cursor);
        const lastAt = textBefore.lastIndexOf('@');

        const newText = text.substring(0, lastAt) +
            '@' + (user.fullName || user.email) + ' ' +
            text.substring(cursor);

        setNewComment(newText);
        setTrackedMentions(prev => new Set(prev).add(user.id));
        setMentionQuery(null);

        // Restore focus and cursor? React re-render will handle value update, but cursor might jump
        // We need to set cursor position after render. 
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                const newPos = lastAt + 1 + (user.fullName || user.email || '').length + 1;
                inputRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    const onSelectFiles = (list: FileList | null) => {
        if (!list) return;
        const add = Array.from(list).map(f => ({ file: f }));
        setFiles(prev => [...prev, ...add]);
    };

    const removeFile = (idx: number) => {
        setFiles(prev => prev.filter((_, i) => i !== idx));
    };

    // Derived filtered users
    const filteredUsers = mentionQuery !== null
        ? allUsers.filter(u =>
            (u.fullName || '').toLowerCase().includes(mentionQuery.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(mentionQuery.toLowerCase())
        ).slice(0, 10)
        : [];

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-blue-600" size={24} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0 relative">
            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-5 p-4 mb-0 min-h-0">
                {comments.length === 0 ? (
                    <div className="text-center text-gray-400 py-8 text-sm">
                        No comments yet. Be the first to comment!
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3 group">
                            <div className="shrink-0">
                                {comment.user.profileImage ? (
                                    <img
                                        src={comment.user.profileImage}
                                        alt={comment.user.fullName || 'User'}
                                        className="w-7 h-7 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                                        <User size={14} className="text-blue-600" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2">
                                    <span className="font-medium text-gray-900 text-sm">
                                        {comment.user.fullName || comment.user.email}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">
                                    <HighlightMentions content={comment.content} />
                                </p>

                                {/* Attachments */}
                                {comment.attachments.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {comment.attachments.map((att) => (
                                            <a
                                                key={att.id}
                                                href={att.filePath}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded"
                                            >
                                                📎 {att.fileName}
                                            </a>
                                        ))}
                                    </div>
                                )}
                                {/* Mentions */}
                                {comment.mentions.length > 0 && (
                                    <div className="mt-1 text-xs text-gray-500">
                                        Mentioned: {comment.mentions.map((m) => m.mentionedUser.fullName || m.mentionedUser.email).join(', ')}
                                    </div>
                                )}
                            </div>

                            {/* Delete Button (only for own comments) */}
                            {comment.userId === currentUser?.id && (
                                <button
                                    onClick={() => handleDelete(comment.id)}
                                    disabled={deleting === comment.id}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-red-500 self-start"
                                    title="Delete comment"
                                >
                                    {deleting === comment.id ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                        <Trash2 size={12} />
                                    )}
                                </button>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Comment Input */}
            {canComment && (
                <div className="border-t border-gray-200 p-4 bg-white relative">
                    {/* Mention Menu */}
                    {mentionQuery !== null && (
                        <MentionList
                            users={filteredUsers}
                            selectedIndex={mentionIndex}
                            onSelect={selectUser}
                        />
                    )}

                    {/* File Previews */}
                    {files.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {files.map((f, i) => (
                                <div key={i} className="relative group bg-gray-50 border border-gray-200 rounded-lg p-2 pr-8 flex items-center gap-2">
                                    <div className="text-xs max-w-[150px] truncate">{f.file.name}</div>
                                    <button
                                        onClick={() => removeFile(i)}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 rounded"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="relative">
                        <textarea
                            ref={inputRef}
                            value={newComment}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            onClick={() => setMentionQuery(null)} // Close menu if clicking away (simplification)
                            placeholder="Write a comment..."
                            className="w-full resize-none border border-gray-300 rounded-lg pl-3 pr-24 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[48px] max-h-[120px]"
                            rows={1}
                            style={{ height: 'auto', minHeight: '48px' }}
                        />
                        <div className="absolute right-2 bottom-2 flex items-center gap-1">
                            <label className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer transition-colors" title="Attach files">
                                <Paperclip size={18} />
                                <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => onSelectFiles(e.target.files)}
                                />
                            </label>
                            <button
                                onClick={handleSubmit}
                                disabled={(!newComment.trim() && files.length === 0) || submitting}
                                className="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {submitting ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <Send size={16} />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
