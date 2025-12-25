import { api } from '../api';

export type Conversation = {
  id: string;
  kind: 'EVENT' | 'DEPARTMENT' | 'ISSUE' | 'GROUP' | 'DIRECT';
  title?: string | null;
  departmentId?: string | null;
  isActive?: boolean;
  isSystemGroup?: boolean;
  updatedAt: string;
  lastMessage?: { id: string; authorId: string; body?: string | null; createdAt: string; author?: { id: string; fullName?: string; email?: string } } | null;
  participants?: { userId: string; lastReadAt?: string | null; user?: { id: string; fullName?: string; email?: string } }[];
  unreadCount?: number;
  lastMessageAllRead?: boolean;
};

export type SendMessagePayload = { conversationId: string; body?: string; parentId?: string };

export const chatService = {
  listConversations: (eventId: string) =>
    api.get<Conversation[]>(`/chat/events/${eventId}/conversations`),

  createConversation: (body: {
    eventId: string;
    kind: Conversation['kind'];
    title?: string;
    departmentId?: string;
    participantUserIds?: string[];
  }) => api.post<Conversation>(`/chat/conversations`, body),

  sendMessage: (payload: SendMessagePayload) => api.post(`/chat/messages`, payload),
  react: (payload: { messageId: string; emoji: string }) => api.post(`/chat/react`, payload),
  markRead: (payload: { conversationId: string }) => api.patch(`/chat/read`, payload),
  listMessages: (conversationId: string, opts?: { limit?: number; before?: string }) =>
    api.get<{ items: any[]; nextCursor?: string | null }>(
      `/chat/conversations/${conversationId}/messages${opts?.limit || opts?.before ? `?${new URLSearchParams({
        ...(opts?.limit ? { limit: String(opts.limit) } : {}),
        ...(opts?.before ? { before: opts.before } : {}),
      }).toString()}` : ''
      }`,
    ),
  createTaskFromMessage: (payload: {
    eventId: string;
    conversationId: string;
    messageId: string;
    departmentId?: string;
    title?: string;
  }) => api.post(`/chat/create-task-from-message`, payload),
  startDirect: (eventId: string, userId: string) => api.post(`/chat/direct`, { eventId, userId }),
  addParticipants: (conversationId: string, userIds: string[]) => api.post(`/chat/conversations/${conversationId}/participants`, { conversationId, userIds }),
  listParticipants: (conversationId: string) => api.get(`/chat/conversations/${conversationId}/participants`),
  removeParticipant: (conversationId: string, userId: string) => api.delete(`/chat/conversations/${conversationId}/participants/${userId}`),
  updateParticipant: (conversationId: string, userId: string, body: { role?: 'MEMBER' | 'OWNER' }) => api.patch(`/chat/conversations/${conversationId}/participants/${userId}`, body),
  readers: (messageId: string) => api.get<{ userId: string; fullName?: string; email?: string; itsId?: string; profileImage?: string; readAt: string }[]>(`/chat/messages/${messageId}/readers`),
  getPermissions: (eventId: string) => api.get<ChatPermissions>(`/chat/events/${eventId}/permissions`),
};

export type ChatPermissions = {
  canViewAllSystemGroups: boolean;
  canSendToSystemGroups: boolean;
  canDeleteMessages: boolean;
};
