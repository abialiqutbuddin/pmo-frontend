import { create } from 'zustand';
import { connectChatSocket, getChatSocket } from '../lib/chatSocket';
import { chatService, type Conversation } from '../services/chat';
import { useAuthStore } from './authStore';
import { useContextStore } from './contextStore';

export type ChatMessageVM = {
  id: string;
  conversationId: string;
  authorId: string;
  author?: { id: string; fullName?: string; email?: string; itsId?: string; profileImage?: string };
  body?: string | null;
  parentId?: string | null;
  createdAt: string;
  attachments?: { id: string; originalName: string; mimeType: string; objectKey?: string; size?: number }[];
  isSystem?: boolean;
};

interface ChatState {
  eventId: string | null;
  conversations: Conversation[];
  activeId: string | null;
  messages: Record<string, ChatMessageVM[]>; // by conversationId
  connecting: boolean;
  error?: string | null;
  dmNames: Record<string, string>; // conversationId -> other participant's name for DIRECT
  lastMsg: Record<string, { id?: string; authorId?: string; content?: string; createdAt?: string }>; // conversationId -> preview
  unread: Record<string, number>;
  participants: Record<string, Record<string, { id: string; fullName?: string; email?: string; itsId?: string; profileImage?: string; designation?: string; lastReadAt?: string | null }>>;
  cursors: Record<string, string | null>; // conversationId -> earliest loaded createdAt
  hasMore: Record<string, boolean>; // conversationId -> whether older messages may exist
  scrollPos: Record<string, number>; // conversationId -> scrollTop
  pendingJoin: Record<string, true>;

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
  unread: {},
  participants: {},
  cursors: {},
  hasMore: {},
  scrollPos: {},
  pendingJoin: {},

