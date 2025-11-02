import React from 'react';
import { ChatRoom } from '../../types/chat';
import { UserAvatar } from '../ui/UserAvatar';
import clsx from 'clsx';
import { Users } from 'lucide-react';

interface ChatSidebarItemProps {
  room: ChatRoom;
  isActive: boolean;
  onClick: () => void;
}

// Helper to get initials
const getInitials = (name: string) => {
  if (name.startsWith('#')) {
    return name.substring(1, 3).toUpperCase();
  }
  const parts = name.split(' ');
  return parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`
    : parts[0].substring(0, 2);
};

export const ChatSidebarItem: React.FC<ChatSidebarItemProps> = ({
  room,
  isActive,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'flex items-center p-3 cursor-pointer border-b border-gray-100',
        isActive ? 'bg-gray-100' : 'hover:bg-gray-50',
      )}
    >
      {/* Avatar / Icon */}
      <div className="flex-shrink-0 mr-3">
        <div className="w-12 h-12">
          {room.isGroup ? (
            <div className="w-12 h-12 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center">
              <Users size={22} />
            </div>
          ) : room.members && room.members.length ? (
            <UserAvatar nameOrEmail={room.members[0].name} imageUrl={room.members[0].avatarUrl} itsId={room.members[0].itsId || undefined} size={48} />
          ) : (
            <div className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xl">
              {getInitials(room.name)}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold truncate">{room.name}</h3>
          <span className="text-xs text-gray-500">
            {room.lastMessage.createdAt ? new Date(room.lastMessage.createdAt).toLocaleTimeString() : ''}
          </span>
        </div>
        <p className="text-sm text-gray-600 truncate">
          {room.lastMessage.content || ''}
        </p>
      </div>
    </div>
  );
};
