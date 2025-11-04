// frontend/src/services/zones.ts
import { api } from '../api';

export interface ZoneItem { id: string; name: string; enabled: boolean }

export const zonesService = {
  list: async (eventId: string) => {
    return (await api.get<ZoneItem[]>(`/events/${eventId}/zones`)) || [];
  },
  create: async (eventId: string, body: { name: string; enabled?: boolean }) => {
    return api.post<ZoneItem>(`/events/${eventId}/zones`, body);
  },
  update: async (eventId: string, zoneId: string, body: { name?: string; enabled?: boolean }) => {
    return api.patch<ZoneItem>(`/events/${eventId}/zones/${zoneId}`, body);
  },
  toggle: async (eventId: string, enabled: boolean) => {
    return api.patch(`/events/${eventId}/zones/toggle?enabled=${enabled}`);
  },
  zoneDepartments: async (eventId: string, zoneId: string) => {
    return (await api.get<string[]>(`/events/${eventId}/zones/${zoneId}/departments`)) || [];
  },
  setZoneDepartments: async (eventId: string, zoneId: string, departmentIds: string[]) => {
    return api.post(`/events/${eventId}/zones/${zoneId}/departments`, { departmentIds });
  },
  // Zonal department templates
  listZonalDepts: async (eventId: string) => {
    return (await api.get<{ id: string; name: string }[]>(`/events/${eventId}/zones/zonal-departments`)) || [];
  },
  createZonalDept: async (eventId: string, name: string) => {
    return api.post<{ id: string; name: string }>(`/events/${eventId}/zones/zonal-departments`, { name });
  },
  updateZonalDept: async (eventId: string, id: string, name: string) => {
    return api.patch<{ id: string; name: string }>(`/events/${eventId}/zones/zonal-departments/${id}`, { name });
  },
  deleteZonalDept: async (eventId: string, id: string) => {
    return api.delete<void>(`/events/${eventId}/zones/zonal-departments/${id}`);
  },
  listZoneZonalDepts: async (eventId: string, zoneId: string) => {
    return (await api.get<{ id: string; name: string; templateId: string }[]>(`/events/${eventId}/zones/${zoneId}/zonal-departments`)) || [];
  },
  // Zone POCs
  listPOCs: async (eventId: string, zoneId: string) => {
    return (await api.get<{ userId: string; role: string; user?: { id: string; fullName?: string; email?: string } }[]>(`/events/${eventId}/zones/${zoneId}/pocs`)) || [];
  },
  addPOC: async (eventId: string, zoneId: string, userId: string) => {
    return api.post(`/events/${eventId}/zones/${zoneId}/pocs`, { userId });
  },
  removePOC: async (eventId: string, zoneId: string, userId: string) => {
    return api.delete(`/events/${eventId}/zones/${zoneId}/pocs/${userId}`);
  },
  // Generic zone assignments
  listAssignments: async (eventId: string, zoneId: string) => {
    return (await api.get<{ userId: string; role: string; user?: { id: string; fullName?: string; email?: string } }[]>(`/events/${eventId}/zones/${zoneId}/assignments`)) || [];
  },
  addAssignment: async (eventId: string, zoneId: string, params: { userId: string; role: 'HEAD' | 'POC' | 'MEMBER' }) => {
    return api.post(`/events/${eventId}/zones/${zoneId}/assignments`, params);
  },
  updateAssignment: async (eventId: string, zoneId: string, userId: string, role: 'HEAD' | 'POC' | 'MEMBER') => {
    return api.patch(`/events/${eventId}/zones/${zoneId}/assignments/${userId}`, { role });
  },
  removeAssignment: async (eventId: string, zoneId: string, userId: string) => {
    return api.delete(`/events/${eventId}/zones/${zoneId}/assignments/${userId}`);
  },
  // Zone-department members
  listZoneDeptMembers: async (eventId: string, zoneId: string, deptId: string) => {
    return (await api.get<{ userId: string; role: string; user?: { id: string; fullName?: string; email?: string } }[]>(`/events/${eventId}/zones/${zoneId}/departments/${deptId}/members`)) || [];
  },
  addZoneDeptMember: async (eventId: string, zoneId: string, deptId: string, params: { userId: string; role: 'DEPT_HEAD' | 'DEPT_MEMBER' }) => {
    return api.post(`/events/${eventId}/zones/${zoneId}/departments/${deptId}/members`, params);
  },
  updateZoneDeptMember: async (eventId: string, zoneId: string, deptId: string, userId: string, role: 'DEPT_HEAD' | 'DEPT_MEMBER') => {
    return api.patch(`/events/${eventId}/zones/${zoneId}/departments/${deptId}/members/${userId}`, { role });
  },
  removeZoneDeptMember: async (eventId: string, zoneId: string, deptId: string, userId: string) => {
    return api.delete(`/events/${eventId}/zones/${zoneId}/departments/${deptId}/members/${userId}`);
  },
};
