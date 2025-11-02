// A simplified version based on your app's needs
export interface ChatUser {
  id: string;
  name: string;
  avatarUrl?: string;
  itsId?: string | null;
}

export interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  sender: ChatUser;
  roomId: string;
  attachments?: { id: string; originalName: string; mimeType: string; objectKey?: string; size?: number }[];
}

export interface ChatRoom {
  id: string;
  name: string; // e.g., "#dept-venueprep" or "John Doe"
  isGroup: boolean;
  members: ChatUser[];
  lastMessage: ChatMessage;
}
