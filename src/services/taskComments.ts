// frontend/src/services/taskComments.ts
import { api } from '../api';

export interface CommentUser {
    id: string;
    fullName?: string;
    email?: string;
    profileImage?: string;
}

export interface CommentMention {
    id: string;
    mentionedUser: CommentUser;
}

export interface CommentAttachment {
    id: string;
    fileName: string;
    filePath: string;
    mimeType?: string;
    size?: number;
}

export interface TaskComment {
    id: string;
    taskId: string;
    userId: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    user: CommentUser;
    attachments: CommentAttachment[];
    mentions: CommentMention[];
}

export const taskCommentsService = {
    list: (eventId: string, taskId: string) =>
        api.get<TaskComment[]>(`/events/${eventId}/tasks/${taskId}/comments`),

    create: (eventId: string, taskId: string, content: string, mentionedUserIds?: string[]) =>
        api.post<TaskComment>(`/events/${eventId}/tasks/${taskId}/comments`, {
            content,
            mentionedUserIds,
        }),

    delete: (eventId: string, taskId: string, commentId: string) =>
        api.delete<{ ok: boolean }>(`/events/${eventId}/tasks/${taskId}/comments/${commentId}`),
};
