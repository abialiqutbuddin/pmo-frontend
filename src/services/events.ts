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
  // Legacy single-role fields (kept for compatibility with simple views)
  departmentId?: string | null;
  department?: { id: string; name: string };
  roleId?: string | null;
  role?: { id: string; name: string };

  // New multi-assignment fields
  globalRole?: { id: string; name: string } | null;
  assignments: {
    department: { id: string; name: string };
    role: { id: string; name: string };
  }[];

  user?: { id: string; fullName?: string; email?: string; itsId?: string; profileImage?: string; designation?: string };
  createdAt?: string;
}

export const eventsService = {
  list: () => api.get<EventSummary[]>('/events'),
  get: (eventId: string) => api.get<{ id: string; name: string; zonesEnabled?: boolean }>(`/events/${eventId}`),
  create: (dto: CreateEventDto) => api.post<EventSummary>('/events', dto),
  members: {
    list: (() => {
      const TTL = 2 * 60 * 1000;
      const cache = new Map<string, { ts: number; data: EventMember[] }>();
      const listFn = async (eventId: string, opts?: { force?: boolean }) => {
        const now = Date.now();
        const cached = cache.get(eventId);
        if (!opts?.force && cached && now - cached.ts < TTL) return cached.data;
        const rows = (await api.get<any[]>(`/events/${eventId}/members`)) || [];

        // Group by userId
        const byUser = new Map<string, EventMember>();

        for (const r of rows) {
          let existing = byUser.get(r.userId);
          if (!existing) {
            existing = {
              ...r,
              user: r.user,
              assignments: [],
              globalRole: null
            };
            byUser.set(r.userId, existing);
          }
          // Now "existing" is guaranteed to be defined because we just set it if it wasn't.

          // Case 1: Department Assignment
          if (r.department && r.role) {
            existing.assignments.push({
              department: r.department,
              role: r.role
            });
            // Keep legacy fields populated with *something* so list view isn't empty
            if (!existing.departmentId) {
              existing.departmentId = r.departmentId;
              existing.department = r.department;
            }
          }
          // Case 2: Global Role (No Department)
          else if (!r.department && r.role) {
            existing.globalRole = r.role;
            // Legacy field backup
            existing.roleId = r.roleId;
            existing.role = r.role;
          }
        }

        const data = Array.from(byUser.values()).sort((a, b) => (a.user?.fullName || '').localeCompare(b.user?.fullName || ''));
        cache.set(eventId, { ts: now, data });
        return data;
      };
      // expose clear method for internals
      (listFn as any).clear = (eventId: string) => cache.delete(eventId);
      return listFn;
    })() as ((eventId: string, opts?: { force?: boolean }) => Promise<EventMember[]>) & { clear: (id: string) => void },

    assignable: (eventId: string) => api.get<EventMember[]>(`/events/${eventId}/members/assignable`),

    bulkAdd: async (eventId: string, userIds: string[], roleId?: string) => {
      const res = await api.post(`/events/${eventId}/members/bulk`, { userIds, roleId });
      // clear cache
      if ((eventsService.members.list as any).clear) (eventsService.members.list as any).clear(eventId);
      return res;
    },

    update: async (eventId: string, userId: string, dto: { roleId?: string | null; departmentId?: string | null }) => {
      const res = await api.patch(`/events/${eventId}/members/${userId}`, dto);
      if ((eventsService.members.list as any).clear) (eventsService.members.list as any).clear(eventId);
      return res;
    },

    addAssignment: async (eventId: string, userId: string, dto: { roleId: string; departmentId: string }) => {
      const res = await api.post(`/events/${eventId}/members`, { userId, ...dto });
      if ((eventsService.members.list as any).clear) (eventsService.members.list as any).clear(eventId);
      return res;
    },

    removeAssignment: async (eventId: string, userId: string, departmentId?: string) => {
      let url = `/events/${eventId}/members/${userId}`;
      if (departmentId) url += `?departmentId=${departmentId}`;
      const res = await api.delete(url);
      if ((eventsService.members.list as any).clear) (eventsService.members.list as any).clear(eventId);
      return res;
    }
  },
};
