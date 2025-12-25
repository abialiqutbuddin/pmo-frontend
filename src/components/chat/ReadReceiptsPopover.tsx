import React from 'react';
import { UserAvatar } from '../ui/UserAvatar';

export type ReceiptItem = { userId: string; fullName?: string; profileImage?: string; itsId?: string | null };

interface ReadReceiptsPopoverProps {
  open: boolean;
  loading?: boolean;
  readers?: ReceiptItem[] | null;
  unreaders?: ReceiptItem[] | null;
  meId?: string | undefined;
  containerClassName?: string; // absolute positioning provided by parent
  arrow?: 'top-right' | 'bottom-right' | 'top-left' | 'none';
}

export const ReadReceiptsPopover: React.FC<ReadReceiptsPopoverProps> = ({
  open,
  loading,
  readers,
  unreaders,
  meId,
  containerClassName,
  arrow = 'top-right',
}) => {
  if (!open) return null;
  const r = (readers || []).filter((x) => (meId ? x.userId !== meId : true));
  const u = (unreaders || []).filter((x) => (meId ? x.userId !== meId : true));

  return (
    <div className={`z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 text-xs w-72 ${containerClassName || ''}`}>
      {arrow !== 'none' && (
        <div
          className={
            arrow === 'top-right'
              ? 'absolute -top-1 right-6 w-2 h-2 bg-white border-l border-t border-gray-200 rotate-45'
              : arrow === 'bottom-right'
                ? 'absolute -bottom-1 right-6 w-2 h-2 bg-white border-l border-b border-gray-200 rotate-45'
                : arrow === 'top-left'
                  ? 'absolute -top-1 left-2 w-2 h-2 bg-white border-l border-t border-gray-200 rotate-45'
                  : ''
          }
        />
      )}
      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="max-h-56 overflow-y-auto">
          <div className="font-semibold mb-1">Read</div>
          {r && r.length ? (
            r.map((it) => (
              <div key={it.userId} className="flex items-center gap-2 py-0.5">
                <UserAvatar nameOrEmail={it.fullName || it.userId} imageUrl={it.profileImage} itsId={it.itsId || undefined} size={20} />
                <div className="truncate">{it.fullName || it.userId}</div>
              </div>
            ))
          ) : (
            <div className="text-gray-500">No readers yet</div>
          )}
          <div className="font-semibold mt-2 mb-1">Unread</div>
          {u && u.length ? (
            u.map((it) => (
              <div key={it.userId} className="flex items-center gap-2 py-0.5">
                <UserAvatar nameOrEmail={it.fullName || it.userId} imageUrl={it.profileImage} itsId={it.itsId || undefined} size={20} />
                <div className="truncate">{it.fullName || it.userId}</div>
              </div>
            ))
          ) : (
            <div className="text-gray-500">None</div>
          )}
        </div>
      )}
    </div>
  );
};

