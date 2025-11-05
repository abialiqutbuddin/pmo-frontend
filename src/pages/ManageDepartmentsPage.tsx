// frontend/src/pages/ManageDepartmentsPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Page } from '../components/layout/Page';
import { useContextStore } from '../store/contextStore';
import { useAuthStore } from '../store/authStore';
import { departmentsService, type Department, type DeptMember } from '../services/departments';
import { usersService } from '../services/users';
import { Spinner } from '../components/ui/Spinner';
import { Building2, Plus, Search, Shield, Trash2, Pencil, UserPlus, Wrench } from 'lucide-react';
import { Dropdown } from '../components/ui/Dropdown';

type DeptOverview = { id: string; name: string; heads: string[]; memberCount: number };

export const ManageDepartmentsPage: React.FC = () => {
  const { currentEventId, currentEventName, canAdminEvent } = useContextStore();
  const isSuperAdmin = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);

  const [depts, setDepts] = useState<Department[]>([]);
  const [deptsLoading, setDeptsLoading] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [deptErr, setDeptErr] = useState<string | null>(null);
  const [overview, setOverview] = useState<DeptOverview[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [activeDeptId, setActiveDeptId] = useState<string>('');

  const [members, setMembers] = useState<DeptMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersErr, setMembersErr] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [assignable, setAssignable] = useState<{ userId: string; fullName: string; email: string }[]>([]);
  const [assignRole, setAssignRole] = useState<'DEPT_HEAD' | 'DEPT_MEMBER' | 'OBSERVER'>('DEPT_MEMBER');
  const [assignLoading, setAssignLoading] = useState(false);
  const [globalUsers, setGlobalUsers] = useState<{ id: string; fullName: string; email: string }[]>([]);
  const [assignUserId, setAssignUserId] = useState<string>('');
  const [assignOpen, setAssignOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!currentEventId || !canAdminEvent) return;
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
  }, [currentEventId, canAdminEvent]);

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
    if (!currentEventId || !activeDeptId || !canAdminEvent) return;
    setMembersLoading(true);
    setMembersErr(null);
    departmentsService.members
      .list(currentEventId, activeDeptId)
      .then((rows) => setMembers(rows || []))
      .catch((e) => setMembersErr(e?.message || 'Failed to load members'))
      .finally(() => setMembersLoading(false));
  }, [currentEventId, activeDeptId, canAdminEvent]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!currentEventId || !activeDeptId || !canAdminEvent) return;
      if (isSuperAdmin) {
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
  }, [query, activeDeptId, currentEventId, canAdminEvent, isSuperAdmin, globalUsers.length, members.map(m=>m.userId).join(',')]);

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
      // Remove from candidate list and clear selection
      setAssignable((prev) => prev.filter((u) => u.userId !== userId));
      setAssignUserId('');
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

  if (!canAdminEvent) return <div className="p-6">You do not have admin permissions for this event.</div>;

  return (
    <Page className="space-y-6">
      <div className="flex items-center">
        <Wrench size={22} className="text-fuchsia-600 mr-2" />
        <h1 className="text-2xl font-semibold">Event Settings • Manage Departments</h1>
        <span className="ml-3 text-sm text-gray-500">{currentEventName}</span>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 md:col-span-1">
          <div className="flex items-center mb-1">
            <Building2 size={18} className="text-emerald-600 mr-2" />
            <div className="font-medium">Departments</div>
          </div>
          <div className="flex items-center gap-2">
            <input className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm" placeholder="New department name" value={newDeptName} onChange={(e)=> setNewDeptName(e.target.value)} />
            <button onClick={createDept} disabled={!newDeptName.trim()} className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2 text-sm"><Plus size={16} className="mr-1"/>Create</button>
          </div>
          {deptsLoading && <div className="mt-2"><Spinner size="sm" label="Loading departments"/></div>}
          {deptErr && <div className="text-xs text-rose-600">{deptErr}</div>}
          <div className="border border-gray-100 rounded divide-y mt-2">
            {(overview.length ? overview : depts.map((d) => ({ id: d.id, name: d.name, heads: [] as string[], memberCount: 0 } as any))).map((o: any) => (
              <button key={o.id} className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-gray-50 ${activeDeptId===o.id?'bg-blue-50':''}`} onClick={()=> setActiveDeptId(o.id)}>
                <div>
                  <div className="font-medium text-gray-900">{o.name}</div>
                  <div className="text-xs text-gray-500">{(o.heads && o.heads.length) ? o.heads.join(', ') : 'No heads'}</div>
                </div>
                <span className="text-xs text-gray-600">{o.memberCount ?? 0} members</span>
              </button>
            ))}
            {(!overview.length && !depts.length) && (<div className="px-3 py-4 text-sm text-gray-500">No departments yet. Create one above.</div>)}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 md:col-span-2">
          {activeDept ? (
            <>
              <div className="flex items-center mb-3">
                <div className="font-medium">{activeDept.name}</div>
                <button className="ml-auto text-sm text-gray-600 hover:text-gray-900 inline-flex items-center" onClick={() => {
                  const name = prompt('Rename department', activeDept.name);
                  if (name && name.trim()) renameDept(activeDept.id, name.trim());
                }}><Pencil size={14} className="mr-1"/>Rename</button>
                <button className="ml-3 text-sm text-rose-600 hover:text-rose-700 inline-flex items-center" onClick={() => deleteDept(activeDept.id)}><Trash2 size={14} className="mr-1"/>Delete</button>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
                  <input
                    className="w-full pl-7 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                    placeholder="Search users to add"
                    value={query}
                    onChange={(e)=> { setQuery(e.target.value); setAssignUserId(''); setAssignOpen(true); }}
                    onFocus={() => setAssignOpen(true)}
                    onBlur={() => setTimeout(()=> setAssignOpen(false), 150)}
                  />
                  {assignOpen && assignable.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-sm max-h-56 overflow-auto">
                      {assignable.map(u => (
                        <button
                          key={u.userId}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${assignUserId===u.userId ? 'bg-blue-50' : ''}`}
                          onClick={() => { setAssignUserId(u.userId); setQuery(u.fullName || u.email || u.userId); setAssignOpen(false); }}
                        >
                          <div className="font-medium text-gray-900">{u.fullName || u.email || u.userId}</div>
                          <div className="text-xs text-gray-500">{u.userId}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Dropdown value={assignRole} onChange={(v)=> setAssignRole(v as any)} options={[{ value: 'DEPT_MEMBER', label: 'Member' }, { value: 'DEPT_HEAD', label: 'Head' }, { value: 'OBSERVER', label: 'Observer' }]} />
                <button
                  className="inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-2 text-sm"
                  disabled={!assignable.length || assignLoading}
                  onClick={()=> {
                    const target = assignUserId || (assignable[0]?.userId || '');
                    if (!target) return;
                    addMember(target);
                  }}
                >
                  <UserPlus size={16} className="mr-1"/>Add
                </button>
              </div>
              {/* Searchable dropdown replaces list of candidates */}
              <div className="border rounded divide-y">
                {membersLoading && <div className="p-3"><Spinner size="sm" label="Loading members"/></div>}
                {membersErr && <div className="p-3 text-rose-600 text-sm">{membersErr}</div>}
                {members.map((m)=> (
                  <div key={m.userId} className="px-3 py-2 flex items-center">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{m.user?.fullName || m.userId}</div>
                      <div className="text-xs text-gray-500">{m.user?.email}</div>
                    </div>
                    <Dropdown value={m.role} onChange={(v)=> updateRole(m.userId, v as any)} options={[{ value: 'DEPT_MEMBER', label: 'Member' }, { value: 'DEPT_HEAD', label: 'Head' }, { value: 'OBSERVER', label: 'Observer' }]} />
                    <button className="ml-2 text-rose-600 hover:text-rose-700 text-sm" onClick={()=> removeMember(m.userId)}>Remove</button>
                  </div>
                ))}
                {(!membersLoading && members.length===0) && <div className="px-3 py-4 text-sm text-gray-500">No members yet.</div>}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500">Select a department</div>
          )}
        </div>
      </div>
    </Page>
  );
};
