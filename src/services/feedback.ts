// frontend/src/services/feedback.ts
import { api } from '../api';

export interface FeedbackItem {
  id: string;
  eventId: string;
  venueId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  description: string;
  dateOccurred?: string | null;
  createdAt: string;
}

export const feedbackService = {
  list: async (eventId: string) => {
    return (await api.get<FeedbackItem[]>(`/events/${eventId}/feedback`)) || [];
  },
  create: async (
    eventId: string,
    body: Partial<Omit<FeedbackItem, 'id' | 'createdAt' | 'eventId'>> & { description: string }
  ) => {
    return api.post<{ id: string }>(`/events/${eventId}/feedback`, body);
  },
};

