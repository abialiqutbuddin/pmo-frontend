import React, { useRef, useState, useEffect } from 'react';
import { Smile, Paperclip, Mic, Send, Image as ImageIcon, File as FileIcon, X } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { eventsService } from '../../services/events';
import { tasksService } from '../../services/tasks';
import { MentionList } from '../tasks/MentionList';
import { TaskMentionList } from './TaskMentionList';
import { useContextStore } from '../../store/contextStore';

interface ChatInputProps {
  roomId: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({ roomId }) => {
  const [text, setText] = useState('');
  const send = useChatStore((s) => s.send);
  const sendAttachment = useChatStore((s) => s.sendAttachment);
  const sendAttachmentsBatch = useChatStore((s) => s.sendAttachmentsBatch);
  const EMPTY_PARTICIPANTS: Record<string, any> = Object.freeze({});
  const participants = useChatStore((s) => s.participants[roomId] ?? EMPTY_PARTICIPANTS);
  const me = useAuthStore((s) => s.currentUser);
  const amParticipant = me?.id ? !!(participants as any)[me.id] : true;
  const imageRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Mentions State
  const { currentEventId } = useContextStore();
  const [members, setMembers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [mentionMode, setMentionMode] = useState<'user' | 'task' | null>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Store mappings of Display Name -> ID/Metadata to transform on send
  const pendingMentions = useRef<Record<string, { type: 'user' | 'task'; id: string }>>({});

  // Load members on mount or when event changes
  useEffect(() => {
    if (currentEventId) {
      eventsService.members.list(currentEventId).then(list => {
        setMembers(list.map(m => m.user));
      }).catch(console.error);
    }
  }, [currentEventId]);

  // Search tasks when query changes and mode is task
  useEffect(() => {
    if (mentionMode === 'task' && currentEventId) {
      const q = query.toLowerCase();
      if (q.length > 0) { // Search if typed something
        tasksService.searchEventTasks(currentEventId, q).then(res => setTasks(res));
      } else {
        setTasks([]);
      }
    }
  }, [mentionMode, query, currentEventId]);

  const filteredMembers = React.useMemo(() => {
    if (mentionMode !== 'user') return [];
    const q = query.toLowerCase();
    return members.filter(u =>
      (u.fullName?.toLowerCase() || '').includes(q) ||
      (u.email?.toLowerCase() || '').includes(q)
    ).slice(0, 10); // cap results
  }, [members, mentionMode, query]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setText(newVal);

    // Detect cursor position and backward
    const cursor = e.target.selectionStart;
    const textUntilCursor = newVal.substring(0, cursor);
    const lastAt = textUntilCursor.lastIndexOf('@');
    const lastHash = textUntilCursor.lastIndexOf('#');

    const lastTrigger = Math.max(lastAt, lastHash);

    if (lastTrigger !== -1) {
      const isAt = lastAt === lastTrigger;
      // Check validity: Start of line or preceded by space
      const prevChar = lastTrigger > 0 ? textUntilCursor[lastTrigger - 1] : ' ';
      if (/\s/.test(prevChar)) {
        const q = textUntilCursor.substring(lastTrigger + 1);
        // Check if q has spaces (allow spaces for names, but maybe limit length or stop at newline)
        if (!q.includes('\n')) {
          setMentionMode(isAt ? 'user' : 'task');
          setQuery(q);
          setSelectedIndex(0);
          return;
        }
      }
    }
    setMentionMode(null);
  };

  const insertMention = (display: string, type: 'user' | 'task', id: string) => {
    const cursor = (document.querySelector('#chat-textarea') as HTMLTextAreaElement)?.selectionStart || text.length;
    const textUntilCursor = text.substring(0, cursor);
    const lastAt = textUntilCursor.lastIndexOf('@');
    const lastHash = textUntilCursor.lastIndexOf('#');
    const triggerIdx = Math.max(lastAt, lastHash);

    if (triggerIdx !== -1) {
      const before = text.substring(0, triggerIdx);
      const after = text.substring(cursor);
      const triggerChar = type === 'user' ? '@' : '#';
      const newText = before + triggerChar + display + ' ' + after;

      // Store mapping
      pendingMentions.current[display] = { type, id };

      setText(newText);
      setMentionMode(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionMode) {
      const list = mentionMode === 'user' ? filteredMembers : tasks;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % list.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + list.length) % list.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (list[selectedIndex]) {
          if (mentionMode === 'user') {
            const u = list[selectedIndex];
            insertMention(u.fullName, 'user', u.id);
          } else {
            const t = list[selectedIndex];
            insertMention(t.title, 'task', t.id);
          }
        } else {
          setMentionMode(null); // Cancel if no selection
        }
      } else if (e.key === 'Escape') {
        setMentionMode(null);
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  const handleSend = () => {
    if (text.trim() === '') return;

    // Transform pending mentions to rich syntax: @Name -> @[Name](user:ID)
    let finalBody = text;
    Object.entries(pendingMentions.current).forEach(([name, meta]) => {
      const trigger = meta.type === 'user' ? '@' : '#';
      // Replace all occurrences of @Name with @[Name](user:ID)
      // Use word boundary to avoid partial matches if possible, but names have spaces.
      // Simple replace might be risky for "Ali" vs "Ali Ahmed".
      // But for now, let's assume direct replacement.
      const search = `${trigger}${name}`;
      const replace = `${trigger}[${name}](${meta.type}:${meta.id})`;
      finalBody = finalBody.replaceAll(search, replace);
    });

    void send(roomId, finalBody.trim());
    setText('');
    setMentionMode(null);
    pendingMentions.current = {};
  };

  return (
    <div className="flex items-end p-3 bg-gray-100 border-t border-gray-200 relative">
      {/* Mentions Dropdown */}
      {mentionMode === 'user' && filteredMembers.length > 0 && (
        <MentionList users={filteredMembers} selectedIndex={selectedIndex} onSelect={(u) => insertMention(u.fullName, 'user', u.id)} />
      )}
      {mentionMode === 'task' && tasks.length > 0 && (
        <TaskMentionList tasks={tasks} selectedIndex={selectedIndex} onSelect={(t) => insertMention(t.title, 'task', t.id)} />
      )}

      {/* Emoji & Attach Buttons */}
      <button className="p-2 text-gray-500 hover:text-gray-700 mb-1" disabled={!amParticipant} title={amParticipant ? '' : 'You are no longer a member of this group'}>
        <Smile size={24} />
      </button>
      <div className="relative mb-1">
        <button className="p-2 text-gray-500 hover:text-gray-700" onClick={() => setShowPicker((v) => !v)} disabled={!amParticipant} title={amParticipant ? '' : 'You are no longer a member of this group'}>
          <Paperclip size={24} />
        </button>
        {showPicker && (
          <div className="absolute bottom-10 left-0 bg-white border shadow rounded-md w-44 z-10">
            <button className="w-full flex items-center px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setShowPicker(false); imageRef.current?.click(); }}>
              <ImageIcon size={16} className="mr-2 text-emerald-600" /> Photos
            </button>
            <button className="w-full flex items-center px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setShowPicker(false); fileRef.current?.click(); }}>
              <FileIcon size={16} className="mr-2 text-blue-600" /> Files
            </button>
          </div>
        )}
      </div>
      {/* Hidden inputs ... reuse */}
      <input ref={imageRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (files.length > 1) void sendAttachmentsBatch(roomId, files);
        else if (files[0]) void sendAttachment(roomId, files[0]);
        if (imageRef.current) imageRef.current.value = '';
      }} />
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (files.length > 1) void sendAttachmentsBatch(roomId, files);
        else if (files[0]) void sendAttachment(roomId, files[0]);
        if (fileRef.current) fileRef.current.value = '';
      }} />

      {/* Text Input */}
      <div className="flex-1 mx-2 relative">
        <textarea
          id="chat-textarea"
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Type a message (@user or #task)"
          className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 resize-none min-h-[44px] max-h-32"
          disabled={!amParticipant}
          rows={1}
          style={{ height: 'auto', minHeight: '44px' }}
        // Auto-resize could be added via ref/useEffect
        />
      </div>

      {/* Send or Mic Button */}
      <button
        onClick={handleSend}
        className="p-2 mb-1 rounded-full bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
        disabled={!amParticipant}
      >
        {text ? <Send size={24} /> : <Mic size={24} />}
      </button>
    </div>
  );
};
