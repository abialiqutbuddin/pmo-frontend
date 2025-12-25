import { useEffect, useState } from 'react';
import { api } from '../api';
import { useContextStore } from '../store/contextStore';
import { useAuthStore } from '../store/authStore';
import { eventsService, EventMember } from '../services/events';
import {
    Users, UserPlus, Search, X, Check, Shield,
    MoreHorizontal, Trash2, Import, ArrowRight
} from 'lucide-react';
import { rolesService, Role } from '../services/roles';
import { EditMemberDrawer } from '../components/events/EditMemberDrawer';
import { Pencil } from 'lucide-react';


export default function EventMembersPage() {
    const { currentEventId, currentEventName } = useContextStore();
    const { hasPermission } = useAuthStore();

    const [members, setMembers] = useState<EventMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingMember, setEditingMember] = useState<EventMember | null>(null);

    useEffect(() => {
        if (!currentEventId) return;
        loadMembers();
    }, [currentEventId]);

    const loadMembers = async () => {
        if (!currentEventId) return;
        setLoading(true);
        try {
            const data = await eventsService.members.list(currentEventId, { force: true });
            setMembers(data);
        } catch (e) {
            console.error('Failed to load members', e);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!confirm('Are you sure you want to remove this member?')) return;
        try {
            await api.delete(`/events/${currentEventId}/members/${userId}`);
            await loadMembers();
        } catch (e: any) {
            alert(e.message || 'Failed to remove member');
        }
    };

    const filteredMembers = members.filter(m =>
        m.user?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        m.user?.email?.toLowerCase().includes(search.toLowerCase())
    );

    const isSA = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);
    const isTM = !!useAuthStore((s) => s.currentUser?.isTenantManager);

    if (!hasPermission('events', 'assign_members') && !useContextStore.getState().canAdminEvent && !isSA && !isTM) {
        return <div className="p-8 text-center text-gray-500">You do not have permission to manage members.</div>;
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Event Members</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage attendees and staff for {currentEventName}</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <UserPlus size={20} />
                    Add Members
                </button>
            </header>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search members..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                            <tr>
                                <th className="px-6 py-3">Member</th>
                                <th className="px-6 py-3">Email</th>
                                <th className="px-6 py-3">ITS</th>
                                <th className="px-6 py-3">Role</th>
                                <th className="px-6 py-3">Department</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                            ) : filteredMembers.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No members found.</td></tr>
                            ) : (
                                filteredMembers.map((m) => (
                                    <tr key={m.userId} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium">
                                                    {m.user?.profileImage ? (
                                                        <img src={m.user.profileImage} alt="" className="w-full h-full rounded-full object-cover" />
                                                    ) : (
                                                        (m.user?.fullName?.[0] || '?').toUpperCase()
                                                    )}
                                                </div>
                                                <div className="font-medium text-gray-900">{m.user?.fullName || 'Unknown'}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{m.user?.email}</td>
                                        <td className="px-6 py-4 text-gray-600 font-mono text-sm">{m.user?.itsId || '—'}</td>
                                        <td className="px-6 py-4">
                                            {m.role ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">
                                                    <Shield size={12} className="mr-1" />
                                                    {m.role.name}
                                                </span>
                                            ) : <span className="text-gray-400 text-sm">—</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {m.department ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                                                    {m.department.name}
                                                </span>
                                            ) : <span className="text-gray-400 text-sm">—</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            <button
                                                onClick={() => setEditingMember(m)}
                                                className="text-gray-400 hover:text-blue-600 p-1 bg-gray-50 rounded hover:bg-blue-50 transition-colors"
                                                title="Edit member"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleRemoveMember(m.userId)}
                                                className="text-gray-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Remove member"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAddModal && currentEventId && (
                <AddMembersModal
                    eventId={currentEventId}
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => {
                        setShowAddModal(false);
                        loadMembers();
                    }}
                />
            )}

            {editingMember && currentEventId && (
                <EditMemberDrawer
                    eventId={currentEventId}
                    member={editingMember}
                    open={!!editingMember}
                    onClose={() => setEditingMember(null)}
                    onSuccess={() => {
                        // Don't auto close here if you want to keep it open, but for now we close in drawer.
                        // Just reload.
                        loadMembers();
                    }}
                />
            )}
        </div>
    );
}

