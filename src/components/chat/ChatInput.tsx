import React, { useRef, useState } from 'react';
import { Smile, Paperclip, Mic, Send, Image as ImageIcon, File as FileIcon, X } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

interface ChatInputProps {
  roomId: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({ roomId }) => {
  const [text, setText] = useState('');
  const send = useChatStore((s) => s.send);
  const sendAttachment = useChatStore((s) => s.sendAttachment);
  const sendAttachmentsBatch = useChatStore((s) => s.sendAttachmentsBatch);
  const imageRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const handleSend = () => {
    if (text.trim() === '') return;
    void send(roomId, text.trim());
    setText('');
  };

  return (
    <div className="flex items-center p-3 bg-gray-100 border-t border-gray-200">
      {/* Emoji & Attach Buttons */}
      <button className="p-2 text-gray-500 hover:text-gray-700">
        <Smile size={24} />
      </button>
      <div className="relative">
        <button className="p-2 text-gray-500 hover:text-gray-700" onClick={() => setShowPicker((v) => !v)}>
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
      {/* Photos input */}
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length > 1) void sendAttachmentsBatch(roomId, files);
          else if (files[0]) void sendAttachment(roomId, files[0]);
          if (imageRef.current) imageRef.current.value = '';
        }}
      />
      {/* Files input */}
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length > 1) void sendAttachmentsBatch(roomId, files);
          else if (files[0]) void sendAttachment(roomId, files[0]);
          if (fileRef.current) fileRef.current.value = '';
        }}
      />

      {/* Text Input */}
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        placeholder="Type a message"
        className="flex-1 mx-2 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Send or Mic Button */}
      <button
        onClick={handleSend}
        className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600"
      >
        {text ? <Send size={24} /> : <Mic size={24} />}
      </button>
    </div>
  );
};
