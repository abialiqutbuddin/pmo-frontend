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
  const savedPos = useChatStore((s) => s.scrollPos[roomId]);
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
  // Reset tracking when switching rooms so first load scrolls to bottom
  useEffect(() => {
    prevLenRef.current = 0;
    lastMessageIdRef.current = null;
    initialScrolledRef.current = false;
    setShowScrollDown(false);
    // decide what to restore to for this room
    if (typeof savedPos === 'number') {
      restoreTargetRef.current = { mode: 'pos', pos: savedPos };
      pinBottomRef.current = false;
    } else {
      restoreTargetRef.current = { mode: 'bottom' };
      pinBottomRef.current = true; // no saved state => always start from bottom
    }
  }, [roomId]);
  const lastMarkTsRef = useRef<number>(0);

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const isNearBottom = () => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150; // larger window so button shows sooner
  };

  // Auto-scroll handling on new messages appended
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = isNearBottom();
    const len = messages.length;
    const last = len ? messages[len - 1] : null;
    const lastId = last?.id || null;

    // First render in this room: apply restore target once
    if (!initialScrolledRef.current && len > 0) {
      // Defer to next frame to ensure DOM has painted
      const target = restoreTargetRef.current;
      requestAnimationFrame(() => {
        const el2 = containerRef.current;
        if (!el2) return;
        if (!pinBottomRef.current && target?.mode === 'pos' && typeof target.pos === 'number') el2.scrollTop = target.pos;
        else el2.scrollTop = el2.scrollHeight;
        initialScrolledRef.current = true;
        restoreTargetRef.current = null;
        pinBottomRef.current = false;
        setShowScrollDown(!isNearBottom());
        // Run one more pass shortly after to account for late layout (images, fonts)
        setTimeout(() => {
          const el3 = containerRef.current;
          if (!el3) return;
          if (isNearBottom()) el3.scrollTop = el3.scrollHeight;
        }, 50);
        setTimeout(() => {
          const el4 = containerRef.current;
          if (!el4) return;
          if (isNearBottom()) el4.scrollTop = el4.scrollHeight;
        }, 200);
      });
    } else if (nearBottom) {
      // Stay pinned to bottom when near bottom
      scrollToBottom('auto');
    } else {
      // If the new last message is by me, also scroll
      const mine = last && last.sender.id === currentUser?.id;
      if (mine && lastMessageIdRef.current !== lastId) {
        scrollToBottom('smooth');
      }
    }

    lastMessageIdRef.current = lastId;
    prevLenRef.current = len;
    // Update scroll-down button visibility when messages change
    setShowScrollDown(!isNearBottom());

    // Mark conversation as read when near bottom and new message arrives (throttle)
    if (len && nearBottom) {
      const now = Date.now();
      if (now - lastMarkTsRef.current > 1000) {
        lastMarkTsRef.current = now;
        const s = getChatSocket();
        if (s?.connected) s.emit('conversation.read', { conversationId: roomId });
        else chatService.markRead({ conversationId: roomId }).catch(() => {});
      }
    }
  }, [messages]);

  // Save scroll position when changing rooms/unmounting
  useEffect(() => {
    return () => {
      const el = containerRef.current;
      if (el) setScrollPos(roomId, el.scrollTop);
    };
  }, [roomId, setScrollPos]);

  // Infinite scroll: when scrolled to top, load older and keep viewport position stable
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = async () => {
      setScrollPos(roomId, el.scrollTop);
      setShowScrollDown(!isNearBottom());
      if (isNearBottom()) {
        const now = Date.now();
        if (now - lastMarkTsRef.current > 1000) {
          lastMarkTsRef.current = now;
          const s = getChatSocket();
          if (s?.connected) s.emit('conversation.read', { conversationId: roomId });
          else chatService.markRead({ conversationId: roomId }).catch(() => {});
        }
      }
      if (el.scrollTop <= 40) {
        const prevHeight = el.scrollHeight;
        await loadOlder(roomId);
        // after prepend, adjust scroll so content doesn't jump
        const newHeight = el.scrollHeight;
        el.scrollTop = newHeight - prevHeight + el.scrollTop;
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [roomId, loadOlder, setScrollPos]);

  return (
    <div ref={containerRef} className="relative flex-1 overflow-y-auto p-4 space-y-2 bg-stone-100">
      {/* This bg-stone-100 gives a warm, WhatsApp-like chat background */}
      {messages.map((msg) => (
        <Message key={msg.id} message={msg} showSender={showSender} />
      ))}
      <div ref={messagesEndRef} />
      {showScrollDown && (
        <button
          onClick={() => { scrollToBottom('smooth'); setShowScrollDown(false); }}
          className="fixed right-6 bottom-28 md:bottom-16 px-3 py-2 rounded-full shadow bg-white text-gray-700 border hover:bg-gray-50 z-30"
          title="Scroll to latest"
        >
          ↓ New
        </button>
      )}
    </div>
  );
};
