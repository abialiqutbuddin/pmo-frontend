import React, { useEffect, useState } from 'react';
import { SideDrawer } from '../ui/SideDrawer';
import { EventMember, eventsService } from '../../services/events';
import { usersService, UpdateUserDto } from '../../services/users';
import { rolesService, Role } from '../../services/roles';
import { User, Shield, Lock, Save } from 'lucide-react';

interface EditMemberDrawerProps {
    eventId: string;
    member: EventMember | null;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type Tab = 'membership' | 'profile';

export const EditMemberDrawer: React.FC<EditMemberDrawerProps> = ({ eventId, member, open, onClose, onSuccess }) => {
    const [activeTab, setActiveTab] = useState<Tab>('membership');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reference lists
    const [roles, setRoles] = useState<Role[]>([]);

    // Form State - Membership
    const [roleId, setRoleId] = useState<string>('');

    // Form State - Profile
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [itsId, setItsId] = useState('');
    const [password, setPassword] = useState('');
    const [designation, setDesignation] = useState('');

    useEffect(() => {
        if (open && member) {
            // Init form
            setRoleId(member.roleId || '');

            setFullName(member.user?.fullName || '');
            setEmail(member.user?.email || '');
            setItsId(member.user?.itsId || '');
            setDesignation(member.user?.designation || '');
            setPassword('');

            setError(null);

            // Load lists
            loadLists();
        }
    }, [open, member, eventId]);

    const loadLists = async () => {
        try {
            const r = await rolesService.list();
            setRoles(r);
        } catch (e) {
            console.error('Failed to load lists', e);
        }
    };

    const handleSaveMembership = async () => {
        if (!member) return;
        setSaving(true);
        setError(null);
        try {
            await eventsService.members.update(eventId, member.userId, {
                roleId: roleId || null,
            });
            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Failed to update membership');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!member) return;
        setSaving(true);
        setError(null);
        try {
            const updateDto: UpdateUserDto = {
                fullName,
                email,
                itsId,
                designation,
            };
            if (password) updateDto.password = password;

            await usersService.update(member.userId, updateDto);
            onSuccess();
            onClose();
        } catch (e: any) {
            setError(e.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    if (!member) return null;

    return (
        <SideDrawer
            open={open}
            onClose={onClose}
            header={
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                        {(member.user?.fullName?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Edit Member</h2>
                        <p className="text-sm text-gray-500">{member.user?.fullName}</p>
                    </div>
                </div>
            }
        >
            <div className="p-4">
                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        className={`flex-1 pb-3 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${activeTab === 'membership' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('membership')}
                    >
                        <Shield size={16} /> Membership
                    </button>
                    <button
                        className={`flex-1 pb-3 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${activeTab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        <User size={16} /> User Profile
                    </button>
                </div>

                {/* Membership Form */}
                {activeTab === 'membership' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-200">

                        {/* Global Role Section */}
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <Shield size={16} className="text-blue-600" />
                                Global Role
                            </h3>
                            <div className="flex gap-2">
                                <select
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    value={roleId}
                                    onChange={e => setRoleId(e.target.value)}
                                >
                                    <option value="">No Global Role</option>
                                    {roles.filter(r => !r.scope || r.scope === 'EVENT' || r.scope === 'BOTH').map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleSaveMembership}
                                    disabled={saving}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {saving ? '...' : 'Set'}
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                                Global roles grant access across the entire event. Use with caution.
                            </p>
                        </div>

                        {/* Department Assignments Section */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Department Assignments</h3>

                            {/* List Existing */}
                            <div className="space-y-2 mb-4">
                                {member.assignments?.length === 0 && (
                                    <div className="text-sm text-gray-400 italic p-2 border border-dashed rounded bg-gray-50 text-center">
                                        No department assignments
                                    </div>
                                )}
                                {member.assignments?.map((a, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{a.department?.name}</div>
                                            <div className="text-xs text-blue-600 bg-blue-50 inline-block px-1.5 py-0.5 rounded mt-0.5">
                                                {a.role?.name}
                                            </div>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (!confirm('Remove this assignment?')) return;
                                                setSaving(true);
                                                try {
                                                    await eventsService.members.removeAssignment(eventId, member.userId, a.department.id);
                                                    onSuccess();
                                                } catch (e) { console.error(e); }
                                                setSaving(false);
                                            }}
                                            className="text-red-500 hover:bg-red-50 p-1.5 rounded"
                                        >
                                            <span className="sr-only">Remove</span>
                                            &times;
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Add New */}
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Add Assignment</h4>
                                <AddAssignmentForm
                                    roles={roles.filter(r => !r.scope || r.scope === 'DEPARTMENT' || r.scope === 'BOTH')}
                                    eventId={eventId}
                                    userId={member.userId}
                                    onSuccess={onSuccess}
                                />
                            </div>
                        </div>

                    </div>
                )}

                {/* Profile Form */}
                {activeTab === 'profile' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={designation}
                                    onChange={e => setDesignation(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                            <input
                                type="email"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ITS ID</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={itsId}
                                    onChange={e => setItsId(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reset Password</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        placeholder="Leave blank to keep"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-xs text-yellow-800 flex gap-2 mt-4">
                            <span>⚠️</span>
                            <p>Warning: Updating these details changes the user's global profile across the entire tenant.</p>
                        </div>

                        <div className="pt-4 border-t mt-6 flex justify-end">
                            <button
                                onClick={handleSaveProfile}
                                disabled={saving}
                                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : <><Save size={18} /> Update Profile</>}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </SideDrawer>
    );
};

const AddAssignmentForm: React.FC<{
    roles: Role[];
    eventId: string;
    userId: string;
    onSuccess: () => void;
}> = ({ roles, eventId, userId, onSuccess }) => {
    const [deptId, setDeptId] = useState('');
    const [roleId, setRoleId] = useState('');
    const [departments, setDepartments] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // fetch available departments
        // Ideally pass from parent or context, but fetching here is fine for now
        eventsService.get(eventId).then(() => {
            // we actually need list of departments. Using raw api for now or similar
            // Assuming we have an endpoint or we can get it from contextStore if available, 
            // but component should be somewhat standalone.
            // Let's rely on api call
            import('../../api').then(({ api }) => {
                api.get<any[]>(`/events/${eventId}/departments`).then(setDepartments).catch(() => { });
            });
        });
    }, [eventId]);

    const submit = async () => {
        if (!deptId || !roleId) return;
        setSaving(true);
        try {
            await eventsService.members.addAssignment(eventId, userId, { departmentId: deptId, roleId });
            onSuccess();
            setDeptId('');
            setRoleId('');
        } catch (e: any) {
            alert(e.message || 'Failed to add');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex gap-2 items-end">
            <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
                <select
                    className="w-full px-2 py-1.5 border rounded text-sm"
                    value={deptId}
                    onChange={e => setDeptId(e.target.value)}
                >
                    <option value="">Select Dept</option>
                    {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
            </div>
            <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                <select
                    className="w-full px-2 py-1.5 border rounded text-sm"
                    value={roleId}
                    onChange={e => setRoleId(e.target.value)}
                >
                    <option value="">Select Role</option>
                    {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>
            </div>
            <button
                disabled={!deptId || !roleId || saving}
                onClick={submit}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 h-[34px]" // align height
            >
                Add
            </button>
        </div>
    );
};
