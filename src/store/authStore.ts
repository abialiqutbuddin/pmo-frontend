// frontend/src/store/authStore.ts
import { create } from 'zustand';
import { BASE_URL } from '../api';

type JwtClaims = {
  sub: string;
  email: string;
  isSuperAdmin: boolean;
  iat?: number;
  exp?: number;
};

type CurrentUser = {
  id: string;
  email: string;
  isSuperAdmin: boolean;
  fullName?: string;
  profileImage?: string | null;
  itsId?: string | null;
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
  currentUser: CurrentUser | null;

  login: (email: string, password: string) => Promise<void>;
  tryRefresh: () => Promise<boolean>;
  logout: (all?: boolean) => Promise<void>;
  clearAuth: () => void;
  _hydrateProfile: () => Promise<void>;
}

const initialAccess = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
const initialRefresh = typeof localStorage !== 'undefined' ? localStorage.getItem('refreshToken') : null;
let initialUser: CurrentUser | null = null;

if (initialAccess) {
  const claims = parseJwt(initialAccess);
  if (claims?.sub) {
    initialUser = {
      id: claims.sub,
      email: (claims.email as string) || '',
      isSuperAdmin: !!claims.isSuperAdmin,
    };
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: initialAccess,
  refreshToken: initialRefresh,
  currentUser: initialUser,

  clearAuth: () => {
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } catch {}
    set({ accessToken: null, refreshToken: null, currentUser: null });
  },

  _hydrateProfile: async () => {
    const { accessToken, currentUser } = get();
    if (!accessToken || !currentUser?.id) return;
    try {
      const res = await fetch(`${BASE_URL}/users/${currentUser.id}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!res.ok) return;
      const u: any = await res.json();
      set({ currentUser: { ...currentUser, fullName: u.fullName, profileImage: u.profileImage ?? null, itsId: u.itsId ?? null } });
    } catch {}
  },

  login: async (email, password) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    const data: { accessToken: string; refreshToken: string } = await res.json();

    try {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
    } catch {}

    const claims = parseJwt(data.accessToken);
    const user: CurrentUser | null = claims?.sub
      ? { id: claims.sub, email: (claims.email as string) || '', isSuperAdmin: !!claims.isSuperAdmin }
      : null;

    set({ accessToken: data.accessToken, refreshToken: data.refreshToken, currentUser: user });
    // hydrate profile (fullName, profileImage)
    await get()._hydrateProfile();
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
    } catch {}

    const claims = parseJwt(data.accessToken);
    const user: CurrentUser | null = claims?.sub
      ? { id: claims.sub, email: (claims.email as string) || '', isSuperAdmin: !!claims.isSuperAdmin }
      : null;

    set({ accessToken: data.accessToken, refreshToken: data.refreshToken, currentUser: user });
    // refresh profile in background
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
