// frontend/src/pages/TasksPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useContextStore } from '../store/contextStore';
import { useAuthStore } from '../store/authStore';
import { usePageStateStore } from '../store/pageStateStore';
import { tasksService } from '../services/tasks';
import { bus } from '../lib/eventBus';
import { departmentsService } from '../services/departments';
import { eventsService } from '../services/events';
import type { TaskItem, TaskStatus } from '../types/task';
import type { DepType } from '../services/tasks';
import { Plus, Trash2, Pencil, Clock, Flag, User, LayoutGrid, List as ListIcon } from 'lucide-react';
import { Dropdown } from '../components/ui/Dropdown';
import { Eye } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { TaskDetailsDrawer } from '../components/tasks/TaskDetailsDrawer';
import { TasksBoardView } from '../components/tasks/TaskBoardView';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
  { value: 'canceled', label: 'Canceled' },
];

function fmt(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

const PRIORITY_LABEL: Record<number, string> = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low', 5: 'Very Low' };

const PriorityBadge: React.FC<{ p: number }> = ({ p }) => {
  const color = p === 1 ? 'bg-rose-600' : p === 2 ? 'bg-orange-500' : p === 3 ? 'bg-amber-500' : p === 4 ? 'bg-emerald-500' : 'bg-gray-500';
  return (
    <span className={`inline-flex items-center ${color} text-white rounded px-2 py-0.5 text-xs`} title={`Priority ${p} (${PRIORITY_LABEL[p]})`}>
      <Flag size={12} className="mr-1" /> {PRIORITY_LABEL[p]}
    </span>
  );
};

type CreateForm = {
  title: string;
  description: string;
  priority: number;
  startAt: string;
  dueAt: string;
  assigneeId: string;
};

export const TasksPage: React.FC = () => {
  const { currentEventId, departments, myMemberships, canAdminEvent } = useContextStore();
  const currentUserId = useAuthStore((s) => s.currentUser?.id);
  const isSuperAdmin = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);

  const tasksState = usePageStateStore((s) => s.tasks);
  const setTasksState = usePageStateStore((s) => s.setTasks);
  const deptId = tasksState.deptId;
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [memberOptions, setMemberOptions] = useState<{ value: string; label: string }[]>([]);
  const [memberNameById, setMemberNameById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const statusFilter = tasksState.statusFilter;
  const priorityFilter = tasksState.priorityFilter;
  const q = tasksState.q;

  //view
  const [viewing, setViewing] = useState<TaskItem | null>(null);

  // Create/edit modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({ title: '', description: '', priority: 3, startAt: '', dueAt: '', assigneeId: '' });
  const [createDeps, setCreateDeps] = useState<{ upstreamId: string; depType: DepType }[]>([]);

  // Edit modal
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [editForm, setEditForm] = useState<CreateForm & { progressPct: number; status: TaskStatus }>({ title: '', description: '', priority: 3, startAt: '', dueAt: '', assigneeId: '', progressPct: 0, status: 'todo' });
  const [deps, setDeps] = useState<{ blockers: { upstreamId: string; depType: DepType; task: TaskItem }[] } | null>(null);
  const [allTasksForDeps, setAllTasksForDeps] = useState<TaskItem[]>([]);
  const [newDep, setNewDep] = useState<{ upstreamId: string; depType: DepType }>({ upstreamId: '', depType: 'finish_to_start' });

  //BOARD VIEW
  const viewMode = tasksState.viewMode;

  // Compute accessible departments based on role
  const accessibleDepts = useMemo(() => {
    if (isSuperAdmin || canAdminEvent) return departments;
    const ids = new Set((myMemberships.map((m) => m.departmentId).filter(Boolean) as string[]));
    return departments.filter((d) => ids.has(d.id));
  }, [isSuperAdmin, canAdminEvent, departments, myMemberships]);

  // Choose default department
  useEffect(() => {
    if (!deptId && accessibleDepts.length > 0) {
      const myDept = myMemberships.find((m) => m.departmentId && accessibleDepts.some((d) => d.id === m.departmentId))?.departmentId;
      setTasksState({ deptId: myDept || accessibleDepts[0].id });
    }
  }, [accessibleDepts, myMemberships, deptId, setTasksState]);

  async function loadTasks(force?: boolean) {
    if (!currentEventId || !deptId) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await tasksService.list(currentEventId, deptId, { force });
      setTasks(data || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    // subscribe to task changes (placeholder realtime bus)
    const off = bus.on('tasks:changed', ({ eventId, departmentId }: any) => {
      if (eventId === currentEventId && departmentId === deptId) loadTasks(true);
    });
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEventId, deptId]);

  // Load names: prefer department members; fall back to event members for names when assignee isn't in dept
  useEffect(() => {
    let mounted = true;
    if (!currentEventId || !deptId) return;
    (async () => {
      try {
        const deptRows = await departmentsService.members.list(currentEventId, deptId).catch(() => []);
        const eventRows = await eventsService.members.list(currentEventId).catch(() => []);
        if (!mounted) return;
        const deptList = Array.isArray(deptRows) ? deptRows : [];
        const eventList = Array.isArray(eventRows) ? eventRows : [];
        // Options for assignee: department members only
        const opts = deptList.map((m) => ({ value: m.userId, label: m.user?.fullName || m.userId }));
        setMemberOptions([{ value: '', label: 'Unassigned' }, ...opts]);
        // Name map for rendering: union of dept + event members
        const map: Record<string, string> = {};
        for (const m of eventList) {
          map[m.userId] = m.user?.fullName || map[m.userId] || m.userId;
        }
        for (const m of deptList) {
          map[m.userId] = m.user?.fullName || map[m.userId] || m.userId;
        }
        setMemberNameById(map);
      } catch {
        setMemberOptions([{ value: '', label: 'Unassigned' }]);
        setMemberNameById({});
      }
    })();
    return () => {
      mounted = false;
    };
  }, [currentEventId, deptId]);

  // RBAC helpers
  const canCreate = useMemo(() => {
    if (!deptId) return false;
    if (isSuperAdmin) return true;
    const roles = myMemberships.filter((m) => !m.departmentId || m.departmentId === deptId).map((m) => m.role);
    return roles.includes('OWNER') || roles.includes('PMO_ADMIN') || roles.includes('DEPT_HEAD') || roles.includes('DEPT_MEMBER');
  }, [isSuperAdmin, myMemberships, deptId]);

  const canEditTask = (t: TaskItem) => {
    if (isSuperAdmin) return true;
    const roles = myMemberships.filter((m) => !m.departmentId || m.departmentId === deptId).map((m) => m.role);
    if (roles.includes('OWNER') || roles.includes('PMO_ADMIN') || roles.includes('DEPT_HEAD')) return true;
    if (roles.includes('DEPT_MEMBER')) {
      return t.creatorId === currentUserId || t.assigneeId === currentUserId;
    }
    return false;
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tasks.filter((t) => {
      const matchStatus = statusFilter === 'all' ? true : t.status === statusFilter;
      const matchPriority = priorityFilter === 'all' ? true : t.priority === priorityFilter;
      const matchText = !term || t.title.toLowerCase().includes(term) || (t.description || '').toLowerCase().includes(term);
      return matchStatus && matchPriority && matchText;
    });
  }, [tasks, statusFilter, priorityFilter, q]);

  async function createTask() {
    if (!currentEventId || !deptId) return;
    if (!createForm.title.trim()) return;
    setCreating(true);
    try {
      const payload: any = {
        title: createForm.title.trim(),
        description: createForm.description?.trim() || undefined,
        priority: Number(createForm.priority) || 3,
        startAt: createForm.startAt ? new Date(createForm.startAt).toISOString() : undefined,
        dueAt: createForm.dueAt ? new Date(createForm.dueAt).toISOString() : undefined,
        assigneeId: createForm.assigneeId?.trim() || undefined,
      };
      const created = await tasksService.create(currentEventId, deptId, payload);
      // link dependencies if any
      for (const d of createDeps) {
        if (!d.upstreamId) continue;
        try {
          await tasksService.dependencies.add(currentEventId, deptId, created.id, d);
        } catch { }
      }
      setShowCreate(false);
      setCreateForm({ title: '', description: '', priority: 3, startAt: '', dueAt: '', assigneeId: '' });
      setCreateDeps([]);
      await loadTasks(true);
    } catch (e) {
      // surface minimal error
      alert('Failed to create task. Check permissions and required fields.');
    } finally {
      setCreating(false);
    }
  }

  async function changeStatus(task: TaskItem, status: TaskStatus) {
    if (!currentEventId || !deptId) return;
    try {
      const res = await tasksService.changeStatus(currentEventId, deptId, task.id, { status });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: res.status, progressPct: res.progressPct } : t)));
    } catch (e) {
      alert('Not allowed to change status');
    }
  }

  async function updateTask(task: TaskItem, patch: Partial<TaskItem>) {
    if (!currentEventId || !deptId) return;
    try {
      const payload: any = {
        title: patch.title,
        description: patch.description,
        priority: patch.priority,
        startAt: patch.startAt === '' ? null : patch.startAt ? new Date(patch.startAt).toISOString() : undefined,
        dueAt: patch.dueAt === '' ? null : patch.dueAt ? new Date(patch.dueAt).toISOString() : undefined,
        assigneeId: patch.assigneeId === '' ? null : patch.assigneeId ?? undefined,
      };
      const res = await tasksService.update(currentEventId, deptId, task.id, payload);
      // Re-fetch or optimistic merge
      await loadTasks(true);
      return res;
    } catch (e) {
      alert('Failed to update task');
    }
  }

  // add
  function openDetails(t: TaskItem) {
    setViewing(t);
  }

  // add
  async function changeStatusFromDrawer(task: TaskItem, status: TaskStatus) {
    if (!currentEventId || !deptId) return;
    try {
      const res = await tasksService.changeStatus(currentEventId, deptId, task.id, { status });
      // reflect in list + drawer
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: res.status, progressPct: res.progressPct } : t)));
      setViewing((cur) => (cur && cur.id === task.id ? { ...cur, status: res.status, progressPct: res.progressPct } : cur));
    } catch {
      alert('Not allowed to change status');
    }
  }

  function openEdit(t: TaskItem) {
    setEditing(t);
    setEditForm({
      title: t.title,
      description: t.description || '',
      priority: t.priority,
      startAt: t.startAt ? new Date(t.startAt).toISOString().slice(0, 16) : '',
      dueAt: t.dueAt ? new Date(t.dueAt).toISOString().slice(0, 16) : '',
      assigneeId: t.assigneeId || '',
      progressPct: t.progressPct || 0,
      status: t.status,
    });
    // load dependencies + candidate tasks
    if (currentEventId && deptId) {
      tasksService.dependencies
        .list(currentEventId, deptId, t.id)
        .then((d) => setDeps({ blockers: d.blockers || [] }))
        .catch(() => setDeps({ blockers: [] }));
      tasksService
        .list(currentEventId, deptId)
        .then((rows) => setAllTasksForDeps((rows || []).filter((x) => x.id !== t.id)))
        .catch(() => setAllTasksForDeps([]));
    }
  }

  async function removeTask(task: TaskItem) {
    if (!currentEventId || !deptId) return;
    if (!confirm('Delete this task?')) return;
    try {
      await tasksService.remove(currentEventId, deptId, task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (e) {
      alert('Failed to delete task');
    }
  }

  const DepartmentSelect = (
    <Dropdown
      value={deptId}
      onChange={(v) => setTasksState({ deptId: v })}
      options={accessibleDepts.map((d) => ({ value: d.id, label: d.name }))}
      placeholder={accessibleDepts.length ? undefined : 'No department'}
      title="Choose department"
      fullWidth={false}
    />
  );

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="text-2xl font-semibold mr-2">Tasks</div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2" title="Department">
            <span className="text-xs text-gray-600">Dept</span>
            {DepartmentSelect}
          </div>
          <div className="flex items-center gap-2" title="Filter by status">
            <span className="text-xs text-gray-600">Status</span>
            <Dropdown
              value={String(statusFilter)}
              onChange={(v) => setTasksState({ statusFilter: v as TaskStatus | 'all' })}
              options={[{ value: 'all', label: 'All Statuses' }, ...STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))]}
            />
          </div>
          <div className="flex items-center gap-2" title="Filter by priority">
            <span className="text-xs text-gray-600">Priority</span>
            <Dropdown
              value={String(priorityFilter)}
              onChange={(v) => setTasksState({ priorityFilter: v === 'all' ? 'all' : Number(v) })}
              options={[{ value: 'all', label: 'All Priorities' }, ...[1, 2, 3, 4, 5].map((p) => ({ value: String(p), label: PRIORITY_LABEL[p] }))]}
            />
          </div>
          <div className="relative">
            <input
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Search tasks"
              value={q}
              onChange={(e) => setTasksState({ q: e.target.value })}
              title="Search by title or description"
            />
          </div>
          <button
            className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2 text-sm"
            onClick={() => setShowCreate(true)}
            disabled={!canCreate}
            title={canCreate ? 'Create task' : 'You do not have permission to create tasks'}
          >
            <Plus size={16} className="mr-1" /> New Task
          </button>
        </div>
      </div>

      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-3">{err}</div>}
      {loading && <Spinner label="Loading tasks" />}

      <div className="inline-flex items-center bg-gray-100 border border-gray-300 rounded-xl p-1">
        <button
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm transition ${viewMode==='list' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
          onClick={()=> setTasksState({ viewMode: 'list' })}
          title="List view"
        >
          <ListIcon size={16} className="mr-1" /> List
        </button>
        <button
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm transition ${viewMode==='board' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
          onClick={()=> setTasksState({ viewMode: 'board' })}
          title="Board view"
        >
          <LayoutGrid size={16} className="mr-1" /> Board
        </button>
      </div>

      {!loading && (
        <>
          {viewMode === 'list' ? (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600">Title</th>
                    <th className="text-left px-4 py-2 text-gray-600">Priority</th>
                    <th className="text-left px-4 py-2 text-gray-600">Assignee</th>
                    <th className="text-left px-4 py-2 text-gray-600">Due</th>
                    <th className="text-left px-4 py-2 text-gray-600">Status</th>
                    <th className="text-right px-4 py-2 text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{t.title}</div>
                        {t.description && (
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-2"><PriorityBadge p={t.priority} /></td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center text-gray-700"><User size={14} className="mr-1" />{(t.assigneeId && memberNameById[t.assigneeId]) || t.assigneeId || '-'}</span>
                      </td>
                      <td className="px-4 py-2"><span className="inline-flex items-center text-gray-700"><Clock size={14} className="mr-1" />{fmt(t.dueAt) || '-'}</span></td>
                      <td className="px-4 py-2">
                        <Dropdown
                          value={t.status}
                          onChange={(v) => changeStatus(t, v as TaskStatus)}
                          options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
                          title={canEditTask(t) ? 'Change status' : 'No permission to change status'}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button className="text-gray-700 hover:text-black mr-3" onClick={() => openDetails(t)} title="View details">
                          <Eye size={16} />
                        </button>
                        <button className="text-gray-700 hover:text-black mr-3" onClick={() => openEdit(t)} title="Edit">
                          <Pencil size={16} />
                        </button>
                        <button
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() => removeTask(t)}
                          disabled={!canEditTask(t)}
                          title="Delete task"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No tasks found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <TasksBoardView
              tasks={filtered}
              onChangeStatus={changeStatusFromDrawer}
              onView={openDetails}
              memberNameById={memberNameById}
            />
          )}
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-lg shadow-lg border border-gray-200 p-6">
            <div className="text-lg font-semibold mb-4">Create Task</div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Title</label>
                <input
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Short task description"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Description</label>
                <textarea
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Details or context"
                />
              </div>
              <div className="grid md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm mb-1">Priority</label>
                  <Dropdown
                    value={String(createForm.priority)}
                    onChange={(v) => setCreateForm((f) => ({ ...f, priority: Number(v) }))}
                    options={[1, 2, 3, 4, 5].map((p) => ({ value: String(p), label: PRIORITY_LABEL[p] }))}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Start At</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                    value={createForm.startAt}
                    onChange={(e) => setCreateForm((f) => ({ ...f, startAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Due At</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                    value={createForm.dueAt}
                    onChange={(e) => setCreateForm((f) => ({ ...f, dueAt: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Assignee</label>
                <Dropdown
                  value={createForm.assigneeId}
                  onChange={(v) => setCreateForm((f) => ({ ...f, assigneeId: v }))}
                  options={memberOptions}
                  fullWidth
                />
              </div>
              {/* Dependencies */}
              <div className="mt-2">
                <div className="text-sm font-medium mb-2">Dependencies (Blockers)</div>
                <div className="flex items-center gap-2">
                  <Dropdown
                    value={''}
                    onChange={(v) => setCreateDeps((prev) => [...prev, { upstreamId: v, depType: 'finish_to_start' }])}
                    options={[{ value: '', label: 'Select task to add' }, ...tasks.map((t) => ({ value: t.id, label: t.title }))]}
                    fullWidth
                  />
                </div>
                {createDeps.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {createDeps.map((d, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="flex-1">{tasks.find((t) => t.id === d.upstreamId)?.title || d.upstreamId}</span>
                        <Dropdown
                          value={d.depType}
                          onChange={(v) => setCreateDeps((prev) => prev.map((x, i) => (i === idx ? { ...x, depType: v as DepType } : x)))}
                          options={[
                            { value: 'finish_to_start', label: 'Finish to start' },
                            { value: 'start_to_start', label: 'Start to start' },
                            { value: 'finish_to_finish', label: 'Finish to finish' },
                            { value: 'start_to_finish', label: 'Start to finish' },
                          ]}
                        />
                        <button
                          className="text-rose-600 hover:text-rose-700"
                          onClick={() => setCreateDeps((prev) => prev.filter((_, i) => i !== idx))}
                          title="Remove"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="px-3 py-2 rounded-md text-sm text-gray-700 hover:text-black" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="px-3 py-2 rounded-md text-sm bg-blue-600 hover:bg-blue-700 text-white"
                onClick={createTask}
                disabled={creating || !createForm.title.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-2xl rounded-lg shadow-lg border border-gray-200 p-6">
            <div className="text-lg font-semibold mb-4">Edit Task</div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Title</label>
                <input className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Description</label>
                <textarea className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm" rows={4} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm mb-1">Priority</label>
                <Dropdown value={String(editForm.priority)} onChange={(v) => setEditForm((f) => ({ ...f, priority: Number(v) }))} options={[1, 2, 3, 4, 5].map((p) => ({ value: String(p), label: PRIORITY_LABEL[p] }))} />
              </div>
              <div>
                <label className="block text-sm mb-1">Status</label>
                <Dropdown value={editForm.status} onChange={(v) => setEditForm((f) => ({ ...f, status: v as TaskStatus }))} options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))} />
              </div>
              <div>
                <label className="block text-sm mb-1">Start At</label>
                <input type="datetime-local" className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm" value={editForm.startAt} onChange={(e) => setEditForm((f) => ({ ...f, startAt: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm mb-1">Due At</label>
                <input type="datetime-local" className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm" value={editForm.dueAt} onChange={(e) => setEditForm((f) => ({ ...f, dueAt: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm mb-1">Progress %</label>
                <input type="number" min={0} max={100} className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm" value={editForm.progressPct} onChange={(e) => setEditForm((f) => ({ ...f, progressPct: Math.max(0, Math.min(100, Number(e.target.value))) }))} />
              </div>
              <div>
                <AssigneeSelect deptId={deptId} value={editForm.assigneeId} onChange={(v) => setEditForm((f) => ({ ...f, assigneeId: v }))} options={memberOptions.slice(1)} />
              </div>
            </div>

            {/* Dependencies */}
            <div className="mt-6">
              <div className="text-sm font-medium mb-2">Dependencies (Blockers)</div>
              <div className="space-y-2">
                {(deps?.blockers || []).map((b) => (
                  <div key={b.upstreamId} className="flex items-center justify-between border border-gray-100 rounded px-3 py-2">
                    <div className="text-sm">
                      <span className="font-medium">{b.task.title}</span>
                      <span className="ml-2 text-xs text-gray-500">{PRIORITY_LABEL[b.task.priority]} • {b.task.status}</span>
                    </div>
                    <button
                      className="text-rose-600 hover:text-rose-700 text-sm"
                      onClick={async () => {
                        if (!currentEventId || !deptId || !editing) return;
                        await tasksService.dependencies.remove(currentEventId!, deptId!, editing!.id, b.upstreamId);
                        // reload deps
                        const d = await tasksService.dependencies.list(currentEventId!, deptId!, editing!.id);
                        setDeps({ blockers: d.blockers || [] });
                      }}
                      title="Remove dependency"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Dropdown
                    value={newDep.upstreamId}
                    onChange={(v) => setNewDep((s) => ({ ...s, upstreamId: v }))}
                    options={[{ value: '', label: 'Select task' }, ...allTasksForDeps.map((t) => ({ value: t.id, label: t.title }))]}
                  />
                  <Dropdown
                    value={newDep.depType}
                    onChange={(v) => setNewDep((s) => ({ ...s, depType: v as DepType }))}
                    options={[
                      { value: 'finish_to_start', label: 'Finish to start' },
                      { value: 'start_to_start', label: 'Start to start' },
                      { value: 'finish_to_finish', label: 'Finish to finish' },
                      { value: 'start_to_finish', label: 'Start to finish' },
                    ]}
                  />
                  <button
                    className="inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-2 text-sm"
                    onClick={async () => {
                      if (!newDep.upstreamId || !currentEventId || !deptId || !editing) return;
                      await tasksService.dependencies.add(currentEventId!, deptId!, editing!.id, newDep);
                      const d = await tasksService.dependencies.list(currentEventId!, deptId!, editing!.id);
                      setDeps({ blockers: d.blockers || [] });
                      setNewDep({ upstreamId: '', depType: 'finish_to_start' });
                    }}
                    title="Add dependency"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button className="px-3 py-2 rounded-md text-sm text-gray-700 hover:text-black" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                className="px-3 py-2 rounded-md text-sm bg-blue-600 hover:bg-blue-700 text-white"
                onClick={async () => {
                  if (!editing) return;
                  await updateTask(editing, {
                    title: editForm.title,
                    description: editForm.description,
                    priority: editForm.priority,
                    startAt: editForm.startAt,
                    dueAt: editForm.dueAt,
                    assigneeId: editForm.assigneeId,
                  });
                  // Save status/progress separately via status endpoint
                  try {
                    if (currentEventId && deptId) {
                      await tasksService.changeStatus(currentEventId, deptId, editing.id, {
                        status: editForm.status,
                        progressPct: editForm.progressPct,
                      });
                    }
                  } catch { }
                  setEditing(null);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {viewing && (
        <TaskDetailsDrawer
          task={viewing}
          eventId={currentEventId!}
          memberNameById={memberNameById}
          onClose={() => setViewing(null)}
          onChangeStatus={(s) => changeStatusFromDrawer(viewing, s)}
        />
      )}
    </div>
  );
};



/* ---- Assignee dropdown backed by department members ---- */
const AssigneeSelect: React.FC<{ deptId: string; value: string; onChange: (v: string) => void; options?: { value: string; label: string }[] }> = ({ deptId, value, onChange, options }) => {
  const { currentEventId } = useContextStore();
  const [opts, setOpts] = useState<{ value: string; label: string }[]>(options || []);
  useEffect(() => {
    if (options) return; // use provided options
    let mounted = true;
    if (!currentEventId || !deptId) return;
    departmentsService.members
      .list(currentEventId, deptId)
      .then((rows) => {
        if (!mounted) return;
        const items = (rows || []).map((m) => ({ value: m.userId, label: m.user?.fullName || m.userId }));
        setOpts(items);
      })
      .catch(() => setOpts([]));
    return () => {
      mounted = false;
    };
  }, [currentEventId, deptId, options]);
  const final = options || opts;
  return (
    <div>
      <label className="block text-sm mb-1">Assignee</label>
      <Dropdown value={value || ''} onChange={onChange} options={[{ value: '', label: 'Unassigned' }, ...final]} />
    </div>
  );
};
