import React, { useMemo } from 'react';
import { ChatRoom as ChatRoomType } from '../../types/chat';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useContextStore } from '../../store/contextStore';

interface ChatRoomProps {
  room: ChatRoomType;
  isActive?: boolean;
  isSystemGroup?: boolean;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ room, isActive = true, isSystemGroup = false }) => {
  // Avoid returning a new object each render to satisfy useSyncExternalStore caching
  const EMPTY_PARTICIPANTS: Record<string, any> = Object.freeze({});
  const partMap = useChatStore((s) => s.participants[room.id] ?? EMPTY_PARTICIPANTS);
  const me = useAuthStore((s) => s.currentUser);
  const chatPermissions = useContextStore((s) => s.chatPermissions);

  const amParticipant = useMemo(() => {
    return room.isGroup ? !!(partMap as any)[me?.id || ''] : true;
  }, [partMap, me?.id, room.isGroup]);

  // For system groups, check if user has global send permission
  const canSendToSystemGroup = isSystemGroup && chatPermissions?.canSendToSystemGroups;
  const canSendMessages = isActive && (amParticipant || canSendToSystemGroup);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      {/* Chat Header */}
      <ChatHeader roomId={room.id} roomName={room.name} isGroup={room.isGroup} isSystemGroup={isSystemGroup} />

      {/* Message List */}
      <MessageList roomId={room.id} />

      {/* Inactive channel banner */}
      {!isActive && (
        <div className="px-4 py-2 text-center text-sm text-gray-700 bg-amber-50 border-t border-b border-amber-200">
          This channel is archived. You can view previous messages and attachments only.
        </div>
      )}

      {/* Read-only access banner for system groups */}
      {isActive && isSystemGroup && !amParticipant && !canSendToSystemGroup && (
        <div className="px-4 py-2 text-center text-sm text-gray-700 bg-blue-50 border-t border-b border-blue-200">
          You have view-only access to this channel.
        </div>
      )}

      {/* Removed from group banner */}
      {isActive && room.isGroup && !isSystemGroup && !amParticipant && (
        <div className="px-4 py-2 text-center text-sm text-gray-700 bg-yellow-50 border-t border-b border-yellow-200">
          You are no longer a member of this group. You can view previous messages only.
        </div>
      )}

      {/* Message Input - only show if can send messages */}
      {canSendMessages ? (
        <ChatInput roomId={room.id} />
      ) : (
        <div className="px-4 py-3 bg-gray-100 border-t border-gray-200 text-center text-sm text-gray-500">
          You cannot send messages in this channel
        </div>
      )}
    </div>
  );
};
