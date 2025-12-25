import React from 'react';
import { TaskStatus } from '../../types/task';
import { Calendar, CheckCircle2, AlertOctagon, Clock, User, Link2 } from 'lucide-react';

interface TaskHoverProps {
    task: {
        id: string;
        title: string;
        description?: string;
        department?: { name: string };
        status: TaskStatus;
        priority?: number;
        progressPct?: number;
        startAt?: string;
        dueAt?: string;
        assignee?: {
            fullName?: string;
            profileImage?: string;
        } | null;
        blockedBy?: { blocker: { id: string; title: string; status: string } }[];
    };
}

const statusColors: Record<TaskStatus, string> = {
    todo: 'bg-slate-100 text-slate-700 border-slate-200',
    in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
    blocked: 'bg-red-50 text-red-700 border-red-200',
    done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    canceled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const StatusBadge = ({ status }: { status: TaskStatus }) => (
    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold border ${statusColors[status] || 'bg-gray-100'}`}>
        {status.replace('_', ' ')}
    </span>
);

export const TaskHoverCard: React.FC<TaskHoverProps> = ({ task }) => {
    return (
        <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-100 w-80 text-sm z-50 animate-in fade-in zoom-in-95 duration-200">
            {/* Header: Dept + Priority */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {task.department && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            {task.department.name}
                        </span>
                    )}
                    <StatusBadge status={task.status} />
                </div>
                {task.priority !== undefined && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${task.priority >= 4 ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                        P{task.priority}
                    </span>
                )}
            </div>

            {/* Title */}
            <div className="font-bold text-gray-900 mb-1 leading-tight">
                {task.title}
            </div>

            {/* Description */}
            {task.description && (
                <div className="text-xs text-gray-500 mb-3 line-clamp-3 bg-gray-50 p-2 rounded-md border border-gray-100">
                    {task.description}
                </div>
            )}

            {/* Progress */}
            {(task.progressPct !== undefined) && (
                <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1 uppercase tracking-wider font-medium">
                        <span>Progress</span>
                        <span>{task.progressPct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 w-full rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${task.progressPct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${task.progressPct}%` }} />
                    </div>
                </div>
            )}

            {/* Dates Grid */}
            <div className="grid grid-cols-2 gap-2 mb-3">
                {task.startAt && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <div className="flex flex-col">
                            <span className="text-[9px] text-gray-400 uppercase">Start</span>
                            <span className="font-medium">{new Date(task.startAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                )}
                {task.dueAt && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 p-1.5 rounded border border-gray-100">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <div className="flex flex-col">
                            <span className="text-[9px] text-gray-400 uppercase">Due</span>
                            <span className="font-medium">{new Date(task.dueAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Dependencies */}
            {task.blockedBy && task.blockedBy.length > 0 && (
                <div className="mb-3">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-1">
                        <Link2 className="w-3 h-3" />
                        <span>Dependencies ({task.blockedBy.length})</span>
                    </div>
                    <div className="space-y-1">
                        {task.blockedBy.slice(0, 2).map((dep, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs text-gray-600 bg-orange-50/50 px-1.5 py-1 rounded border border-orange-100/50 truncate">
                                <AlertOctagon className="w-3 h-3 text-orange-400 shrink-0" />
                                <span className="truncate">{dep.blocker.title}</span>
                            </div>
                        ))}
                        {task.blockedBy.length > 2 && (
                            <div className="text-[10px] text-gray-400 pl-1">+ {task.blockedBy.length - 2} more</div>
                        )}
                    </div>
                </div>
            )}

            {/* Footer: Assignee */}
            <div className="border-t border-gray-100 pt-2 mt-2 flex items-center justify-between">
                {task.assignee ? (
                    <div className="flex items-center gap-2">
                        {task.assignee.profileImage ? (
                            <img src={task.assignee.profileImage} className="w-6 h-6 rounded-full ring-2 ring-white border border-gray-200" alt="" />
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] text-white font-bold ring-2 ring-white">
                                {task.assignee.fullName?.[0]}
                            </div>
                        )}
                        <div className="flex flex-col">
                            <span className="text-[9px] text-gray-400 uppercase leading-none">Assignee</span>
                            <span className="text-xs font-medium text-gray-700">{task.assignee.fullName}</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-gray-400">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center border border-dashed border-gray-300">
                            <User className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs">Unassigned</span>
                    </div>
                )}
            </div>
        </div>
    );
};
