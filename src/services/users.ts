// frontend/src/services/users.ts
import { api } from '../api';

export interface User {
  id: string;
  email: string;
  fullName: string;
  isDisabled: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  itsId?: string;
  profileImage?: string;
  organization?: string;
  designation?: string;
  phoneNumber?: string;
}

export interface CreateUserDto {
  itsId: string;
  fullName: string;
  email: string;
  profileImage?: string;
  organization?: string;
  designation?: string;
  phoneNumber?: string;
  isSuperAdmin?: boolean;
  isDisabled?: boolean;
}

export type UpdateUserDto = Partial<Pick<
  User,
  'itsId' | 'fullName' | 'email' | 'profileImage' | 'organization' | 'designation' | 'phoneNumber' | 'isSuperAdmin' | 'isDisabled'
>> & {
  password?: string;
};

const USER_TTL = 2 * 60 * 1000;
let userListCache: { ts: number; data: User[] } | null = null;

export const usersService = {
  list: async (opts?: { force?: boolean }) => {
    const now = Date.now();
    if (!opts?.force && userListCache && now - userListCache.ts < USER_TTL) return userListCache.data;
    const data = (await api.get<User[]>('/users')) || [];
    userListCache = { ts: now, data };
    return data;
  },
  get: (id: string) => api.get<User>(`/users/${id}`),
  create: async (dto: CreateUserDto) => {
    const res = await api.post<User>('/users', dto);
    userListCache = null;
    return res;
  },
  update: async (id: string, dto: UpdateUserDto) => {
    const res = await api.patch<User>(`/users/${id}`, dto);
    userListCache = null;
    return res;
  },
  remove: async (id: string) => {
    const res = await api.delete<void>(`/users/${id}`);
    userListCache = null;
    return res;
  },
};
