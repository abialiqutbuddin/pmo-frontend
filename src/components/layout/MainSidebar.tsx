import React, { ElementType, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  CheckSquare,
  GanttChartSquare,
  Settings,
  Bell,
  Calendar,
  Building2,
  Wrench,
  MapPin,
  ChevronDown,
  Users2,
  GitBranch,
  ChevronsLeft,
  ChevronsRight,
  Shield,
  Search,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useContextStore } from '../../store/contextStore';
import { zonesService } from '../../services/zones';
import { useChatStore } from '../../store/chatStore';
import { UserAvatar } from '../ui/UserAvatar';
import { useNotificationStore } from '../../store/notificationStore';

// Unified Sidebar Item Component
interface SidebarItemProps {
  icon: ElementType;
  label: string;
  to?: string;            // If provided, it's a link
  badge?: number;
  collapsed?: boolean;
  active?: boolean;       // For parent groups to show active state
  children?: React.ReactNode;
  isOpen?: boolean;       // For accordion state (expanded mode)
  onToggle?: () => void;  // Toggle accordion
  end?: boolean;          // NavLink exact match
  child?: boolean;        // If true, it's a nested item (smaller, indented)
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon: Icon,
  label,
  to,
  badge,
  collapsed,
  children,
  isOpen,
  onToggle,
  end,
  child,
}) => {
  // 1. COLLAPSED MODE: Icon + Hover Menu
  if (collapsed) {
    return (
      <div className="relative group my-1">
        {/* Trigger Icon */}
        <div
          className={`
            flex items-center justify-center p-3 rounded-xl cursor-pointer transition-colors
            ${to ? '' : 'hover:bg-gray-700 text-gray-400 hover:text-white'}
          `}
        >
          {to ? (
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center justify-center p-3 rounded-xl transition-all ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              <Icon size={22} className="flex-shrink-0" />
            </NavLink>
          ) : (
            <Icon size={22} className="flex-shrink-0" />
          )}

          {typeof badge === 'number' && badge > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
          )}
        </div>

        {/* Floating Menu (Hover) */}
        <div className="absolute left-full top-0 ml-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 transform origin-left scale-95 group-hover:scale-100">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 mb-1">
            <div className={`p-1.5 rounded-lg ${to ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
              <Icon size={18} />
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-sm">{label}</div>
              {!!badge && <div className="text-[10px] text-rose-500 font-medium">{badge} notifications</div>}
            </div>
          </div>

          {/* Content (Children or Link Description) */}
          <div className="p-1.5">
            {children ? (
              <div className="flex flex-col gap-0.5">
                {children}
              </div>
            ) : to ? (
              // If it's a direct link, duplicate it here for clickability or just show info?
              // Usually sidebar hover doesn't need to duplicate the link if the main icon works.
              // But for UX, let's allow clicking the header or just provide extra context.
              // We'll leave it simple: The hover mainly serves to identify the icon.
              <div className="px-3 py-2 text-xs text-gray-500">
                Click icon to visit {label}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // 2. EXPANDED MODE: Standard List / Accordion
  // If it's a parent group (has children)
  if (children) {
    return (
      <div className="my-1">
        <button
          onClick={onToggle}
          className={`w-full flex items-center justify-between p-3 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition-colors group ${isOpen ? 'bg-gray-750 text-white' : ''}`}
        >
          <div className="flex items-center gap-3">
            <Icon size={20} className="group-hover:text-white transition-colors" />
            <span className="font-medium text-sm">{label}</span>
          </div>
          <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`} />
        </button>
        <div className={`grid transition-all duration-200 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className="overflow-hidden">
            <div className="pl-3 border-l-2 border-gray-700 ml-4 space-y-1 py-1">
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standard Link Item
  return (
    <NavLink
      to={to!}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 p-3 my-1 rounded-lg transition-all ${isActive
          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
          : 'text-gray-400 hover:bg-gray-700 hover:text-white'
        } ${child ? 'py-2 px-3 text-sm' : ''}`
      }
    >
      <Icon size={child ? 18 : 20} className={child ? '' : 'flex-shrink-0'} />
      <span className="font-medium text-sm flex-1">{label}</span>
      {typeof badge === 'number' && badge > 0 && (
        <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );
};


// Helper for sub-items in the hover menu (needs to be dark text since menu is white)
const HoverMenuItem: React.FC<{ to: string; label: string; icon: ElementType }> = ({ to, label, icon: Icon }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${isActive
        ? 'bg-blue-50 text-blue-600 font-medium'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`
    }
  >
    <Icon size={16} className="opacity-70" />
    {label}
  </NavLink>
);


export const MainSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSuperAdmin = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);
  const isTenantManager = !!useAuthStore((s) => s.currentUser?.isTenantManager);
  const currentUser = useAuthStore((s) => s.currentUser);
  const hydrateProfile = useAuthStore((s) => s._hydrateProfile);
  const { myMemberships, canAdminEvent, currentEventId, currentEventStructure } = useContextStore();
  const isDeptHead = myMemberships.some((m) => m.role === 'DEPT_HEAD');
  const [collapsed, setCollapsed] = useState(false);

  const [eventOpen, setEventOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);

  const totalUnread = Object.values(useChatStore((s) => s.unread)).reduce((a, b) => a + (b || 0), 0);
  const meId = useAuthStore((s) => s.currentUser?.id);
  const [hasZoneAssignment, setHasZoneAssignment] = useState<boolean>(false);
  const notificationUnread = useNotificationStore((s) => s.unreadCount);
  const fetchNotificationUnread = useNotificationStore((s) => s.fetchUnreadCount);

  useEffect(() => {
    if (currentUser && !currentUser.fullName) {
      void hydrateProfile();
    }
  }, [currentUser?.id]);

  // Fetch notification unread count
  useEffect(() => {
    if (!currentEventId) {
      useNotificationStore.getState().clearUnreadCount();
      return;
    }
    void fetchNotificationUnread(currentEventId);
  }, [currentEventId, fetchNotificationUnread]);

  // auto-open groups
  useEffect(() => {
    if (location.pathname.startsWith('/admin/settings')) setEventOpen(true);
    if (location.pathname.startsWith('/tasks')) setTasksOpen(true);
  }, [location.pathname]);

  // Check zones
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

  const authPermission = useAuthStore((s) => s.hasPermission);
  const eventPermission = useContextStore((s) => s.hasEventPermission);
  const hasPermission = (module: string, action: string) => authPermission(module, action) || eventPermission(module, action);

  // Helper to render consistent sub-items whether expanded or in hover menu
  const renderSubItem = (to: string, label: string, icon: ElementType) => {
    if (collapsed) {
      return <HoverMenuItem to={to} label={label} icon={icon} />;
    }
    return <SidebarItem to={to} label={label} icon={icon} collapsed={false} child />;
  };

  return (
    <div className={`${collapsed ? 'w-20' : 'w-72'} h-screen bg-[#1e1e24] text-gray-300 flex flex-col transition-all duration-300 ease-in-out border-r border-[#2a2a35] shadow-2xl z-20`}>

      {/* Search / Brand Area - Optional if user wants search in sidebar like reference image */}
      {!collapsed && (
        <div className="p-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              placeholder="Search..."
              className="w-full bg-[#2a2a35] border border-transparent focus:border-blue-500/50 rounded-lg py-2 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <span className="text-[10px] bg-[#363642] px-1.5 rounded text-gray-400">⌘</span>
              <span className="text-[10px] bg-[#363642] px-1.5 rounded text-gray-400">K</span>
            </div>
          </div>
        </div>
      )}
      {collapsed && <div className="h-4" />}

      {/* Navigation */}
      <nav className={`flex-1 ${collapsed ? 'px-2 overflow-visible' : 'px-4 overflow-y-auto'} py-4 space-y-1 scrollbar-hide`}>

        <SidebarItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" collapsed={collapsed} />

        {hasPermission('events', 'read') && (
          <SidebarItem to="/events" icon={Calendar} label="Events" collapsed={collapsed} />
        )}

        {/* Notifications - after Events */}
        <SidebarItem to="/notifications" icon={Bell} label="Notifications" badge={notificationUnread} collapsed={collapsed} />

        {hasPermission('chat', 'read') && (
          <SidebarItem to="/chat" icon={MessageSquare} label="Chat" badge={totalUnread} collapsed={collapsed} />
        )}

        {/* TASKS GROUP */}
        {hasPermission('tasks', 'read') && (
          <SidebarItem
            icon={CheckSquare}
            label="Tasks"
            collapsed={collapsed}
            isOpen={tasksOpen}
            onToggle={() => setTasksOpen(o => !o)}
          >
            {currentEventStructure === 'HIERARCHICAL' ? (
              renderSubItem('/tasks/departments', 'Departments', Building2)
            ) : (
              <>
                {renderSubItem('/tasks/central', 'Central Departments', Building2)}
                {(hasPermission('zones', 'read') || hasZoneAssignment) && (
                  renderSubItem('/tasks/zones', 'Zones', MapPin)
                )}
              </>
            )}
          </SidebarItem>
        )}

        {hasPermission('feedback', 'read') && (
          <SidebarItem to="/feedback" icon={Bell} label="Feedback" collapsed={collapsed} />
        )}

        {hasPermission('gantt', 'read') && (
          <SidebarItem to="/gantt" icon={GanttChartSquare} label="Gantt" collapsed={collapsed} />
        )}

        {!isSuperAdmin && isDeptHead && (
          <SidebarItem to="/me/department" icon={Building2} label="My Department" collapsed={collapsed} />
        )}

        {/* SETTINGS GROUP */}
        {(canAdminEvent || isSuperAdmin || isTenantManager) && (
          <SidebarItem
            icon={Wrench}
            label="Event Settings"
            collapsed={collapsed}
            isOpen={eventOpen}
            onToggle={() => setEventOpen(o => !o)}
          >
            {renderSubItem('/admin/settings/general', 'General', Settings)}
            {renderSubItem('/admin/settings/members', 'Members', Users2)}
            {hasPermission('departments', 'read') && renderSubItem('/admin/settings/departments', 'Manage Departments', Building2)}
            {currentEventStructure === 'ZONAL' && hasPermission('zones', 'read') && renderSubItem('/admin/settings/zones', 'Manage Zones', MapPin)}
            {(hasPermission('roles', 'read') || isSuperAdmin) && renderSubItem('/admin/roles', 'Roles', Shield)}
            {(hasPermission('departments', 'read') || isDeptHead || isSuperAdmin || isTenantManager) && renderSubItem('/admin/organogram', 'Organogram', GitBranch)}
          </SidebarItem>
        )}

        {/* Super Admin / App Settings - Keep simple for now */}
        {isSuperAdmin && !collapsed && (
          <div className="mt-6 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider px-2">Application</div>
        )}
        {isSuperAdmin && (
          <SidebarItem to="/admin/tenants" icon={Building2} label="Tenants" collapsed={collapsed} />
        )}
        {(hasPermission('roles', 'read') || hasPermission('users', 'read')) && (
          <>
            {!collapsed && <div className="mt-6 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider px-2">System</div>}
            {hasPermission('users', 'read') && (
              <SidebarItem to="/admin/users" icon={Users2} label="User Management" collapsed={collapsed} />
            )}
          </>
        )}
      </nav>

      {/* Footer Profile */}
      <div className={`mt-auto p-4 border-t border-[#2a2a35] bg-[#1a1a20] relative`}>
        {/* Profile Card */}
        <button
          onClick={() => navigate('/profile')}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-start gap-3'} rounded-xl transition-colors hover:bg-gray-800 p-2`}
        >
          <UserAvatar nameOrEmail={currentUser?.fullName || currentUser?.email || 'User'} imageUrl={currentUser?.profileImage} itsId={currentUser?.itsId || undefined} size={32} className="ring-2 ring-gray-700" />
          {!collapsed && (
            <div className="flex-1 text-left overflow-hidden">
              <div className="text-sm font-medium text-white truncate">{currentUser?.fullName || currentUser?.email}</div>
              <div className="text-[11px] text-gray-500 truncate">{currentUser?.email}</div>
            </div>
          )}
          {!collapsed && <Settings size={16} className="text-gray-500" />}
        </button>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 bg-gray-800 border border-gray-600 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full p-1.5 shadow-lg hover:shadow-xl transition-all z-50 flex items-center justify-center"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
      </div>

    </div>
  );
};

