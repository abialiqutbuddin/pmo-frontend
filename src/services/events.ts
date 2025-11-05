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
  get: (eventId: string) => api.get<{ id: string; name: string; zonesEnabled?: boolean }>(`/events/${eventId}`),
  create: (dto: CreateEventDto) => api.post<EventSummary>('/events', dto),
  members: {
    list: (() => {
      const TTL = 2 * 60 * 1000;
      const cache = new Map<string, { ts: number; data: EventMember[] }>();
      return async (eventId: string, opts?: { force?: boolean }) => {
        const now = Date.now();
        const cached = cache.get(eventId);
        if (!opts?.force && cached && now - cached.ts < TTL) return cached.data;
        const rows = (await api.get<any[]>(`/events/${eventId}/members`)) || [];
        // Deduplicate by userId so consumers that need a unique user list
        // (e.g., member pickers) stay stable even if the API returns
        // department-scoped memberships.
        const byUser = new Map<string, EventMember>();
        for (const r of rows) {
          if (!byUser.has(r.userId)) byUser.set(r.userId, { userId: r.userId, user: r.user });
        }
        const data = Array.from(byUser.values()).sort((a, b) => (a.user?.fullName || '').localeCompare(b.user?.fullName || ''));
        cache.set(eventId, { ts: now, data });
        return data;
      };
    })(),
  },
};
