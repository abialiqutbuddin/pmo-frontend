// frontend/src/services/dashboard.ts
import { api } from '../api';

export interface Summary {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  avgProgressPct: number;
  byStatus?: { todo: number; in_progress: number; blocked: number; done: number; canceled: number };
}

export interface DueSoonItem {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  priority: number;
  departmentId: string;
  departmentName: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
}

export interface RecentItem {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  progressPct?: number | null;
  departmentName: string;
  assigneeName?: string | null;
}

export interface DeptOverviewItem {
  departmentId: string;
  name: string;
  total: number;
  done: number;
  avgProgressPct: number;
}

export interface MyTaskItem {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  progressPct?: number | null;
  priority: number;
  departmentName: string;
}

export const dashboardService = {
  summary: (eventId: string) => api.get<Summary>(`/events/${eventId}/dashboard/summary`),
  dueSoon: (eventId: string, days = 7) => api.get<DueSoonItem[]>(`/events/${eventId}/dashboard/due-soon?days=${days}`),
  recent: (eventId: string) => api.get<RecentItem[]>(`/events/${eventId}/dashboard/recent`),
  deptOverview: (eventId: string) => api.get<DeptOverviewItem[]>(`/events/${eventId}/dashboard/dept-overview`),
  myTasks: (eventId: string) => api.get<MyTaskItem[]>(`/events/${eventId}/dashboard/my-tasks`),
};
