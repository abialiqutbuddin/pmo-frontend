// frontend/src/api.ts
import { useAuthStore } from './store/authStore';

// Prefer env, fall back to local backend port 3000 (matches backend/src/main.ts)
const RAW_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://eef4de7fc8a3.ngrok-free.app';
export const BASE_URL = String(RAW_BASE_URL).replace(/\/+$/, '');

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const { accessToken, tryRefresh, clearAuth } = useAuthStore.getState();

  const headers = new Headers(init.headers || {});

  // detect if we're sending FormData
  const isForm = init.body instanceof FormData;

  // only attach Content-Type for non-FormData bodies
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Accept', 'application/json');
  // Avoid ngrok browser warning HTML
  if (BASE_URL.includes('ngrok')) headers.set('ngrok-skip-browser-warning', 'true');
  if (init.body && !isForm && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { ...init, headers });

  if (res.status === 401 && retry) {
    const ok = await tryRefresh().catch(() => false);
    if (ok) return request<T>(path, init, false);
    clearAuth();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Invalid JSON response');
  }
  return (await res.json()) as T;
}

// api.ts (or wherever your api object lives)

function isFormData(v: unknown): v is FormData {
  return typeof FormData !== 'undefined' && v instanceof FormData;
}

export const api = {
  get: <T,>(path: string) =>
    request<T>(path, { method: 'GET' }),

  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: isFormData(body) ? body : body !== undefined ? JSON.stringify(body) : undefined,
      // IMPORTANT: don't set Content-Type for FormData; the browser will add the boundary
      headers: isFormData(body) ? undefined : { 'Content-Type': 'application/json' },
    }),

  patch: <T,>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: isFormData(body) ? body : body !== undefined ? JSON.stringify(body) : undefined,
      headers: isFormData(body) ? undefined : { 'Content-Type': 'application/json' },
    }),

  delete: <T,>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'DELETE',
      body: isFormData(body) ? body : body !== undefined ? JSON.stringify(body) : undefined,
      headers: isFormData(body) ? undefined : { 'Content-Type': 'application/json' },
    }),
};
