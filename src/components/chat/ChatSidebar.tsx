import React, { useEffect, useState } from 'react';
import { ChatRoom } from '../../types/chat';
import { ChatSidebarItem } from './ChatSidebarItem';
import { Search } from 'lucide-react';
import { useContextStore } from '../../store/contextStore';
import { eventsService } from '../../services/events';
import { useChatStore } from '../../store/chatStore';

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

  useEffect(() => {
    if (!currentEventId) return;
    eventsService.members.list(currentEventId).then((rows: any[]) => setMembers((rows || []).map(r => ({ userId: r.userId, fullName: r.user?.fullName, email: r.user?.email, designation: r.user?.designation }))));
  }, [currentEventId]);

  const filtered = members.filter(m => (m.fullName || m.email || '').toLowerCase().includes(q.trim().toLowerCase()));

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

      {/* New Chat Modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowNew(false)} />
          <div className="relative z-10 w-full max-w-lg bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Start new chat</h3>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowNew(false)}>Close</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs text-gray-600 mb-1">Direct message</div>
                <input className="w-full mb-2 rounded border px-2 py-1 text-sm" placeholder="Search member" value={q} onChange={(e)=>setQ(e.target.value)} />
                <div className="max-h-48 overflow-auto border rounded">
                  {filtered.slice(0,40).map(m => (
                    <button key={m.userId} onClick={async ()=>{
                      if (!currentEventId) return;
                      const id = await startDirect(currentEventId, m.userId);
                      if (id) { onSelectRoom(id); setShowNew(false); }
                    }} className="block text-left w-full text-sm px-2 py-2 hover:bg-gray-50 border-b last:border-b-0">
                      <div className="flex flex-col">
                        <span className="font-medium">{m.fullName || m.email}</span>
                        <span className="text-xs text-gray-500">{m.designation || m.email}</span>
                      </div>
                    </button>
                  ))}
                  {!filtered.length && <div className="p-2 text-xs text-gray-500">No matches</div>}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Create channel</div>
                <CreateChannelForm members={members} onCreate={async (title, ids)=>{
                  if (!currentEventId) return;
                  const id = await createChannel({ eventId: currentEventId, title, participantUserIds: ids });
                  if (id) { onSelectRoom(id); setShowNew(false); }
                }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CreateChannelForm: React.FC<{ members: { userId: string; fullName?: string; email?: string }[]; onCreate: (title: string, ids: string[]) => void }>= ({ members, onCreate }) => {
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div>
      <input className="w-full mb-2 rounded border px-2 py-1 text-sm" placeholder="Channel name" value={title} onChange={(e)=>setTitle(e.target.value)} />
      <div className="max-h-32 overflow-auto border rounded p-1 mb-2">
        {members.slice(0,50).map(m => {
          const id = m.userId;
          const checked = selected.includes(id);
          return (
            <label key={id} className="block text-sm">
              <input type="checkbox" className="mr-2" checked={checked} onChange={(e)=> setSelected(prev => e.target.checked ? [...prev, id] : prev.filter(x=>x!==id))} />
              {m.fullName || m.email}
            </label>
          );
        })}
      </div>
      <button className="w-full bg-blue-600 text-white text-sm rounded px-2 py-1" onClick={()=> onCreate(title.trim(), selected)}>Create</button>
    </div>
  );
};
