// frontend/src/store/pageStateStore.ts
import { create } from 'zustand';
import type { TaskStatus } from '../types/task';

type TasksPageState = {
  deptIds: string[];
  viewMode: 'list' | 'board';
  statusFilters: string[];
  priorityFilter: number | 'all';
  q: string;
  memberFilter?: string | 'all';
  overdueOnly?: boolean;
  viewingTaskId?: string | null;
};

type GanttPageState = {
  deptId: string;
  scale: 'day' | 'week';
  theme: 'default' | 'pastel' | 'contrast';
};

type AdminUsersPageState = {
  q: string;
  showCreate: boolean;
};

type PageState = {
  tasks: TasksPageState;
  setTasks: (patch: Partial<TasksPageState>) => void;

  gantt: GanttPageState;
  setGantt: (patch: Partial<GanttPageState>) => void;

  adminUsers: AdminUsersPageState;
  setAdminUsers: (patch: Partial<AdminUsersPageState>) => void;
};

export const usePageStateStore = create<PageState>((set) => ({
  tasks: {
    deptIds: [],
    viewMode: 'list',
    statusFilters: [],
    priorityFilter: 'all',
    q: '',
    memberFilter: 'all',
    overdueOnly: false,
    viewingTaskId: null,
  },
  setTasks: (patch) => set((s) => ({ tasks: { ...s.tasks, ...patch } })),

  gantt: {
    deptId: '',
    scale: 'day',
    theme: 'default',
  },
  setGantt: (patch) => set((s) => ({ gantt: { ...s.gantt, ...patch } })),

  adminUsers: {
    q: '',
    showCreate: false,
  },
  setAdminUsers: (patch) => set((s) => ({ adminUsers: { ...s.adminUsers, ...patch } })),
}));
