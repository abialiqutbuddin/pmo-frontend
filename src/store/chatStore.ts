import { create } from 'zustand';
import { connectChatSocket, getChatSocket } from '../lib/chatSocket';
import { chatService, type Conversation } from '../services/chat';
import { useAuthStore } from './authStore';
import { useContextStore } from './contextStore';

export type ChatMessageVM = {
  id: string;
  conversationId: string;
  authorId: string;
  body?: string | null;
  parentId?: string | null;
  createdAt: string;
  attachments?: { id: string; originalName: string; mimeType: string; objectKey?: string; size?: number }[];
};

interface ChatState {
  eventId: string | null;
  conversations: Conversation[];
  activeId: string | null;
  messages: Record<string, ChatMessageVM[]>; // by conversationId
  connecting: boolean;
  error?: string | null;
  dmNames: Record<string, string>; // conversationId -> other participant's name for DIRECT
  lastMsg: Record<string, { content?: string; createdAt?: string }>; // conversationId -> preview
  participants: Record<string, Record<string, { id: string; fullName?: string; email?: string; itsId?: string; profileImage?: string; designation?: string }>>;
  cursors: Record<string, string | null>; // conversationId -> earliest loaded createdAt
  hasMore: Record<string, boolean>; // conversationId -> whether older messages may exist
  scrollPos: Record<string, number>; // conversationId -> scrollTop

  connect: () => Promise<void>;
  loadConversations: () => Promise<void>;
  join: (conversationId: string) => void;
  setActive: (id: string) => void;
  send: (conversationId: string, body: string) => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  loadParticipants: (conversationId: string) => Promise<void>;
  loadOlder: (conversationId: string) => Promise<void>;
  startDirect: (eventId: string, userId: string) => Promise<string | null>;
  createChannel: (body: { eventId: string; title: string; participantUserIds: string[] }) => Promise<string | null>;
  sendAttachment: (conversationId: string, file: File) => Promise<void>;
  sendAttachmentsBatch: (conversationId: string, files: File[]) => Promise<void>;
  reset: () => void;
  setScrollPos: (conversationId: string, pos: number) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  eventId: null,
  conversations: [],
  activeId: null,
  messages: {},
  connecting: false,
  error: null,
  dmNames: {},
  lastMsg: {},
  participants: {},
  cursors: {},
  hasMore: {},
  scrollPos: {},

  connect: async () => {
    const token = useAuthStore.getState().accessToken;
    const eventId = useContextStore.getState().currentEventId;
    if (!token || !eventId) return;
    if (getChatSocket()?.connected) return;
    set({ connecting: true, error: null });
    const s = connectChatSocket(token, eventId);
    s.on('connect_error', (err) => set({ error: err?.message || 'Socket error' }));
    s.on('message.new', (msg: any) => {
      set((st) => {
        const arr = st.messages[msg.conversationId] ? [...st.messages[msg.conversationId]] : [];
        arr.push({
          id: msg.id,
          conversationId: msg.conversationId,
          authorId: msg.authorId,
          body: msg.body,
          parentId: msg.parentId,
          createdAt: msg.createdAt,
        });
        const lastMsg = { ...st.lastMsg, [msg.conversationId]: { content: msg.body, createdAt: msg.createdAt } };
        return { messages: { ...st.messages, [msg.conversationId]: arr }, lastMsg };
      });
    });
    s.on('message.attachment', (p: { conversationId: string; messageId: string; attachments: any[] }) => {
      set((st) => {
        const arr = st.messages[p.conversationId] ? [...st.messages[p.conversationId]] : [];
        const idx = arr.findIndex((m) => m.id === p.messageId);
        if (idx >= 0) {
          const prev = arr[idx];
          arr[idx] = { ...prev, attachments: p.attachments };
        }
        return { messages: { ...st.messages, [p.conversationId]: arr } };
      });
    });
    set({ connecting: false });
  },

