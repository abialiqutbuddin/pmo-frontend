// frontend/src/services/tasks.ts
import { api } from '../api';
import type { TaskItem, TaskStatus } from '../types/task';
import { bus } from '../lib/eventBus';

export type DepType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';

export interface TaskDependencies {
  blockers: { upstreamId: string; depType: DepType; task: TaskItem }[];
}

export const tasksService = {
  list: (() => {
    const TTL = 2 * 60 * 1000; // 2 minutes
    const cache = new Map<string, { ts: number; data: TaskItem[] }>();
    return async (
      eventId: string,
      departmentId: string,
      opts?: { force?: boolean; assigneeId?: string }
    ) => {
      const key = `${eventId}:${departmentId}:${opts?.assigneeId ?? 'all'}`;
      const now = Date.now();
      const cached = cache.get(key);
      if (!opts?.force && cached && now - cached.ts < TTL) return cached.data;
      const qs = opts?.assigneeId ? `?assigneeId=${encodeURIComponent(opts.assigneeId)}` : '';
      const data = (await api.get<TaskItem[]>(`/events/${eventId}/departments/${departmentId}/tasks${qs}`)) || [];
      cache.set(key, { ts: now, data });
      return data;
    };
  })(),

  create: async (
    eventId: string,
    departmentId: string,
    body: Partial<Omit<TaskItem, 'id' | 'status'>> & { title: string; priority?: number }
  ) => {
    const res = await api.post<TaskItem>(`/events/${eventId}/departments/${departmentId}/tasks`, body);
    bus.emit('tasks:changed', { eventId, departmentId });
    return res;
  },

  update: async (
    eventId: string,
    departmentId: string,
    taskId: string,
    body: Partial<TaskItem>
  ) => {
    const res = await api.patch<TaskItem>(`/events/${eventId}/departments/${departmentId}/tasks/${taskId}`, body);
    bus.emit('tasks:changed', { eventId, departmentId });
    return res;
  },

  remove: async (eventId: string, departmentId: string, taskId: string) => {
    await api.delete<void>(`/events/${eventId}/departments/${departmentId}/tasks/${taskId}`);
    bus.emit('tasks:changed', { eventId, departmentId });
  },

  changeStatus: async (
    eventId: string,
    departmentId: string,
    taskId: string,
    body: { status: TaskStatus; progressPct?: number }
  ) => {
    const res = await api.patch<{ status: TaskStatus; progressPct?: number }>(
      `/events/${eventId}/departments/${departmentId}/tasks/${taskId}/status`,
      body,
    );
    bus.emit('tasks:changed', { eventId, departmentId });
    return res;
  },

  dependencies: {
    list: (eventId: string, departmentId: string, taskId: string) =>
      api.get<TaskDependencies>(`/events/${eventId}/departments/${departmentId}/tasks/${taskId}/dependencies`),
    add: (
      eventId: string,
      departmentId: string,
      taskId: string,
      body: { upstreamId: string; depType: DepType }
    ) => api.post<void>(`/events/${eventId}/departments/${departmentId}/tasks/${taskId}/dependencies`, body),
    remove: (
      eventId: string,
      departmentId: string,
      taskId: string,
      upstreamId: string,
    ) => api.delete<void>(`/events/${eventId}/departments/${departmentId}/tasks/${taskId}/dependencies`, { upstreamId }),
  },
};