  connect: async () => {
    const token = useAuthStore.getState().accessToken;
    const eventId = useContextStore.getState().currentEventId;
    if (!token || !eventId) return;
    if (getChatSocket()?.connected) return;
    set({ connecting: true, error: null });
    const s = connectChatSocket(token, eventId);
    s.on('connect', () => {
      try {
        const ids = new Set<string>();
        const pending = Object.keys(get().pendingJoin || {});
        pending.forEach((id) => ids.add(id));
        (get().conversations || []).forEach((c) => ids.add(c.id));
        ids.forEach((id) => s.emit('conversation.join', { conversationId: id }));
        set({ pendingJoin: {} });
      } catch {}
    });
    s.on('connect_error', (err) => set({ error: err?.message || 'Socket error' }));
    s.on('message.new', (msg: any) => {
      set((st) => {
        const arr = st.messages[msg.conversationId] ? [...st.messages[msg.conversationId]] : [];
        arr.push({
          id: msg.id,
          conversationId: msg.conversationId,
          authorId: msg.authorId,
          author: msg.author,
          body: msg.body,
          parentId: msg.parentId,
          createdAt: msg.createdAt,
          isSystem: !!msg.isSystem,
        });
        const lastMsg = { ...st.lastMsg, [msg.conversationId]: { id: msg.id, authorId: msg.authorId, content: msg.body, createdAt: msg.createdAt } };
        const meId = useAuthStore.getState().currentUser?.id;
        const isActive = st.activeId === msg.conversationId;
        const unread = { ...st.unread };
        if (!isActive && msg.authorId !== meId) unread[msg.conversationId] = (unread[msg.conversationId] || 0) + 1;
        // reorder: move this conversation to the top
        const conversations = [...st.conversations];
        const idx = conversations.findIndex((c) => c.id === msg.conversationId);
        if (idx > 0) {
          const [moved] = conversations.splice(idx, 1);
          conversations.unshift(moved);
        }
        return { conversations, messages: { ...st.messages, [msg.conversationId]: arr }, lastMsg, unread };
      });
      try {
        // If it's a system message for add/remove, refresh participants map
        if (msg?.isSystem && typeof msg.body === 'string' && /^(added |removed )/i.test(msg.body.trim())) {
          const fn = get().loadParticipants;
          if (typeof fn === 'function') fn(msg.conversationId);
        }
      } catch {}
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
    s.on('conversation.read', (p: { conversationId: string; userId: string; at: string }) => {
      set((st) => {
        const pm = st.participants[p.conversationId] ? { ...st.participants[p.conversationId] } : {};
        const row = pm[p.userId] || { id: p.userId } as any;
        pm[p.userId] = { ...row, lastReadAt: p.at };
        const meId = useAuthStore.getState().currentUser?.id;
        const unread = { ...st.unread };
        if (p.userId === meId) unread[p.conversationId] = 0;
        return { participants: { ...st.participants, [p.conversationId]: pm }, unread };
      });
    });
    // Participants list changes broadcast from server
    s.on('participants.updated', (p: { conversationId: string }) => {
      try { const fn = get().loadParticipants; if (typeof fn === 'function') fn(p.conversationId); } catch {}
    });
    // New conversation invited to me (e.g., added to a group)
    s.on('conversation.invited', (c: any) => {
      set((st) => {
        // If this conversation already exists, ignore or update
        const exists = st.conversations.some((x) => x.id === c.id);
        const conversations = exists ? st.conversations.map((x) => (x.id === c.id ? { ...x, ...c } : x)) : [{ ...c }, ...st.conversations];
        const participants = { ...st.participants, [c.id]: Object.fromEntries((c.participants || []).map((p: any) => [p.userId, { id: p.userId, fullName: p.user?.fullName, email: p.user?.email, lastReadAt: p.lastReadAt || null }])) };
        const lastMsg = { ...st.lastMsg } as any;
        if (c.lastMessage) {
          lastMsg[c.id] = { id: c.lastMessage.id, authorId: c.lastMessage.authorId, content: c.lastMessage.body, createdAt: c.lastMessage.createdAt };
        }
        return { conversations, participants, lastMsg };
      });
      // auto-join the room and prefetch messages
      try {
        const s2 = getChatSocket();
        if (s2?.connected) s2.emit('conversation.join', { conversationId: c.id });
      } catch {}
      // Preload minimal messages for preview accuracy
      try { get().loadMessages(c.id); } catch {}
    });
    // Server denied joining a conversation (e.g., removed member)
    s.on('conversation.join-denied', (p: { conversationId: string }) => {
      // Clear my read state and participants map entry for me; UI will disable input
      set((st) => {
        const parts = { ...(st.participants[p.conversationId] || {}) } as any;
        const meId = useAuthStore.getState().currentUser?.id;
        if (meId && parts[meId]) delete parts[meId];
        return { participants: { ...st.participants, [p.conversationId]: parts } };
      });
    });
    // Server kicked me from a conversation
    s.on('conversation.kicked', (p: { conversationId: string }) => {
      set((st) => {
        const parts = { ...(st.participants[p.conversationId] || {}) } as any;
        const meId = useAuthStore.getState().currentUser?.id;
        if (meId && parts[meId]) delete parts[meId];
        return { participants: { ...st.participants, [p.conversationId]: parts } };
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
    // Prime last message map and participants' lastReadAt from server response
    set((st) => {
      const lastMsg: any = { ...st.lastMsg };
      const participants: any = { ...st.participants };
      const unread: any = { ...st.unread };
      for (const c of list as any[]) {
        if (c.lastMessage) {
          lastMsg[c.id] = {
            id: c.lastMessage.id,
            authorId: c.lastMessage.authorId,
            content: c.lastMessage.body,
            createdAt: c.lastMessage.createdAt,
          };
        }
        if (Array.isArray(c.participants)) {
          const map = participants[c.id] || {};
          for (const p of c.participants) {
            const row = map[p.userId] || { id: p.userId };
            map[p.userId] = { ...row, lastReadAt: p.lastReadAt || null, fullName: p.user?.fullName, email: p.user?.email };
          }
          participants[c.id] = map;
        }
        if (typeof (c as any).unreadCount === 'number') unread[c.id] = (c as any).unreadCount;
      }
      return { conversations: list as any, lastMsg, participants, unread };
    });
    // auto-join rooms
    const s = getChatSocket();
    if (s?.connected) {
      list.forEach((c) => s.emit('conversation.join', { conversationId: c.id }));
    } else {
      set((st) => {
        const next = { ...(st.pendingJoin || {}) } as Record<string, true>;
        (list as any[]).forEach((c) => { next[c.id] = true; });
        return { pendingJoin: next };
      });
    }

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

    // skip extra preview fetch; we already got lastMessage above
  },

  join: (conversationId) => {
    const s = getChatSocket();
    if (s?.connected) s.emit('conversation.join', { conversationId });
    else set((st) => ({ pendingJoin: { ...(st.pendingJoin || {}), [conversationId]: true } }));
  },

  setActive: (id) => set((st) => ({ activeId: id, unread: { ...st.unread, [id]: 0 } })),

  send: async (conversationId, body) => {
    const s = getChatSocket();
    if (s?.connected) {
      s.emit('message.send', { conversationId, body });
    } else {
      const msg: any = await chatService.sendMessage({ conversationId, body }).catch(()=>null);
      if (msg) {
        set((st) => {
          const arr = st.messages[conversationId] ? [...st.messages[conversationId]] : [];
          arr.push({ id: msg.id, conversationId, authorId: msg.authorId, body: msg.body, parentId: msg.parentId, createdAt: msg.createdAt });
          const lastMsg = { ...st.lastMsg, [conversationId]: { id: msg.id, authorId: msg.authorId, content: msg.body, createdAt: msg.createdAt } };
          const conversations = [...st.conversations];
          const idx = conversations.findIndex((c) => c.id === conversationId);
          if (idx > 0) { const [moved] = conversations.splice(idx, 1); conversations.unshift(moved); }
          return { conversations, messages: { ...st.messages, [conversationId]: arr }, lastMsg };
        });
      }
    }
  },

  loadMessages: async (conversationId) => {
    try {
      const json = await chatService.listMessages(conversationId, { limit: 50 });
      set((st) => {
        const items = json.items || [];
        const last = items.length ? items[items.length - 1] : null;
        const lm = last ? { id: last.id, authorId: last.authorId, content: last.body, createdAt: last.createdAt } : undefined as any;
        return {
          messages: { ...st.messages, [conversationId]: items },
          cursors: { ...st.cursors, [conversationId]: json.nextCursor || null },
          hasMore: { ...st.hasMore, [conversationId]: !!items.length },
          lastMsg: lm ? { ...st.lastMsg, [conversationId]: lm } : st.lastMsg,
        };
      });
    } catch (e) {
      // swallow load errors, keep UI responsive
    }
  },

  loadParticipants: async (conversationId) => {
    try {
      const rows: any[] = await chatService.listParticipants(conversationId);
      const map: Record<string, { id: string; fullName?: string; email?: string; itsId?: string; profileImage?: string; designation?: string; lastReadAt?: string | null; role?: string }> = {};
      rows.forEach((r: any) => {
        map[r.userId] = {
          id: r.user?.id || r.userId,
          fullName: r.user?.fullName,
          email: r.user?.email,
          itsId: r.user?.itsId,
          profileImage: r.user?.profileImage,
          designation: r.user?.designation,
          lastReadAt: r.lastReadAt || null,
          role: r.role,
        };
      });
      const meId = useAuthStore.getState().currentUser?.id;
      const conv = get().conversations.find((c) => c.id === conversationId);
      if (conv?.kind === 'DIRECT') {
        const other = rows.find((r: any) => r.userId !== meId)?.user;
        const name = other?.fullName || other?.email || 'Direct';
        set((st) => ({
          participants: { ...st.participants, [conversationId]: map },
          dmNames: { ...st.dmNames, [conversationId]: name },
        }));
      } else {
        set((st) => ({ participants: { ...st.participants, [conversationId]: map } }));
      }
    } catch {
      // ignore
    }
  },

  startDirect: async (eventId, userId) => {
    try {
      const conv: any = await chatService.startDirect(eventId, userId);
      set((st) => ({ conversations: [conv, ...st.conversations.filter(c=>c.id!==conv.id)], activeId: conv.id }));
      const s = getChatSocket();
      if (s?.connected) s.emit('conversation.join', { conversationId: conv.id });
      else set((st) => ({ pendingJoin: { ...(st.pendingJoin || {}), [conv.id]: true } }));
      // Immediately hydrate participants and DM display name
      try {
        const rows: any[] = await chatService.listParticipants(conv.id);
        const map: Record<string, { id: string; fullName?: string; email?: string; itsId?: string; profileImage?: string; designation?: string; lastReadAt?: string | null; role?: string }> = {};
        rows.forEach((r: any) => {
          map[r.userId] = {
            id: r.user?.id || r.userId,
            fullName: r.user?.fullName,
            email: r.user?.email,
            itsId: r.user?.itsId,
            profileImage: r.user?.profileImage,
            designation: r.user?.designation,
            lastReadAt: r.lastReadAt || null,
            role: r.role,
          };
        });
        const meId = useAuthStore.getState().currentUser?.id;
        const other = rows.find((r: any) => r.userId !== meId)?.user;
        const name = other?.fullName || other?.email || 'Direct';
        set((st) => ({
          participants: { ...st.participants, [conv.id]: map },
          dmNames: { ...st.dmNames, [conv.id]: name },
        }));
      } catch {}
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
