import { api } from '../api';

export interface Module {
    id: string;
    key: string;
    name: string;
    description?: string;
    features?: string[];
}

export interface Permission {
    moduleId: string;
    actions: string[];
    module: Module;
}

export type RoleScope = 'EVENT' | 'DEPARTMENT' | 'BOTH';

export interface Role {
    id: string;
    tenantId: string;
    name: string;
    description?: string;
    isSystem: boolean;
    permissions: Permission[];
    scope?: RoleScope;
}

export const rolesService = {
    list: async () => {
        return api.get<Role[]>('/roles');
    },

    listModules: async () => {
        return api.get<Module[]>('/roles/modules');
    },

    create: async (data: { name: string; description?: string }) => {
        return api.post<Role>('/roles', data);
    },

    update: async (roleId: string, data: { name?: string; description?: string; permissions?: { moduleId: string; actions: string[] }[] }) => {
        return api.put<Role>(`/roles/${roleId}`, data);
    },

    delete: async (roleId: string) => {
        return api.delete(`/roles/${roleId}`);
    }
};
