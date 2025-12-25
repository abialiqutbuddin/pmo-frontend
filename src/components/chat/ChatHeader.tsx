import React, { useEffect, useMemo, useState } from 'react';
import { UserAvatar } from '../ui/UserAvatar';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { Plus } from 'lucide-react';
import { SideDrawer } from '../ui/SideDrawer';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useContextStore } from '../../store/contextStore';
import { eventsService } from '../../services/events';
import { chatService } from '../../services/chat';

interface ChatHeaderProps {
  roomId: string;
  roomName: string;
  isGroup?: boolean;
  isSystemGroup?: boolean;
}

const EMPTY_PARTICIPANTS: Record<string, any> = Object.freeze({});

export const ChatHeader: React.FC<ChatHeaderProps> = ({ roomId, roomName, isGroup, isSystemGroup }) => {
  // Avoid returning a new object from the selector (which triggers useSyncExternalStore warnings)
  const partMap = useChatStore((s) => s.participants[roomId] ?? EMPTY_PARTICIPANTS);
  const me = useAuthStore((s) => s.currentUser);
  const loadParticipants = useChatStore((s) => s.loadParticipants);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const { currentEventId } = useContextStore();

  const [showMembers, setShowMembers] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ open: boolean; userId?: string; name?: string; isLeave?: boolean }>(
    { open: false }
  );
  const [q, setQ] = useState('');
  const [candidates, setCandidates] = useState<{ userId: string; fullName?: string; email?: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const avatars = useMemo(() => {
    const vals = Object.values(partMap) as any[];
    if (!isGroup) {
      const other = vals.find((u) => u.id !== me?.id);
      return other ? [other] : [];
    }
    return vals.slice(0, 5);
  }, [partMap, me?.id, isGroup]);

  const extraCount = Math.max(0, Object.keys(partMap).length - avatars.length);

  // System groups don't allow manual member management
  const canAdd = useMemo(() => {
    if (!isGroup || isSystemGroup) return false;
    const mine = (partMap as any)[me?.id || ''];
    return !!(mine && mine.role === 'OWNER');
  }, [isGroup, isSystemGroup, partMap, me?.id]);

  const amParticipant = useMemo(() => {
    if (!isGroup) return true; // DMs always have me
    return !!(partMap as any)[me?.id || ''];
  }, [isGroup, partMap, me?.id]);

  useEffect(() => {
    if (!showMembers) return;
    if (!currentEventId) return;
    if (!canAdd) return; // only load candidates if owner can add
    setLoading(true);
    eventsService.members
      .list(currentEventId)
      .then((rows: any[]) => {
        const existing = new Set(Object.keys(partMap));
        const selfId = me?.id;
        const filtered = (rows || [])
          .filter((r) => r.userId !== selfId && !existing.has(r.userId))
          .map((r) => ({ userId: r.userId, fullName: r.user?.fullName, email: r.user?.email }));
        setCandidates(filtered);
      })
      .finally(() => setLoading(false));
  }, [showMembers, currentEventId, partMap, me?.id, canAdd]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return candidates;
    return candidates.filter((c) => (c.fullName || c.email || '').toLowerCase().includes(term));
  }, [q, candidates]);

  return (
    <div className="flex items-center p-3 border-b border-gray-200 bg-gray-100">
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
      {/* Right side actions */}
      <div className="ml-auto flex items-center">
        {isGroup && amParticipant && (
          <button
            className="inline-flex items-center bg-gray-700 hover:bg-gray-800 text-white rounded-md px-3 py-1.5 text-sm"
            onClick={() => { setShowMembers(true); loadParticipants(roomId); }}
            title="Members"
          >
            Members
          </button>
        )}
      </div>

      {/* Members drawer */}
      {isGroup && (
        <SideDrawer
          open={showMembers}
          onClose={() => setShowMembers(false)}
          maxWidthClass="max-w-md"
          header={
            <div className="flex items-center justify-between w-full">
              <div className="text-lg font-semibold">Members{Object.values(partMap).length ? ` (${Object.values(partMap).length})` : ''}</div>
            </div>
          }
        >
          <div className="p-4">
            {canAdd && (
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs text-gray-500">Manage group participants</div>
                <button
                  className={"inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium shadow-sm " + (addOpen ? "bg-gray-200 text-gray-800 hover:bg-gray-300" : "bg-blue-600 text-white hover:bg-blue-700")}
                  onClick={() => setAddOpen((v) => !v)}
                  title={addOpen ? 'Hide add panel' : 'Add members'}
                >
                  <Plus size={16} className="mr-1" /> {addOpen ? 'Hide' : 'Add members'}
                </button>
              </div>
            )}
            {/* Add members inline (owner only) */}
            {canAdd && addOpen && (
              <div className="mb-4">
                <div className="text-base font-semibold mb-2">Add Members</div>
                <input
                  className="w-full mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Search by name or email"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {loading ? (
                  <div className="text-sm text-gray-500">Loading…</div>
                ) : (
                  <div className="max-h-56 overflow-y-auto divide-y border rounded">
                    {filtered.map((u) => (
                      <div key={u.userId} className="flex items-center justify-between px-3 py-2">
                        <div className="text-sm min-w-0">
                          <div className="font-medium truncate">{u.fullName || u.email}</div>
                          <div className="text-xs text-gray-500 truncate">{u.email}</div>
                        </div>
                        <button
                          className="inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-1.5 text-xs"
                          onClick={async () => {
                            await chatService.addParticipants(roomId, [u.userId]);
                            await loadParticipants(roomId);
                            await loadMessages(roomId);
                            setCandidates((prev) => prev.filter((x) => x.userId !== u.userId));
                          }}
                        >
                          Add
                        </button>
                      </div>
                    ))}
                    {filtered.length === 0 && (
                      <div className="px-3 py-6 text-center text-sm text-gray-500">No eligible members to add</div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-base font-semibold mb-1">Current Members</div>
              {Object.values(partMap).length === 0 && <div className="text-sm text-gray-500">No members</div>}
              {Object.values(partMap).map((u: any) => (
                <div key={u.id} className="flex items-center justify-between border rounded px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar nameOrEmail={u.fullName || u.email || 'User'} imageUrl={u.profileImage} itsId={u.itsId || undefined} size={28} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{u.fullName || u.email || u.id}</div>
                      <div className="text-xs text-gray-500">{u.role || 'MEMBER'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canAdd && u.id !== me?.id && (
                      <>
                        <select
                          className="text-xs border rounded px-1 py-0.5"
                          value={u.role || 'MEMBER'}
                          onChange={async (e) => {
                            const role = e.target.value as 'MEMBER' | 'OWNER';
                            await chatService.updateParticipant(roomId, u.id, { role });
                            await loadParticipants(roomId);
                          }}
                        >
                          <option value="MEMBER">Member</option>
                          <option value="OWNER">Owner</option>
                        </select>
                        <button
                          className="text-xs text-rose-600 hover:text-rose-700"
                          onClick={() => setConfirm({ open: true, userId: u.id, name: u.fullName || u.email || u.id })}
                        >
                          Remove
                        </button>
                      </>
                    )}
                    {!canAdd && u.id === me?.id && (
                      <button
                        className="text-xs text-rose-600 hover:text-rose-700"
                        onClick={() => setConfirm({ open: true, userId: u.id, name: 'this group', isLeave: true })}
                      >
                        Leave
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SideDrawer>
      )}
      {/* Confirm removal/leave */}
      <ConfirmDialog
        open={confirm.open}
        onCancel={() => setConfirm({ open: false })}
        onConfirm={async () => {
          try {
            if (!confirm.userId) return;
            await chatService.removeParticipant(roomId, confirm.userId);
            await loadParticipants(roomId);
            await loadMessages(roomId);
          } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Failed to update members';
            try { window.alert(msg); } catch { }
          } finally {
            setConfirm({ open: false });
          }
        }}
        title={confirm.isLeave ? 'Leave group?' : 'Remove member?'}
        message={confirm.isLeave ? 'Are you sure you want to leave this group?' : `Remove ${confirm.name} from this group?`}
        confirmText={confirm.isLeave ? 'Leave' : 'Remove'}
        danger
      />
    </div>
  );
};
