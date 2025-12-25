import React, { useState } from 'react';
import { Flag, Calendar, User, LayoutGrid, Tag, FileIcon, MessageSquare, Activity } from 'lucide-react';
import { Dropdown } from '../ui/Dropdown';
import type { TaskItem, TaskStatus, TaskType } from '../../types/task';
import { AttachmentsPanel } from './AttachmentsPanel';
import { CommentsTab } from './CommentsTab';
import { ActivityTab } from './ActivityTab';
import { SideDrawer } from '../ui/SideDrawer';
import { UserAvatar } from '../ui/UserAvatar';
import { DependencyManager } from './DependencyManager';
import { Link as LinkIcon } from 'lucide-react';

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

const TYPE_LABEL: Record<TaskType, string> = {
  new_task: 'Task',
  issue: 'Issue',
  taujeeh: 'Taujeeh',
  improvement: 'Improvement',
};

function fmtDate(x?: string | Date | null) {
  if (!x) return '—';
  const d = typeof x === 'string' ? new Date(x) : x;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });

}

type TabKey = 'activity' | 'attachments' | 'comments' | 'dependencies';

export const TaskDetailsDrawer: React.FC<{
  task: TaskItem;
  onClose: () => void;
  onChangeStatus: (s: TaskStatus) => Promise<void>;
  memberNameById: Record<string, string>;
  memberMap?: Record<string, { name: string; avatar?: string }>;
  eventId: string;
  departmentId?: string; // Add departmentId prop if available from parent, else optional
  canComment?: boolean;
}> = ({ task, onClose, onChangeStatus, memberNameById, memberMap, eventId, departmentId, canComment = true }) => {
  const [activeTab, setActiveTab] = useState<TabKey>('activity');

  const PriorityBadge = ({ p }: { p: number }) => {
    const color =
      p === 1
        ? 'bg-rose-100 text-rose-700'
        : p === 2
          ? 'bg-orange-100 text-orange-700'
          : p === 3
            ? 'bg-amber-100 text-amber-700'
            : 'bg-blue-50 text-blue-700';
    return (
      <span
        className={`inline-flex items-center ${color} rounded-full px-2.5 py-0.5 text-xs font-medium`}
      >
        {PRIORITY_LABEL[p] || 'Normal'}
      </span>
    );
  };

  const StatusBadge = ({ s }: { s: TaskStatus }) => {
    let color = 'bg-gray-100 text-gray-700';
    if (s === 'todo') color = 'bg-gray-100 text-gray-700'; // Gray
    if (s === 'in_progress') color = 'bg-blue-50 text-blue-700'; // Soft Blue
    if (s === 'done') color = 'bg-green-50 text-green-700'; // Soft Green
    if (s === 'blocked') color = 'bg-red-50 text-red-700'; // Soft Red
    if (s === 'canceled') color = 'bg-gray-50 text-gray-500';

    return (
      <span className={`inline-flex items-center ${color} rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity border border-transparent hover:border-black/5`}>
        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${s === 'todo' ? 'bg-gray-500' : 'bg-current'}`} />
        {STATUS_OPTIONS.find(o => o.value === s)?.label || s}
      </span>
    );
  }



  const tabClass = (key: TabKey) =>
    `pb-3 text-sm font-medium cursor-pointer transition-colors relative ${activeTab === key
      ? 'text-blue-600'
      : 'text-gray-500 hover:text-gray-700'
    }`;

  const TabIndicator = ({ active }: { active: boolean }) => (
    active ? <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" /> : null
  );

  return (
    <SideDrawer
      open={true}
      onClose={onClose}
      maxWidthClass="max-w-md"
      headerPadding="p-3.5"
      header={
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{task.title}</h2>
        </div>
      }
    >
      <div className="flex flex-col min-h-full">
        {/* Meta Grid */}
        <div className="px-5 py-4 border-b border-gray-100 grid grid-cols-[100px_1fr] gap-x-4 gap-y-3 items-center text-sm">

          <div className="flex items-center text-gray-500 gap-2"><LayoutGrid size={15} /> Status</div>
          <div>
            <Dropdown
              value={task.status}
              onChange={(v) => onChangeStatus(v as TaskStatus)}
              options={STATUS_OPTIONS}
              // Render custom trigger 
              renderTrigger={() => <StatusBadge s={task.status} />}
            />
          </div>

          <div className="flex items-center text-gray-500 gap-2"><Activity size={15} /> Progress</div>
          <div className="flex items-center gap-2 w-full max-w-[200px]">
            <div className="h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${task.status === 'done' ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${task.progressPct || 0}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 font-medium tabular-nums min-w-[3ch]">{task.progressPct || 0}%</span>
          </div>

          <div className="flex items-center text-gray-500 gap-2"><Flag size={15} /> Priority</div>
          <div><PriorityBadge p={task.priority} /></div>

          <div className="flex items-center text-gray-500 gap-2"><Calendar size={15} /> Due Date</div>
          <div className="text-gray-900 font-medium">
            {task.dueAt ? new Date(task.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : <span className="text-gray-400">No due date</span>}
          </div>

          <div className="flex items-center text-gray-500 gap-2"><Tag size={15} /> Type</div>
          <div>
            <span className="inline-flex items-center bg-gray-50 text-gray-700 border border-gray-200 rounded px-2 py-0.5 text-xs font-medium">
              {(task.type && TYPE_LABEL[task.type]) ? TYPE_LABEL[task.type] : (task.type || 'Task')}
            </span>
          </div>

          <div className="flex items-center text-gray-500 gap-2"><User size={16} /> Assignee</div>
          <div className="flex items-center gap-2">
            {task.assigneeId ? (
              <>
                <UserAvatar nameOrEmail={memberMap?.[task.assigneeId]?.name || memberNameById[task.assigneeId]} imageUrl={memberMap?.[task.assigneeId]?.avatar} size={24} />
                <span className="text-gray-900 font-medium">{memberMap?.[task.assigneeId]?.name || memberNameById[task.assigneeId] || 'Unknown'}</span>
              </>
            ) : (
              <span className="text-gray-400 italic">Unassigned</span>
            )}
          </div>
        </div>

        <div className="px-6 py-6 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Project Description</h3>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 leading-relaxed border border-gray-100">
            {task.description || <span className="italic text-gray-400">No description provided for this task.</span>}
          </div>

          {/* Inline Attachments (Row) */}
          <div className="mt-2">
            <AttachmentsPanel
              eventId={eventId}
              entityType="Task"
              entityId={task.id}
              readOnly={true}
              memberNameById={memberNameById}
              variant="compact"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 mt-2 flex gap-8 border-b border-gray-200 sticky top-0 bg-white z-10">
          <button className={tabClass('activity')} onClick={() => setActiveTab('activity')}>
            Activity
            <TabIndicator active={activeTab === 'activity'} />
          </button>
          <button className={tabClass('dependencies')} onClick={() => setActiveTab('dependencies')}>
            Dependencies
            <TabIndicator active={activeTab === 'dependencies'} />
          </button>
          <button className={tabClass('attachments')} onClick={() => setActiveTab('attachments')}>
            Attachments
            <TabIndicator active={activeTab === 'attachments'} />
          </button>
          <button className={tabClass('comments')} onClick={() => setActiveTab('comments')}>
            Comments
            <TabIndicator active={activeTab === 'comments'} />
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-gray-50 flex flex-col h-[300px] overflow-y-auto border-b border-gray-200">
          {activeTab === 'activity' && (
            <div className="p-0">
              <ActivityTab eventId={eventId} departmentId={departmentId} taskId={task.id} />
            </div>
          )}
          {activeTab === 'dependencies' && (
            <div className="p-6">
              <DependencyManager
                eventId={eventId}
                departmentId={task.departmentId || departmentId || ''}
                taskId={task.id}
              />
            </div>
          )}
          {activeTab === 'attachments' && (
            <div className="p-6">
              <AttachmentsPanel
                eventId={eventId}
                entityType="Task"
                entityId={task.id}
                readOnly={true}
                memberNameById={memberNameById}
                memberMap={memberMap}
                variant="list"
              />
            </div>
          )}
          {activeTab === 'comments' && (
            <CommentsTab eventId={eventId} taskId={task.id} canComment={canComment} />
          )}
        </div>
      </div>
    </SideDrawer>
  );
};
