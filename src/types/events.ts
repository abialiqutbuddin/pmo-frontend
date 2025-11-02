// frontend/src/types/events.ts
export interface EventSummary {
  id: string;
  name: string;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  archivedAt?: string | null;
}

