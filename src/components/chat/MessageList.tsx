import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Message } from './Message';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { chatService } from '../../services/chat';
import { getChatSocket } from '../../lib/chatSocket';

interface MessageListProps {
  roomId: string;
}

export const MessageList: React.FC<MessageListProps> = ({ roomId }) => {
  const msgsMap = useChatStore((s) => s.messages);
  const conversations = useChatStore((s) => s.conversations);
  const participants = useChatStore((s) => s.participants);
  const loadOlder = useChatStore((s) => s.loadOlder);
  const setScrollPos = useChatStore((s) => s.setScrollPos);

  // Don't subscribe to scrollPos to avoid re-renders on scroll
  // const savedPos = useChatStore((s) => s.scrollPos[roomId]); 

  const currentUser = useAuthStore((s) => s.currentUser);
  const messages = useMemo(() => (msgsMap[roomId] || []).map(m => {
    const self = m.authorId === currentUser?.id;
    const p = participants[roomId]?.[m.authorId];
    const displayName = self
      ? (currentUser?.fullName || currentUser?.email || 'Me')
      : (m.author?.fullName || m.author?.email || p?.fullName || p?.email || m.authorId);
    return {
      id: m.id,
      content: m.body || '',
      createdAt: new Date(m.createdAt).toLocaleTimeString(),
      sender: {
        id: m.authorId,
        name: displayName,
        avatarUrl: self ? (currentUser?.profileImage || undefined) : (m.author?.profileImage || p?.profileImage || undefined),
        itsId: self ? (currentUser?.itsId || null) : (m.author?.itsId || p?.itsId || null)
      },
      roomId,
      attachments: m.attachments,
      createdAtISO: m.createdAt,
      isSystem: m.isSystem,
    };
  }), [msgsMap, roomId, currentUser?.id, currentUser?.fullName, currentUser?.email, participants]);

  const showSender = useMemo(() => {
    const c = conversations.find((x) => x.id === roomId);
    return c ? c.kind !== 'DIRECT' : false;
  }, [conversations, roomId]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const prevLenRef = useRef<number>(0);
  const lastMessageIdRef = useRef<string | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const initialScrolledRef = useRef<boolean>(false);
  const restoreTargetRef = useRef<{ mode: 'pos' | 'bottom'; pos?: number } | null>(null);
  const pinBottomRef = useRef<boolean>(false);
  const lastMarkTsRef = useRef<number>(0);
  const scrollTimeoutRef = useRef<number | null>(null);

  // Initial load / Room switch logic
  useEffect(() => {
    prevLenRef.current = 0;
    lastMessageIdRef.current = null;
    initialScrolledRef.current = false;
    setShowScrollDown(false);

    // Read saved position directly from store to avoid re-renders
    const savedPos = useChatStore.getState().scrollPos[roomId];

    if (typeof savedPos === 'number') {
      restoreTargetRef.current = { mode: 'pos', pos: savedPos };
      pinBottomRef.current = false;
    } else {
      restoreTargetRef.current = { mode: 'bottom' };
      pinBottomRef.current = true;
    }
  }, [roomId]);

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const el = containerRef.current;
    if (!el) return;
    // Use large number to ensure bottom
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  const isNearBottom = () => {
    const el = containerRef.current;
    if (!el) return true;
    // 100px threshold
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  };

  // Auto-scroll handling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const len = messages.length;
    const last = len ? messages[len - 1] : null;
    const lastId = last?.id || null;

    // First render/restore logic
    if (!initialScrolledRef.current && len > 0) {
      const target = restoreTargetRef.current;

      // Use ResizeObserver loop or just immediate effect?
      // For simplicity, we try immediate + small delay
      if (!pinBottomRef.current && target?.mode === 'pos' && typeof target.pos === 'number') {
        el.scrollTop = target.pos;
      } else {
        el.scrollTop = el.scrollHeight;
      }

      initialScrolledRef.current = true;
      restoreTargetRef.current = null;
      pinBottomRef.current = false;
      setShowScrollDown(!isNearBottom());

      // Double check shortly after for images/layout shift
      setTimeout(() => {
        if (isNearBottom()) el.scrollTop = el.scrollHeight;
      }, 100);

    } else {
      // For updates (not initial load)
      const isNewMessage = len > prevLenRef.current || (lastId !== lastMessageIdRef.current);

      if (isNewMessage) {
        if (isNearBottom()) {
          // User was at bottom, stay pinned
          scrollToBottom('smooth');
        } else {
          // User was scrolled up
          const mine = last && last.sender.id === currentUser?.id;
          if (mine) {
            scrollToBottom('smooth');
          } else {
            // New message from others, and we are not at bottom -> show button
            setShowScrollDown(true);
          }
        }
      }
      // If not a new message (just an update/reaction), do NOT scroll.
    }

    lastMessageIdRef.current = lastId;
    prevLenRef.current = len;

    // Mark read if at bottom
    if (len && isNearBottom()) {
      const now = Date.now();
      if (now - lastMarkTsRef.current > 1000) {
        lastMarkTsRef.current = now;
        const s = getChatSocket();
        if (s?.connected) s.emit('conversation.read', { conversationId: roomId });
        else chatService.markRead({ conversationId: roomId }).catch(() => { });
      }
    }
  }, [messages, currentUser?.id, roomId]);

  // Scroll listener being efficient
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = async () => {
      const nearBottom = isNearBottom();
      setShowScrollDown(!nearBottom);

      // Mark read if scrolled to bottom
      if (nearBottom) {
        const now = Date.now();
        if (now - lastMarkTsRef.current > 1000) {
          lastMarkTsRef.current = now;
          const s = getChatSocket();
          if (s?.connected) s.emit('conversation.read', { conversationId: roomId });
          else chatService.markRead({ conversationId: roomId }).catch(() => { });
        }
      }

      // Save position (debounced/throttled)
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = window.setTimeout(() => {
        setScrollPos(roomId, el.scrollTop);
      }, 150);

      // Load older logic
      if (el.scrollTop <= 40) {
        const prevHeight = el.scrollHeight;
        await loadOlder(roomId);
        // adjust scroll
        const newHeight = el.scrollHeight;
        el.scrollTop = newHeight - prevHeight + el.scrollTop;
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [roomId, loadOlder, setScrollPos]);

  return (
    <div className="relative flex-1 h-full overflow-hidden flex flex-col bg-stone-100">
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <Message key={msg.id} message={msg} showSender={showSender} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {showScrollDown && (
        <button
          onClick={() => { scrollToBottom('smooth'); }}
          className="absolute right-6 bottom-6 px-3 py-2 rounded-full shadow-lg bg-white text-gray-700 border hover:bg-gray-50 z-30 flex items-center gap-1 text-sm font-medium animate-in fade-in slide-in-from-bottom-2"
          title="Scroll to latest"
        >
          <span>↓</span>
          <span>New Messages</span>
        </button>
      )}
    </div>
  );
};
