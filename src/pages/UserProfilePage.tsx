import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { usersService, type User } from '../services/users';
import { UserAvatar } from '../components/ui/UserAvatar';
import { Spinner } from '../components/ui/Spinner';

export const UserProfilePage: React.FC = () => {
  const current = useAuthStore((s) => s.currentUser);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!current?.id) return;
      setLoading(true); setErr(null);
      try {
        const u = await usersService.get(current.id);
        if (mounted) setUser(u);
      } catch (e: any) {
        if (mounted) setErr(e?.message || 'Failed to load profile');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [current?.id]);

  const title = user?.fullName || current?.email || 'My Profile';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <UserAvatar nameOrEmail={title} imageUrl={user?.profileImage} itsId={user?.itsId || null} size={48} />
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <div className="text-sm text-gray-600">{user?.email || current?.email}</div>
        </div>
      </div>

      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{err}</div>}
      {loading && <Spinner label="Loading profile" />}

      {user && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium mb-2">Profile</div>
            <div className="text-sm text-gray-700 space-y-1">
              <div><span className="text-gray-500">Full name:</span> {user.fullName || '—'}</div>
              <div><span className="text-gray-500">ITS ID:</span> {user.itsId || '—'}</div>
              <div><span className="text-gray-500">Organization:</span> {user.organization || '—'}</div>
              <div><span className="text-gray-500">Designation:</span> {user.designation || '—'}</div>
              <div><span className="text-gray-500">Phone:</span> {user.phoneNumber || '—'}</div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium mb-2">Status</div>
            <div className="text-sm text-gray-700 space-y-1">
              <div><span className="text-gray-500">Super Admin:</span> {user.isSuperAdmin ? 'Yes' : 'No'}</div>
              <div><span className="text-gray-500">Disabled:</span> {user.isDisabled ? 'Yes' : 'No'}</div>
              <div><span className="text-gray-500">Created:</span> {new Date(user.createdAt).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
