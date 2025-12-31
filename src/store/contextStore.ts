// frontend/src/store/contextStore.ts
import { create } from 'zustand';
import { api } from '../api';
import { useAuthStore } from './authStore';
import type { ChatPermissions } from '../services/chat';

export type EventRole =
  | 'OWNER'
  | 'PMO_ADMIN'
  | 'PMO_POC'
  | 'DEPT_HEAD'
  | 'DEPT_MEMBER'
  | 'GUEST'
  | 'OBSERVER';

export interface Department {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface RolePermission {
  actions: string[];
  module: { key: string };
}

export interface DetailedRole {
  id: string;
  name: string; // or EventRole if strictly enum, but backend returns string name
  permissions: RolePermission[];
}

export interface MyMembership {
  role: EventRole | DetailedRole; // Keep compatibility or switch to DetailedRole
  departmentId?: string | null;
  permissions?: string[];
}

interface ContextState {
  currentEventId: string | null;
  currentEventName: string | null;
  currentEventStructure?: 'ZONAL' | 'HIERARCHICAL';
  currentDeptId: string | null;

  departments: Department[];
  myMemberships: MyMembership[];
  loadingContext: boolean;
  error?: string | null;

  // Event-scoped permissions (e.g., ["tasks:read", "tasks:create", "chat:send_message"])
  eventPermissions: string[];

  // Chat-specific permissions for system groups
  chatPermissions: ChatPermissions | null;

  contextLoaded: boolean;

  // derived (kept in state for reactivity)
  isSuperAdmin: boolean;
  canAdminEvent: boolean; // OWNER or PMO_ADMIN or SuperAdmin

  selectEvent: (eventId: string, name?: string | null) => Promise<void>;
  clearEvent: () => void;
  selectDepartment: (deptId: string | null) => void;
  refreshContext: () => Promise<void>;

