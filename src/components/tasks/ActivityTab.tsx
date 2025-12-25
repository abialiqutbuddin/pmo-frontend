import React, { useEffect, useState } from 'react';
import { tasksService } from '../../services/tasks';
import { Spinner } from '../ui/Spinner';
import { UserAvatar } from '../ui/UserAvatar';
import { format } from 'date-fns';
import { HighlightMentions } from '../ui/HighlightMentions';
import { format } from 'date-fns';
import { HighlightMentions } from '../ui/HighlightMentions';
// import { AuditAction } from '@prisma/client'; 

// If frontend doesn't have prisma client types, we can define a local type or use string.
// Since it's frontend, we likely don't have @prisma/client access directly unless shared. 
// We will use string for now to avoid build issues if @prisma/client isn't available in frontend.

type AuditLogItem = {
    id: string;
    action: string;
    createdAt: string;
    actor: {
        id: string;
        fullName: string;
        email: string;
        profileImage?: string;
    };
    details?: any; // parsed diffJson
    description?: string;
    diffJson?: string;
};

export const ActivityTab: React.FC<{
    eventId: string;
    departmentId?: string; // Not strictly needed for the fetch if using the tasks service activity endpoint correctly
    taskId: string;
}> = ({ eventId, departmentId = 'nop', taskId }) => {
    const [logs, setLogs] = useState<AuditLogItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // We need departmentId to match the URL structure: /events/:eid/departments/:did/tasks/:tid/activity
        // If departmentId is missing from props, we might need to rely on the parent providing it or fetch it.
        // For now assume parent passes it or we use a 'dummy' if backend doesn't strictly enforce departmentId for ID-based lookup 
        // (though the controller route includes it).
        // The previous code in TaskDetailsDrawer used `eventId`, but didn't explicitly pass departmentId to tabs.
        // We should ensure TaskDetailsDrawer has departmentId.

        if (!departmentId) return;

        setLoading(true);
        tasksService.activity(eventId, departmentId, taskId)
            .then((data) => setLogs(data))
            .catch((err) => console.error('Failed to load activity', err))
            .finally(() => setLoading(false));
    }, [eventId, departmentId, taskId]);

    if (loading) return <div className="p-4 flex justify-center"><Spinner /></div>;
    if (logs.length === 0) return <div className="p-4 text-center text-gray-500 text-sm">No activity recorded.</div>;

    return (
        <div className="flex flex-col gap-4 p-4">
            {logs.map((log) => (
                <div key={log.id} className="flex gap-3">
                    <div className="pt-1">
                        <UserAvatar
                            nameOrEmail={log.actor?.fullName}
                            imageUrl={log.actor?.profileImage}
                            size={24}
                        />
                    </div>
                    <div className="flex-1 text-sm">
                        <div className="text-gray-900">
                            <span className="font-medium">{log.actor?.fullName}</span>{' '}
                            <span className="text-gray-600">
                                {formatAction(log)}
                            </span>
                            {/* Show comment content if available */}
                            {log.action === 'COMMENT_ADDED' && log.details?.content && (
                                <div className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-700 whitespace-pre-wrap border border-gray-100">
                                    <HighlightMentions content={log.details.content} />
                                </div>
                            )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                            {format(new Date(log.createdAt), 'MMM d, h:mm a')}
                        </div>
                        {/* Optional: Show diff details if needed */}
                        {/* {log.diffJson && (
              <div className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono text-gray-600">
                {log.diffJson}
              </div>
            )} */}
                    </div>
                </div>
            ))}
        </div>
    );
};

function formatAction(log: AuditLogItem): string {
    if (log.description) return log.description; // Trust generic description if present

    switch (log.action) {
        case 'TASK_CREATED': return 'created this task';
        case 'TASK_UPDATED': return 'updated the task';
        case 'TASK_DELETED': return 'deleted the task';
        case 'COMMENT_ADDED': return 'commented';
        case 'FILE_UPLOADED': return 'uploaded a file';
        case 'MEMBER_TAGGED': return 'tagged a member';
        default: return log.action.replace(/_/g, ' ').toLowerCase();
    }
}
