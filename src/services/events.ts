// frontend/src/services/events.ts
import { api } from '../api';
import type { EventSummary } from '../types/events';

export interface CreateEventDto {
  name: string;
  startsAt?: string;
  endsAt?: string;
}

export interface EventMember {
  userId: string;
  user?: { id: string; fullName?: string; email?: string };
}

export const eventsService = {
  list: () => api.get<EventSummary[]>('/events'),
  create: (dto: CreateEventDto) => api.post<EventSummary>('/events', dto),
  members: {
    list: (() => {
      const TTL = 2 * 60 * 1000;
      const cache = new Map<string, { ts: number; data: EventMember[] }>();
      return async (eventId: string, opts?: { force?: boolean }) => {
        const now = Date.now();
        const cached = cache.get(eventId);
        if (!opts?.force && cached && now - cached.ts < TTL) return cached.data;
        const data = (await api.get<EventMember[]>(`/events/${eventId}/members`)) || [];
        cache.set(eventId, { ts: now, data });
        return data;
      };
    })(),
  },
};
