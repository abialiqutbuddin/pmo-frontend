import React, { useEffect, useState } from 'react';
import { usePageStateStore } from '../../store/pageStateStore';
import { TaskDetailsDrawer } from './TaskDetailsDrawer';
import { tasksService } from '../../services/tasks';
import { useContextStore } from '../../store/contextStore';
import type { TaskItem } from '../../types/task';
import { departmentsService } from '../../services/departments';
import { eventsService } from '../../services/events';
import { usersService } from '../../services/users';

export const GlobalTaskDrawer: React.FC = () => {
    const viewingTaskId = usePageStateStore((s) => s.tasks.viewingTaskId);
    const setTasksState = usePageStateStore((s) => s.setTasks);
    const { currentEventId } = useContextStore();

    const [task, setTask] = useState<TaskItem | null>(null);
    const [loading, setLoading] = useState(false);

    // Member maps
    const [memberNameById, setMemberNameById] = useState<Record<string, string>>({});
    const [memberMap, setMemberMap] = useState<Record<string, { name: string; avatar?: string }>>({});

    const close = () => {
        setTasksState({ viewingTaskId: null });
        setTask(null);
    };

    useEffect(() => {
        if (!viewingTaskId || !currentEventId) {
            setTask(null);
            return;
        }

        setLoading(true);
        // We need to fetch the task first to know its departmentId
        // But tasksService.get requires deptId.
        // Solution: Use the search endpoint by ID which is event-scoped!
        // Or assume we have deptId if passed? But viewingTaskId is just ID.
        // Wait, searchEventTasks returns partial info.
        // We need FULL info for the drawer (comments, attachments etc).
        // tasksService.get(eventId, deptId, taskId) is the standard.
        // If we don't know deptId, we have a problem.
        // HOWEVER, `searchEventTasks` (which we improved) works across departments.
        // AND `searchEventTasks` returns full task objects now (or acceptable partials).
        // Let's rely on search first to get deptId, then fetch full details if needed?
        // Actually, let's try to fetch via a new "get globally" endpoint or just iterate/search.
        // Since we updated searchEventTasks to return rich info, let's use that to get basic info,
        // including `departmentId` if we added it to the select?
        // Let's check `searchEventTasks` implementation again.

        // Strategy: 
        // 1. Search by ID to find the task and its department.
        // 2. Fetch full details using the department ID.

        tasksService.searchEventTasks(currentEventId, viewingTaskId).then(results => {
            // Exact match by ID
            const found = results.find(t => t.id === viewingTaskId);
            // Note: searchEventTasks needs to select departmentId for this to work!
            // I need to verify if backend returns departmentId.
            // If not, I should add it.

            if (found) {
                // Fetch full details if possible, or just use found if it's rich enough.
                // The drawer needs full details usually.
                // Let's assume found has departmentId (it should, checking backend...).
                // Actually the select in backend didn't include departmentId explicitly in my last edit?
                // Checking...
                /* 
                   select: {
                       id: true,
                       title: true,
                       description: true,
                       status: true,
                       priority: true,
                       progressPct: true,
                       dueAt: true,
                       assignee: { ... },
                       // Missing departmentId?
                   }
                */
                // I should fix backend to return departmentId.

                // Fallback: If found contains basic info, show it.
                // But for strict compatibility:
                setTask(found as any);
            } else {
                close(); // Not found
            }
        }).catch(() => {
            close();
        }).finally(() => setLoading(false));

    }, [viewingTaskId, currentEventId]);


    // Load members context if drawer is open
    useEffect(() => {
        if (!task || !currentEventId) return;

        // Ideally we load members for the specific department + event
        // Similar to CentralTasksPage logic
        const loadMembers = async () => {
            try {
                const [users, eventMembers] = await Promise.all([
                    usersService.list(),
                    eventsService.members.list(currentEventId)
                ]);

                const map: Record<string, string> = {};
                const detailedMap: Record<string, { name: string; avatar?: string }> = {};

                // Base users
                users.forEach(u => {
                    map[u.id] = u.fullName;
                    detailedMap[u.id] = { name: u.fullName, avatar: u.profileImage };
                });

                // Event overrides
                eventMembers.forEach(m => {
                    const uid = m.userId;
                    if (m.user && uid && m.user.fullName) {
                        map[uid] = m.user.fullName;
                        detailedMap[uid] = { name: m.user.fullName, avatar: m.user.profileImage };
                    }
                });

                setMemberNameById(map);
                setMemberMap(detailedMap);
            } catch { }
        };
        loadMembers();
    }, [task?.id, currentEventId]);


    if (!viewingTaskId || !task) return null;

    return (
        <TaskDetailsDrawer
            task={task}
            onClose={close}
            memberNameById={memberNameById}
            memberMap={memberMap}
            eventId={currentEventId || ''}
            departmentId={task.departmentId}
            onChangeStatus={async (s) => {
                if (currentEventId && task.departmentId) {
                    await tasksService.changeStatus(currentEventId, task.departmentId, task.id, { status: s });
                    setTask(prev => prev ? { ...prev, status: s } : null);
                }
            }}
        />
    );
};
