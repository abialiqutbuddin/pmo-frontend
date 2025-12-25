// frontend/src/pages/NotificationsPage.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { notificationsService, type Notification } from '../services/notifications';
import { useNavigate } from 'react-router-dom';
import { useContextStore } from '../store/contextStore';
import { Bell, Check, Search } from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { Spinner } from '../components/ui/Spinner';
import { ModernInput } from '../components/ui/ModernInput';
import { UserAvatar } from '../components/ui/UserAvatar';
import { useNotificationStore } from '../store/notificationStore';

// Helper to get grouped label
function getDateGroupLabel(dateStr: string): string {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'd MMM');
}

// Helper to format relative time
function formatRelativeTime(dateStr: string): string {
    const date = parseISO(dateStr);
    if (isToday(date)) {
        return format(date, 'h:mma').toLowerCase().replace('m', 'h ago');
    }
    if (isYesterday(date)) {
        return 'Yesterday';
    }
    return format(date, 'd MMM');
}

export const NotificationsPage: React.FC = () => {
    const navigate = useNavigate();
    const currentEventId = useContextStore((s) => s.currentEventId);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [markingAll, setMarkingAll] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const loadNotifications = async () => {
        setLoading(true);
        try {
            const data = await notificationsService.list(currentEventId || undefined);
            setNotifications(data);
        } catch (e) {
            console.error('Failed to load notifications', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, [currentEventId]);

    const handleMarkAsRead = async (n: Notification, e: React.MouseEvent) => {
        e.stopPropagation();
        if (n.readAt) return;
        try {
            await notificationsService.markAsRead(n.id);
            setNotifications((prev) =>
                prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
            );
            useNotificationStore.getState().decrementUnreadCount(1);
        } catch (err) {
            console.error('Failed to mark as read', err);
        }
    };

    const handleView = (n: Notification) => {
        // Mark as read when viewing
        if (!n.readAt) {
            notificationsService.markAsRead(n.id).catch(() => { });
            setNotifications((prev) =>
                prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
            );
            useNotificationStore.getState().decrementUnreadCount(1);
        }
        if (n.link) {
            navigate(n.link);
        }
    };

    const handleMarkAllAsRead = async () => {
        setMarkingAll(true);
        try {
            const unreadCount = notifications.filter(n => !n.readAt).length;
            await notificationsService.markAllAsRead(currentEventId || undefined);
            setNotifications((prev) =>
                prev.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() }))
            );
            useNotificationStore.getState().decrementUnreadCount(unreadCount);
        } catch (e) {
            console.error('Failed to mark all as read', e);
        } finally {
            setMarkingAll(false);
        }
    };

    // Filter and group notifications
    const filteredNotifications = useMemo(() => {
        if (!searchQuery.trim()) return notifications;
        const q = searchQuery.toLowerCase();
        return notifications.filter(
            (n) =>
                n.title.toLowerCase().includes(q) ||
                (n.body && n.body.toLowerCase().includes(q))
        );
    }, [notifications, searchQuery]);

    const groupedNotifications = useMemo(() => {
        const groups: { label: string; items: Notification[] }[] = [];
        const groupMap = new Map<string, Notification[]>();

        for (const n of filteredNotifications) {
            const label = getDateGroupLabel(n.createdAt);
            if (!groupMap.has(label)) {
                groupMap.set(label, []);
            }
            groupMap.get(label)!.push(n);
        }

        // Order: Today first, then Yesterday, then by date
        const order = ['Today', 'Yesterday'];
        for (const label of order) {
            if (groupMap.has(label)) {
                groups.push({ label, items: groupMap.get(label)! });
                groupMap.delete(label);
            }
        }
        // Remaining dates
        for (const [label, items] of groupMap) {
            groups.push({ label, items });
        }

        return groups;
    }, [filteredNotifications]);

    const unreadCount = notifications.filter((n) => !n.readAt).length;

    const getKindColor = (kind: string): string => {
        switch (kind) {
            case 'TASK_ASSIGNED':
                return 'bg-blue-100 text-blue-600';
            case 'USER_MENTIONED':
                return 'bg-purple-100 text-purple-600';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <div className="px-6 py-4 h-full overflow-y-auto">
            {/* Search Bar */}
            <div className="mb-6">
                <ModernInput
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    icon={<Search size={18} className="text-gray-400" />}
                />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
                {unreadCount > 0 && (
                    <button
                        onClick={handleMarkAllAsRead}
                        disabled={markingAll}
                        className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                        {markingAll ? 'Marking...' : 'Mark all as Read'}
                    </button>
                )}
            </div>

            {/* Count */}
            <p className="text-gray-600 mb-6">
                You have <span className="text-teal-600 font-semibold">{unreadCount}</span> notifications to go through
            </p>

            {loading ? (
                <div className="flex justify-center py-16">
                    <Spinner />
                </div>
            ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                    <Bell size={48} className="mx-auto mb-4 text-gray-300" />
                    <p className="font-medium">No notifications</p>
                    <p className="text-sm mt-1">You're all caught up!</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {groupedNotifications.map((group) => (
                        <div key={group.label}>
                            <h2 className="text-sm font-medium text-gray-500 mb-3">{group.label}</h2>
                            <div className="space-y-2">
                                {group.items.map((n) => (
                                    <div
                                        key={n.id}
                                        className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${n.readAt
                                            ? 'bg-white border-gray-100'
                                            : 'bg-gray-50 border-gray-200'
                                            }`}
                                    >
                                        {/* Icon/Avatar */}
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getKindColor(n.kind)}`}>
                                            {n.kind === 'TASK_ASSIGNED' && <Bell size={18} />}
                                            {n.kind === 'USER_MENTIONED' && <span className="font-bold">@</span>}
                                            {!['TASK_ASSIGNED', 'USER_MENTIONED'].includes(n.kind) && <Bell size={18} />}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-2">
                                                <span className="font-semibold text-gray-900">{n.title}</span>
                                                <span className="text-xs text-gray-400">{formatRelativeTime(n.createdAt)}</span>
                                            </div>
                                            {n.body && (
                                                <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{n.body}</p>
                                            )}
                                        </div>

                                        {/* Mark as Read - only show for unread */}
                                        {!n.readAt && (
                                            <button
                                                onClick={(e) => handleMarkAsRead(n, e)}
                                                className="text-teal-600 hover:text-teal-700 font-medium text-sm shrink-0"
                                            >
                                                Mark as Read
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
