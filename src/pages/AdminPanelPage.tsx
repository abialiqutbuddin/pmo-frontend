// frontend/src/pages/AdminPanelPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContextStore } from '../store/contextStore';
import { useAuthStore } from '../store/authStore';
import { usersService } from '../services/users';
import { departmentsService, type Department, type DeptMember } from '../services/departments';
import { Wrench, Plus, Building2, Users, Trash2, Pencil, Search, UserPlus, Shield } from 'lucide-react';
import { Dropdown } from '../components/ui/Dropdown';
import { Spinner } from '../components/ui/Spinner';

// Types are imported from services
type DeptOverview = { id: string; name: string; heads: string[]; memberCount: number };

export const AdminPanelPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentEventId, currentEventName, canAdminEvent } = useContextStore();
  const isSuperAdmin = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);

  // Departments state
  const [depts, setDepts] = useState<Department[]>([]);
  const [deptsLoading, setDeptsLoading] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [deptErr, setDeptErr] = useState<string | null>(null);
  const [overview, setOverview] = useState<DeptOverview[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Selection
  const [activeDeptId, setActiveDeptId] = useState<string>('');

  // Members state
  const [members, setMembers] = useState<DeptMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersErr, setMembersErr] = useState<string | null>(null);

  // Assignable search
  const [query, setQuery] = useState('');
  const [assignable, setAssignable] = useState<{ userId: string; fullName: string; email: string }[]>([]);
  const [assignRole, setAssignRole] = useState<'DEPT_HEAD' | 'DEPT_MEMBER' | 'OBSERVER'>('DEPT_MEMBER');
  const [assignLoading, setAssignLoading] = useState(false);
  const [globalUsers, setGlobalUsers] = useState<{ id: string; fullName: string; email: string }[]>([]);

  const canManage = canAdminEvent; // OWNER/PMO_ADMIN or SuperAdmin

  useEffect(() => {
    if (!currentEventId || !canManage) return;
    setDeptsLoading(true);
    setDeptErr(null);
    departmentsService
      .list(currentEventId)
      .then((d) => {
        const list = d || [];
        setDepts(list);
        if (!activeDeptId && list.length > 0) setActiveDeptId(list[0].id);
      })
      .catch((e) => setDeptErr(e?.message || 'Failed to load departments'))
      .finally(() => setDeptsLoading(false));
  }, [currentEventId, canManage]);

  // Build department overview (heads + counts)
  useEffect(() => {
    let mounted = true;
    async function build() {
      if (!currentEventId || !depts.length) { setOverview([]); return; }
      setOverviewLoading(true);
      try {
        const rows = await Promise.all(
          depts.map(async (d) => {
            const members = await departmentsService.members.list(currentEventId, d.id).catch(() => []);
            const heads = members.filter((m) => m.role === 'DEPT_HEAD').map((m) => m.user?.fullName || m.userId);
            return { id: d.id, name: d.name, heads, memberCount: members.length } as DeptOverview;
          })
        );
        if (mounted) setOverview(rows);
      } finally {
        setOverviewLoading(false);
      }
    }
    build();
    return () => { mounted = false; };
  }, [currentEventId, depts]);

  useEffect(() => {
    if (!currentEventId || !activeDeptId || !canManage) return;
    setMembersLoading(true);
    setMembersErr(null);
    departmentsService.members
      .list(currentEventId, activeDeptId)
      .then((rows) => setMembers(rows || []))
      .catch((e) => setMembersErr(e?.message || 'Failed to load members'))
      .finally(() => setMembersLoading(false));
  }, [currentEventId, activeDeptId, canManage]);

  // Load assignable candidates
  useEffect(() => {
    const t = setTimeout(() => {
      if (!currentEventId || !activeDeptId || !canManage) return;
      if (isSuperAdmin) {
        // global users (once) then filter locally
        if (globalUsers.length === 0) {
          usersService
            .list()
            .then((users) => setGlobalUsers(users || []))
            .catch(() => setGlobalUsers([]));
        }

        const term = query.trim().toLowerCase();
        const existing = new Set(members.map((m) => m.userId));
        const pool = globalUsers.filter((u) => !existing.has(u.id));
        const filtered = term
          ? pool.filter((u) => u.fullName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
          : pool.slice(0, 25);
        setAssignable(filtered.map((u) => ({ userId: u.id, fullName: u.fullName, email: u.email })));
      } else {
        departmentsService
          .assignableCandidates(currentEventId, activeDeptId, query)
          .then((rows) => setAssignable(rows || []))
          .catch(() => setAssignable([]));
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeDeptId, currentEventId, canManage, isSuperAdmin, globalUsers.length, members.map(m=>m.userId).join(',')]);

  const activeDept = useMemo(() => depts.find((d) => d.id === activeDeptId), [depts, activeDeptId]);

  async function createDept() {
    if (!newDeptName.trim() || !currentEventId) return;
    try {
      const d = await departmentsService.create(currentEventId, newDeptName.trim());
      setDepts((prev) => [...prev, d].sort((a, b) => a.name.localeCompare(b.name)));
      setNewDeptName('');
    } catch (e: any) {
      setDeptErr(e?.message || 'Failed to create department');
    }
  }

  async function renameDept(id: string, name: string) {
    if (!name.trim() || !currentEventId) return;
    const updated = await departmentsService.rename(currentEventId, id, name.trim());
    setDepts((prev) => prev.map((d) => (d.id === id ? updated : d)));
  }

  async function deleteDept(id: string) {
    if (!currentEventId) return;
    if (!confirm('Delete department? This removes its memberships.')) return;
    await departmentsService.remove(currentEventId, id);
    setDepts((prev) => prev.filter((d) => d.id !== id));
    if (activeDeptId === id) setActiveDeptId('');
  }

  async function addMember(userId: string) {
    if (!currentEventId || !activeDeptId) return;
    setAssignLoading(true);
    try {
      const row = await departmentsService.members.add(currentEventId, activeDeptId, { userId, role: assignRole });
      setMembers((prev) => [row, ...prev]);
    } finally {
      setAssignLoading(false);
    }
  }

  async function updateRole(userId: string, role: DeptMember['role']) {
    if (!currentEventId || !activeDeptId) return;
    const row = await departmentsService.members.update(currentEventId, activeDeptId, userId, { role });
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role: row.role } : m)));
  }

  async function removeMember(userId: string) {
    if (!currentEventId || !activeDeptId) return;
    await departmentsService.members.remove(currentEventId, activeDeptId, userId);
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  if (!canManage) {
    return (
      <div className="p-6">
        <div className="text-gray-700">You do not have admin permissions for this event.</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center">
        <Wrench size={22} className="text-fuchsia-600 mr-2" />
        <h1 className="text-2xl font-semibold">Manage Departments</h1>
        <span className="ml-3 text-sm text-gray-500">{currentEventName}</span>
      </div>

      {/* Department selector + create */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-emerald-600" />
            <span className="text-sm font-medium">Department</span>
            <Dropdown
              value={activeDeptId}
              onChange={(v) => setActiveDeptId(v)}
              options={depts.map((d) => ({ value: d.id, label: d.name }))}
              title="Choose department"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <input
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="New department name"
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
            />
            <button
              onClick={createDept}
              disabled={!newDeptName.trim()}
              className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2 text-sm"
              title="Create department"
            >
              <Plus size={16} className="mr-1" /> Create
            </button>
            {activeDept && (
              <>
                <button
                  className="text-gray-700 hover:text-black text-sm"
                  title="Rename department"
                  onClick={async () => {
                    const name = prompt('Rename department', activeDept.name) || '';
                    if (name && name !== activeDept.name) await renameDept(activeDept.id, name);
                  }}
                >
                  <Pencil size={16} className="inline mr-1" /> Rename
                </button>
                <button
                  className="text-rose-600 hover:text-rose-700 text-sm"
                  title="Delete department"
                  onClick={() => deleteDept(activeDept.id)}
                >
                  <Trash2 size={16} className="inline mr-1" /> Delete
                </button>
              </>
            )}
          </div>
        </div>
        {deptsLoading && <div className="mt-3"><Spinner size="sm" label="Loading departments" /></div>}
        {deptErr && <div className="text-sm text-red-600 mt-3">{deptErr}</div>}
      </div>

      {/* Departments overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <Building2 size={18} className="text-emerald-600 mr-2" />
          <div className="font-medium">Departments Overview</div>
        </div>
        {overviewLoading && <Spinner size="sm" label="Loading overview" />}
        {!overviewLoading && (
          <div className="border border-gray-100 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-600">Department</th>
                  <th className="text-left px-3 py-2 text-gray-600">Head(s)</th>
                  <th className="text-left px-3 py-2 text-gray-600">Members</th>
                </tr>
              </thead>
              <tbody>
                {overview.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{o.name}</td>
                    <td className="px-3 py-2">{o.heads.length ? o.heads.join(', ') : '—'}</td>
                    <td className="px-3 py-2">{o.memberCount}</td>
                  </tr>
                ))}
                {overview.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-gray-500">No departments yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Members of selected department */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <Users size={18} className="text-sky-600 mr-2" />
          <div className="font-medium">Department Members</div>
          <span className="ml-2 text-xs text-gray-500">{activeDept ? activeDept.name : 'Select a department'}</span>
        </div>

        {!activeDeptId && <div className="text-sm text-gray-500">Select a department to manage members.</div>}

        {activeDeptId && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full pl-9 pr-3 py-2 rounded-md border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Search people to add"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  title="Search candidates"
                />
              </div>
                <Dropdown
                  value={assignRole}
                  onChange={(v) => setAssignRole(v as any)}
                  options={[
                    { value: 'DEPT_MEMBER', label: 'Member' },
                    { value: 'DEPT_HEAD', label: 'Head' },
                    { value: 'OBSERVER', label: 'Observer' },
                  ]}
                  title="Role to assign"
                />
            </div>

            {query && assignable.length > 0 && (
              <div className="mb-3 max-h-40 overflow-y-auto border border-gray-100 rounded">
                {assignable.map((a) => (
                  <div key={a.userId} className="flex items-center justify-between px-3 py-2 border-b last:border-0">
                    <div className="text-sm">
                      <div className="font-medium">{a.fullName}</div>
                      <div className="text-gray-500 text-xs">{a.email}</div>
                    </div>
                    <button
                      className="inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-1.5 text-xs"
                      onClick={() => addMember(a.userId)}
                      disabled={assignLoading}
                      title="Add to department"
                    >
                      <UserPlus size={14} className="mr-1" /> Add
                    </button>
                  </div>
                ))}
              </div>
            )}

            {membersLoading && <Spinner size="sm" label="Loading members" />}
            {membersErr && <div className="text-sm text-red-600">{membersErr}</div>}
            {!membersLoading && !membersErr && (
              <div className="border border-gray-100 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-600">Member</th>
                      <th className="text-left px-3 py-2 text-gray-600">Role</th>
                      <th className="text-right px-3 py-2 text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <div className="text-gray-900">
                            <span className="font-medium mr-2">{m.user?.fullName || m.userId}</span>
                            <span className="text-xs text-gray-500 font-mono">{m.userId}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                            <Dropdown
                              value={m.role}
                              onChange={(v) => updateRole(m.userId, v as any)}
                              options={[
                                { value: 'DEPT_MEMBER', label: 'Member' },
                                { value: 'DEPT_HEAD', label: 'Head' },
                                { value: 'OBSERVER', label: 'Observer' },
                              ]}
                              title="Change role"
                            />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            className="text-rose-600 hover:text-rose-700"
                            onClick={() => removeMember(m.userId)}
                            title="Remove from department"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {members.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-gray-500">No members yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
