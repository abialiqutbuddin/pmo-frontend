import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Message } from './Message';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

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
    const displayName = self ? (currentUser?.fullName || currentUser?.email || 'Me') : (p?.fullName || p?.email || m.authorId);
    return {
      id: m.id,
      content: m.body || '',
      createdAt: new Date(m.createdAt).toLocaleTimeString(),
      sender: { id: m.authorId, name: displayName, avatarUrl: self ? (currentUser?.profileImage || undefined) : (p?.profileImage || undefined), itsId: self ? (currentUser?.itsId || null) : (p?.itsId || null) },
      roomId,
      attachments: m.attachments,
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

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const isNearBottom = () => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  // Auto-scroll to bottom on new messages appended (when near bottom)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const nearBottom = isNearBottom();
    const len = messages.length;
    const last = len ? messages[len - 1] : null;
    const lastId = last?.id || null;

    // If first load (previously empty) or near bottom, scroll down
    if (prevLenRef.current === 0 || nearBottom) {
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
  }, [messages]);

  // When switching rooms, restore saved scroll or jump to bottom
  useEffect(() => {
    // wait a tick for DOM to paint
    const t = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      if (typeof savedPos === 'number') {
        el.scrollTop = savedPos;
      } else {
        scrollToBottom('auto');
      }
      initialScrolledRef.current = true;
      setShowScrollDown(!isNearBottom());
    }, 0);
    return () => clearTimeout(t);
  }, [roomId, savedPos]);

  // Infinite scroll: when scrolled to top, load older and keep viewport position stable
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = async () => {
      setScrollPos(roomId, el.scrollTop);
      setShowScrollDown(!isNearBottom());
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
          className="absolute right-4 bottom-4 px-3 py-2 rounded-full shadow bg-white text-gray-700 border hover:bg-gray-50"
          title="Scroll to latest"
        >
          ↓ New
        </button>
      )}
    </div>
  );
};
