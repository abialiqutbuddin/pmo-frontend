// frontend/src/types/task.ts
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'canceled';

export interface TaskItem {
  id: string;
  eventId?: string;
  departmentId?: string;
  creatorId: string;
  assigneeId?: string | null;
  title: string;
  description?: string | null;
  priority: number; // 1..5
  status: TaskStatus;
  progressPct?: number;
  startAt?: string | null;
  dueAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
}

