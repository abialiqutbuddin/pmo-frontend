import React, { useMemo } from 'react';
import { UserAvatar } from '../ui/UserAvatar';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

interface ChatHeaderProps {
  roomId: string;
  roomName: string;
  isGroup?: boolean;
}

const EMPTY_PARTICIPANTS: Record<string, any> = Object.freeze({});

export const ChatHeader: React.FC<ChatHeaderProps> = ({ roomId, roomName, isGroup }) => {
  // Avoid returning a new object from the selector (which triggers useSyncExternalStore warnings)
  const partMap = useChatStore((s) => s.participants[roomId] ?? EMPTY_PARTICIPANTS);
  const me = useAuthStore((s) => s.currentUser);

  const avatars = useMemo(() => {
    const vals = Object.values(partMap) as any[];
    if (!isGroup) {
      const other = vals.find((u) => u.id !== me?.id);
      return other ? [other] : [];
    }
    return vals.slice(0, 5);
  }, [partMap, me?.id, isGroup]);

  const extraCount = Math.max(0, Object.keys(partMap).length - avatars.length);

  return (
    <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-100">
      {/* Left: avatars + name */}
      <div className="flex items-center min-w-0">
        {isGroup ? (
          <div className="flex -space-x-[7px] mr-3">{/* ~25% overlap for 28px avatars */}
            {avatars.map((u) => (
              <div key={u.id} className="rounded-full ring-1 ring-white">
                <UserAvatar nameOrEmail={u.fullName || u.email || 'User'} imageUrl={u.profileImage} itsId={u.itsId || undefined} size={28} />
              </div>
            ))}
            {extraCount > 0 && (
              <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 text-xs flex items-center justify-center ring-1 ring-white">
                +{extraCount}
              </div>
            )}
          </div>
        ) : (
          <div className="mr-3">
            {avatars[0] ? (
              <UserAvatar nameOrEmail={avatars[0].fullName || avatars[0].email || 'User'} imageUrl={avatars[0].profileImage} itsId={avatars[0].itsId || undefined} size={36} />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                {roomName.substring(0, 2)}
              </div>
            )}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-semibold truncate max-w-[60vw]">{roomName}</h2>
          {isGroup ? <span className="text-xs text-gray-500">Group</span> : null}
        </div>
      </div>
      {/* Right side actions hidden */}
    </div>
  );
};
