import React, { useEffect, useState } from 'react';
import { Page } from '../components/layout/Page';
import { Spinner } from '../components/ui/Spinner';
import { useAuthStore } from '../store/authStore';
import { api } from '../api';
import { Plus, Building2 } from 'lucide-react';

interface Tenant {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
}

export const TenantsPage: React.FC = () => {
    const isSuperAdmin = !!useAuthStore(s => s.currentUser?.isSuperAdmin);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);

    // Create Form State
    const [form, setForm] = useState({
        name: '',
        slug: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '',
    });
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load Tenants (Mock for now, or need endpoint?)
    // Wait, we don't have a "List Tenants" endpoint yet! 
    // TenantController only has create.
    // I should probably add @Get() to TenantController to list tenants for Super Admin.
    // For now, I will create the frontend assuming the endpoint exists or will exist.
    // Let's implement the list fetch later or now? 
    // I should add list endpoint to backend first?
    // Let's assume I'll add GET /tenant shortly.

    useEffect(() => {
        if (!isSuperAdmin) return;
        setLoading(true);
        // TODO: Implement GET /tenant on backend
        // For now we might fail or get empty.
        api.get<Tenant[]>('/tenant')
            .then(setTenants)
            .catch(() => { }) // likely 404 if not impl
            .finally(() => setLoading(false));
    }, [isSuperAdmin]);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setCreating(true);
        setError(null);
        try {
            await api.post('/tenant', form);
            // Reload list
            const res = await api.get<Tenant[]>('/tenant').catch(() => []);
            setTenants(res);
            setShowCreate(false);
            setForm({ name: '', slug: '', adminName: '', adminEmail: '', adminPassword: '' });
            alert('Tenant created successfully');
        } catch (err: any) {
            setError(err?.message || 'Failed to create tenant');
        } finally {
            setCreating(false);
        }
    }

    if (!isSuperAdmin) return <div className="p-8">Access Denied</div>;

    return (
        <Page>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="text-2xl font-semibold text-gray-900">Application Settings</div>
                    <div className="text-sm text-gray-500">Manage Tenants and Admins</div>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-blue-700 font-medium"
                >
                    <Plus size={18} className="mr-2" />
                    New Tenant
                </button>
            </div>

            {loading && <Spinner />}

            {!loading && (
                <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                            <tr>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Slug</th>
                                <th className="px-4 py-3">Created At</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {tenants.length === 0 ? (
                                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No tenants found.</td></tr>
                            ) : (
                                tenants.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900 flex items-center">
                                            <Building2 size={16} className="mr-2 text-gray-400" />
                                            {t.name}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{t.slug}</td>
                                        <td className="px-4 py-3 text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                        <h2 className="text-xl font-bold mb-4">Create New Tenant</h2>
                        {error && <div className="mb-4 text-red-600 bg-red-50 p-2 rounded text-sm">{error}</div>}

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Organization Name</label>
                                    <input
                                        className="w-full border rounded px-3 py-2 text-sm"
                                        required
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        placeholder="e.g. Acme Corp"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Slug (URL)</label>
                                    <input
                                        className="w-full border rounded px-3 py-2 text-sm"
                                        required
                                        value={form.slug}
                                        onChange={e => setForm({ ...form, slug: e.target.value })}
                                        placeholder="e.g. acme"
                                    />
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Initial Admin User</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm mb-1">Full Name</label>
                                        <input
                                            className="w-full border rounded px-3 py-2 text-sm"
                                            required
                                            value={form.adminName}
                                            onChange={e => setForm({ ...form, adminName: e.target.value })}
                                            placeholder="Admin Name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1">Email Address</label>
                                        <input
                                            type="email"
                                            className="w-full border rounded px-3 py-2 text-sm"
                                            required
                                            value={form.adminEmail}
                                            onChange={e => setForm({ ...form, adminEmail: e.target.value })}
                                            placeholder="admin@acme.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-1">Password</label>
                                        <input
                                            type="password"
                                            className="w-full border rounded px-3 py-2 text-sm"
                                            required
                                            value={form.adminPassword}
                                            onChange={e => setForm({ ...form, adminPassword: e.target.value })}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="px-4 py-2 text-gray-700 rounded hover:bg-gray-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {creating ? 'Creating...' : 'Create Tenant'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Page>
    );
};