  /**
   * Check if current user has an event-scoped permission.
   * SuperAdmins automatically have all permissions.
   */
  hasEventPermission: (module: string, action: string) => boolean;
}

const LS_EVENT_ID = 'currentEventId';
const LS_EVENT_NAME = 'currentEventName';
const LS_DEPT_ID = 'currentDeptId';

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export const useContextStore = create<ContextState>((set, get) => ({
  currentEventId: typeof localStorage !== 'undefined' ? localStorage.getItem(LS_EVENT_ID) : null,
  currentEventName: typeof localStorage !== 'undefined' ? localStorage.getItem(LS_EVENT_NAME) : null,
  currentDeptId: typeof localStorage !== 'undefined' ? localStorage.getItem(LS_DEPT_ID) : null,

  departments: [],
  myMemberships: [],
  eventPermissions: [],
  chatPermissions: null,
  loadingContext: false,
  contextLoaded: false,
  error: null,
  isSuperAdmin: !!useAuthStore.getState().currentUser?.isSuperAdmin,
  canAdminEvent: !!useAuthStore.getState().currentUser?.isSuperAdmin,

  hasEventPermission: (module, action) => {
    const isSA = !!useAuthStore.getState().currentUser?.isSuperAdmin;
    if (isSA) return true;
    const perms = get().eventPermissions;
    return perms.includes(`${module}:${action}`);
  },

  clearEvent: () => {
    try {
      localStorage.removeItem(LS_EVENT_ID);
      localStorage.removeItem(LS_EVENT_NAME);
      localStorage.removeItem(LS_DEPT_ID);
    } catch { }
    set({
      currentEventId: null,
      currentEventName: null,
      currentDeptId: null,
      departments: [],
      myMemberships: [],
      eventPermissions: [],
      chatPermissions: null,
      contextLoaded: false,
      isSuperAdmin: !!useAuthStore.getState().currentUser?.isSuperAdmin,
      canAdminEvent: !!useAuthStore.getState().currentUser?.isSuperAdmin,
      error: null,
    });
  },

  selectEvent: async (eventId, name) => {
    try {
      localStorage.setItem(LS_EVENT_ID, eventId);
      if (name) localStorage.setItem(LS_EVENT_NAME, name);
    } catch { }
    set({ currentEventId: eventId, currentEventName: name ?? null, contextLoaded: false });
    await get().refreshContext();
  },

  selectDepartment: (deptId) => {
    try {
      if (deptId) localStorage.setItem(LS_DEPT_ID, deptId);
      else localStorage.removeItem(LS_DEPT_ID);
    } catch { }
    set({ currentDeptId: deptId });
  },

  refreshContext: async () => {
    const eventId = get().currentEventId;
    const auth = useAuthStore.getState();
    if (!auth.accessToken || !eventId) return;

    set({ loadingContext: true, error: null });
    try {
      // get event (name)
      const ev = await api.get<{ id: string; name: string }>(`/events/${eventId}`);

      // list departments
      const depts = await api.get<Department[]>(`/events/${eventId}/departments`);

      // Fetch event-scoped permissions for current user
      let eventPerms: string[] = [];
      try {
        eventPerms = await api.get<string[]>(`/events/${eventId}/my-permissions`);
      } catch {
        // Permission endpoint might not exist yet or user has no permissions
        eventPerms = [];
      }

      // Fetch chat-specific permissions for system groups
      let chatPerms: ChatPermissions | null = null;
      try {
        chatPerms = await api.get<ChatPermissions>(`/chat/events/${eventId}/permissions`);
      } catch {
        chatPerms = null;
      }

      // memberships (event-level)
      type BackendMember = {
        userId: string;
        role: { name: string; permissions: any[] };
        departmentId?: string | null
      };
      const members = await api.get<BackendMember[]>(
        `/events/${eventId}/members`,
      );

      // 2. Fetch MY memberships specifically (flattened permissions from backend)
      type MyMembershipRes = {
        userId: string;
        role: { name: string; permissions: string[] };
        departmentId?: string | null
      };
      const myMembershipsRaw = await api.get<MyMembershipRes[]>(
        `/events/${eventId}/my-memberships`
      );

      const mapMember = (m: MyMembershipRes): MyMembership => {
        if (!m.role) {
          return {
            role: 'GUEST' as EventRole,
            departmentId: m.departmentId,
            permissions: []
          };
        }
        return {
          role: m.role.name as EventRole,
          departmentId: m.departmentId,
          permissions: m.role.permissions || []
        };
      };

      const my = myMembershipsRaw.map(mapMember);

      // (Fallback logic removed: it was clearing permissions causing bugs)

      let currentDeptId = get().currentDeptId;
      const deptIds = unique(my.map((m) => m.departmentId || '').filter(Boolean) as string[]);
      if (!currentDeptId) {
        // auto-pick if single dept
        if (deptIds.length === 1) currentDeptId = deptIds[0];
      } else if (deptIds.length && !deptIds.includes(currentDeptId)) {
        currentDeptId = deptIds[0];
      }
      try {
        localStorage.setItem(LS_EVENT_NAME, ev.name);
        if (currentDeptId) localStorage.setItem(LS_DEPT_ID, currentDeptId);
      } catch { }

      const authState = useAuthStore.getState();
      const isSA = !!authState.currentUser?.isSuperAdmin;
      const isTM = !!authState.currentUser?.isTenantManager;

      const roleNames = my.map((m) => {
        if (!m.role) return '';
        return typeof m.role === 'string' ? m.role : m.role.name || '';
      });

      // Check for event admin via:
      // 1. SuperAdmin or Tenant Manager
      // 2. Legacy event roles (OWNER, PMO_ADMIN)
      // 3. Tenant-level permission for events
      // 4. Event-scoped permission for manage_settings
      const hasTenantPerm = authState.hasPermission;
      const canAdmin = isSA || isTM ||
        roleNames.includes('OWNER') ||
        roleNames.includes('PMO_ADMIN') ||
        hasTenantPerm('events', 'manage_settings') ||
        hasTenantPerm('events', 'update') ||
        eventPerms.includes('events:manage_settings');

      set({
        currentEventId: ev.id,
        currentEventName: ev.name,
        currentEventStructure: (ev as any).structure || 'ZONAL',
        departments: depts,
        myMemberships: my,
        eventPermissions: eventPerms,
        chatPermissions: chatPerms,
        currentDeptId: currentDeptId ?? null,
        isSuperAdmin: isSA,
        canAdminEvent: canAdmin,
      });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load event context' });
    } finally {
      set({ loadingContext: false, contextLoaded: true });
    }
  },
}));

