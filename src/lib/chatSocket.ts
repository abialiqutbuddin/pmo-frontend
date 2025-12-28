import { io, Socket } from 'socket.io-client';
import { BASE_URL } from '../api';

let socket: Socket | null = null;
let currentToken: string | null = null;

export function connectChatSocket(token: string, eventId: string): Socket {
  if (socket && socket.connected && currentToken === token) return socket;

  // If socket exists but token changed or disconnected, ensure clean start
  if (socket) {
    try { socket.disconnect(); } catch { }
    socket = null;
  }

  currentToken = token;
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
  try { socket?.disconnect(); } catch { }
  socket = null;
  currentToken = null;
}