  loadConversations: async () => {
    const eventId = useContextStore.getState().currentEventId;
    if (!eventId) return;
    // Clear store only when switching to a different event
    const prevEventId = get().eventId;
    if (prevEventId && prevEventId !== eventId) {
      set({
        conversations: [],
        messages: {},
        dmNames: {},
        lastMsg: {},
        participants: {},
        cursors: {},
        hasMore: {},
      });
    }
    if (prevEventId !== eventId) set({ eventId });
    const list = await chatService.listConversations(eventId).catch(() => []);
    set({ conversations: list });
    // auto-join rooms
    const s = getChatSocket();
    list.forEach((c) => s?.emit('conversation.join', { conversationId: c.id }));

    // compute DM display names for DIRECT conversations and hydrate participants map for sidebar avatars
    (async () => {
      const results = await Promise.all(
        list
          .filter((c) => c.kind === 'DIRECT')
          .map(async (c) => {
            try {
              const rows: any[] = await chatService.listParticipants(c.id);
              const me = useAuthStore.getState().currentUser?.id;
              const other = rows.find((r: any) => r.userId !== me)?.user;
              const name = other?.fullName || other?.email || 'Direct';
              // build participants map for this conversation
              const map: Record<string, { id: string; fullName?: string; email?: string; itsId?: string; profileImage?: string; designation?: string }> = {};
              rows.forEach((r: any) => {
                map[r.userId] = {
                  id: r.user?.id || r.userId,
                  fullName: r.user?.fullName,
                  email: r.user?.email,
                  itsId: r.user?.itsId,
                  profileImage: r.user?.profileImage,
                  designation: r.user?.designation,
                };
              });
              return { id: c.id, name, map };
            } catch {
              return { id: c.id, name: 'Direct', map: {} as Record<string, any> };
            }
          }),
      );
      set((st) => ({
        dmNames: { ...st.dmNames, ...Object.fromEntries(results.map((r) => [r.id, r.name])) },
        participants: { ...st.participants, ...Object.fromEntries(results.map((r) => [r.id, r.map])) },
      }));
    })();

    // load last message previews
    (async () => {
      const previews = await Promise.all(
        list.map(async (c) => {
          try {
            const res = await chatService.listMessages(c.id, { limit: 1 });
            const m = (res.items || [])[0];
            return [c.id, { content: m?.body, createdAt: m?.createdAt }] as const;
          } catch {
            return [c.id, { content: undefined, createdAt: undefined }] as const;
          }
        }),
      );
      set((st) => ({ lastMsg: { ...st.lastMsg, ...Object.fromEntries(previews) } }));
    })();
  },

  join: (conversationId) => {
    const s = getChatSocket();
    s?.emit('conversation.join', { conversationId });
  },

  setActive: (id) => set({ activeId: id }),

  send: async (conversationId, body) => {
    const s = getChatSocket();
    if (s?.connected) {
      s.emit('message.send', { conversationId, body });
    } else {
      await chatService.sendMessage({ conversationId, body });
    }
  },

  loadMessages: async (conversationId) => {
    try {
      const json = await chatService.listMessages(conversationId, { limit: 50 });
      set((st) => ({
        messages: { ...st.messages, [conversationId]: (json.items || []) },
        cursors: { ...st.cursors, [conversationId]: json.nextCursor || null },
        hasMore: { ...st.hasMore, [conversationId]: !!(json.items && json.items.length) },
      }));
    } catch (e) {
      // swallow load errors, keep UI responsive
    }
  },

  loadParticipants: async (conversationId) => {
    try {
      const rows: any[] = await chatService.listParticipants(conversationId);
      const map: Record<string, { id: string; fullName?: string; email?: string; itsId?: string; profileImage?: string; designation?: string }> = {};
      rows.forEach((r: any) => {
        map[r.userId] = {
          id: r.user?.id || r.userId,
          fullName: r.user?.fullName,
          email: r.user?.email,
          itsId: r.user?.itsId,
          profileImage: r.user?.profileImage,
          designation: r.user?.designation,
        };
      });
      set((st) => ({ participants: { ...st.participants, [conversationId]: map } }));
    } catch {
      // ignore
    }
  },

  startDirect: async (eventId, userId) => {
    try {
      const conv: any = await chatService.startDirect(eventId, userId);
      set((st) => ({ conversations: [conv, ...st.conversations.filter(c=>c.id!==conv.id)], activeId: conv.id }));
      const s = getChatSocket();
      s?.emit('conversation.join', { conversationId: conv.id });
      return conv.id as string;
    } catch {
      return null;
    }
  },

  createChannel: async ({ eventId, title, participantUserIds }) => {
    try {
      const conv = await chatService.createConversation({ eventId, kind: 'GROUP', title, participantUserIds });
      set((st) => ({ conversations: [conv, ...st.conversations], activeId: conv.id }));
      const s = getChatSocket();
      s?.emit('conversation.join', { conversationId: conv.id });
      return conv.id as string;
    } catch {
      return null;
    }
  },

