import React, { useEffect, useMemo, useState } from 'react';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatRoom } from '../components/chat/ChatRoom';
import { useChatStore } from '../store/chatStore';
import { useContextStore } from '../store/contextStore';
import { Spinner } from '../components/ui/Spinner';
import { useAuthStore } from '../store/authStore';

export const ChatPage: React.FC = () => {
  const { connect, loadConversations, conversations, activeId, setActive, connecting, loadMessages, join, dmNames, lastMsg, loadParticipants } = useChatStore();
  const participantsMap = useChatStore((s) => s.participants);
  const unreadMap = useChatStore((s) => s.unread);
  const { currentEventId } = useContextStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [dmName, setDmName] = useState<string>('');

  useEffect(() => {
    if (!currentEventId) return;
    void connect().then(() => loadConversations());
  }, [currentEventId]);

  const activeRoom = conversations.find((c) => c.id === activeId);
  useEffect(() => {
    if (activeRoom) {
      join(activeRoom.id);
      void loadMessages(activeRoom.id);
      void loadParticipants(activeRoom.id);
    }
  }, [activeRoom?.id]);

  // Compute display name for DIRECT chats based on store-populated dmNames
  useEffect(() => {
    if (!activeRoom || activeRoom.kind !== 'DIRECT') { setDmName(''); return; }
    setDmName(dmNames[activeRoom.id] || 'Direct');
  }, [activeRoom?.id, activeRoom?.kind, dmNames]);

  return (
    <div className="flex h-full min-h-0 w-full bg-gray-100">
      {/* Sidebar (Chat List) */}
      <ChatSidebar
        rooms={conversations.map((c) => {
          const isGroup = c.kind !== 'DIRECT';
          let members: { id: string; name: string; avatarUrl?: string; itsId?: string | null }[] = [];
          if (!isGroup) {
            const partMap = participantsMap[c.id] || {};
            const meId = useAuthStore.getState().currentUser?.id;
            const other = Object.entries(partMap).map(([uid, u]: any) => u).find((u) => u.id !== meId);
            if (other) members = [{ id: other.id, name: other.fullName || other.email || 'User', avatarUrl: other.profileImage, itsId: other.itsId }];
          }
          const lm = (lastMsg[c.id] || (c.lastMessage ? { id: c.lastMessage.id, authorId: c.lastMessage.authorId, content: c.lastMessage.body, createdAt: c.lastMessage.createdAt } : undefined)) || {} as any;
          const authorMap = participantsMap[c.id] || {};
          const authorName = lm.authorId ? (
            lm.authorId === currentUser?.id ? 'You' : (
              c.lastMessage?.author?.fullName || authorMap[lm.authorId]?.fullName || authorMap[lm.authorId]?.email || lm.authorId
            )
          ) : '';
          const unread = (unreadMap[c.id] ?? c.unreadCount ?? 0) as number;
          return {
            id: c.id,
            name: c.kind === 'DIRECT' ? (dmNames[c.id] || 'Direct') : (c.title || `#${c.kind.toLowerCase()}`),
            isGroup,
            members,
            lastMessage: { id: lm.id || '', content: (lm.content || ''), createdAt: (lm.createdAt || ''), sender: { id: lm.authorId || '', name: authorName }, roomId: c.id },
            unread,
          };
        })}
        activeRoomId={activeRoom?.id || ''}
        onSelectRoom={setActive}
      />

      {/* Main Chat Area */}
      {connecting ? (
        <div className="flex-1 flex items-center justify-center"><Spinner label="Connecting…" /></div>
      ) : activeRoom ? (
        <ChatRoom
          key={activeRoom.id}
          room={{
            id: activeRoom.id,
            name: activeRoom.kind === 'DIRECT' ? (dmName || 'Direct') : (activeRoom.title || `#${activeRoom.kind.toLowerCase()}`),
            isGroup: activeRoom.kind !== 'DIRECT',
            members: [],
            lastMessage: { id: '', content: '', createdAt: '', sender: { id: '', name: '' }, roomId: activeRoom.id },
          }}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">Select a chat to start messaging</div>
      )}
    </div>
  );
};
