import React, { useMemo, useRef, useState } from 'react';
import { ChatRoom } from '../../types/chat';
import { UserAvatar } from '../ui/UserAvatar';
import clsx from 'clsx';
import { CheckCheck, Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { chatService } from '../../services/chat';
import { isDmRead, isGroupAllRead } from '../../lib/chatRead';
import { ReadReceiptsPopover } from './ReadReceiptsPopover';

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
  const me = useAuthStore((s) => s.currentUser);
  const participants = useChatStore((s) => s.participants);
  const isMine = room.lastMessage?.sender?.id && room.lastMessage.sender.id === me?.id;

  // DM read state from participants map
  const dmRead = useMemo(() => {
    if (!isMine || room.isGroup) return false;
    const serverAllRead = (room as any).lastMessageAllRead;
    const computed = isDmRead(participants[room.id], me?.id, room.lastMessage?.createdAt);
    return !!(serverAllRead || computed);
  }, [participants, room.id, room.isGroup, room.lastMessage?.createdAt, isMine, me?.id, (room as any).lastMessageAllRead]);

  // Group read state: all read if every participant (excluding me) lastReadAt >= last msg time
  const groupAllRead = useMemo(() => {
    if (!isMine || !room.isGroup) return false;
    const serverAllRead = (room as any).lastMessageAllRead;
    const computed = isGroupAllRead(participants[room.id], me?.id, room.lastMessage?.createdAt);
    return !!(serverAllRead || computed);
  }, [participants, room.id, room.isGroup, room.lastMessage?.createdAt, isMine, me?.id, (room as any).lastMessageAllRead]);

  // Hover tooltip for group receipts
  const [showTip, setShowTip] = useState(false);
  const [loading, setLoading] = useState(false);
  const [readers, setReaders] = useState<{ userId: string; fullName?: string; profileImage?: string; itsId?: string | null }[] | null>(null);
  const [unreaders, setUnreaders] = useState<{ userId: string; fullName?: string; profileImage?: string; itsId?: string | null }[] | null>(null);
  const cacheRef = useRef<{ ts: number; data: { readers: any[]; unreaders: any[] } } | null>(null);
  const hoverDebounce = useRef<number | null>(null);
  const onHover = () => {
    if (!isMine || !room.isGroup) return;
    if (hoverDebounce.current) window.clearTimeout(hoverDebounce.current);
    hoverDebounce.current = window.setTimeout(async () => {
      setShowTip(true);
      const now = Date.now();
      if (cacheRef.current && now - cacheRef.current.ts < 60000) {
        setReaders(cacheRef.current.data.readers);
        setUnreaders(cacheRef.current.data.unreaders);
        return;
      }
      try {
        setLoading(true);
        const rs = room.lastMessage?.id ? await chatService.readers(room.lastMessage.id) : [];
        // ensure we have participant names; fetch if missing
        let map = participants[room.id] || {};
        if (!Object.keys(map).length) {
          try {
            const rows = (await chatService.listParticipants(room.id)) as any[];
            const m2: any = {};
            rows.forEach((r: any) => {
              m2[r.userId] = {
                id: r.user?.id || r.userId,
                fullName: r.user?.fullName,
                email: r.user?.email,
                profileImage: r.user?.profileImage,
                itsId: r.user?.itsId,
              };
            });
            map = m2;
          } catch { }
        }
        const infoMap: Record<string, { name: string; profileImage?: string; itsId?: string | null }> = {};
        Object.values(map).forEach((u: any) => { infoMap[u.id] = { name: (u.fullName || u.email || u.id) as string, profileImage: u.profileImage, itsId: u.itsId }; });
        let unread: { userId: string; fullName?: string; profileImage?: string; itsId?: string | null }[] = [];
        const readerIds = new Set(rs.map((r: any) => r.userId));
        Object.values(map).forEach((u: any) => {
          if (u.id !== me?.id && !readerIds.has(u.id)) unread.push({ userId: u.id, fullName: infoMap[u.id]?.name, profileImage: infoMap[u.id]?.profileImage, itsId: infoMap[u.id]?.itsId });
        });
        const readersFmt = rs
          .filter((r: any) => r.userId !== me?.id)
          .map((r: any) => ({
            userId: r.userId,
            fullName: r.fullName || infoMap[r.userId]?.name || r.userId,
            profileImage: infoMap[r.userId]?.profileImage,
            itsId: infoMap[r.userId]?.itsId,
          }));
        cacheRef.current = { ts: now, data: { readers: readersFmt, unreaders: unread } };
        setReaders(readersFmt);
        setUnreaders(unread);
      } finally {
        setLoading(false);
      }
    }, 200);
  };
  const onLeave = () => {
    if (hoverDebounce.current) window.clearTimeout(hoverDebounce.current);
    setShowTip(false);
  };
  const unread = (room as any).unread || 0;
  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative flex items-center p-3 cursor-pointer border-b border-gray-100',
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
          <h3 className={clsx('text-sm truncate', unread ? 'font-bold text-gray-900' : 'font-semibold')}>{room.name}</h3>
          <div className="relative flex items-center gap-1">
            <span className="text-xs text-gray-500">
              {room.lastMessage.createdAt ? new Date(room.lastMessage.createdAt).toLocaleTimeString() : ''}
            </span>
            {unread > 0 && (
              <span className="ml-2 bg-blue-600 text-white text-[11px] px-2 py-0.5 rounded-full min-w-[20px] text-center">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 relative" onMouseEnter={onHover} onMouseLeave={onLeave}>
          {isMine && (
            <CheckCheck size={16} className={clsx('shrink-0', room.isGroup ? (groupAllRead ? 'text-blue-500' : 'text-gray-400') : (dmRead ? 'text-blue-500' : 'text-gray-400'))} />
          )}
          <p className={clsx('text-sm truncate flex-1', unread ? 'text-gray-900 font-medium' : 'text-gray-600')}>
            {room.isGroup && room.lastMessage?.sender?.name ? (
              <>
                <span className="text-gray-800 font-medium mr-1">{room.lastMessage.sender.name}:</span>
                <span>{room.lastMessage.content || ''}</span>
              </>
            ) : (
              room.lastMessage.content || ''
            )}
          </p>
          <ReadReceiptsPopover
            open={!!(isMine && room.isGroup && showTip)}
            loading={loading}
            readers={readers}
            unreaders={unreaders}
            meId={me?.id}
            containerClassName="absolute top-full left-0 mt-2 z-50"
            arrow="top-left"
          />
        </div>
      </div>
    </div>
  );
};