  sendAttachment: async (conversationId, file) => {
    const s = getChatSocket();
    const eventId = useContextStore.getState().currentEventId;
    if (!eventId) return;
    // create a shell message via WS to get an id, then upload
    await new Promise<void>((resolve) => {
      if (s?.connected) {
        s.emit('message.send', { conversationId, body: file.name }, async (msg: any) => {
          try {
            const { attachmentsService } = await import('../services/attachments');
            // optimistic temp attachment with progress
            set((st) => {
              const arr = st.messages[conversationId] ? [...st.messages[conversationId]] : [];
              const idx = arr.findIndex((m) => m.id === msg.id);
              const optimistic: any = { id: 'temp', originalName: file.name, mimeType: file.type, size: file.size, uploading: true, progress: 0 };
              const updated = idx >= 0 ? { ...arr[idx], attachments: [ ...(arr[idx].attachments || []), optimistic ] } : { ...msg, attachments: [optimistic] };
              if (idx >= 0) arr[idx] = updated; else arr.push(updated);
              return { messages: { ...st.messages, [conversationId]: arr } };
            });
            await attachmentsService.uploadWithProgress(eventId, 'Message', msg.id, file, (pct) => {
              set((st) => {
                const arr = st.messages[conversationId] ? [...st.messages[conversationId]] : [];
                const idx = arr.findIndex((m) => m.id === msg.id);
                if (idx >= 0) {
                  const atts = (arr[idx].attachments || []).map((a: any) => (a.id === 'temp' && a.originalName === file.name ? { ...a, progress: pct } : a));
                  arr[idx] = { ...arr[idx], attachments: atts };
                }
                return { messages: { ...st.messages, [conversationId]: arr } };
              });
            });
            // ask server to broadcast the official attachments list to all
            s.emit('attachment.uploaded', { messageId: msg.id });
          } finally {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  },

  sendAttachmentsBatch: async (conversationId, files) => {
    const s = getChatSocket();
    const eventId = useContextStore.getState().currentEventId;
    if (!eventId || !files.length) return;
    await new Promise<void>((resolve) => {
      if (s?.connected) {
        s.emit('message.send', { conversationId, body: '' }, async (msg: any) => {
          try {
            const { attachmentsService } = await import('../services/attachments');
            // optimistic placeholders for all files
            set((st) => {
              const arr = st.messages[conversationId] ? [...st.messages[conversationId]] : [];
              const idx = arr.findIndex((m) => m.id === msg.id);
              const optimistic = files.map((f, i) => ({ id: `temp-${i}`, originalName: f.name, mimeType: f.type, size: f.size, uploading: true, progress: 0 } as any));
              const updated = idx >= 0 ? { ...arr[idx], attachments: [ ...(arr[idx].attachments || []), ...optimistic ] } : { ...msg, attachments: optimistic };
              if (idx >= 0) arr[idx] = updated; else arr.push(updated);
              return { messages: { ...st.messages, [conversationId]: arr } };
            });
            // upload sequentially to keep UI simple
            const { attachmentsService: svc } = await import('../services/attachments');
            for (let i = 0; i < files.length; i++) {
              const f = files[i];
              await svc.uploadWithProgress(eventId, 'Message', msg.id, f, (pct) => {
                set((st) => {
                  const arr = st.messages[conversationId] ? [...st.messages[conversationId]] : [];
                  const idx = arr.findIndex((m) => m.id === msg.id);
                  if (idx >= 0) {
                    const atts = (arr[idx].attachments || []).map((a: any) => (a.id === `temp-${i}` ? { ...a, progress: pct } : a));
                    arr[idx] = { ...arr[idx], attachments: atts };
                  }
                  return { messages: { ...st.messages, [conversationId]: arr } };
                });
              });
            }
            // broadcast completion
            s.emit('attachment.uploaded', { messageId: msg.id });
          } finally {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  },

  reset: () => {
    set({
      conversations: [],
      activeId: null,
      messages: {},
      connecting: false,
      error: null,
      dmNames: {},
      lastMsg: {},
      participants: {},
      cursors: {},
      hasMore: {},
      scrollPos: {},
    });
  },

  setScrollPos: (conversationId, pos) => {
    set((st) => ({ scrollPos: { ...st.scrollPos, [conversationId]: pos } }));
  },

  loadOlder: async (conversationId) => {
    const cur = get().cursors[conversationId];
    const more = get().hasMore[conversationId];
    if (!more || !cur) return;
    try {
      const json = await chatService.listMessages(conversationId, { limit: 50, before: cur });
      set((st) => {
        const prev = st.messages[conversationId] || [];
        // prepend older items; de-duplicate by id
        const mergedById = new Map<string, any>();
        for (const m of json.items || []) mergedById.set(m.id, m);
        for (const m of prev) mergedById.set(m.id, m);
        const merged = Array.from(mergedById.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return {
          messages: { ...st.messages, [conversationId]: merged },
          cursors: { ...st.cursors, [conversationId]: json.nextCursor || null },
          hasMore: { ...st.hasMore, [conversationId]: !!(json.items && json.items.length) },
        };
      });
    } catch {}
  },
}));
