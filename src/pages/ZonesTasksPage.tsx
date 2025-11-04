import React, { useEffect, useMemo, useState } from 'react';
import { Page } from '../components/layout/Page';
import { Dropdown } from '../components/ui/Dropdown';
import { useContextStore } from '../store/contextStore';
import { useAuthStore } from '../store/authStore';
import { usePageStateStore } from '../store/pageStateStore';
import { zonesService } from '../services/zones';
import { tasksService } from '../services/tasks';
import { eventsService } from '../services/events';
import type { TaskItem, TaskStatus, TaskType } from '../types/task';
import { Spinner } from '../components/ui/Spinner';
import { Calendar, Eye, Pencil, Trash2, Flag, LayoutGrid, List as ListIcon, Plus } from 'lucide-react';
import { UserAvatar } from '../components/ui/UserAvatar';
import { TasksBoardView } from '../components/tasks/TaskBoardView';
import { TaskDetailsDrawer } from '../components/tasks/TaskDetailsDrawer';
import { SideDrawer } from '../components/ui/SideDrawer';
import { VenueSelect } from '../components/tasks/VenueSelect';
import { attachmentsService } from '../services/attachments';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
  { value: 'canceled', label: 'Canceled' },
];
const PRIORITY_LABEL: Record<number, string> = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low', 5: 'Very Low' };
const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'issue', label: 'Issue' },
  { value: 'new_task', label: 'New Task' },
  { value: 'taujeeh', label: 'Taujeeh' },
  { value: 'improvement', label: 'Improvement' },
];
const TYPE_COLOR: Record<TaskType, string> = {
  issue: 'bg-rose-100 text-rose-800 border-rose-300',
  new_task: 'bg-blue-100 text-blue-800 border-blue-300',
  taujeeh: 'bg-amber-100 text-amber-800 border-amber-300',
  improvement: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

const PriorityBadge: React.FC<{ p: number }> = ({ p }) => {
  const color =
    p === 1 ? 'bg-rose-600' :
      p === 2 ? 'bg-orange-500' :
        p === 3 ? 'bg-amber-500' :
          p === 4 ? 'bg-emerald-500' : 'bg-gray-500';
  return <span className={`inline-flex items-center ${color} text-white rounded px-2 py-0.5 text-xs`} title={`Priority ${p} (${PRIORITY_LABEL[p]})`}><Flag size={12} className="mr-1" /> {PRIORITY_LABEL[p]}</span>;
};
function fmt(iso?: string | null) { if (!iso) return ''; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; const dd = String(d.getDate()).padStart(2, '0'); const mm2 = String(d.getMonth() + 1).padStart(2, '0'); const yyyy = d.getFullYear(); return `${dd}-${mm2}-${yyyy}`; }
function isoToDateInput(iso?: string | null) { if (!iso) return ''; const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; const yyyy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); return `${yyyy}-${mm}-${dd}`; }
function dateOnlyToISO(dateStr?: string | null) { if (!dateStr) return undefined; const d = new Date(`${dateStr}T00:00:00`); if (Number.isNaN(d.getTime())) return undefined; return d.toISOString(); }

