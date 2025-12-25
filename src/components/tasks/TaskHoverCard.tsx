import React from 'react';
import { TaskStatus } from '../../types/task';

// Minimal types to avoid full dependency if not needed
interface TaskHoverProps {
    task: {
        id: string;
        title: string;
        status: TaskStatus;
        priority?: number;
        assignee?: {
            fullName?: string;
            profileImage?: string;
        } | null;
    };
}

const statusColors: Record<TaskStatus, string> = {
    TODO: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    IN_REVIEW: 'bg-purple-100 text-purple-700',
    DONE: 'bg-green-100 text-green-700',
    CANCELED: 'bg-red-100 text-red-700',
};

export const TaskHoverCard: React.FC<TaskHoverProps> = ({ task }) => {
    return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 w-64 text-sm z-50">
            <div className="font-semibold text-gray-900 mb-1 truncate" title={task.title}>
                {task.title}
            </div>
            <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded textxs font-medium ${statusColors[task.status] || 'bg-gray-100'}`}>
                    {task.status.replace('_', ' ')}
                </span>
                {task.priority !== undefined && (
                    <span className="text-xs text-gray-500">P{task.priority}</span>
                )}
            </div>
            {task.assignee ? (
                <div className="flex items-center gap-2 text-xs text-gray-600 border-t pt-2">
                    {task.assignee.profileImage ? (
                        <img src={task.assignee.profileImage} className="w-5 h-5 rounded-full" alt="" />
                    ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[10px]">
                            {task.assignee.fullName?.[0]}
                        </div>
                    )}
                    <span>{task.assignee.fullName}</span>
                </div>
            ) : (
                <div className="text-xs text-gray-400 border-t pt-2">Unassigned</div>
            )}
        </div>
    );
};
