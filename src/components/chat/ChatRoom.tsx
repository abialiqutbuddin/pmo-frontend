import React, { useMemo } from 'react';
import { ChatRoom as ChatRoomType } from '../../types/chat';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

interface ChatRoomProps {
  room: ChatRoomType;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ room }) => {
  // Avoid returning a new object each render to satisfy useSyncExternalStore caching
  const EMPTY_PARTICIPANTS: Record<string, any> = Object.freeze({});
  const partMap = useChatStore((s) => s.participants[room.id] ?? EMPTY_PARTICIPANTS);
  const me = useAuthStore((s) => s.currentUser);
  const amParticipant = useMemo(() => {
    return room.isGroup ? !!(partMap as any)[me?.id || ''] : true;
  }, [partMap, me?.id, room.isGroup]);
  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      {/* Chat Header */}
      <ChatHeader roomId={room.id} roomName={room.name} isGroup={room.isGroup} />

      {/* Message List */}
      <MessageList roomId={room.id} />

      {/* Removed banner */}
      {room.isGroup && !amParticipant && (
        <div className="px-4 py-2 text-center text-sm text-gray-700 bg-yellow-50 border-t border-b border-yellow-200">
          You are no longer a member of this group. You can view previous messages only.
        </div>
      )}

      {/* Message Input */}
      <ChatInput roomId={room.id} />
    </div>
  );
};