export const ZonesTasksPage: React.FC = () => {
  const { currentEventId, departments, myMemberships, canAdminEvent } = useContextStore();
  const currentUserId = useAuthStore((s) => s.currentUser?.id);
  const isSuperAdmin = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);

  const tasksState = usePageStateStore((s) => s.tasks); // reuse filters (status/priority/search/member/overdue/view)
  const setTasksState = usePageStateStore((s) => s.setTasks);
  const statusFilter = tasksState.statusFilter;
  const priorityFilter = tasksState.priorityFilter;
  const q = tasksState.q;
  const overdueOnly = !!tasksState.overdueOnly;
  const memberFilter = tasksState.memberFilter || 'all';
  const viewMode = tasksState.viewMode;

  const [zones, setZones] = useState<{ id: string; name: string; enabled: boolean }[]>([]);
  const [zoneId, setZoneId] = useState<string>('ALL_ZONES');
  const [zdepts, setZDepts] = useState<{ id: string; name: string }[]>([]);
  const [zdeptId, setZDeptId] = useState<string>('ALL_ZDEPTS');

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [memberNameById, setMemberNameById] = useState<Record<string, string>>({});
  const [venueNameById, setVenueNameById] = useState<Record<string, string>>({});

  const [viewing, setViewing] = useState<TaskItem | null>(null);

  // Create drawer state (zonal)
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<{ title: string; description: string; priority: number; startAt: string; dueAt: string; assigneeId: string; venueId: string; type: TaskType }>({ title: '', description: '', priority: 3, startAt: '', dueAt: '', assigneeId: '', venueId: '', type: 'new_task' });
  const [createFiles, setCreateFiles] = useState<{ file: File; url: string; progress: number }[]>([]);
  const [createDeptId, setCreateDeptId] = useState<string>('');
  const [createZoneId, setCreateZoneId] = useState<string>('');
  const [createZDepts, setCreateZDepts] = useState<{ id: string; name: string }[]>([]);
  const [createZDeptId, setCreateZDeptId] = useState<string>('');
  const [createZoneDeptIds, setCreateZoneDeptIds] = useState<string[]>([]);
  // Event-level zonal dept templates (for ALL_ZONES filter)
  const [allZonalTemplates, setAllZonalTemplates] = useState<{ id: string; name: string }[]>([]);
  // Map zonal dept row id -> template id (for client-side filter when ALL_ZONES)
  const [rowTemplateMap, setRowTemplateMap] = useState<Record<string, string>>({});

  // zones
  useEffect(() => { if (!currentEventId) return; zonesService.list(currentEventId).then(r => setZones(r || [])).catch(() => setZones([])); }, [currentEventId]);
  useEffect(() => { if (!currentEventId) return; if (zoneId === 'ALL_ZONES') { setZDepts([]); setZDeptId('ALL_ZDEPTS'); return; } zonesService.listZoneZonalDepts(currentEventId, zoneId).then(r => { setZDepts(r || []); setZDeptId('ALL_ZDEPTS'); }).catch(() => { setZDepts([]); setZDeptId('ALL_ZDEPTS'); }); }, [currentEventId, zoneId]);

  // load tasks across departments for selected zone/zdept, keep zonal only
  async function loadTasks(force?: boolean) {
    if (!currentEventId) return;
    setLoading(true); setErr(null);
    try {
      const res = await Promise.all(departments.map(async (d) => {
        const rows = await tasksService.list(currentEventId, d.id, {
          force,
          zoneId: zoneId !== 'ALL_ZONES' ? zoneId : undefined,
          zonalDeptRowId: (zoneId !== 'ALL_ZONES' && zdeptId !== 'ALL_ZDEPTS') ? zdeptId : undefined
        });
        return (rows || []).filter(t => !!t.zoneId).map(t => ({ ...t, departmentId: d.id }));
      }));
      const all = res.flat();
      setTasks(all);
    } catch (e: any) { setErr(e?.message || 'Failed to load tasks'); } finally { setLoading(false); }
  }
  useEffect(() => { loadTasks(); }, [currentEventId, zoneId, zdeptId]);

  // defaults when opening create
  useEffect(() => {
    if (!showCreate) return;
    if (!createZoneId && zoneId !== 'ALL_ZONES') setCreateZoneId(zoneId);
    // When zone dept ids load, default to first available department for that zone
    if (!createDeptId) {
      if (createZoneDeptIds.length > 0) setCreateDeptId(createZoneDeptIds[0]);
      else if (departments.length > 0) setCreateDeptId(departments[0].id);
    }
  }, [showCreate, departments, zoneId, createDeptId, createZoneId, createZoneDeptIds]);

  // Load zonal departments for selected create zone
  useEffect(() => {
    if (!currentEventId) return;
    if (!createZoneId) { setCreateZDepts([]); setCreateZDeptId(''); return; }
    zonesService.listZoneZonalDepts(currentEventId, createZoneId)
      .then(rows => { setCreateZDepts(rows || []); setCreateZDeptId(''); })
      .catch(() => { setCreateZDepts([]); setCreateZDeptId(''); });
  }, [currentEventId, createZoneId]);

  // Load central departments assigned to the selected create zone (zone's departments)
  useEffect(() => {
    if (!currentEventId) return;
    if (!createZoneId) { setCreateZoneDeptIds([]); return; }
    zonesService.zoneDepartments(currentEventId, createZoneId)
      .then((ids) => setCreateZoneDeptIds(ids || []))
      .catch(() => setCreateZoneDeptIds([]));
  }, [currentEventId, createZoneId]);

  // Load all zonal dept templates (used when Zone = All)
  useEffect(() => {
    if (!currentEventId) return;
    zonesService.listZonalDepts(currentEventId)
      .then(rows => setAllZonalTemplates(rows || []))
      .catch(() => setAllZonalTemplates([]));
  }, [currentEventId]);

  // Build row -> template map for zones present in current task list (for client-side filter when ALL_ZONES)
  useEffect(() => {
    if (!currentEventId) return;
    if (zoneId !== 'ALL_ZONES') return;
    const zoneIds = Array.from(new Set((tasks.map(t => t.zoneId).filter(Boolean) as string[])));
    if (zoneIds.length === 0) { setRowTemplateMap({}); return; }
    Promise.all(
      zoneIds.map(z => zonesService.listZoneZonalDepts(currentEventId, z).then(rows => rows || []).catch(() => []))
    ).then(all => {
      const map: Record<string,string> = {};
      for (const rows of all) {
        for (const r of rows) map[r.id] = (r as any).templateId;
      }
      setRowTemplateMap(map);
    });
  }, [currentEventId, tasks, zoneId]);

  // member names (use event-wide)
  useEffect(() => {
    if (!currentEventId) return;
    (async () => {
      try {
        const eventRows = await eventsService.members.list(currentEventId).catch(() => []);
        const map: Record<string, string> = {};
        for (const m of eventRows || []) map[m.userId] = m.user?.fullName || m.userId;
        setMemberNameById(map);
      } catch { setMemberNameById({}); }
    })();
  }, [currentEventId]);

  // venue names
  useEffect(() => {
    let mounted = true;
    if (!currentEventId) return;
    import('../services/venues').then(({ venuesService }) =>
      venuesService.list(currentEventId!).then((rows) => {
        if (!mounted) return;
        const m: Record<string, string> = {};
        for (const v of rows || []) m[v.id] = v.name;
        setVenueNameById(m);
      }).catch(() => setVenueNameById({}))
    );
    return () => { mounted = false; };
  }, [currentEventId, tasks]);

  // permissions
  const canEditTask = (t: TaskItem) => {
    if (isSuperAdmin) return true;
    if (!t.departmentId) return false;
    const roles = myMemberships.filter((m) => !m.departmentId || m.departmentId === t.departmentId).map((m) => m.role);
    if (roles.includes('OWNER') || roles.includes('PMO_ADMIN') || roles.includes('DEPT_HEAD')) return true;
    if (roles.includes('DEPT_MEMBER')) {
      return t.creatorId === currentUserId || t.assigneeId === currentUserId;
    }
    return false;
  };

  // filters
  function matches(t: TaskItem) {
    const term = q.trim().toLowerCase(); const now = Date.now();
    const matchStatus = statusFilter === 'all' ? true : t.status === statusFilter;
    const matchPriority = priorityFilter === 'all' ? true : t.priority === priorityFilter;
    const matchMember = memberFilter === 'all' ? true : t.assigneeId === memberFilter;
    const isOverdue = !!t.dueAt && new Date(t.dueAt).getTime() < now && t.status !== 'done' && t.status !== 'canceled';
    const matchOverdue = overdueOnly ? isOverdue : true;
    const matchText = !term || t.title.toLowerCase().includes(term) || (t.description || '').toLowerCase().includes(term);
    const matchZonalDept = (() => {
      if (zoneId !== 'ALL_ZONES') return true; // server handles row filter for a specific zone
      if (zdeptId === 'ALL_ZDEPTS') return true;
      const tmplId = rowTemplateMap[t.zonalDeptRowId || ''];
      return tmplId ? tmplId === zdeptId : false;
    })();
    return matchStatus && matchPriority && matchMember && matchOverdue && matchText && matchZonalDept;
  }
  const filtered = useMemo(() => tasks.filter(matches), [tasks, statusFilter, priorityFilter, memberFilter, overdueOnly, q]);

  // actions
  async function changeStatus(task: TaskItem, status: TaskStatus) {
    if (!currentEventId || !task.departmentId) return;
    try {
      const res = await tasksService.changeStatus(currentEventId, task.departmentId, task.id, { status });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: res.status, progressPct: res.progressPct } : t)));
    } catch { alert('Not allowed to change status'); }
  }
  async function changeStatusFromDrawer(task: TaskItem, status: TaskStatus) {
    if (!currentEventId || !task.departmentId) return;
    try {
      const res = await tasksService.changeStatus(currentEventId, task.departmentId, task.id, { status });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: res.status, progressPct: res.progressPct } : t)));
      setViewing((cur) => (cur && cur.id === task.id ? { ...cur, status: res.status, progressPct: res.progressPct } : cur));
    } catch { alert('Not allowed to change status'); }
  }
  function openDetails(t: TaskItem) { setViewing(t); }
  function openEdit(t: TaskItem) {
    // (Optional) If you want full edit like Central page, you can copy the SideDrawer from Central.
    // For now we’ll just open details drawer to keep parity on view+status changes.
    setViewing(t);
  }
  async function removeTask(task: TaskItem) {
    if (!currentEventId || !task.departmentId) return;
    if (!confirm('Delete this task?')) return;
    try {
      await tasksService.remove(currentEventId, task.departmentId, task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch { alert('Failed to delete task'); }
  }

  // create zonal task
  async function createTask() {
    if (!currentEventId) return;
    if (!createForm.title.trim()) return;
    // Hidden internal storage department (backend requires departmentId). We pick a default silently.
    if (!createDeptId) {
      if (departments.length > 0) {
        setCreateDeptId(departments[0].id);
      } else {
        alert('Unable to create: no internal department is configured for storage.');
        return;
      }
    }
    if (!createZoneId) { alert('Please select a zone'); return; }
    setCreating(true);
    try {
      const payload: any = {
        title: createForm.title.trim(),
        description: createForm.description?.trim() || undefined,
        priority: Number(createForm.priority) || 3,
        type: createForm.type,
        startAt: createForm.startAt ? dateOnlyToISO(createForm.startAt) : undefined,
        dueAt: createForm.dueAt ? dateOnlyToISO(createForm.dueAt) : undefined,
        assigneeId: createForm.assigneeId?.trim() || undefined,
        venueId: createForm.venueId?.trim() || undefined,
        zoneId: createZoneId,
        zonalDeptRowId: createZDeptId || undefined,
      };
      const created = await tasksService.create(currentEventId, createDeptId, payload);
      for (let i = 0; i < createFiles.length; i++) {
        const item = createFiles[i];
        await attachmentsService.uploadWithProgress(
          currentEventId,
          'Task',
          created.id,
          item.file,
          (pct) => setCreateFiles((prev) => prev.map((p, idx) => (idx === i ? { ...p, progress: pct } : p)))
        ).catch(() => { });
      }
      setShowCreate(false);
      setCreateForm({ title: '', description: '', priority: 3, startAt: '', dueAt: '', assigneeId: '', venueId: '', type: 'new_task' });
      setCreateFiles((prev) => { prev.forEach(p => URL.revokeObjectURL(p.url)); return []; });
      setCreateDeptId(''); setCreateZoneId(''); setCreateZDeptId('');
      await loadTasks(true);
    } catch {
      alert('Failed to create zonal task. Check zone selection and permissions.');
    } finally { setCreating(false); }
  }
  function onPickCreateFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next = Array.from(files).map((f) => ({ file: f, url: URL.createObjectURL(f), progress: 0 }));
    setCreateFiles((prev) => [...prev, ...next]);
  }
  function removeCreateFile(idx: number) {
    setCreateFiles((prev) => {
      const copy = [...prev];
      const [rm] = copy.splice(idx, 1);
      if (rm) URL.revokeObjectURL(rm.url);
      return copy;
    });
  }

  // UI helpers
  const statusBase = 'appearance-none text-sm rounded-md pl-3 pr-8 py-2 border focus:outline-none focus:ring-2 w-[124px] min-w-[124px]';
  const statusColor = (s: TaskStatus) =>
    s === 'done' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100' :
      s === 'in_progress' ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100' :
        s === 'blocked' ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100' :
          s === 'canceled' ? 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-100' :
            'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-100';

  return (
    <Page>
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-semibold">Tasks • Zones</div>
        </div>

        {/* Row 2: filters (list view only) */}
        {viewMode === 'list' && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[180px]" title="Zone">
              <label className="block text-xs text-gray-600 mb-1">Zone</label>
              <Dropdown value={zoneId} onChange={(v) => setZoneId(v)} options={[{ value: 'ALL_ZONES', label: 'All Zones' }, ...zones.map(z => ({ value: z.id, label: z.name }))]} fullWidth />
            </div>
            <div className="min-w-[220px]" title="Zonal Department">
              <label className="block text-xs text-gray-600 mb-1">Zonal Dept</label>
              {zoneId !== 'ALL_ZONES' ? (
                <Dropdown
                  value={zdeptId}
                  onChange={(v) => setZDeptId(v)}
                  options={[{ value: 'ALL_ZDEPTS', label: 'All Zonal Departments' }, ...zdepts.map(d => ({ value: d.id, label: d.name }))]}
                  fullWidth
                />
              ) : (
                <Dropdown
                  value={zdeptId}
                  onChange={(v) => setZDeptId(v)}
                  options={[{ value: 'ALL_ZDEPTS', label: 'All Zonal Departments' }, ...allZonalTemplates.map(t => ({ value: t.id, label: t.name }))]}
                  fullWidth
                />
              )}
            </div>
            <div className="min-w-[160px]" title="Status">
              <label className="block text-xs text-gray-600 mb-1">Status</label>
              <Dropdown value={String(statusFilter)} onChange={(v) => setTasksState({ statusFilter: v as any })} options={[{ value: 'all', label: 'All Statuses' }, ...STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))]} fullWidth />
            </div>
            <div className="min-w-[160px]" title="Priority">
              <label className="block text-xs text-gray-600 mb-1">Priority</label>
              <Dropdown value={String(priorityFilter)} onChange={(v) => setTasksState({ priorityFilter: v === 'all' ? 'all' : Number(v) })} options={[{ value: 'all', label: 'All Priorities' }, ...[1, 2, 3, 4, 5].map(p => ({ value: String(p), label: PRIORITY_LABEL[p] }))]} fullWidth />
            </div>
            <div className="min-w-[180px]" title="Member">
              <label className="block text-xs text-gray-600 mb-1">Member</label>
              <Dropdown
                value={String(memberFilter)}
                onChange={(v) => setTasksState({ memberFilter: v as any })}
                options={[{ value: 'all', label: 'All Members' }, ...Object.entries(memberNameById).map(([id, name]) => ({ value: id, label: name }))]}
                fullWidth
              />
            </div>
            <div className="min-w-[140px]">
              <label className="block text-xs text-gray-600 mb-1">Overdue</label>
              <label className="inline-flex items-center text-sm text-gray-700">
                <input type="checkbox" className="mr-2" checked={overdueOnly} onChange={(e) => setTasksState({ overdueOnly: e.target.checked })} />
                Overdue only
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Row 3: view toggle + search (search only in list view) */}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="inline-flex items-center bg-gray-100 border border-gray-300 rounded-xl p-1">
          <button
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm transition ${viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
            onClick={() => setTasksState({ viewMode: 'list' })}
            title="List view"
          >
            <ListIcon size={16} className="mr-1" /> List
          </button>
          <button
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm transition ${viewMode === 'board' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
            onClick={() => setTasksState({ viewMode: 'board' })}
            title="Board view"
          >
            <LayoutGrid size={16} className="mr-1" /> Board
          </button>
        </div>

        {viewMode === 'list' && (
          <>
            <div className="flex flex-col flex-1 min-w-[220px]">
              <label className="block text-xs text-gray-600 mb-1">Search</label>
              <input
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Search tasks"
                value={q}
                onChange={(e) => setTasksState({ q: e.target.value })}
                aria-label="Search tasks"
              />
            </div>
            {/* Add Task aligned to the right */}
            <button
              className="ml-auto inline-flex items-center px-3 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              onClick={() => setShowCreate(true)}
              title="Create zonal task"
            >
              <Plus size={16} className="mr-1" /> Add Task
            </button>
          </>
        )}
      </div>
      <div style={{ height: '10px' }}></div>
      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-3">{err}</div>}
      {loading && <Spinner label="Loading tasks" />}

      {!loading && (viewMode === 'board' ? (
        <TasksBoardView
          tasks={filtered}
          onChangeStatus={changeStatusFromDrawer}
          onView={openDetails}
          memberNameById={memberNameById}
        />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm table-auto">
            <colgroup>
              <col style={{ width: '30%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '120px' }} />
            </colgroup>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 text-gray-600">Title</th>
                <th className="text-left px-4 py-2 text-gray-600">Type</th>
                <th className="text-left px-4 py-2 text-gray-600">Venue</th>
                <th className="text-left px-4 py-2 text-gray-600">Priority</th>
                <th className="text-left px-4 py-2 text-gray-600">Assignee</th>
                <th className="text-left px-4 py-2 text-gray-600">Due</th>
                <th className="text-left px-4 py-2 text-gray-600">Status</th>
                <th className="text-right px-4 py-2 text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b last:border-0 align-top">
                  <td className="px-4 py-2 align-top">
                    <div className="font-medium text-gray-900" title={t.title}>{t.title}</div>
                    {t.description && (<div className="text-xs text-gray-600 mt-0.5 break-words whitespace-pre-wrap">{t.description}</div>)}
                  </td>
                  <td className="px-4 py-2 align-top">
                    {t.type && (
                      <span className={`inline-flex items-center border rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[t.type as TaskType] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                        {TYPE_OPTIONS.find(o => o.value === t.type)?.label || t.type}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 align-top"><span className="text-sm text-gray-700">{venueNameById[t.venueId || ''] || (t.venueId ? t.venueId : '—')}</span></td>
                  <td className="px-4 py-2 align-top"><PriorityBadge p={t.priority} /></td>
                  <td className="px-4 py-2 align-top">{t.assigneeId ? (<UserAvatar nameOrEmail={memberNameById[t.assigneeId] || t.assigneeId} size={28} className="shadow-sm" />) : (<span className="text-gray-400 text-sm">—</span>)}</td>
                  <td className="px-4 py-2 align-top"><span className="inline-flex items-center text-gray-700"><Calendar size={14} className="mr-1" />{fmt(t.dueAt) || '-'}</span></td>
                  <td className="px-4 py-2 align-top">
                    <Dropdown
                      value={t.status}
                      onChange={(v) => changeStatus(t, v as TaskStatus)}
                      options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
                      title={canEditTask(t) ? 'Change status' : 'No permission to change status'}
                      disabled={!canEditTask(t)}
                      className={`${statusBase} ${statusColor(t.status)}`}
                    />
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap align-top">
                    <button className="text-gray-700 hover:text-black mr-3" onClick={() => openDetails(t)} title="View"><Eye size={16} /></button>
                    <button className="text-gray-700 hover:text-black mr-3" onClick={() => openEdit(t)} title="Edit"><Pencil size={16} /></button>
                    <button className="text-rose-600 hover:text-rose-700" onClick={() => removeTask(t)} disabled={!canEditTask(t)} title="Delete"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (<tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">No tasks found.</td></tr>)}
            </tbody>
          </table>
        </div>
      ))}

      {viewing && (
        <TaskDetailsDrawer
          task={viewing}
          eventId={currentEventId!}
          memberNameById={memberNameById}
          onClose={() => setViewing(null)}
          onChangeStatus={(s) => changeStatusFromDrawer(viewing, s)}
        />
      )}
      {showCreate && (
        <SideDrawer
          open={showCreate}
          onClose={() => setShowCreate(false)}
          maxWidthClass="max-w-2xl"
          header={
            <>
              <div className="text-xl font-semibold truncate">Create Zonal Task</div>
              <div className="text-sm text-gray-600 truncate">{createForm.title || 'New zonal task'}</div>
            </>
          }
        >
          <div className="p-5">
            <div className="grid md:grid-cols-2 gap-4">
              {/* No central department selection in Zonal create – stored internally */}
              <div>
                <label className="block text-sm mb-1">Zone <span className="text-rose-600">*</span></label>
                <Dropdown
                  value={createZoneId}
                  onChange={(v) => setCreateZoneId(v)}
                  options={zones.map(z => ({ value: z.id, label: z.name }))}
                  fullWidth
                />
              </div>
              {createZoneId && (
                <div>
                  <label className="block text-sm mb-1">Zonal Department</label>
                  <Dropdown
                    value={createZDeptId}
                    onChange={(v) => setCreateZDeptId(v)}
                    options={[{ value: '', label: 'None' }, ...createZDepts.map(d => ({ value: d.id, label: d.name }))]}
                    fullWidth
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Title <span className="text-rose-600">*</span></label>
                <input
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  value={createForm.title}
                  onChange={(e) => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Setup registration desk in Zone A"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Description</label>
                <textarea
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  rows={4}
                  value={createForm.description}
                  onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Add relevant details, links, checklists"
                />
              </div>

              {currentEventId && (
                <div className="md:col-span-2">
                  <VenueSelect
                    eventId={currentEventId}
                    value={createForm.venueId}
                    onChange={(v) => setCreateForm(f => ({ ...f, venueId: v }))}
                    label="Venue"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm mb-1">Priority</label>
                <Dropdown
                  value={String(createForm.priority)}
                  onChange={(v) => setCreateForm(f => ({ ...f, priority: Number(v) }))}
                  options={[1, 2, 3, 4, 5].map(p => ({ value: String(p), label: PRIORITY_LABEL[p] }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Type</label>
                <Dropdown
                  value={createForm.type}
                  onChange={(v) => setCreateForm(f => ({ ...f, type: v as TaskType }))}
                  options={TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                />
              </div>

              <div>
                <label className="block text-sm mb-1">Start Date</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  value={createForm.startAt}
                  onChange={(e) => setCreateForm(f => ({ ...f, startAt: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Due Date</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  value={createForm.dueAt}
                  onChange={(e) => setCreateForm(f => ({ ...f, dueAt: e.target.value }))}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Assignee</label>
                <Dropdown
                  value={createForm.assigneeId || ''}
                  onChange={(v) => setCreateForm(f => ({ ...f, assigneeId: v }))}
                  options={[{ value: '', label: 'Unassigned' }, ...Object.entries(memberNameById).map(([id, name]) => ({ value: id, label: name }))]}
                  fullWidth
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Attachments</label>
                <input type="file" multiple onChange={(e) => onPickCreateFiles(e.target.files)} className="block w-full text-sm text-gray-700" />
                {createFiles.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {createFiles.map((f, idx) => (
                      <li key={idx} className="flex items-center justify-between text-sm">
                        <span className="truncate max-w-[70%]">{f.file.name}</span>
                        <div className="flex items-center gap-2">
                          {f.progress > 0 && f.progress < 100 && (
                            <span className="text-xs text-gray-500">{Math.round(f.progress)}%</span>
                          )}
                          <button className="text-rose-600 hover:text-rose-700" onClick={() => removeCreateFile(idx)} title="Remove">Remove</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button className="px-3 py-2 rounded-lg text-sm border border-gray-300" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="px-3 py-2 rounded-lg text-sm bg-blue-600 text-white disabled:opacity-60" onClick={createTask} disabled={creating}>
                  {creating ? 'Creating…' : 'Create Task'}
                </button>
              </div>
            </div>
          </div>
        </SideDrawer>
      )}
    </Page>
  );
};
