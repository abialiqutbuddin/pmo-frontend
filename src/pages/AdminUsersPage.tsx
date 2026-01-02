// frontend/src/pages/AdminUsersPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { usersService, type User } from '../services/users';
import { eventsService } from '../services/events';
import { rolesService, type Role } from '../services/roles';
import { Users2, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Shield } from 'lucide-react';
import { SideDrawer } from '../components/ui/SideDrawer';
import { Spinner } from '../components/ui/Spinner';
import { usePageStateStore } from '../store/pageStateStore';

export const AdminUsersPage: React.FC = () => {
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const adminUsers = usePageStateStore((s) => s.adminUsers);
  const setAdminUsers = usePageStateStore((s) => s.setAdminUsers);
  const q = adminUsers.q;

  // create drawer state
  const showCreate = adminUsers.showCreate;
  const [creating, setCreating] = useState(false);
  const [itsId, setItsId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [organization, setOrganization] = useState('');
  const [designation, setDesignation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isTM, setIsTM] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);

  // Event assignment state
  const [availableEvents, setAvailableEvents] = useState<{ id: string; name: string }[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Role assignment state
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  const [editing, setEditing] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editTM, setEditTM] = useState(false);
  const [editDisabled, setEditDisabled] = useState(false);
  const [editItsId, setEditItsId] = useState('');
  const [editOrg, setEditOrg] = useState('');
  const [editDesig, setEditDesig] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editProfile, setEditProfile] = useState('');

  // Load users on mount
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr(null);
    usersService
      .list()
      .then((data) => mounted && setRows(data || []))
      .catch((e) => mounted && setErr(e?.message || 'Failed to load users'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch events and roles when create drawer opens
  useEffect(() => {
    if (showCreate) {
      setLoadingEvents(true);

      Promise.all([
        eventsService.list(),
        rolesService.list()
      ])
        .then(([events, roles]) => {
          setAvailableEvents(events);
          setAvailableRoles(roles);
        })
        .catch(console.error)
        .finally(() => setLoadingEvents(false));

      // Reset selection when opening
      setSelectedEventIds(new Set());
      setSelectedRoleId('');
    } else {
      setSelectedEventIds(new Set());
      setSelectedRoleId('');
    }
  }, [showCreate]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((u) =>
      u.email.toLowerCase().includes(term)
      || u.fullName.toLowerCase().includes(term)
      || (u.itsId || '').toLowerCase().includes(term)
      || (u.organization || '').toLowerCase().includes(term)
      || (u.designation || '').toLowerCase().includes(term)
      || (u.phoneNumber || '').toLowerCase().includes(term)
      || u.id.includes(term),
    );
  }, [rows, q]);

  async function createUser() {
    if (!itsId.trim() || !fullName.trim() || !email.trim()) return;
    setCreating(true);
    setErr(null);
    try {
      const u = await usersService.create({
        itsId: itsId.trim(),
        fullName: fullName.trim(),
        email: email.trim(),
        profileImage: profileImage.trim() || undefined,
        organization: organization.trim() || undefined,
        designation: designation.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
        isTenantManager: !!isTM,
        isDisabled: !!isDisabled,
        eventIds: Array.from(selectedEventIds),
        eventRoleId: selectedRoleId || undefined,
      });
      setRows((prev) => [u, ...prev]);
      setAdminUsers({ showCreate: false });
      setItsId('');
      setFullName('');
      setEmail('');
      setProfileImage('');
      setOrganization('');
      setDesignation('');
      setPhoneNumber('');
      setIsTM(false);
      setIsDisabled(false);
      setSelectedRoleId('');
    } catch (e: any) {
      setErr(e?.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  async function updateUser(id: string, patch: Partial<User> & { password?: string }) {
    const updated = await usersService.update(id, patch);
    setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete user?')) return;
    await usersService.remove(id);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center">
        <Users2 size={22} className="text-fuchsia-600 mr-2" />
        <h1 className="text-2xl font-semibold">Users</h1>
      </div>

      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{err}</div>}

      {/* Create user button opens drawer */}
      <div className="flex items-center">
        <button
          className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2 text-sm"
          onClick={() => setAdminUsers({ showCreate: true })}
          title="Create user"
        >
          <Plus size={16} className="mr-1" /> New User
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center">
        <input
          className="w-full max-w-md rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          placeholder="Search by name or email"
          value={q}
          onChange={(e) => setAdminUsers({ q: e.target.value })}
          title="Filter users"
        />
      </div>

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-6"><Spinner label="Loading users" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 text-gray-600">Full name</th>
                <th className="text-left px-4 py-2 text-gray-600">Email</th>
                <th className="text-left px-4 py-2 text-gray-600">ITS</th>
                <th className="text-left px-4 py-2 text-gray-600">Org</th>
                <th className="text-left px-4 py-2 text-gray-600">Designation</th>
                <th className="text-left px-4 py-2 text-gray-600">Phone</th>
                <th className="text-left px-4 py-2 text-gray-600">Tenant Manager</th>
                <th className="text-left px-4 py-2 text-gray-600">Status</th>
                <th className="text-right px-4 py-2 text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{u.fullName}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2 font-mono text-xs">{u.itsId || '—'}</td>
                  <td className="px-4 py-2">{u.organization || '—'}</td>
                  <td className="px-4 py-2">{u.designation || '—'}</td>
                  <td className="px-4 py-2">{u.phoneNumber || '—'}</td>
                  <td className="px-4 py-2">
                    <button
                      className={`inline-flex items-center rounded px-2 py-1 border text-xs ${u.isTenantManager ? 'border-fuchsia-300 text-fuchsia-700 bg-fuchsia-50' : 'border-gray-300 text-gray-700 bg-gray-50'}`}
                      onClick={() => updateUser(u.id, { isTenantManager: !u.isTenantManager })}
                      title="Toggle Tenant Manager"
                    >
                      <Shield size={14} className="mr-1" /> {u.isTenantManager ? 'Manager' : 'Standard'}
                    </button>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      className="inline-flex items-center text-gray-700"
                      onClick={() => updateUser(u.id, { isDisabled: !u.isDisabled })}
                      title={u.isDisabled ? 'Enable user' : 'Disable user'}
                    >
                      {u.isDisabled ? (
                        <>
                          <ToggleLeft size={18} className="text-rose-600 mr-1" /> Disabled
                        </>
                      ) : (
                        <>
                          <ToggleRight size={18} className="text-emerald-600 mr-1" /> Active
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-gray-700 hover:text-black mr-3"
                      onClick={() => {
                        setEditing(u);
                        setEditFullName(u.fullName);
                        setEditEmail(u.email);
                        setEditPassword('');
                        setEditTM(!!u.isTenantManager);
                        setEditDisabled(!!u.isDisabled);
                        setEditItsId(u.itsId || '');
                        setEditOrg(u.organization || '');
                        setEditDesig(u.designation || '');
                        setEditPhone(u.phoneNumber || '');
                        setEditProfile(u.profileImage || '');
                      }}
                      title="Edit user"
                    >
                      <Pencil size={16} />
                    </button>
                    <button className="text-rose-600 hover:text-rose-700" onClick={() => deleteUser(u.id)} title="Delete user">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create User Drawer */}
      <SideDrawer
        open={showCreate}
        onClose={() => setAdminUsers({ showCreate: false })}
        maxWidthClass="max-w-2xl"
        header={<div className="text-xl font-semibold">Create User</div>}
      >
        <div className="p-5 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">ITS ID<span className="text-rose-600"> *</span></label>
              <input
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="e.g., 12345678"
                value={itsId}
                maxLength={8}
                onChange={(e) => setItsId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Full name<span className="text-rose-600"> *</span></label>
              <input
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Email<span className="text-rose-600"> *</span></label>
              <input
                type="email"
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Phone</label>
              <input
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Organization</label>
              <input
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Designation</label>
              <input
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Profile Image (URL)</label>
              <input
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                value={profileImage}
                onChange={(e) => setProfileImage(e.target.value)}
                placeholder="https://.../avatar.jpg"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="inline-flex items-center text-sm text-gray-700">
              <input type="checkbox" className="mr-2" checked={isTM} onChange={(e) => setIsTM(e.target.checked)} />
              Tenant Manager
            </label>
            <label className="inline-flex items-center text-sm text-gray-700">
              <input type="checkbox" className="mr-2" checked={isDisabled} onChange={(e) => setIsDisabled(e.target.checked)} />
              Disabled
            </label>
          </div>

          <div className="border-t pt-3">
            <label className="block text-sm mb-2 font-medium">Assign to Events (Optional)</label>
            {loadingEvents ? <div className="text-center text-sm py-2">Loading events...</div> : (
              <div className="border rounded-md max-h-40 overflow-y-auto bg-white p-1 space-y-1">
                {availableEvents.length === 0 ? <div className="text-sm text-gray-400 p-2">No events found.</div> : availableEvents.map(ev => (
                  <label key={ev.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={selectedEventIds.has(ev.id)}
                      onChange={e => {
                        const next = new Set(selectedEventIds);
                        if (e.target.checked) next.add(ev.id);
                        else next.delete(ev.id);
                        setSelectedEventIds(next);
                      }}
                    />
                    <span className="text-sm">{ev.name}</span>
                  </label>
                ))}
              </div>
            )}
            {selectedEventIds.size > 0 && (
              <div className="mt-3">
                <label className="block text-sm mb-1 font-medium">Role for selected events</label>
                <select
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                  value={selectedRoleId}
                  onChange={e => setSelectedRoleId(e.target.value)}
                >
                  <option value="">No specific role</option>
                  {availableRoles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button className="px-3 py-2 rounded-md text-sm text-gray-700 hover:text-black" onClick={() => setAdminUsers({ showCreate: false })}>
              Cancel
            </button>
            <button
              className="px-3 py-2 rounded-md text-sm bg-blue-600 hover:bg-blue-700 text-white"
              onClick={createUser}
              disabled={creating || !itsId || !fullName || !email}
            >
              Create
            </button>
          </div>
          <div className="text-xs text-gray-500">Fields marked * are required. Initial password is the ITS ID.</div>
        </div>
      </SideDrawer>

      {/* Edit Drawer */}
      <SideDrawer
        open={!!editing}
        onClose={() => setEditing(null)}
        maxWidthClass="max-w-md"
        header={<div className="text-xl font-semibold">Edit User</div>}
      >
        {editing && (
          <div className="p-5 space-y-3">
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">ITS ID</label>
                <input
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editItsId}
                  onChange={(e) => setEditItsId(e.target.value.slice(0, 8))}
                />
                <div className="text-xs text-gray-500 mt-1">Max 8 characters</div>
              </div>
              <div>
                <label className="block text-sm mb-1">Full name</label>
                <input
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Email</label>
                <input
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm mb-1">Phone</label>
                  <input
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Organization</label>
                  <input
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={editOrg}
                    onChange={(e) => setEditOrg(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm mb-1">Designation</label>
                  <input
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={editDesig}
                    onChange={(e) => setEditDesig(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Profile Image (URL)</label>
                  <input
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={editProfile}
                    onChange={(e) => setEditProfile(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Password (leave blank to keep)</label>
                <input
                  type="password"
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={editTM}
                    onChange={(e) => setEditTM(e.target.checked)}
                  />
                  Tenant Manager
                </label>
                <label className="inline-flex items-center text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={editDisabled}
                    onChange={(e) => setEditDisabled(e.target.checked)}
                  />
                  Disabled
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded-md text-sm text-gray-700 hover:text-black"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                className="px-3 py-2 rounded-md text-sm bg-blue-600 hover:bg-blue-700 text-white"
                onClick={async () => {
                  if (!editing) return;
                  const patch: any = {
                    itsId: editItsId || undefined,
                    fullName: editFullName,
                    email: editEmail,
                    profileImage: editProfile || undefined,
                    organization: editOrg || undefined,
                    designation: editDesig || undefined,
                    phoneNumber: editPhone || undefined,
                    isTenantManager: editTM,
                    isDisabled: editDisabled,
                  };
                  if (editPassword) patch.password = editPassword;
                  await updateUser(editing.id, patch);
                  setEditing(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </SideDrawer>
    </div>
  );
};
