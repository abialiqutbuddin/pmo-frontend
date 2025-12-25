
import React, { useEffect, useState } from 'react';
import { Page } from '../components/layout/Page';
import { Spinner } from '../components/ui/Spinner';
import { useAuthStore } from '../store/authStore';
import { api } from '../api';
import { Plus, Shield, Check, X, Pencil, Trash2, Globe, Layout, Layers } from 'lucide-react';

interface Module {
    id: string;
    key: string;
    name: string;
    description?: string;
}

interface Permission {
    moduleId: string;
    actions: string[];
}

type RoleScope = 'EVENT' | 'DEPARTMENT' | 'BOTH';

interface Role {
    id: string;
    name: string;
    description?: string;
    isSystem: boolean;
    scope: RoleScope;
    permissions: {
        moduleId: string;
        module: Module;
        actions: string[];
    }[];
}

export const RolesPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [roles, setRoles] = useState<Role[]>([]);
    const [modules, setModules] = useState<Module[]>([]);

    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);

    // Form State
    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formScope, setFormScope] = useState<RoleScope>('BOTH');
    // Map moduleId -> actions[]
    const [formPerms, setFormPerms] = useState<Record<string, string[]>>({});

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [r, m] = await Promise.all([
                api.get<Role[]>('/roles'),
                api.get<Module[]>('/roles/modules')
            ]);
            setRoles(r);
            // Filter out tenant-level modules as requested
            setModules(m.filter(mod => !['users', 'roles'].includes(mod.key)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    function openCreate() {
        setEditingRole(null);
        setFormName('');
        setFormDesc('');
        setFormScope('BOTH');
        setFormPerms({});
        setShowModal(true);
    }

    function openEdit(r: Role) {
        if (r.isSystem) return; // Cannot edit system roles
        setEditingRole(r);
        setFormName(r.name);
        setFormDesc(r.description || '');
        setFormScope(r.scope || 'BOTH');

        // Populate perms
        const map: Record<string, string[]> = {};
        r.permissions.forEach(p => {
            map[p.moduleId] = p.actions;
        });
        setFormPerms(map);

        setShowModal(true);
    }

    function toggleAction(moduleId: string, action: string) {
        setFormPerms(prev => {
            const current = prev[moduleId] || [];
            const has = current.includes(action);
            let next = [];
            if (has) next = current.filter(a => a !== action);
            else next = [...current, action];
            return { ...prev, [moduleId]: next };
        });
    }

    // Helpers for UI Chks
    function isView(mid: string) { return (formPerms[mid] || []).includes('read'); }
    function isEdit(mid: string) {
        const acts = formPerms[mid] || [];
        return acts.includes('update') || acts.includes('create');
    }
    function isDelete(mid: string) { return (formPerms[mid] || []).includes('delete'); }

    function toggleView(mid: string) {
        if (isView(mid)) {
            // Turn off read -> usually turns off everything? Or just read?
            // Let's just toggle 'read'
            toggleAction(mid, 'read');
        } else {
            toggleAction(mid, 'read');
        }
    }
    function toggleEdit(mid: string) {
        const on = !isEdit(mid);
        setFormPerms(prev => {
            const cur = new Set(prev[mid] || []);
            if (on) {
                cur.add('update');
                cur.add('create');
                cur.add('read');
            } else {
                cur.delete('update');
                cur.delete('create');
            }
            return { ...prev, [mid]: Array.from(cur) };
        });
    }
    function toggleDelete(mid: string) {
        toggleAction(mid, 'delete');
        if (!isDelete(mid)) {
            setFormPerms(prev => {
                const cur = new Set(prev[mid] || []);
                cur.add('read');
                return { ...prev, [mid]: Array.from(cur) };
            });
        }
    }

    async function save() {
        if (!formName.trim()) return;
        setSubmitting(true);
        try {
            // Convert map to array for backend
            const permissions = Object.entries(formPerms).map(([moduleId, actions]) => ({
                moduleId,
                actions
            })).filter(p => p.actions.length > 0);

            if (editingRole) {
                // Update existing role
                await api.put(`/roles/${editingRole.id}`, {
                    name: formName,
                    description: formDesc,
                    scope: formScope,
                    permissions
                });
            } else {
                // Create new role, then assign permissions
                const newRole = await api.post<Role>('/roles', {
                    name: formName,
                    description: formDesc,
                    scope: formScope,
                });

                // Assign permissions to the newly created role
                if (permissions.length > 0) {
                    await api.put(`/roles/${newRole.id}`, { permissions });
                }
            }

            await loadData();
            setShowModal(false);
        } catch (e: any) {
            alert(e?.message || 'Failed to save');
        } finally {
            setSubmitting(false);
        }
    }

    async function remove(id: string) {
        if (!confirm('Delete this role?')) return;
        try {
            await api.delete(`/roles/${id}`);
            setRoles(prev => prev.filter(r => r.id !== id));
        } catch (e: any) {
            alert(e?.message || 'Failed to delete');
        }
    }

    function getScopeIcon(scope: RoleScope) {
        switch (scope) {
            case 'EVENT': return <Globe size={14} className="mr-1" />;
            case 'DEPARTMENT': return <Layout size={14} className="mr-1" />;
            default: return <Layers size={14} className="mr-1" />;
        }
    }

    function getScopeLabel(scope: RoleScope) {
        switch (scope) {
            case 'EVENT': return 'Global Only';
            case 'DEPARTMENT': return 'Department Only';
            default: return 'Global & Department';
        }
    }

    return (
        <Page>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="text-2xl font-semibold">Roles & Permissions</div>
                    <div className="text-gray-500 text-sm">Manage access control for your organization</div>
                </div>
                <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-blue-700">
                    <Plus size={18} className="mr-2" />
                    New Role
                </button>
            </div>

            {loading && <Spinner />}
            {!loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {roles.map(r => (
                        <div key={r.id} className="bg-white border rounded-lg p-5 shadow-sm hover:shadow-md transition">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center">
                                    <Shield size={20} className={`mr-2 ${r.isSystem ? 'text-gray-400' : 'text-blue-600'}`} />
                                    <h3 className="font-semibold text-lg">{r.name}</h3>
                                </div>
                                {!r.isSystem && (
                                    <div className="flex gap-2">
                                        <button onClick={() => openEdit(r)} className="text-gray-500 hover:text-blue-600"><Pencil size={16} /></button>
                                        <button onClick={() => remove(r.id)} className="text-gray-500 hover:text-red-600"><Trash2 size={16} /></button>
                                    </div>
                                )}
                            </div>
                            <p className="text-sm text-gray-600 mb-4 h-10 line-clamp-2">{r.description || 'No description'}</p>

                            <div className="flex items-center gap-2 mt-auto">
                                <div className={`text-xs px-2 py-1 rounded flex items-center border ${r.scope === 'DEPARTMENT' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                        r.scope === 'EVENT' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                            'bg-gray-50 text-gray-600 border-gray-200'
                                    }`}>
                                    {getScopeIcon(r.scope || 'BOTH')}
                                    {getScopeLabel(r.scope || 'BOTH')}
                                </div>
                                <div className="text-xs text-gray-500 bg-gray-50 p-1 px-2 rounded border border-gray-100 ml-auto">
                                    {r.isSystem ? 'System' : `${r.permissions.length} Modules`}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b">
                            <h2 className="text-xl font-bold">{editingRole ? 'Edit Role' : 'Create Role'}</h2>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Role Name</label>
                                    <input className="w-full border rounded px-3 py-2" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Project Manager" autoFocus />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Scope</label>
                                    <select
                                        className="w-full border rounded px-3 py-2 bg-white"
                                        value={formScope}
                                        onChange={e => setFormScope(e.target.value as RoleScope)}
                                    >
                                        <option value="BOTH">Global & Department (Anywhere)</option>
                                        <option value="DEPARTMENT">Department Only (Department Specific)</option>
                                        <option value="EVENT">Global Only (Event Wide)</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {formScope === 'DEPARTMENT' && 'This role can only be assigned within specific departments.'}
                                        {formScope === 'EVENT' && 'This role can only be assigned as a global event role.'}
                                        {formScope === 'BOTH' && 'This role can be used globally or within departments.'}
                                    </p>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">Description</label>
                                    <input className="w-full border rounded px-3 py-2" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Role responsibilities..." />
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold mb-3">Module Permissions</h3>
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b text-left">
                                            <tr>
                                                <th className="px-4 py-3">Module</th>
                                                <th className="px-4 py-3 w-24 text-center">View</th>
                                                <th className="px-4 py-3 w-24 text-center">Edit</th>
                                                <th className="px-4 py-3 w-24 text-center">Delete</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {modules.map(m => (
                                                <tr key={m.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium">{m.name}</div>
                                                        <div className="text-xs text-gray-500">{m.description}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input type="checkbox" checked={isView(m.id)} onChange={() => toggleView(m.id)} className="w-4 h-4 rounded text-blue-600" />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input type="checkbox" checked={isEdit(m.id)} onChange={() => toggleEdit(m.id)} className="w-4 h-4 rounded text-blue-600" />
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input type="checkbox" checked={isDelete(m.id)} onChange={() => toggleDelete(m.id)} className="w-4 h-4 rounded text-blue-600" />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-lg">
                            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded">Cancel</button>
                            <button onClick={save} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50">
                                {submitting ? 'Saving...' : 'Save Role'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Page>
    );
};
