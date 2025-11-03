import React, { useMemo, useRef } from 'react';
import { ChatMessage } from '../../types/chat';
import { useAuthStore } from '../../store/authStore';
import { CheckCheck, Paperclip, X } from 'lucide-react';
import clsx from 'clsx';
import { useContextStore } from '../../store/contextStore';
import { BASE_URL } from '../../api';
import { useState } from 'react';
import { UserAvatar } from '../ui/UserAvatar';
import { useChatStore } from '../../store/chatStore';
import { chatService } from '../../services/chat';
import { isDmRead, isGroupAllRead } from '../../lib/chatRead';
import { ReadReceiptsPopover } from './ReadReceiptsPopover';

interface MessageProps {
  message: ChatMessage;
  showSender?: boolean; // show sender name only when true (e.g., group chats)
}

export const Message: React.FC<MessageProps> = ({ message, showSender }) => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isOwnMessage = message.sender.id === currentUser?.id;
  const { currentEventId } = useContextStore();
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);
  const conversations = useChatStore((s) => s.conversations);
  const participants = useChatStore((s) => s.participants);

  const isDirect = useMemo(() => {
    const c = conversations.find((x) => x.id === message.roomId);
    return c ? c.kind === 'DIRECT' : false;
  }, [conversations, message.roomId]);

  const dmRead = useMemo(() => (
    !isOwnMessage || !isDirect ? false : isDmRead(participants[message.roomId], currentUser?.id, (message as any).createdAtISO || message.createdAt)
  ), [isOwnMessage, isDirect, participants, message.roomId, (message as any).createdAtISO, message.createdAt, currentUser?.id]);

  const groupAllRead = useMemo(() => (
    !isOwnMessage || isDirect ? false : isGroupAllRead(participants[message.roomId], currentUser?.id, (message as any).createdAtISO || message.createdAt)
  ), [isOwnMessage, isDirect, participants, message.roomId, (message as any).createdAtISO, message.createdAt, currentUser?.id]);

  // Readers hover (group): cache per messageId with TTL
  const [showReaders, setShowReaders] = useState(false);
  const [readersLoading, setReadersLoading] = useState(false);
  const [readers, setReaders] = useState<{ userId: string; fullName?: string; profileImage?: string; itsId?: string | null }[] | null>(null);
  const [unreaders, setUnreaders] = useState<{ userId: string; fullName?: string; profileImage?: string; itsId?: string | null }[] | null>(null);
  const cacheRef = useRef<{ ts: number; data: { readers: any[]; unreaders: any[] } } | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const onHover = () => {
    if (!isOwnMessage) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(async () => {
      setShowReaders(true);
      // Use cached within 60s
      const now = Date.now();
      if (cacheRef.current && now - cacheRef.current.ts < 60000) {
        setReaders(cacheRef.current.data.readers);
        setUnreaders(cacheRef.current.data.unreaders);
        return;
      }
      try {
        setReadersLoading(true);
        const rs = await chatService.readers(message.id);
        // build participants info map for avatars/names
        let map = participants[message.roomId] || {} as any;
        if (!Object.keys(map).length) {
          try {
            const rows2: any[] = await chatService.listParticipants(message.roomId);
            const m2: any = {};
            rows2.forEach((r: any) => {
              m2[r.userId] = { id: r.user?.id || r.userId, fullName: r.user?.fullName, email: r.user?.email, profileImage: r.user?.profileImage, itsId: r.user?.itsId };
            });
            map = m2;
          } catch {}
        }
        const infoMap: Record<string, { name: string; profileImage?: string; itsId?: string | null }> = {};
        Object.values(map).forEach((u: any) => { infoMap[u.id] = { name: (u.fullName || u.email || u.id) as string, profileImage: u.profileImage, itsId: u.itsId }; });
        const meId = currentUser?.id;
        const readerIds = new Set((rs || []).map((r: any) => r.userId));
        const readersFmt = (rs || []).filter((r: any) => r.userId !== meId).map((r: any) => ({ userId: r.userId, fullName: r.fullName || infoMap[r.userId]?.name || r.userId, profileImage: infoMap[r.userId]?.profileImage, itsId: infoMap[r.userId]?.itsId }));
        const unreadFmt: any[] = [];
        Object.values(map).forEach((u: any) => { if (u.id !== meId && !readerIds.has(u.id)) unreadFmt.push({ userId: u.id, fullName: infoMap[u.id]?.name, profileImage: infoMap[u.id]?.profileImage, itsId: infoMap[u.id]?.itsId }); });
        cacheRef.current = { ts: now, data: { readers: readersFmt, unreaders: unreadFmt } };
        setReaders(readersFmt);
        setUnreaders(unreadFmt);
      } finally {
        setReadersLoading(false);
      }
    }, 200); // debounce hover
  };
  const onLeave = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setShowReaders(false);
  };

  const isSystemEvent = useMemo(() => !!(message as any).isSystem, [message]);

  const attachmentUrl = (att: any) => {
    if (att?.objectKey) {
      return `${BASE_URL}/${(att.objectKey as string).split('/').map(encodeURIComponent).join('/')}`;
    }
    if (currentEventId && att?.id) {
      return `${BASE_URL}/events/${currentEventId}/attachments/${att.id}`;
    }
    return '#';
  };

  const isImage = (m?: string) => !!m && m.startsWith('image/');

  if (isSystemEvent) {
    return (
      <div className="flex justify-center my-1">
        <div className="px-3 py-1 rounded bg-gray-200 text-gray-700 text-xs text-center">
          <span className="font-medium">{message.sender.name}</span> {message.content}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className={clsx('flex items-end', isOwnMessage ? 'justify-end' : 'justify-start')}>
      {/* Avatar on group chats for non-self messages */}
      {showSender && !isOwnMessage && (
        <div className="mr-2 self-end">
          <UserAvatar nameOrEmail={message.sender.name} imageUrl={message.sender.avatarUrl} itsId={message.sender.itsId || undefined} size={28} />
        </div>
      )}
      <div
        className={clsx(
          'relative rounded-lg p-3 shadow-sm max-w-xs lg:max-w-md',
          isOwnMessage ? 'bg-emerald-100' : 'bg-white',
        )}
      >
          <>
        {/* Sender name (only when explicitly enabled, e.g., groups) */}
        {showSender && !isOwnMessage && (
          <div className="text-xs font-bold text-blue-600 mb-1">
            {message.sender.name}
          </div>
        )}

        {/* Message Content */}
        {message.content && <p className="text-sm whitespace-pre-wrap mb-1">{message.content}</p>}

        {/* Attachments */}
        {Array.isArray((message as any).attachments) && (message as any).attachments.length > 0 && (
          <div className="mt-1 space-y-2">
            {(message as any).attachments.map((a: any, idx: number) => {
              const url = attachmentUrl(a);
              if (isImage(a.mimeType)) {
                return (
                  <ImageAttachment key={`${a.id}-${idx}`} src={url} name={a.originalName} uploading={a.uploading} progress={a.progress} onClick={() => setLightbox({ src: url, name: a.originalName })} />
                );
              }
              return (
                <div className="inline-flex items-center px-2 py-1 rounded bg-white/70 border text-sm text-gray-700">
                  <Paperclip size={16} className="mr-1" />
                  <a
                    key={`${a.id}-${idx}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate max-w-[220px] hover:underline"
                    title={a.originalName}
                  >
                    {a.originalName || 'Attachment'}
                  </a>
                  {a.uploading && (
                    <span className="ml-2 text-xs text-gray-500">{typeof a.progress === 'number' ? `${a.progress}%` : 'Uploading…'}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Timestamp and Read Receipt */}
        <div className="relative flex justify-end items-center mt-1" onMouseEnter={onHover} onMouseLeave={onLeave}>
          <span className="text-xs text-gray-500 mr-1">
            {message.createdAt}
          </span>
          {isOwnMessage && (
            (() => {
              const atts: any[] = (message as any).attachments || [];
              const uploading = atts.some((a) => a.uploading || (typeof a.progress === 'number' && a.progress < 100));
              if (uploading) {
                return <span className="inline-block w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />;
              }
              return (
                <CheckCheck
                  size={16}
                  className={clsx(isDirect ? (dmRead ? 'text-blue-500' : 'text-gray-400') : (groupAllRead ? 'text-blue-500' : 'text-gray-400'))}
                  title={isDirect ? (dmRead ? 'Read' : 'Sent') : (groupAllRead ? 'All read' : 'Not all read')}
                />
              );
            })()
          )}
          {/* Readers tooltip (group or any) */}
          <ReadReceiptsPopover
            open={isOwnMessage && showReaders && !isDirect}
            loading={readersLoading}
            readers={readers}
            unreaders={unreaders}
            meId={currentUser?.id}
            containerClassName="absolute bottom-full right-0 mb-2"
            arrow="bottom-right"
          />
        </div>
          </>
      </div>
    </div>
    {lightbox && (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 bg-black/70" onClick={() => setLightbox(null)} />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="relative max-w-5xl max-h-[90vh]">
            <img src={lightbox.src} alt={lightbox.name} className="max-w-full max-h-[90vh] rounded" />
            <button className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded" onClick={() => setLightbox(null)}>
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

const ImageAttachment: React.FC<{ src: string; name: string; uploading?: boolean; progress?: number; onClick?: () => void }> = ({ src, name, uploading, progress, onClick }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative inline-block">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded overflow-hidden">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={name}
        className={clsx('max-w-[260px] max-h-[240px] rounded cursor-pointer', loaded ? 'opacity-100' : 'opacity-0')}
        onLoad={() => setLoaded(true)}
        onClick={onClick}
      />
      {uploading && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded">
          <div className="text-white text-xs">Uploading{typeof progress === 'number' ? ` ${progress}%` : '…'}</div>
        </div>
      )}
    </div>
  );
};
