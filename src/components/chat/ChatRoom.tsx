import React from 'react';
import { ChatRoom as ChatRoomType } from '../../types/chat';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

interface ChatRoomProps {
  room: ChatRoomType;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ room }) => {
  return (
    <div className="flex-1 flex flex-col h-full min-h-0">
      {/* Chat Header */}
      <ChatHeader roomId={room.id} roomName={room.name} isGroup={room.isGroup} />

      {/* Message List */}
      <MessageList roomId={room.id} />

      {/* Message Input */}
      <ChatInput roomId={room.id} />
    </div>
  );
};
