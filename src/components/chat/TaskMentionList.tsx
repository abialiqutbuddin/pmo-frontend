import React, { useEffect, useState } from 'react';
import { TaskStatus } from '../../types/task';

interface HelperTask {
    id: string;
    title: string;
    status: TaskStatus;
    priority?: number;
    assignee?: { fullName?: string };
}

interface TaskMentionListProps {
    tasks: HelperTask[];
    selectedIndex: number;
    onSelect: (task: HelperTask) => void;
}

export const TaskMentionList: React.FC<TaskMentionListProps> = ({ tasks, selectedIndex, onSelect }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            const selectedEl = containerRef.current.children[selectedIndex] as HTMLElement;
            if (selectedEl) {
                selectedEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    if (tasks.length === 0) return null;

    return (
        <div
            ref={containerRef}
            className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 max-h-60 overflow-y-auto z-50 flex flex-col"
        >
            {tasks.map((task, i) => (
                <button
                    key={task.id}
                    className={`flex items-start gap-2 px-3 py-2 text-left text-sm ${i === selectedIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    onClick={() => onSelect(task)}
                >
                    <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{task.title}</div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                            <span className="uppercase">{task.status.replace('_', ' ')}</span>
                            {task.assignee?.fullName && <span>• {task.assignee.fullName}</span>}
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
};
