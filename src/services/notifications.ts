// frontend/src/services/notifications.ts
import { api } from '../api';

export interface Notification {
    id: string;
    userId: string;
    eventId?: string;
    kind: string;
    title: string;
    body?: string;
    link?: string;
    readAt?: string;
    createdAt: string;
}

export const notificationsService = {
    list: (eventId?: string) =>
        api.get<Notification[]>(`/notifications${eventId ? `?eventId=${eventId}` : ''}`),

    unreadCount: (eventId?: string) =>
        api.get<{ count: number }>(`/notifications/unread-count${eventId ? `?eventId=${eventId}` : ''}`),

    markAsRead: (id: string) =>
        api.patch<void>(`/notifications/${id}/read`),

    markAllAsRead: (eventId?: string) =>
        api.patch<void>(`/notifications/read-all${eventId ? `?eventId=${eventId}` : ''}`),
};
