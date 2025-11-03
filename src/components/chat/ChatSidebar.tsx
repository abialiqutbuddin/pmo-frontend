import React, { useEffect, useMemo, useState } from 'react';
import { ChatRoom } from '../../types/chat';
import { ChatSidebarItem } from './ChatSidebarItem';
import { Search, ChevronLeft } from 'lucide-react';
import { useContextStore } from '../../store/contextStore';
import { eventsService } from '../../services/events';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { UserAvatar } from '../ui/UserAvatar';

interface ChatSidebarProps {
  rooms: ChatRoom[];
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  rooms,
  activeRoomId,
  onSelectRoom,
}) => {
  const { currentEventId } = useContextStore();
  const { startDirect, createChannel } = useChatStore();
  const [members, setMembers] = useState<{ userId: string; fullName?: string; email?: string; designation?: string }[]>([]);
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [step, setStep] = useState<'pick'|'details'>('pick');
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const meId = useAuthStore((s)=>s.currentUser?.id);

  useEffect(() => {
    if (!currentEventId) return;
    eventsService.members.list(currentEventId).then((rows: any[]) => setMembers((rows || []).map(r => ({ userId: r.userId, fullName: r.user?.fullName, email: r.user?.email, designation: r.user?.designation }))));
  }, [currentEventId]);

  const filtered = useMemo(()=>
    members
      .filter(m => m.userId !== meId)
      .filter(m => (m.fullName || m.email || '').toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a,b)=> (a.fullName||a.email||'').localeCompare(b.fullName||b.email||''))
  ,[members, q, meId]);

  const toggle = (uid: string) => {
    setSelected(prev => prev.includes(uid) ? prev.filter(x=>x!==uid) : [...prev, uid]);
  };

  return (
    <div className="w-full max-w-sm flex-shrink-0 border-r border-gray-200 bg-white flex flex-col relative">
      {/* Header / Search Bar */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold">Chats</h2>
          <button
            className="text-sm text-blue-600 hover:text-blue-700"
            onClick={() => setShowNew(true)}
          >
            New
          </button>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search or start new chat"
            className="w-full pl-10 pr-4 py-2 rounded-full bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={20}
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {rooms.map((room) => (
          <ChatSidebarItem
            key={room.id}
            room={room}
            isActive={room.id === activeRoomId}
            onClick={() => onSelectRoom(room.id)}
          />
        ))}
      </div>

      {/* New Chat Modal (WhatsApp-like) */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setShowNew(false); setSelected([]); setStep('pick'); setGroupName(''); }} />
          <div className="relative z-10 w-full max-w-xl bg-white rounded-2xl shadow-xl p-0 overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center">
              {step === 'details' && (
                <button className="mr-2 text-gray-600 hover:text-gray-800" onClick={()=> setStep('pick')} title="Back">
                  <ChevronLeft size={20} />
                </button>
              )}
              <h3 className="text-lg font-semibold">New chat</h3>
            </div>
            {step === 'pick' && (
              <div className="p-4">
                <div className="relative mb-3">
                  <input
                    type="text"
                    placeholder="Search name"
                    value={q}
                    onChange={(e)=>setQ(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 rounded-md bg-gray-100 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                </div>
                <div className="max-h-[60vh] overflow-auto rounded-lg border divide-y">
                  {filtered.map(m => {
                    const checked = selected.includes(m.userId);
                    return (
                      <label key={m.userId} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" className="shrink-0" checked={checked} onChange={()=>toggle(m.userId)} />
                        <UserAvatar nameOrEmail={m.fullName || m.email || m.userId} size={28} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{m.fullName || m.email}</div>
                          {m.designation && <div className="text-xs text-gray-500 truncate">{m.designation}</div>}
                        </div>
                      </label>
                    );
                  })}
                  {!filtered.length && (
                    <div className="px-3 py-8 text-center text-sm text-gray-500">No members match your search</div>
                  )}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">{selected.length ? `${selected.length} selected` : 'Select members to start'}</div>
                  <button
                    className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    disabled={!selected.length}
                    onClick={async ()=>{
                      if (!currentEventId) return;
                      if (selected.length === 1) {
                        const id = await startDirect(currentEventId, selected[0]);
                        if (id) { onSelectRoom(id); setShowNew(false); setSelected([]); setStep('pick'); setGroupName(''); }
                      } else {
                        setStep('details');
                      }
                    }}
                  >
                    {selected.length <= 1 ? 'Start' : 'Next'}
                  </button>
                </div>
              </div>
            )}
            {step === 'details' && (
              <div className="p-4">
                <div className="text-sm text-gray-600 mb-2">Group details</div>
                <input
                  className="w-full mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Group name"
                  value={groupName}
                  onChange={(e)=> setGroupName(e.target.value)}
                />
                <div className="text-xs text-gray-500 mb-2">Members</div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {members.filter(m=> selected.includes(m.userId)).map(m => (
                    <span key={m.userId} className="inline-flex items-center bg-gray-100 border rounded-full px-2 py-0.5 text-xs">
                      {m.fullName || m.email}
                    </span>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button className="px-3 py-2 text-sm rounded border" onClick={()=> setStep('pick')}>Back</button>
                  <button
                    className="px-3 py-2 text-sm rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    disabled={!groupName.trim() || selected.length < 2}
                    onClick={async ()=>{
                      if (!currentEventId) return;
                      const id = await createChannel({ eventId: currentEventId, title: groupName.trim(), participantUserIds: selected });
                      if (id) { onSelectRoom(id); setShowNew(false); setSelected([]); setStep('pick'); setGroupName(''); }
                    }}
                  >
                    Create group
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
