// frontend/src/lib/realtime.ts
// Minimal placeholder for wiring real-time updates later (SSE/WebSocket)
import { bus } from './eventBus';

let es: EventSource | null = null;

export function connectRealtime(baseUrl: string, accessToken?: string | null) {
  try {
    if (es) es.close();
  } catch {}
  // Example SSE endpoint: `${baseUrl}/events/stream`
  try {
    const url = new URL('/events/stream', baseUrl);
    if (accessToken) url.searchParams.set('authorization', `Bearer ${accessToken}`);
    es = new EventSource(url.toString());
    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        // normalize to our local bus topics
        if (msg.type === 'task.changed') {
          bus.emit('tasks:changed', { eventId: msg.eventId, departmentId: msg.departmentId });
        }
        if (msg.type === 'chat.message') {
          bus.emit('chat:message', msg);
        }
      } catch {}
    };
    es.onerror = () => {
      // simple retry
      setTimeout(() => connectRealtime(baseUrl, accessToken), 5000);
    };
  } catch {}
}

export function disconnectRealtime() {
  try { es?.close(); } catch {}
  es = null;
}

