// frontend/src/pages/EventDashboardPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useContextStore } from '../store/contextStore';
import { LayoutDashboard, MessageSquare, Users2, ShieldCheck, ListChecks, Bug, GanttChartSquare } from 'lucide-react';

const Tile: React.FC<{ icon: React.ReactNode; title: string; description: string; onClick: () => void; disabled?: boolean; tip?: string }>
  = ({ icon, title, description, onClick, disabled, tip }) => (
  <button
    className={`text-left bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition w-full ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={tip}
  >
    <div className="flex items-center mb-2 text-gray-800">
      <div className="mr-3">{icon}</div>
      <div className="font-semibold">{title}</div>
    </div>
    <div className="text-sm text-gray-500">{description}</div>
  </button>
);

export const EventDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentDeptId, canAdminEvent } = useContextStore();

  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <LayoutDashboard className="text-blue-600 mr-2" size={22} />
        <h1 className="text-2xl font-semibold">Event Overview</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          icon={<MessageSquare size={20} className="text-emerald-600" />}
          title="Chat"
          description="Conversations across event and departments"
          onClick={() => navigate('/chat')}
          tip="Open chat rooms"
        />
        <Tile
          icon={<ListChecks size={20} className="text-indigo-600" />}
          title="Tasks"
          description="Plan and track tasks (coming soon)"
          onClick={() => navigate('/tasks')}
          tip="Task board"
        />
        <Tile
          icon={<Bug size={20} className="text-rose-600" />}
          title="Issues"
          description="Report and resolve incidents (coming soon)"
          onClick={() => navigate('/issues')}
          tip="Issue center"
        />
        <Tile
          icon={<GanttChartSquare size={20} className="text-amber-600" />}
          title="Gantt"
          description="Schedules and dependencies (coming soon)"
          onClick={() => navigate('/gantt')}
          tip="Timeline view"
        />
        <Tile
          icon={<Users2 size={20} className="text-sky-600" />}
          title="My Department"
          description={currentDeptId ? 'View your department members' : 'Pick a department from the header'}
          onClick={() => navigate('/me/department')}
          disabled={!currentDeptId}
          tip={currentDeptId ? 'Open department' : 'Select a department from the header'}
        />
        {canAdminEvent && (
          <Tile
            icon={<ShieldCheck size={20} className="text-fuchsia-600" />}
            title="Admin Tools"
            description="Manage departments and access"
            onClick={() => navigate('/admin')}
            tip="Event administration"
          />
        )}
      </div>
    </div>
  );
};

