// frontend/src/store/authStore.ts
import { create } from 'zustand';
import { BASE_URL } from '../api';

type JwtClaims = {
  sub: string;
  email: string;
  isSuperAdmin: boolean;
  isTenantManager: boolean;
  iat?: number;
  exp?: number;
};

type CurrentUser = {
  id: string;
  email: string;
  isSuperAdmin: boolean;
  isTenantManager: boolean;
  fullName?: string;
  profileImage?: string | null;
  itsId?: string | null;
  permissions?: string[]; // array of "module:action"
  roles?: { id: string; name: string }[];
};

function parseJwt(token: string): JwtClaims | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  tenantId: string | null;
  currentUser: CurrentUser | null;

  login: (email: string, password: string, tenantId?: string) => Promise<void>;
  lookupTenants: (email: string) => Promise<{ id: string; name: string; slug: string }[]>;
  tryRefresh: () => Promise<boolean>;
  logout: (all?: boolean) => Promise<void>;
  clearAuth: () => void;
  _hydrateProfile: () => Promise<void>;
  hasPermission: (module: string, action: string) => boolean;
}

const initialAccess = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
const initialRefresh = typeof localStorage !== 'undefined' ? localStorage.getItem('refreshToken') : null;
const initialTenant = typeof localStorage !== 'undefined' ? localStorage.getItem('tenantId') : null;
let initialUser: CurrentUser | null = null;

if (initialAccess) {
  const claims = parseJwt(initialAccess);
  if (claims?.sub) {
    initialUser = {
      id: claims.sub,
      email: (claims.email as string) || '',
      isSuperAdmin: !!claims.isSuperAdmin,
      isTenantManager: !!claims.isTenantManager,
    };
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: initialAccess,
  refreshToken: initialRefresh,
  tenantId: initialTenant,
  currentUser: initialUser,

  hasPermission: (module, action) => {
    const u = get().currentUser;
    if (!u) return false;
    if (u.isSuperAdmin || u.isTenantManager) return true;
    if (!u.permissions) return false;
    return u.permissions.includes(`${module}:${action}`);
  },

  clearAuth: () => {
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('tenantId');
      localStorage.removeItem('currentEventId');
      localStorage.removeItem('currentEventName');
      localStorage.removeItem('currentDeptId');
    } catch { }
    set({ accessToken: null, refreshToken: null, tenantId: null, currentUser: null });
  },

  _hydrateProfile: async () => {
    const { accessToken, currentUser, tenantId } = get();
    if (!accessToken || !currentUser?.id) return;
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
      };
      if (tenantId) headers['X-Tenant-ID'] = tenantId;

      const res = await fetch(`${BASE_URL}/users/${currentUser.id}`, {
        headers,
      });
      if (!res.ok) return;
      const u: any = await res.json();

      set({
        currentUser: {
          ...currentUser,
          fullName: u.fullName,
          profileImage: u.profileImage ?? null,
          itsId: u.itsId ?? null,
          isTenantManager: !!u.isTenantManager,
          permissions: (u.permissions || []) as string[],
          roles: u.roles || []
        }
      });
    } catch { }
  },

  login: async (email, password, tenantId) => {
    const resolvedTenant = tenantId || 'system';
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': resolvedTenant,
      },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    const data: { accessToken: string; refreshToken: string } = await res.json();

    try {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('tenantId', resolvedTenant);
    } catch { }

    const claims = parseJwt(data.accessToken);
    const user: CurrentUser | null = claims?.sub
      ? { id: claims.sub, email: (claims.email as string) || '', isSuperAdmin: !!claims.isSuperAdmin, isTenantManager: !!claims.isTenantManager }
      : null;

    set({ accessToken: data.accessToken, refreshToken: data.refreshToken, tenantId: resolvedTenant, currentUser: user });
    await get()._hydrateProfile();
  },

  lookupTenants: async (email: string) => {
    const res = await fetch(`${BASE_URL}/auth/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error('Failed to lookup tenants');
    }
    return await res.json();
  },

  tryRefresh: async () => {
    const refreshToken = get().refreshToken;
    if (!refreshToken) return false;

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;

    const data: { accessToken: string; refreshToken: string } = await res.json();

    try {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
    } catch { }

    const claims = parseJwt(data.accessToken);
    const user: CurrentUser | null = claims?.sub
      ? { id: claims.sub, email: (claims.email as string) || '', isSuperAdmin: !!claims.isSuperAdmin, isTenantManager: !!claims.isTenantManager }
      : null;

    set({ accessToken: data.accessToken, refreshToken: data.refreshToken, currentUser: user });
    void get()._hydrateProfile();
    return true;
  },

  logout: async (all) => {
    const { accessToken, refreshToken } = get();
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ refreshToken: refreshToken ?? undefined, all: !!all }),
      });
    } catch {
      // no-op; still clear client state
    }
    get().clearAuth();
  },
}));
