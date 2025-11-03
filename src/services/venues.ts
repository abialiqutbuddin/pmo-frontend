// frontend/src/services/venues.ts
import { api } from '../api';

export interface VenueItem { id: string; name: string }

export const venuesService = {
  list: async (eventId: string, q?: string) => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return (await api.get<VenueItem[]>(`/events/${eventId}/venues${qs}`)) || [];
  },
  create: async (eventId: string, name: string) => {
    return api.post<VenueItem>(`/events/${eventId}/venues`, { name });
  },
};