function AddMembersModal({ eventId, onClose, onSuccess }: { eventId: string, onClose: () => void, onSuccess: () => void }) {
    const [activeTab, setActiveTab] = useState<'new' | 'import'>('new');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [adding, setAdding] = useState(false);

    // Tab New States
    const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
    const [loadingAssignable, setLoadingAssignable] = useState(false);

    // Tab Import States
    const [events, setEvents] = useState<any[]>([]);
    const [sourceEventId, setSourceEventId] = useState('');
    const [importableMembers, setImportableMembers] = useState<any[]>([]);
    const [loadingImportable, setLoadingImportable] = useState(false);

    // Search
    const [searchTerm, setSearchTerm] = useState('');

    // Roles
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string>('');

    useEffect(() => {
        rolesService.list().then(setRoles).catch(console.error);
    }, []);

    useEffect(() => {
        if (activeTab === 'new') {
            loadAssignable();
        } else {
            loadEvents();
        }
    }, [activeTab]);

    useEffect(() => {
        if (sourceEventId && activeTab === 'import') {
            loadImportable(sourceEventId);
        }
    }, [sourceEventId]);

    const loadAssignable = async () => {
        setLoadingAssignable(true);
        try {
            const res = await eventsService.members.assignable(eventId);
            setAssignableUsers(res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAssignable(false);
        }
    };

    const loadEvents = async () => {
        try {
            const res = await eventsService.list();
            setEvents(res.filter(e => e.id !== eventId));
        } catch (e) {
            console.error(e);
        }
    };

    const loadImportable = async (sourceId: string) => {
        setLoadingImportable(true);
        try {
            // Get members of the source event
            const rows = await eventsService.members.list(sourceId);

            // Get current members to exclude them
            const currentMembers = await eventsService.members.list(eventId);
            const currentMemberIds = new Set(currentMembers.map(m => m.userId));

            // Filter: only show users not already in the target event
            const available = rows.filter(r => !currentMemberIds.has(r.userId));
            setImportableMembers(available.map(r => r.user || { id: r.userId, fullName: 'Unknown', email: '' }));
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingImportable(false);
        }
    };

    const handleAdd = async () => {
        if (selectedUsers.size === 0) return;
        setAdding(true);
        try {
            await eventsService.members.bulkAdd(eventId, Array.from(selectedUsers), selectedRoleId || undefined);
            onSuccess();
        } catch (e: any) {
            alert(e.message || 'Failed to add members');
            setAdding(false);
        }
    };

    const toggleUser = (userId: string) => {
        const next = new Set(selectedUsers);
        if (next.has(userId)) next.delete(userId);
        else next.add(userId);
        setSelectedUsers(next);
    };

    const displayedUsers = (activeTab === 'new' ? assignableUsers : importableMembers).filter(u =>
        (u.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-900">Add Members</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex border-b border-gray-200">
                    <button
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'new' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                        onClick={() => { setActiveTab('new'); setSelectedUsers(new Set()); setSearchTerm(''); }}
                    >
                        <span className="flex items-center justify-center gap-2"><UserPlus size={16} /> New from Tenant</span>
                    </button>
                    <button
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'import' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                        onClick={() => { setActiveTab('import'); setSelectedUsers(new Set()); setSearchTerm(''); }}
                    >
                        <span className="flex items-center justify-center gap-2"><Import size={16} /> Import from Event</span>
                    </button>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                    {activeTab === 'import' && (
                        <div className="p-4 border-b border-gray-200 bg-white z-10">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Source Event</label>
                            <select
                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                value={sourceEventId}
                                onChange={(e) => setSourceEventId(e.target.value)}
                            >
                                <option value="">Select an event to import from...</option>
                                {events.map(e => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="p-4 border-b border-gray-200 bg-white z-10 relative">
                        <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {(activeTab === 'new' && loadingAssignable) || (activeTab === 'import' && loadingImportable) ? (
                            <div className="flex justify-center py-10 text-gray-500">Loading...</div>
                        ) : displayedUsers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                                <Users size={48} className="mb-2 opacity-20" />
                                <p>No users found.</p>
                                {activeTab === 'import' && !sourceEventId && <p className="text-sm mt-1">Please select a source event.</p>}
                            </div>
                        ) : (
                            displayedUsers.map((u: any) => {
                                const isSelected = selectedUsers.has(u.id);
                                return (
                                    <div
                                        key={u.id}
                                        onClick={() => toggleUser(u.id)}
                                        className={`flex items-center p-3 rounded-lg cursor-pointer border transition-all ${isSelected ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'}`}
                                    >
                                        <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                            {isSelected && <Check size={12} className="text-white" />}
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs mr-3">
                                            {(u.fullName?.[0] || '?').toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900 truncate">{u.fullName}</div>
                                            <div className="text-xs text-gray-500 truncate">{u.email}</div>
                                        </div>
                                        {u.itsId && <div className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600 ml-2">{u.itsId}</div>}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-600">
                            <strong>{selectedUsers.size}</strong> users selected
                        </div>
                        <div className="h-6 w-px bg-gray-300"></div>
                        <select
                            className="bg-white border rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                            value={selectedRoleId}
                            onChange={e => setSelectedRoleId(e.target.value)}
                        >
                            <option value="">Assign Role...</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                        <button
                            onClick={handleAdd}
                            disabled={adding || selectedUsers.size === 0}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            {adding ? 'Adding...' : 'Add Selected'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
