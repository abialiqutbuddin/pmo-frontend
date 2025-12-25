// frontend/src/services/departments.ts
import { api } from '../api';

export type DeptRole = 'DEPT_HEAD' | 'DEPT_MEMBER' | 'OBSERVER';

export interface Department {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface DeptMemberUser {
  id: string;
  fullName?: string;
  email?: string;
}

export interface DeptMember {
  id: string;
  userId: string;
  role: DeptRole;
  departmentId: string;
  user?: DeptMemberUser;
}

export const departmentsService = {
  list: (() => {
    const TTL = 5 * 60 * 1000; // 5 minutes
    const cache = new Map<string, { ts: number; data: Department[] }>();
    return async (eventId: string, opts?: { force?: boolean }) => {
      const now = Date.now();
      const cached = cache.get(eventId);
      if (!opts?.force && cached && now - cached.ts < TTL) return cached.data;
      const data = (await api.get<Department[]>(`/events/${eventId}/departments`)) || [];
      cache.set(eventId, { ts: now, data });
      return data;
    };
  })(),
  create: (eventId: string, name: string, parentId?: string) => api.post<Department>(`/events/${eventId}/departments`, { name, parentId }),
  rename: (eventId: string, departmentId: string, name: string) =>
    api.patch<Department>(`/events/${eventId}/departments/${departmentId}`, { name }),
  remove: (eventId: string, departmentId: string) => api.delete<void>(`/events/${eventId}/departments/${departmentId}`),

  members: {
    list: (() => {
      const TTL = 2 * 60 * 1000;
      const cache = new Map<string, { ts: number; data: DeptMember[] }>();
      return async (eventId: string, departmentId: string, opts?: { force?: boolean }) => {
        const key = `${eventId}:${departmentId}`;
        const now = Date.now();
        const cached = cache.get(key);
        if (!opts?.force && cached && now - cached.ts < TTL) return cached.data;
        const data = (await api.get<DeptMember[]>(`/events/${eventId}/departments/${departmentId}/members`)) || [];
        cache.set(key, { ts: now, data });
        return data;
      };
    })(),
    add: (
      eventId: string,
      departmentId: string,
      body: { userId: string; role: DeptRole }
    ) => api.post<DeptMember>(`/events/${eventId}/departments/${departmentId}/members`, body),
    update: (
      eventId: string,
      departmentId: string,
      userId: string,
      body: { role: DeptRole }
    ) => api.patch<DeptMember>(`/events/${eventId}/departments/${departmentId}/members/${userId}`, body),
    remove: (eventId: string, departmentId: string, userId: string) =>
      api.delete<void>(`/events/${eventId}/departments/${departmentId}/members/${userId}`),
  },
  assignableCandidates: (
    eventId: string,
    departmentId: string,
    q?: string,
  ) => api.get<{ userId: string; fullName: string; email: string }[]>(
    `/events/${eventId}/departments/${departmentId}/assignable${q ? `?q=${encodeURIComponent(q)}` : ''}`,
  ),
};
