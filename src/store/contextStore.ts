// frontend/src/store/contextStore.ts
import { create } from 'zustand';
import { api } from '../api';
import { useAuthStore } from './authStore';

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
}

export interface MyMembership {
  role: EventRole;
  departmentId?: string | null;
}

interface ContextState {
  currentEventId: string | null;
  currentEventName: string | null;
  currentDeptId: string | null;

  departments: Department[];
  myMemberships: MyMembership[];
  loadingContext: boolean;
  error?: string | null;

  // derived (kept in state for reactivity)
  isSuperAdmin: boolean;
  canAdminEvent: boolean; // OWNER or PMO_ADMIN or SuperAdmin

  selectEvent: (eventId: string, name?: string | null) => Promise<void>;
  clearEvent: () => void;
  selectDepartment: (deptId: string | null) => void;
  refreshContext: () => Promise<void>;
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
  loadingContext: false,
  error: null,
  isSuperAdmin: !!useAuthStore.getState().currentUser?.isSuperAdmin,
  canAdminEvent: !!useAuthStore.getState().currentUser?.isSuperAdmin,

  clearEvent: () => {
    try {
      localStorage.removeItem(LS_EVENT_ID);
      localStorage.removeItem(LS_EVENT_NAME);
      localStorage.removeItem(LS_DEPT_ID);
    } catch {}
    set({
      currentEventId: null,
      currentEventName: null,
      currentDeptId: null,
      departments: [],
      myMemberships: [],
      isSuperAdmin: !!useAuthStore.getState().currentUser?.isSuperAdmin,
      canAdminEvent: !!useAuthStore.getState().currentUser?.isSuperAdmin,
      error: null,
    });
  },

  selectEvent: async (eventId, name) => {
    try {
      localStorage.setItem(LS_EVENT_ID, eventId);
      if (name) localStorage.setItem(LS_EVENT_NAME, name);
    } catch {}
    set({ currentEventId: eventId, currentEventName: name ?? null });
    await get().refreshContext();
  },

  selectDepartment: (deptId) => {
    try {
      if (deptId) localStorage.setItem(LS_DEPT_ID, deptId);
      else localStorage.removeItem(LS_DEPT_ID);
    } catch {}
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

      // memberships
      const members = await api.get<{ userId: string; role: EventRole; departmentId?: string | null }[]>(
        `/events/${eventId}/members`,
      );
      const my = members.filter((m) => m.userId === auth.currentUser?.id);

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
      } catch {}

      const isSA = !!useAuthStore.getState().currentUser?.isSuperAdmin;
      const roles = my.map((m) => m.role);
      const canAdmin = isSA || roles.includes('OWNER') || roles.includes('PMO_ADMIN');

      set({
        currentEventId: ev.id,
        currentEventName: ev.name,
        departments: depts,
        myMemberships: my,
        currentDeptId: currentDeptId ?? null,
        isSuperAdmin: isSA,
        canAdminEvent: canAdmin,
      });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load event context' });
    } finally {
      set({ loadingContext: false });
    }
  },
}));
