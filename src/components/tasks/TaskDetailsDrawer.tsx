import React from 'react';
import { Flag, Calendar, User, CheckCircle } from 'lucide-react';
import { Dropdown } from '../ui/Dropdown';
import type { TaskItem, TaskStatus } from '../../types/task';
import { AttachmentsPanel } from './AttachmentsPanel';
import { SideDrawer } from '../ui/SideDrawer';

const PRIORITY_LABEL: Record<number, string> = {
  1: 'Critical',
  2: 'High',
  3: 'Medium',
  4: 'Low',
  5: 'Very Low',
};

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
  { value: 'canceled', label: 'Canceled' },
];

function fmtDate(x?: string | Date | null) {
  if (!x) return '—';
  const d = typeof x === 'string' ? new Date(x) : x;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export const TaskDetailsDrawer: React.FC<{
  task: TaskItem;
  onClose: () => void;
  onChangeStatus: (s: TaskStatus) => Promise<void>;
  memberNameById: Record<string, string>;
  eventId: string;
}> = ({ task, onClose, onChangeStatus, memberNameById, eventId }) => {

  const PriorityBadge = ({ p }: { p: number }) => {
    const color =
      p === 1
        ? 'bg-rose-600'
        : p === 2
        ? 'bg-orange-500'
        : p === 3
        ? 'bg-amber-500'
        : p === 4
        ? 'bg-emerald-500'
        : 'bg-gray-500';
    return (
      <span
        className={`inline-flex items-center ${color} text-white rounded px-2 py-0.5 text-xs`}
      >
        <Flag size={12} className="mr-1" /> {PRIORITY_LABEL[p]}
      </span>
    );
  };

  return (
    <SideDrawer
      open={true}
      onClose={onClose}
      maxWidthClass="max-w-2xl"
      header={
        <>
          <div className="text-xl font-semibold truncate">{task.title}</div>
          <div className="text-sm text-gray-600 truncate">{task.description || 'No description'}</div>
        </>
      }
    >
      {/* Meta */}
      <div className="p-5 grid grid-cols-2 gap-4 border-b border-gray-100">
          <div className="text-sm">
            <div className="text-gray-500">Created time</div>
            <div>{fmtDate(task.createdAt)}</div>
          </div>
          <div className="text-sm">
            <div className="text-gray-500">Status</div>
            <Dropdown
              value={task.status}
              onChange={(v) => onChangeStatus(v as TaskStatus)}
              options={STATUS_OPTIONS}
            />
          </div>
          <div className="text-sm">
            <div className="text-gray-500">Priority</div>
            <PriorityBadge p={task.priority} />
          </div>
          <div className="text-sm">
            <div className="text-gray-500">Due Date</div>
            <div className="inline-flex items-center text-gray-800">
              <Calendar size={14} className="mr-1" />
              {task.dueAt ? new Date(task.dueAt).toLocaleString() : '—'}
            </div>
          </div>
          <div className="text-sm col-span-2">
            <div className="text-gray-500">Assignee</div>
            <div className="inline-flex items-center text-gray-800">
              <User size={14} className="mr-1" />
              {task.assigneeId
                ? memberNameById[task.assigneeId] || task.assigneeId
                : 'Unassigned'}
            </div>
          </div>
        </div>

        {/* Tabs mimic */}
        <div className="px-5 pt-4">
          <div className="flex gap-4 border-b border-gray-200 mb-4">
            <button className="pb-2 border-b-2 border-blue-600 text-blue-600 text-sm font-medium">
              Activity
            </button>
            <button className="pb-2 text-sm text-gray-500 cursor-default">
              My Work
            </button>
            <button className="pb-2 text-sm text-gray-500 cursor-default">
              Assigned
            </button>
            <button className="pb-2 text-sm text-gray-500 cursor-default">
              Comments
            </button>
          </div>

          {/* Activity Placeholder */}
          <div className="mb-6 text-sm text-gray-600">
            <div className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-100 rounded px-2 py-1">
              <CheckCircle size={14} className="mr-1" /> Activity feed coming soon
            </div>
          </div>

          {/* Attachments */}
          <div className="mb-8">
            <div className="text-base font-semibold mb-2">Attachments</div>
            <AttachmentsPanel
              eventId={eventId}
              entityType="Task"
              entityId={task.id}
            />
          </div>

          {/* Comments placeholder */}
          <div className="mb-8">
            <div className="text-base font-semibold mb-2">Comments</div>
            <div className="text-sm text-gray-500">
              Comments UI will go here.
            </div>
          </div>
        </div>
    </SideDrawer>
  );
};
