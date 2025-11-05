import React, { ElementType, useEffect, useState } from 'react'; // Import ElementType
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  Wrench,
  MapPin,
  ChevronDown,
  Users2,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useContextStore } from '../../store/contextStore';
import { zonesService } from '../../services/zones';
import { useChatStore } from '../../store/chatStore';
import { UserAvatar } from '../ui/UserAvatar';

// 1. Define the props interface
interface NavItemProps {
  to: string;
  icon: ElementType; // Type for a component (like lucide-react icons)
  label: string;
  collapsed?: boolean;
  end?: boolean; // exact match for NavLink
  badge?: number;
  child?: boolean; // render smaller, indented
}

// 2. Apply the interface to your component
const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, collapsed, end, badge, child }) => (
  <NavLink
    to={to}
    end={end}
    // 3. Add type for the 'isActive' parameter
    className={({ isActive }: { isActive: boolean }) =>
      `block w-full flex items-center ${collapsed ? 'justify-center' : ''} ${child ? 'pl-10 pr-3 py-2 my-0.5 text-sm' : 'p-3 my-1'} rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white ${isActive ? 'bg-blue-600 text-white' : ''}`
    }
    title={collapsed ? label : undefined}
  >
    {collapsed ? (
      <span className="relative inline-flex items-center justify-center">
        <Icon size={22} className={`flex-shrink-0`} />
        {typeof badge === 'number' && badge > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] leading-none px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
    ) : (
      <Icon size={child ? 18 : 22} className={`${child ? 'mr-2' : 'mr-3'} flex-shrink-0`} />
    )}
    {!collapsed && (
      <span className="font-medium flex-1 flex items-center">
        {label}
        {typeof badge === 'number' && badge > 0 && (
          <span className="ml-auto bg-rose-600 text-white text-[11px] px-2 py-0.5 rounded-full min-w-[20px] text-center">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
    )}
  </NavLink>
);

export const MainSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSuperAdmin = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);
  const currentUser = useAuthStore((s) => s.currentUser);
  const hydrateProfile = useAuthStore((s) => s._hydrateProfile);
  const { myMemberships, canAdminEvent, currentEventId } = useContextStore();
  const isDeptHead = myMemberships.some((m) => m.role === 'DEPT_HEAD');
  const [collapsed, setCollapsed] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const totalUnread = Object.values(useChatStore((s)=> s.unread)).reduce((a,b)=>a+(b||0),0);
  const meId = useAuthStore((s)=> s.currentUser?.id);
  const [hasZoneAssignment, setHasZoneAssignment] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser && !currentUser.fullName) {
      void hydrateProfile();
    }
  }, [currentUser?.id]);

  // auto-open Event Settings group when on its routes
  useEffect(() => {
    if (location.pathname.startsWith('/admin/settings')) setEventOpen(true);
    if (location.pathname.startsWith('/tasks')) setTasksOpen(true);
  }, [location.pathname]);

  // Determine if user has any zone assignment; if not, hide Zones link
  useEffect(() => {
    let mounted = true;
    async function checkZones() {
      try {
        if (!currentEventId || !meId) { if (mounted) setHasZoneAssignment(false); return; }
        const zones = await zonesService.list(currentEventId).catch(() => []);
        if (!zones?.length) { if (mounted) setHasZoneAssignment(false); return; }
        const rows = await Promise.all(
          zones.map(z => zonesService.listAssignments(currentEventId, z.id).catch(() => []))
        );
        const any = rows.some(list => (list || []).some((a: any) => a.userId === meId));
        if (mounted) setHasZoneAssignment(any);
      } catch {
        if (mounted) setHasZoneAssignment(false);
      }
    }
    checkZones();
    return () => { mounted = false; };
  }, [currentEventId, meId]);

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
        <NavItem to="/chat" icon={MessageSquare} label="Chat" collapsed={collapsed} badge={totalUnread || undefined} />
        {/* Tasks group (collapsible) */}
        <div className="my-1">
          <button
            className={`block w-full flex items-center ${collapsed ? 'justify-center' : ''} p-3 my-1 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white`}
            onClick={() => setTasksOpen((o) => !o)}
            title={collapsed ? 'Tasks' : undefined}
          >
            {collapsed ? (
              <CheckSquare size={22} className="flex-shrink-0" />
            ) : (
              <>
                <span className="flex items-center gap-3">
                  <CheckSquare size={22} className="flex-shrink-0" />
                  <span className="font-medium">Tasks</span>
                </span>
                <ChevronDown size={18} className={`ml-auto transition-transform ${tasksOpen ? '' : '-rotate-90'}`} />
              </>
            )}
          </button>
          {!collapsed && tasksOpen && (
            <div className="mt-1">
              <NavItem to="/tasks/central" icon={Building2} label="Central Departments" collapsed={collapsed} child />
              {(isSuperAdmin || canAdminEvent || hasZoneAssignment) && (
                <NavItem to="/tasks/zones" icon={MapPin} label="Zones" collapsed={collapsed} child />
              )}
            </div>
          )}
        </div>
        <NavItem to="/feedback" icon={Bell} label="Feedback" collapsed={collapsed} />
        <NavItem to="/gantt" icon={GanttChartSquare} label="Gantt" collapsed={collapsed} />
        {!isSuperAdmin && isDeptHead && (
          <NavItem to="/me/department" icon={Building2} label="Department" collapsed={collapsed} />
        )}

        {(isSuperAdmin || canAdminEvent) && (
          <div className="my-1">
            <button
              className={`block w-full flex items-center ${collapsed ? 'justify-center' : ''} p-3 my-1 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white`}
              onClick={() => setEventOpen((o) => !o)}
              title={collapsed ? 'Event Settings' : undefined}
            >
              {collapsed ? (
                <Wrench size={22} className="flex-shrink-0" />
              ) : (
                <>
                  <span className="flex items-center gap-3">
                    <Wrench size={22} className="flex-shrink-0" />
                    <span className="font-medium">Event Settings</span>
                  </span>
                  <ChevronDown size={18} className={`ml-auto transition-transform ${eventOpen ? '' : '-rotate-90'}`} />
                </>
              )}
            </button>
            {!collapsed && eventOpen && (
              <div className="mt-1">
                <NavItem to="/admin/settings/departments" icon={Building2} label="Manage Departments" collapsed={collapsed} child />
                <NavItem to="/admin/settings/zones" icon={MapPin} label="Manage Zones" collapsed={collapsed} child />
              </div>
            )}
          </div>
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
