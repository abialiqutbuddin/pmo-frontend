import { api } from '../api';

export type Conversation = {
  id: string;
  kind: 'EVENT' | 'DEPARTMENT' | 'ISSUE' | 'GROUP' | 'DIRECT';
  title?: string | null;
  departmentId?: string | null;
  issueId?: string | null;
  updatedAt: string;
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
    issueId?: string;
    participantUserIds?: string[];
  }) => api.post<Conversation>(`/chat/conversations`, body),

  sendMessage: (payload: SendMessagePayload) => api.post(`/chat/messages`, payload),
  react: (payload: { messageId: string; emoji: string }) => api.post(`/chat/react`, payload),
  markRead: (payload: { conversationId: string }) => api.patch(`/chat/read`, payload),
  listMessages: (conversationId: string, opts?: { limit?: number; before?: string }) =>
    api.get<{ items: any[]; nextCursor?: string | null }>(
      `/chat/conversations/${conversationId}/messages${
        opts?.limit || opts?.before ? `?${new URLSearchParams({
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
};
