import { io, Socket } from 'socket.io-client';
import { BASE_URL } from '../api';

let socket: Socket | null = null;

export function connectChatSocket(token: string, eventId: string): Socket {
  if (socket && socket.connected) return socket;
  socket = io(`${BASE_URL}/ws`, {
    auth: { token, eventId },
    transports: ['websocket'],
  });
  return socket;
}

export function getChatSocket(): Socket | null {
  return socket;
}

export function disconnectChatSocket() {
  try { socket?.disconnect(); } catch {}
  socket = null;
}

