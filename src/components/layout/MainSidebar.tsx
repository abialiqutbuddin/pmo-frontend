import React, { ElementType, useEffect, useState } from 'react'; // Import ElementType
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  CheckSquare,
  GanttChartSquare,
  Settings,
  Bell,
  Calendar,
  LogOut,
  Building2,
  Users2,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useContextStore } from '../../store/contextStore';
import { UserAvatar } from '../ui/UserAvatar';

// 1. Define the props interface
interface NavItemProps {
  to: string;
  icon: ElementType; // Type for a component (like lucide-react icons)
  label: string;
  collapsed?: boolean;
  end?: boolean; // exact match for NavLink
}

// 2. Apply the interface to your component
const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, collapsed, end }) => (
  <NavLink
    to={to}
    end={end}
    // 3. Add type for the 'isActive' parameter
    className={({ isActive }: { isActive: boolean }) =>
      `block w-full flex items-center ${collapsed ? 'justify-center' : ''} p-3 my-1 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white ${
        isActive ? 'bg-blue-600 text-white' : ''
      }`
    }
    title={collapsed ? label : undefined}
  >
    <Icon size={22} className={`${collapsed ? '' : 'mr-3'} flex-shrink-0`} />
    {!collapsed && <span className="font-medium">{label}</span>}
  </NavLink>
);

export const MainSidebar: React.FC = () => {
  const navigate = useNavigate();
  const isSuperAdmin = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);
  const currentUser = useAuthStore((s) => s.currentUser);
  const hydrateProfile = useAuthStore((s) => s._hydrateProfile);
  const { myMemberships } = useContextStore();
  const isDeptHead = myMemberships.some((m) => m.role === 'DEPT_HEAD');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (currentUser && !currentUser.fullName) {
      void hydrateProfile();
    }
  }, [currentUser?.id]);

  return (
    <div className={`${collapsed ? 'w-16' : 'w-64'} relative h-screen bg-gray-800 text-white flex flex-col p-3 transition-all duration-200`}>
      {/* Header: User */}
      <button
        onClick={() => navigate('/profile')}
        className={`flex items-center ${collapsed ? 'justify-center' : ''} mb-3 p-2 rounded hover:bg-gray-700`}
        title={collapsed ? (currentUser?.email || 'Profile') : undefined}
      >
        <UserAvatar nameOrEmail={currentUser?.fullName || currentUser?.email || 'User'} imageUrl={currentUser?.profileImage} itsId={currentUser?.itsId || undefined} size={36} />
        {!collapsed && (
          <div className="ml-2 text-left">
            <div className="text-sm font-semibold truncate">{currentUser?.fullName || currentUser?.email || 'User'}</div>
            <div className="text-[11px] text-gray-300">View profile</div>
          </div>
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" collapsed={collapsed} />
        {isSuperAdmin && <NavItem to="/events" icon={Calendar} label="Events" collapsed={collapsed} />}
        <NavItem to="/chat" icon={MessageSquare} label="Chat" collapsed={collapsed} />
        <NavItem to="/tasks" icon={CheckSquare} label="Tasks" collapsed={collapsed} />
        <NavItem to="/issues" icon={Bell} label="Issues" collapsed={collapsed} />
        <NavItem to="/gantt" icon={GanttChartSquare} label="Gantt" collapsed={collapsed} />
        {!isSuperAdmin && isDeptHead && (
          <NavItem to="/me/department" icon={Building2} label="Department" collapsed={collapsed} />
        )}

        {isSuperAdmin && (
          <NavItem to="/admin/departments" icon={Building2} label="Departments" collapsed={collapsed} />
        )}

        {/* Super Admin: Users management */}
        {isSuperAdmin && <NavItem to="/admin/users" icon={Users2} label="Users" collapsed={collapsed} />}
      </nav>

      {/* Footer fixed at bottom: Settings + Collapse */}
      <div className="mt-auto pt-2 border-t border-gray-700">
        <NavItem to="/settings" icon={Settings} label="Settings" collapsed={collapsed} />
        <div className={`mt-1 flex ${collapsed ? 'justify-center' : 'justify-end'}`}>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-gray-300 hover:text-white px-2 py-1 rounded"
            title={collapsed ? 'Expand' : 'Collapse'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};
