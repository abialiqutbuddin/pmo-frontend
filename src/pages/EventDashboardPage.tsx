// frontend/src/pages/EventDashboardPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContextStore } from '../store/contextStore';
import { usePageStateStore } from '../store/pageStateStore';
import { dashboardService, type Summary, type DueSoonItem, type RecentItem, type DeptOverviewItem, type MyTaskItem } from '../services/dashboard';
import { bus } from '../lib/eventBus';
import { LayoutDashboard, MessageSquare, Users2, ShieldCheck, ListChecks, Bug, GanttChartSquare, AlertTriangle, CheckCircle2, Clock, TrendingUp, Plus } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Dropdown } from '../components/ui/Dropdown';
import { Page } from '../components/layout/Page';

const Tile: React.FC<{ icon: React.ReactNode; title: string; description: string; onClick: () => void; disabled?: boolean; tip?: string }>
  = ({ icon, title, description, onClick, disabled, tip }) => (
  <button
    className={`text-left bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition w-full ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    onClick={onClick}
    disabled={disabled}
    title={tip}
  >
    <div className="flex items-center mb-2 text-gray-800">
      <div className="mr-3">{icon}</div>
      <div className="font-semibold">{title}</div>
    </div>
    <div className="text-sm text-gray-500">{description}</div>
  </button>
);

export const EventDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentEventId, currentDeptId, canAdminEvent, isSuperAdmin } = useContextStore();
  const setTasksState = usePageStateStore((s) => s.setTasks);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [dueSoon, setDueSoon] = useState<DueSoonItem[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [deptOverview, setDeptOverview] = useState<DeptOverviewItem[]>([]);
  const [myTasks, setMyTasks] = useState<MyTaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dueDays, setDueDays] = useState<'7' | '14' | '30'>('7');

  const canSeeOverview = canAdminEvent || isSuperAdmin;

  async function load() {
    if (!currentEventId) return;
    setLoading(true);
    setErr(null);
    try {
      const [s, d, r] = await Promise.all([
        dashboardService.summary(currentEventId),
        dashboardService.dueSoon(currentEventId, Number(dueDays)),
        dashboardService.recent(currentEventId),
      ]);
      setSummary(s);
      setDueSoon(d);
      setRecent(r);
      if (canSeeOverview) {
        const o = await dashboardService.deptOverview(currentEventId).catch(() => []);
        setDeptOverview(o || []);
      } else {
        setDeptOverview([]);
      }
      const mine = await dashboardService.myTasks(currentEventId).catch(() => []);
      setMyTasks(mine || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const off = bus.on('tasks:changed', ({ eventId }: any) => {
      if (eventId === currentEventId) load();
    });
    return () => off();
  }, [currentEventId, canSeeOverview, dueDays]);

  function goTasks(withStatus?: 'todo' | 'in_progress' | 'blocked' | 'done' | 'canceled') {
    if (withStatus) setTasksState({ statusFilter: withStatus });
    navigate('/tasks');
  }
  function goTasksOverdue() {
    setTasksState({ statusFilter: 'all', overdueOnly: true });
    navigate('/tasks');
  }

  return (
    <Page className="space-y-6">
      <div className="flex items-center mb-2">
        <LayoutDashboard className="text-blue-600 mr-2" size={22} />
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>
      {err && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-3">{err}</div>}

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <button className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:shadow-sm" onClick={() => goTasks()}>
          <div className="text-xs text-gray-500">Total Tasks</div>
          <div className="text-2xl font-semibold">{summary?.total ?? '—'}</div>
        </button>
        <button className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:shadow-sm" onClick={() => goTasks('done')}>
          <div className="text-xs text-gray-500">Completed</div>
          <div className="text-2xl font-semibold inline-flex items-center"><CheckCircle2 size={18} className="text-emerald-600 mr-1" />{summary?.completed ?? '—'}</div>
        </button>
        <button className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:shadow-sm" onClick={() => goTasks('in_progress')}>
          <div className="text-xs text-gray-500">In Progress</div>
          <div className="text-2xl font-semibold inline-flex items-center"><TrendingUp size={18} className="text-indigo-600 mr-1" />{summary?.inProgress ?? '—'}</div>
        </button>
        <button className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:shadow-sm" onClick={() => goTasksOverdue()}>
          <div className="text-xs text-gray-500">Overdue</div>
          <div className="text-2xl font-semibold inline-flex items-center"><AlertTriangle size={18} className="text-rose-600 mr-1" />{summary?.overdue ?? '—'}</div>
        </button>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500">Avg Progress</div>
          <div className="text-2xl font-semibold">{summary ? `${summary.avgProgressPct}%` : '—'}</div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2 text-sm" onClick={() => navigate('/tasks')}>
          <Plus size={16} className="mr-1" /> Create Task
        </button>
        <button className="inline-flex items-center bg-amber-600 hover:bg-amber-700 text-white rounded-md px-3 py-2 text-sm" onClick={() => navigate('/gantt')}>
          <GanttChartSquare size={16} className="mr-1" /> View Gantt
        </button>
        <button className="inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-2 text-sm" onClick={() => navigate('/chat')}>
          <MessageSquare size={16} className="mr-1" /> Open Chat
        </button>
        {(canAdminEvent || isSuperAdmin) && (
          <button className="inline-flex items-center bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-md px-3 py-2 text-sm" onClick={() => navigate('/admin')}>
            <ShieldCheck size={16} className="mr-1" /> Manage Departments
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Tasks due soon */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 lg:col-span-2">
          <div className="flex items-center mb-2">
            <Clock size={18} className="text-amber-600 mr-2" />
            <div className="font-medium">Tasks Due Soon</div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-500">Window</span>
              <Dropdown
                value={dueDays}
                onChange={(v) => setDueDays((v as '7'|'14'|'30'))}
                options={[
                  { value: '7', label: '7 days' },
                  { value: '14', label: '14 days' },
                  { value: '30', label: '30 days' },
                ]}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-600">Title</th>
                  <th className="text-left px-3 py-2 text-gray-600">Department</th>
                  <th className="text-left px-3 py-2 text-gray-600">Assignee</th>
                  <th className="text-left px-3 py-2 text-gray-600">Due</th>
                  <th className="text-left px-3 py-2 text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {dueSoon.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{t.title}</td>
                    <td className="px-3 py-2">{t.departmentName || '—'}</td>
                    <td className="px-3 py-2">{t.assigneeName || 'Unassigned'}</td>
                    <td className="px-3 py-2">{t.dueAt ? new Date(t.dueAt).toLocaleString() : '—'}</td>
                    <td className="px-3 py-2">{t.status}</td>
                  </tr>
                ))}
                {dueSoon.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">No upcoming deadlines.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* My tasks */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center mb-2"><ListChecks size={18} className="text-indigo-600 mr-2" /><div className="font-medium">My Tasks</div></div>
          <div className="space-y-2">
            {myTasks.map((t) => (
              <div key={t.id} className="border border-gray-100 rounded px-3 py-2">
                <div className="text-sm font-medium">{t.title}</div>
                <div className="text-xs text-gray-500 flex items-center justify-between">
                  <span>{t.departmentName}</span>
                  <span>{t.dueAt ? new Date(t.dueAt).toLocaleDateString() : 'No due'}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded mt-2">
                  <div className="h-1.5 bg-blue-600 rounded" style={{ width: `${Math.max(0, Math.min(100, t.progressPct || 0))}%` }} />
                </div>
              </div>
            ))}
            {myTasks.length === 0 && <div className="text-sm text-gray-500">No open tasks assigned to you.</div>}
          </div>
        </div>
      </div>

      {/* Status mix chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="font-medium mb-3">Status Mix</div>
        {summary?.byStatus ? (
          <div className="w-full" style={{ height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Done', value: summary.byStatus.done, color: '#10b981' },
                    { name: 'In Progress', value: summary.byStatus.in_progress, color: '#6366f1' },
                    { name: 'Blocked', value: summary.byStatus.blocked, color: '#f59e0b' },
                    { name: 'To Do', value: summary.byStatus.todo, color: '#9ca3af' },
                    { name: 'Canceled', value: summary.byStatus.canceled, color: '#6b7280' },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                >
                  {[
                    '#10b981',
                    '#6366f1',
                    '#f59e0b',
                    '#9ca3af',
                    '#6b7280',
                  ].map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Pie>
                <ReTooltip formatter={(v, n) => [String(v), String(n)]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No data.</div>
        )}
      </div>

      {/* Dept overview */}
      {(canAdminEvent || isSuperAdmin) && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center mb-3"><Users2 size={18} className="text-sky-600 mr-2" /><div className="font-medium">Department Progress</div></div>
          {deptOverview.length > 0 ? (
            <div className="w-full" style={{ height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={deptOverview.map(d => ({ name: d.name, done: d.done, remaining: Math.max(0, d.total - d.done) }))} margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={50} angle={-15} textAnchor="end" />
                  <YAxis />
                  <Legend />
                  <ReTooltip />
                  <Bar dataKey="done" stackId="a" fill="#10b981" name="Done" />
                  <Bar dataKey="remaining" stackId="a" fill="#e5e7eb" name="Remaining" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-sm text-gray-500">No data.</div>
          )}
        </div>
      )}

      {/* Recent updates */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center mb-2"><TrendingUp size={18} className="text-indigo-600 mr-2" /><div className="font-medium">Recently Updated</div></div>
        <div className="divide-y border border-gray-100 rounded">
          {recent.map((r) => (
            <div key={r.id} className="px-3 py-2 text-sm">
              <div className="font-medium text-gray-800">{r.title}</div>
              <div className="text-xs text-gray-500 flex items-center justify-between">
                <span>{r.departmentName} • {r.assigneeName || 'Unassigned'}</span>
                <span>{new Date(r.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
          {recent.length === 0 && <div className="px-3 py-4 text-sm text-gray-500">No recent activity.</div>}
        </div>
      </div>
    </Page>
  );
};
