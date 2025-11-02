import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { TaskItem, TaskStatus } from '../../types/task';
import { User, Clock, Flag } from 'lucide-react';

const STATUS_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'todo', label: 'To Do', color: 'bg-gray-100' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-blue-100' },
  { key: 'blocked', label: 'Blocked', color: 'bg-rose-100' },
  { key: 'done', label: 'Done', color: 'bg-emerald-100' },
  { key: 'canceled', label: 'Canceled', color: 'bg-gray-200' },
];

export const TasksBoardView: React.FC<{
  tasks: TaskItem[];
  onChangeStatus: (t: TaskItem, s: TaskStatus) => void;
  onView: (t: TaskItem) => void;
  memberNameById: Record<string, string>;
}> = ({ tasks, onChangeStatus, onView, memberNameById }) => {
  const grouped = STATUS_COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.key),
  }));

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const fromStatus = result.source.droppableId as TaskStatus;
    const toStatus = result.destination.droppableId as TaskStatus;
    if (fromStatus === toStatus) return;
    const taskId = result.draggableId;
    const task = tasks.find((t) => t.id === taskId);
    if (task) onChangeStatus(task, toStatus);
  };

  const PriorityBadge = ({ p }: { p: number }) => {
    const color =
      p === 1 ? 'bg-rose-600' :
      p === 2 ? 'bg-orange-500' :
      p === 3 ? 'bg-amber-500' :
      p === 4 ? 'bg-emerald-500' : 'bg-gray-500';
    return <span className={`inline-flex items-center ${color} text-white rounded px-2 py-0.5 text-xs`}>
      <Flag size={12} className="mr-1" /> {p}
    </span>;
  };

  return (
    <div className="flex gap-4 overflow-x-auto p-2 min-h-[70vh]">
      <DragDropContext onDragEnd={handleDragEnd}>
        {grouped.map((col) => (
          <Droppable droppableId={col.key} key={col.key}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex-1 min-w-[240px] rounded-lg p-3 ${col.color}`}
              >
                <div className="font-semibold mb-3 text-gray-800 flex items-center justify-between">
                  {col.label}
                  <span className="text-xs text-gray-500">{col.tasks.length}</span>
                </div>
                {col.tasks.map((t, idx) => (
                  <Draggable draggableId={t.id} index={idx} key={t.id}>
                    {(prov) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        {...prov.dragHandleProps}
                        className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3 cursor-pointer hover:shadow-md transition"
                        onClick={() => onView(t)}
                      >
                        <div className="font-medium text-sm text-gray-900">{t.title}</div>
                        {t.description && (
                          <div className="text-xs text-gray-500 line-clamp-2 mb-1">
                            {t.description}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <User size={12} />
                            {t.assigneeId
                              ? memberNameById[t.assigneeId] || t.assigneeId
                              : 'Unassigned'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            {t.dueAt ? new Date(t.dueAt).toLocaleDateString() : '-'}
                          </div>
                        </div>
                        <div className="mt-2">
                          <PriorityBadge p={t.priority} />
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </DragDropContext>
    </div>
  );
};