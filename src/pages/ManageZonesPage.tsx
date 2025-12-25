// frontend/src/pages/ManageZonesPage.tsx
import React, { useEffect, useState } from 'react';
import { Page } from '../components/layout/Page';
import { useContextStore } from '../store/contextStore';
import { useAuthStore } from '../store/authStore';
import { zonesService, type ZoneItem } from '../services/zones';
import { eventsService } from '../services/events';
import { Spinner } from '../components/ui/Spinner';
import { Dropdown } from '../components/ui/Dropdown';
import { SideDrawer } from '../components/ui/SideDrawer';
import { MapPin, Plus, Wrench, Trash2 } from 'lucide-react';

export const ManageZonesPage: React.FC = () => {
  const { currentEventId, currentEventName, canAdminEvent } = useContextStore();
  const isSA = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);
  const isTM = !!useAuthStore((s) => s.currentUser?.isTenantManager);

  const [zonesEnabled, setZonesEnabled] = useState(false);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [zoneErr, setZoneErr] = useState<string | null>(null);

  const [zdeptName, setZdeptName] = useState('');
  const [zdeptList, setZdeptList] = useState<{ id: string; name: string }[]>([]);

  const [editingZone, setEditingZone] = useState<ZoneItem | null>(null);
  const [assignments, setAssignments] = useState<{ userId: string; role: 'HEAD' | 'POC' | 'MEMBER'; user?: { fullName: string; email: string } }[]>([]);
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState<'HEAD' | 'POC' | 'MEMBER'>('MEMBER');

  const [eventMembers, setEventMembers] = useState<{ userId: string; user?: { fullName: string } }[]>([]);

  useEffect(() => {
    if (!currentEventId) return;
    let mounted = true;
    (async () => {
      try {
        const e = await eventsService.get(currentEventId);
        if (mounted) setZonesEnabled(!!e.zonesEnabled);

        if (e.zonesEnabled) {
          setZonesLoading(true);
          const z = await zonesService.list(currentEventId).catch(() => []);
          const zd = await zonesService.listZonalDepts(currentEventId).catch(() => []);
          if (mounted) {
            setZones(z || []);
            setZdeptList(zd || []);
          }
        }
      } catch { } finally {
        if (mounted) setZonesLoading(false);
      }

      const em = await eventsService.members.list(currentEventId).catch(() => []);
      if (mounted) setEventMembers(em || []);
    })();
    return () => { mounted = false; };
  }, [currentEventId]);

  if (!canAdminEvent && !isSA && !isTM) return <div className="p-6">You do not have admin permissions for this event.</div>;

  return (
    <Page className="space-y-6">
      <div className="flex items-center">
        <Wrench size={22} className="text-fuchsia-600 mr-2" />
        <h1 className="text-2xl font-semibold">Event Settings • Manage Zones</h1>
        <span className="ml-3 text-sm text-gray-500">{currentEventName}</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center">
          <MapPin size={18} className="text-fuchsia-600 mr-2" />
          <div className="font-medium">Zones (optional)</div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-gray-600">Enable Zones</span>
            <input
              type="checkbox"
              checked={zonesEnabled}
              onChange={async (e) => {
                const enabled = e.target.checked;
                setZonesEnabled(enabled);
                try {
                  await zonesService.toggle(currentEventId!, enabled);
                } catch { }
                if (enabled) {
                  setZonesLoading(true);
                  const zs = await zonesService.list(currentEventId!).catch(() => []);
                  setZones(zs || []);
                  setZonesLoading(false);
                } else {
                  setZones([]);
                }
              }}
            />
          </div>
        </div>

        {zonesEnabled && (
          <>
            <div className="flex items-center gap-2">
              <input
                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm flex-1"
                placeholder="New zone name"
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
              />
              <button
                className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2 text-sm"
                onClick={async () => {
                  const name = newZoneName.trim();
                  if (!name) return;
                  try {
                    setZonesLoading(true);
                    const z = await zonesService.create(currentEventId!, { name });
                    setZones((prev) => [...prev, z]);
                    setNewZoneName('');
                  } catch (e: any) {
                    setZoneErr(e?.message || 'Failed to create zone');
                  } finally {
                    setZonesLoading(false);
                  }
                }}
              >
                <Plus size={16} className="mr-1" />Add Zone
              </button>
            </div>
            {zoneErr && (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-2">{zoneErr}</div>
            )}
            {zonesLoading && (
              <div>
                <Spinner size="sm" label="Loading zones" />
              </div>
            )}

            {/* Zones table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2">Zone</th>
                    <th className="text-left px-4 py-2">Enabled</th>
                    <th className="text-right px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z.id} className="border-b last:border-0">
                      <td className="px-4 py-2">{z.name}</td>
                      <td className="px-4 py-2">{z.enabled ? <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs">Enabled</span> : <span className="text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-xs">Disabled</span>}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          className="inline-flex items-center bg-gray-800 hover:bg-gray-900 text-white rounded-md px-3 py-1.5"
                          onClick={async () => {
                            setEditingZone(z);
                            const rows = await zonesService.listAssignments(currentEventId!, z.id).catch(() => []);
                            setAssignments(rows as any);
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {zones.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm text-gray-500">No zones yet. Create one above.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Zonal Departments templates as table */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="font-medium mb-2">Zonal Departments (applies to all zones)</div>
              <div className="flex items-center gap-2 mb-2">
                <input className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm" placeholder="New zonal department name" value={zdeptName} onChange={(e) => setZdeptName(e.target.value)} />
                <button className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2 text-sm" onClick={async () => { const name = zdeptName.trim(); if (!name) return; await zonesService.createZonalDept(currentEventId!, name); setZdeptName(''); const list = await zonesService.listZonalDepts(currentEventId!); setZdeptList(list || []); }}><Plus size={16} className="mr-1" />Add</button>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2">Name</th>
                      <th className="text-right px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zdeptList.map((d) => (
                      <tr key={d.id} className="border-b last:border-0">
                        <td className="px-4 py-2">{d.name}</td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <button className="text-gray-800 hover:text-black mr-3" onClick={async () => {
                            const next = prompt('Rename zonal department', d.name)?.trim();
                            if (!next || next === d.name) return;
                            try { await zonesService.updateZonalDept(currentEventId!, d.id, next); const list = await zonesService.listZonalDepts(currentEventId!); setZdeptList(list || []); } catch (e: any) { alert(e?.message || 'Failed to rename'); }
                          }}>Rename</button>
                          <button className="text-rose-600 hover:text-rose-700" onClick={async () => {
                            if (!confirm('Delete this zonal department? It will be removed from all zones.')) return;
                            try { await zonesService.deleteZonalDept(currentEventId!, d.id); const list = await zonesService.listZonalDepts(currentEventId!); setZdeptList(list || []); } catch (e: any) { alert(e?.message || 'Failed to delete'); }
                          }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                    {zdeptList.length === 0 && (
                      <tr><td className="px-4 py-3 text-sm text-gray-500">No zonal departments yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Zone Drawer */}
      {editingZone && (
        <SideDrawer
          open={!!editingZone}
          onClose={() => { setEditingZone(null); setAssignments([]); setAddUserId(''); setAddRole('MEMBER'); }}
          maxWidthClass="max-w-2xl"
          header={<div><div className="text-xl font-semibold">Edit Zone</div><div className="text-sm text-gray-600">{editingZone.name}</div></div>}
        >
          <div className="p-5 space-y-6">
            <div className="bg-white rounded">
              <div className="grid md:grid-cols-3 gap-2">
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Zone Name</label>
                  <input className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm" value={editingZone.name} onChange={(e) => setEditingZone({ ...editingZone, name: e.target.value })} />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center text-sm"><input type="checkbox" className="mr-2" checked={editingZone.enabled} onChange={(e) => setEditingZone({ ...editingZone, enabled: e.target.checked })} /> Enabled</label>
                </div>
              </div>
              <div className="mt-2 text-right">
                <button className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2 text-sm" onClick={async () => {
                  const updated = await zonesService.update(currentEventId!, editingZone.id, { name: editingZone.name, enabled: editingZone.enabled });
                  // reflect in list
                  setZones((prev) => prev.map(z => z.id === updated.id ? updated : z));
                }}>Save Details</button>
              </div>
            </div>

            {/* Zone Departments selection removed */}

            <div>
              <div className="font-medium mb-2">Assignments (Head, POC, Members)</div>
              <div className="flex items-center gap-2 mb-2">
                <Dropdown value={addUserId} onChange={(v) => setAddUserId(v)} options={[{ value: '', label: 'Select user' }, ...eventMembers.map(m => ({ value: m.userId, label: m.user?.fullName || m.userId }))]} />
                <Dropdown value={addRole} onChange={(v) => setAddRole(v as any)} options={[{ value: 'MEMBER', label: 'Member' }, { value: 'POC', label: 'POC' }, { value: 'HEAD', label: 'Head' }]} />
                <button className="inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-2 text-sm" disabled={!addUserId} onClick={async () => {
                  await zonesService.addAssignment(currentEventId!, editingZone.id, { userId: addUserId, role: addRole });
                  const u = eventMembers.find(m => m.userId === addUserId)?.user;
                  const exists = assignments.find(a => a.userId === addUserId);
                  if (exists) {
                    setAssignments((prev) => prev.map(a => a.userId === addUserId ? { ...a, role: addRole } as any : a));
                  } else {
                    setAssignments((prev) => [{ userId: addUserId, role: addRole, user: u } as any, ...prev]);
                  }
                  setAddUserId('');
                }}>Add</button>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2">Name</th>
                      <th className="text-left px-4 py-2">Email</th>
                      <th className="text-left px-4 py-2">Role</th>
                      <th className="text-right px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr key={a.userId} className="border-b last:border-0">
                        <td className="px-4 py-2">{a.user?.fullName || a.userId}</td>
                        <td className="px-4 py-2">{a.user?.email || '-'}</td>
                        <td className="px-4 py-2">
                          <Dropdown value={a.role} onChange={async (v) => { await zonesService.updateAssignment(currentEventId!, editingZone.id, a.userId, v as any); setAssignments((prev) => prev.map(x => x.userId === a.userId ? { ...x, role: v as any } : x)); }} options={[{ value: 'MEMBER', label: 'Member' }, { value: 'POC', label: 'POC' }, { value: 'HEAD', label: 'Head' }]} />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button className="text-rose-600 hover:text-rose-700" onClick={async () => { await zonesService.removeAssignment(currentEventId!, editingZone.id, a.userId); setAssignments((prev) => prev.filter(x => x.userId !== a.userId)); }}>Remove</button>
                        </td>
                      </tr>
                    ))}
                    {assignments.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-3 text-sm text-gray-500">No assignments yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </SideDrawer>
      )}
    </Page>
  );
};
