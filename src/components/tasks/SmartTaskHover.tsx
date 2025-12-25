import React, { useEffect, useState } from 'react';
import { TaskHoverCard } from './TaskHoverCard';
import { tasksService } from '../../services/tasks';
import { useContextStore } from '../../store/contextStore';

export const SmartTaskHover: React.FC<{ taskId: string; title: string; children: React.ReactNode }> = ({ taskId, title, children }) => {
    const [task, setTask] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [hovering, setHovering] = useState(false);
    const { currentEventId } = useContextStore();

    useEffect(() => {
        if (hovering && !task && !loading && currentEventId) {
            setLoading(true);
            // We need an endpoint to get task by specific ID or search
            // Since we have taskId, let's try getting it directly.
            // But TasksService.get needs departmentId.
            // However, we added 'searchEventTasks' only for searching.
            // We might need a 'getTaskById' that is event-scoped or ignores keys?
            // Actually `taskId` is unique globally (CUID).
            // But our backend often requires event context.
            // If we don't have department, we can't use standard `get`.
            // Let's rely on search by ID for now? Or just Title if search is by title.
            // Actually searchEventTasks returns a list.

            // Optimization: If we can't fetch easily, we just show Title.
            // But user wants status.
            // Let's accept we might need to find the task.

            // Fallback: use search with the exact title? No, title might change.
            // Let's assume we can fetch via search for now, querying the ID?
            // searchEventTasks queries `title`.
            // We need to implement lookup by ID event-scoped.
            // Or just assume department? No.

            // Let's try to pass taskId as query to search?
            // If search checks ID too?
            // I'll update search implementation to check ID if query matches CUID format?
            // Or just leave it for now and show title.

            // Actually, I'll update search to also match ID.
            tasksService.searchEventTasks(currentEventId, taskId).then(res => {
                const found = res.find(t => t.id === taskId);
                if (found) setTask(found);
                setLoading(false);
            }).catch(() => setLoading(false));
        }
    }, [hovering, task, loading, currentEventId, taskId]);

    return (
        <span
            className="relative group inline-block text-blue-600 font-medium cursor-pointer"
            onMouseEnter={() => setHovering(true)}
        >
            {children}
            {hovering && task && (
                <div className="absolute bottom-full left-0 mb-1 z-50">
                    <TaskHoverCard task={task} />
                </div>
            )}
        </span>
    );
};
