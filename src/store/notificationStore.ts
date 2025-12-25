// frontend/src/store/notificationStore.ts
import { create } from 'zustand';
import { notificationsService } from '../services/notifications';

interface NotificationState {
    unreadCount: number;
    setUnreadCount: (count: number) => void;
    decrementUnreadCount: (by?: number) => void;
    fetchUnreadCount: (eventId: string) => Promise<void>;
    clearUnreadCount: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    unreadCount: 0,
    setUnreadCount: (count) => set({ unreadCount: count }),
    decrementUnreadCount: (by = 1) => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - by) })),
    clearUnreadCount: () => set({ unreadCount: 0 }),
    fetchUnreadCount: async (eventId: string) => {
        try {
            const res = await notificationsService.unreadCount(eventId);
            set({ unreadCount: res.count });
        } catch {
            set({ unreadCount: 0 });
        }
    },
}));
