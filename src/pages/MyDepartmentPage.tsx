// frontend/src/pages/MyDepartmentPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Spinner } from '../components/ui/Spinner';
import { useContextStore } from '../store/contextStore';
import { api } from '../api';
import { Users, User, Info, Hash } from 'lucide-react';
import { Dropdown } from '../components/ui/Dropdown';

type DeptMember = {
  id: string;
  userId: string;
  role: string;
  departmentId: string;
  createdAt: string;
  user?: { id: string; fullName?: string; email?: string };
};

export const MyDepartmentPage: React.FC = () => {
  const { currentEventId, currentDeptId, departments, myMemberships, selectDepartment } = useContextStore();
  const [members, setMembers] = useState<DeptMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const headDeptIds = useMemo(
    () => Array.from(new Set(myMemberships.filter((m) => m.role === 'DEPT_HEAD' && m.departmentId).map((m) => m.departmentId!))),
    [myMemberships],
  );

  useEffect(() => {
    if (!currentEventId) return;
    if (!currentDeptId && headDeptIds.length > 0) {
      selectDepartment(headDeptIds[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEventId, headDeptIds.join(',')]);

  const deptName = departments.find((d) => d.id === currentDeptId)?.name;

  useEffect(() => {
    let mounted = true;
    if (!currentEventId || !currentDeptId) return;
    setLoading(true);
    setErr(null);
    api
      .get<DeptMember[]>(`/events/${currentEventId}/departments/${currentDeptId}/members`)
      .then((data) => mounted && setMembers(data || []))
      .catch((e) => mounted && setErr(e?.message || 'Failed to load members'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [currentEventId, currentDeptId]);

  if (!currentDeptId) {
    return (
      <div className="p-6">
        <div className="flex items-center mb-4">
          <Users size={22} className="text-sky-600 mr-2" />
          <h1 className="text-2xl font-semibold">My Department</h1>
        </div>
        <div className="bg-white border border-gray-200 rounded p-4 flex items-center text-gray-700">
          <Info size={18} className="text-blue-600 mr-2" />
          No department selected. If you are a department head, your department will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center mb-4">
        <Users size={22} className="text-sky-600 mr-2" />
        <h1 className="text-2xl font-semibold">{deptName || 'My Department'}</h1>
        {headDeptIds.length > 1 && (
          <Dropdown
            className="ml-3 text-sm border border-gray-200 bg-gray-50 rounded px-2 py-1"
            value={currentDeptId ?? ''}
            onChange={(v) => selectDepartment(v || null)}
            options={headDeptIds.map((id) => ({ value: id, label: departments.find((d) => d.id === id)?.name || id }))}
            title="Switch department"
          />
        )}
      </div>

      {loading && <Spinner label="Loading department" />}
      {err && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{err}</div>
      )}

      {!loading && !err && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 text-gray-600">Member</th>
                <th className="text-left px-4 py-2 text-gray-600">Role</th>
                <th className="text-left px-4 py-2 text-gray-600">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <div className="text-gray-900 flex items-center" title={m.user?.email || m.userId}>
                      <User size={16} className="text-gray-400 mr-2" />
                      <span className="font-medium mr-2">{m.user?.fullName || m.userId}</span>
                      <span className="text-xs text-gray-500 font-mono">{m.userId}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center bg-gray-100 border border-gray-200 rounded px-2 py-1 text-xs text-gray-700">
                      <Hash size={12} className="mr-1" />
                      {m.role}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{new Date(m.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                    No members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
