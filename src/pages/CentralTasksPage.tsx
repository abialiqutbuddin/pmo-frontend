import React, { useEffect, useMemo, useState } from 'react';
import { Page } from '../components/layout/Page';
import { Dropdown } from '../components/ui/Dropdown';
import { useContextStore } from '../store/contextStore';
import { useAuthStore } from '../store/authStore';
import { usePageStateStore } from '../store/pageStateStore';
import { DepType, tasksService } from '../services/tasks';
import { departmentsService } from '../services/departments';
import { eventsService } from '../services/events';
import type { TaskItem, TaskStatus, TaskType } from '../types/task';
import { Spinner } from '../components/ui/Spinner';
import { LayoutGrid, List as ListIcon, Calendar, Eye, Pencil, Trash2, Flag, Plus, FileText, Download } from 'lucide-react';
import { UserAvatar } from '../components/ui/UserAvatar';
import { TaskDetailsDrawer } from '../components/tasks/TaskDetailsDrawer';
import { SideDrawer } from '../components/ui/SideDrawer';
import { TasksBoardView } from '../components/tasks/TaskBoardView';
import { VenueSelect } from '../components/tasks/VenueSelect';
import { attachmentsService } from '../services/attachments';
import { BASE_URL } from '../api';

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
  venueId: string;
  type: TaskType;
};

function fmt(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
function isoToDateInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function dateOnlyToISO(dateStr?: string | null) {
  if (!dateStr) return undefined;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}



export const CentralTasksPage: React.FC = () => {
  const { currentEventId, departments, myMemberships, canAdminEvent } = useContextStore();
  const isSuperAdmin = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);
  const currentUserId = useAuthStore((s) => s.currentUser?.id);

  const tasksState = usePageStateStore((s) => s.tasks);
  const setTasksState = usePageStateStore((s) => s.setTasks);
  const deptId = tasksState.deptId;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksByDept, setTasksByDept] = useState<Record<string, TaskItem[]>>({});
  const [memberOptions, setMemberOptions] = useState<{ value: string; label: string }[]>([]);
  const [memberNameById, setMemberNameById] = useState<Record<string, string>>({});
  const [deptMemberOpts, setDeptMemberOpts] = useState<Record<string, { value: string; label: string }[]>>({});
  const [venueNameById, setVenueNameById] = useState<Record<string, string>>({});

  // ✅ Create/edit modal state MUST live inside the component
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    title: '',
    description: '',
    priority: 3,
    startAt: '',
    dueAt: '',
    assigneeId: '',
    venueId: '',
    type: 'new_task',
  });
  const [createDeps, setCreateDeps] = useState<{ upstreamId: string; depType: DepType }[]>([]);
  const [createFiles, setCreateFiles] = useState<{ file: File; url: string; progress: number }[]>([]);
  const [createDeptId, setCreateDeptId] = useState<string>('');
  const [editFiles, setEditFiles] = useState<{ file: File; url: string; progress: number }[]>([]);
  const [existingAtt, setExistingAtt] = useState<{ id: string; originalName: string; mimeType: string; size?: number; bytes?: number; objectKey?: string }[]>([]);
  const [existingLoading, setExistingLoading] = useState(false);

  const statusFilter = tasksState.statusFilter;
  const priorityFilter = tasksState.priorityFilter;
  const q = tasksState.q;
  const overdueOnly = !!tasksState.overdueOnly;
  const memberFilter = tasksState.memberFilter || 'all';
  const viewMode = tasksState.viewMode;

  // view / edit drawers
  const [viewing, setViewing] = useState<TaskItem | null>(null);
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string; description: string; priority: number; startAt: string; dueAt: string;
    assigneeId: string; venueId: string; type: TaskType; status: TaskStatus; progressPct: number;
  }>({ title: '', description: '', priority: 3, startAt: '', dueAt: '', assigneeId: '', venueId: '', type: 'new_task', status: 'todo', progressPct: 0 });

  const accessibleDepts = useMemo(() => {
    if (isSuperAdmin || canAdminEvent) return departments;
    const ids = new Set((myMemberships.map((m) => m.departmentId).filter(Boolean) as string[]));
    return departments.filter((d) => ids.has(d.id));
  }, [isSuperAdmin, canAdminEvent, departments, myMemberships]);

  useEffect(() => {
    if (!deptId && accessibleDepts.length > 0) {
      setTasksState({ deptId: accessibleDepts[0].id });
    }
  }, [accessibleDepts, deptId, setTasksState]);

  // REPLACE your existing `loadTasks` function in CentralTasksPage with this version.
  // This removes all zone-related logic and ensures the Central page only loads NON-zonal (central) tasks.

  async function loadTasks(force?: boolean) {
    if (!currentEventId || !deptId) return;
    if (deptId === 'ALL' && accessibleDepts.length === 0) return;

    setLoading(true);
    setErr(null);

    try {
      const assignee =
        memberFilter !== 'all' ? (memberFilter as string) : undefined;

      if (deptId === 'ALL') {
        // fetch per department, keep only central (no zoneId)
        const res = await Promise.all(
          accessibleDepts.map(async (d) => {
            const rows =
              (await tasksService.list(currentEventId, d.id, {
                force,
                assigneeId: assignee,
              })) || [];
            const centralOnly = rows.filter((t: any) => !t.zoneId);
            return {
              id: d.id,
              rows: centralOnly.map((t: any) => ({ ...t, departmentId: d.id })),
            };
          })
        );

        const by: Record<string, TaskItem[]> = {};
        for (const r of res) by[r.id] = r.rows;
        setTasksByDept(by);

        const all = res.flatMap((r) => r.rows);
        const dedup = Array.from(
          new Map(all.map((t: any) => [t.id, t])).values()
        ) as TaskItem[];
        setTasks(dedup);
      } else {
        // single department, keep only central (no zoneId)
        const data =
          (await tasksService.list(currentEventId, deptId, {
            force,
            assigneeId: assignee,
          })) || [];

        const centralOnly = data.filter((t: any) => !t.zoneId);
        const withDept = centralOnly.map((t: any) => ({
          ...t,
          departmentId: deptId,
        }));
        setTasks(withDept as any);
        setTasksByDept({ [deptId]: withDept as any });
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (showCreate && deptId === 'ALL' && !createDeptId && accessibleDepts.length > 0) {
      setCreateDeptId(accessibleDepts[0].id);
    }
  }, [showCreate, deptId, createDeptId, accessibleDepts]);

  // Members: options + name map (dedup by userId to avoid duplicates from multiple roles)
  useEffect(() => {
    if (!currentEventId || !deptId) return;
    (async () => {
      try {
        const deptRows = deptId === 'ALL' ? [] : await departmentsService.members.list(currentEventId, deptId).catch(() => []);
        const eventRows = await eventsService.members.list(currentEventId).catch(() => []);

        // Build options from either event-wide or department-specific members, dedup by userId
        const baseRows = (deptId === 'ALL' ? eventRows : deptRows) || [];
        const seen = new Set<string>();
        const uniq = [] as { userId: string; user?: { fullName?: string } }[];
        for (const m of baseRows) {
          if (!m?.userId) continue;
          if (seen.has(m.userId)) continue;
          seen.add(m.userId);
          uniq.push(m);
        }
        const opts = uniq
          .map((m) => ({ value: m.userId, label: m.user?.fullName || m.userId }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setMemberOptions([{ value: '', label: 'Unassigned' }, ...opts]);

        // Name map combines event-wide + dept-specific to resolve names anywhere
        const map: Record<string, string> = {};
        for (const m of eventRows || []) map[m.userId] = m.user?.fullName || m.userId;
        for (const m of deptRows || []) map[m.userId] = m.user?.fullName || map[m.userId] || m.userId;
        setMemberNameById(map);
      } catch {
        setMemberOptions([{ value: '', label: 'Unassigned' }]);
        setMemberNameById({});
      }
    })();
  }, [currentEventId, deptId]);

  // Helper: ensure department-specific member options are loaded (for assignee dropdowns)
  async function ensureDeptMemberOptions(loadDeptId?: string) {
    if (!currentEventId) return;
    const id = loadDeptId;
    if (!id) return;
    if (deptMemberOpts[id]) return;
    try {
      const rows = await departmentsService.members.list(currentEventId, id).catch(() => []);
      const opts = (rows || [])
        .map((m: any) => ({ value: m.userId, label: m.user?.fullName || m.userId }))
        .sort((a: any, b: any) => a.label.localeCompare(b.label));
      setDeptMemberOpts((prev) => ({ ...prev, [id]: opts }));
    } catch {}
  }

  // When create modal is open, load member options for target department
  useEffect(() => {
    if (!showCreate) return;
    const targetDeptId = deptId === 'ALL' ? createDeptId : deptId;
    if (targetDeptId) void ensureDeptMemberOptions(targetDeptId);
  }, [showCreate, deptId, createDeptId]);

  // When editing, load member options for the task's department
  useEffect(() => {
    if (!editing?.departmentId) return;
    void ensureDeptMemberOptions(editing.departmentId);
  }, [editing?.departmentId]);

  // Load tasks when deps change
  useEffect(() => {
    if (!currentEventId) return;
    if (!deptId) return;

    // If we're on ALL, wait until we actually know which departments are accessible
    if (deptId === 'ALL' && accessibleDepts.length === 0) return;

    // Fetch (no need to include filters that are purely client-side)
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEventId, deptId, memberFilter, accessibleDepts]);

  // Venues: name map for display
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

  // Permissions
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

  async function createTask() {
    if (!currentEventId || !deptId) return;
    if (!createForm.title.trim()) return;
    setCreating(true);
    try {
      const targetDeptId = deptId === 'ALL' ? createDeptId : deptId;
      if (!targetDeptId) throw new Error('Please choose a department');
      const payload: any = {
        title: createForm.title.trim(),
        description: createForm.description?.trim() || undefined,
        priority: Number(createForm.priority) || 3,
        type: createForm.type,
        startAt: createForm.startAt ? dateOnlyToISO(createForm.startAt) : undefined,
        dueAt: createForm.dueAt ? dateOnlyToISO(createForm.dueAt) : undefined,
        assigneeId: createForm.assigneeId?.trim() || undefined,
        venueId: createForm.venueId?.trim() || undefined,
        //zoneId: zones.length > 0 ? (createCommon ? undefined : (createForm as any).zoneId || undefined) : undefined,
      };
      const created = await tasksService.create(currentEventId, targetDeptId, payload);
      // Upload any selected files
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
      // link dependencies if any
      for (const d of createDeps) {
        if (!d.upstreamId) continue;
        try {
          await tasksService.dependencies.add(currentEventId, targetDeptId, created.id, d);
        } catch { }
      }
      setShowCreate(false);
      setCreateForm({ title: '', description: '', priority: 3, startAt: '', dueAt: '', assigneeId: '', venueId: '', type: 'new_task' });
      setCreateDeps([]);
      // cleanup previews
      setCreateFiles((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return [];
      });
      await loadTasks(true);
    } catch (e) {
      // surface minimal error
      alert('Failed to create task. Select a department and check permissions.');
    } finally {
      setCreating(false);
    }
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

  function onPickEditFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next = Array.from(files).map((f) => ({ file: f, url: URL.createObjectURL(f), progress: 0 }));
    setEditFiles((prev) => [...prev, ...next]);
  }
  function removeEditFile(idx: number) {
    setEditFiles((prev) => {
      const copy = [...prev];
      const [rm] = copy.splice(idx, 1);
      if (rm) URL.revokeObjectURL(rm.url);
      return copy;
    });
  }

  // Helpers for existing attachments
  function publicUrlFromObjectKey(objectKey?: string) {
    if (!objectKey) return '';
    // encode each segment to avoid problems with spaces
    return `${BASE_URL}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
  }
  function fileUrl(eventId: string, a: { id: string; objectKey?: string }) {
    if (a.objectKey) return publicUrlFromObjectKey(a.objectKey);
    return `${BASE_URL}/events/${eventId}/attachments/${a.id}`;
  }

  useEffect(() => {
    let mounted = true;
    async function loadExisting() {
      if (!currentEventId || !editing?.id) { setExistingAtt([]); return; }
      setExistingLoading(true);
      try {
        const rows = await attachmentsService.list(currentEventId, 'Task', editing.id).catch(() => []);
        if (mounted) setExistingAtt(rows || []);
      } finally {
        if (mounted) setExistingLoading(false);
      }
    }
    loadExisting();
    return () => { mounted = false; };
  }, [currentEventId, editing?.id]);



  // Filters
  function matchesFilters(t: TaskItem) {
    const term = q.trim().toLowerCase();
    const now = Date.now();
    const matchStatus = statusFilter === 'all' ? true : t.status === statusFilter;
    const matchPriority = priorityFilter === 'all' ? true : t.priority === priorityFilter;
    const matchMember = memberFilter === 'all' ? true : t.assigneeId === memberFilter;
    const isOverdue = !!t.dueAt && new Date(t.dueAt).getTime() < now && t.status !== 'done' && t.status !== 'canceled';
    const matchOverdue = overdueOnly ? isOverdue : true;
    const matchText = !term || t.title.toLowerCase().includes(term) || (t.description || '').toLowerCase().includes(term);
    return matchStatus && matchPriority && matchMember && matchOverdue && matchText;
  }
  const filtered = useMemo(() => tasks.filter(matchesFilters), [tasks, statusFilter, priorityFilter, memberFilter, overdueOnly, q]);

  // Actions
  async function changeStatus(task: TaskItem, status: TaskStatus) {
    if (!currentEventId || !task.departmentId) return;
    try {
      const res = await tasksService.changeStatus(currentEventId, task.departmentId, task.id, { status });
      // Update flat list (used by board and single dept list)
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: res.status, progressPct: res.progressPct } : t)));
      // Update per-dept map (used by ALL view tables)
      setTasksByDept((prev) => {
        const next = { ...prev } as Record<string, TaskItem[]>;
        const did = task.departmentId!;
        if (next[did]) {
          next[did] = next[did].map((t) => (t.id === task.id ? { ...t, status: res.status, progressPct: res.progressPct } as TaskItem : t));
        }
        return next;
      });
    } catch {
      alert('Not allowed to change status');
    }
  }
  async function changeStatusFromDrawer(task: TaskItem, status: TaskStatus) {
    if (!currentEventId || !task.departmentId) return;
    try {
      const res = await tasksService.changeStatus(currentEventId, task.departmentId, task.id, { status });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: res.status, progressPct: res.progressPct } : t)));
      setTasksByDept((prev) => {
        const next = { ...prev } as Record<string, TaskItem[]>;
        const did = task.departmentId!;
        if (next[did]) {
          next[did] = next[did].map((t) => (t.id === task.id ? { ...t, status: res.status, progressPct: res.progressPct } as TaskItem : t));
        }
        return next;
      });
      setViewing((cur) => (cur && cur.id === task.id ? { ...cur, status: res.status, progressPct: res.progressPct } : cur));
    } catch { alert('Not allowed to change status'); }
  }
  function openDetails(t: TaskItem) { setViewing(t); }
  function openEdit(t: TaskItem) {
    setEditing(t);
    setEditForm({
      title: t.title,
      description: t.description || '',
      priority: t.priority,
      startAt: isoToDateInput(t.startAt),
      dueAt: isoToDateInput(t.dueAt),
      assigneeId: t.assigneeId || '',
      venueId: t.venueId || '',
      type: (t.type as TaskType) || 'new_task',
      status: t.status,
      progressPct: t.progressPct || 0,
    });
  }
  async function removeTask(task: TaskItem) {
    if (!currentEventId || !task.departmentId) return;
    if (!confirm('Delete this task?')) return;
    try {
      await tasksService.remove(currentEventId, task.departmentId, task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch {
      alert('Failed to delete task');
    }
  }
  async function saveEdit() {
    if (!currentEventId || !editing || !editing.departmentId) return;
    try {
      await tasksService.update(
        currentEventId,
        editing.departmentId,
        editing.id,
        {
          title: editForm.title || undefined,
          description: editForm.description || undefined,
          priority: editForm.priority,
          type: editForm.type,
          startAt: editForm.startAt ? dateOnlyToISO(editForm.startAt) : undefined,
          dueAt: editForm.dueAt ? dateOnlyToISO(editForm.dueAt) : undefined,
          assigneeId: editForm.assigneeId || undefined,
          venueId: editForm.venueId || undefined,
        }
      );

      // Persist status/progress (some backends split these)
      await tasksService.changeStatus(
        currentEventId,
        editing.departmentId,
        editing.id,
        { status: editForm.status, progressPct: editForm.progressPct }
      ).catch(() => { });

      // 🔹 Optimistic local patch (instant UI)
      setTasks(prev =>
        prev.map(t =>
          t.id === editing.id
            ? {
              ...t,
              title: editForm.title,
              description: editForm.description || undefined,
              priority: editForm.priority,
              type: editForm.type,
              startAt: editForm.startAt ? dateOnlyToISO(editForm.startAt) : undefined,
              dueAt: editForm.dueAt ? dateOnlyToISO(editForm.dueAt) : undefined,
              assigneeId: editForm.assigneeId || undefined,
              venueId: editForm.venueId || undefined,
              status: editForm.status,
              progressPct: editForm.progressPct,
            }
            : t
        )
      );

      // 🔹 Hard refresh with cache-bust so board/list stays true to server
      await loadTasks(true);

      // Upload any newly attached files (edit)
      if (editFiles.length) {
        for (let i = 0; i < editFiles.length; i++) {
          const item = editFiles[i];
          try {
            await attachmentsService.uploadWithProgress(
              currentEventId,
              'Task',
              editing.id,
              item.file,
              (pct) => setEditFiles((prev) => prev.map((p, idx) => (idx === i ? { ...p, progress: pct } : p)))
            );
          } catch { }
        }
        setEditFiles((prev) => {
          prev.forEach((p) => URL.revokeObjectURL(p.url));
          return [];
        });
      }

      // Refresh existing attachments list
      try {
        const rows = await attachmentsService.list(currentEventId, 'Task', editing.id).catch(() => []);
        setExistingAtt(rows || []);
      } catch {}

      setEditing(null);
    } catch {
      alert('Failed to update task');
    }
  }

  // UI render helpers
  const statusBase = 'appearance-none text-sm rounded-md pl-3 pr-8 py-2 border focus:outline-none focus:ring-2 w-[124px] min-w-[124px]';
  const statusColor = (s: TaskStatus) =>
    s === 'done' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100' :
      s === 'in_progress' ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100' :
        s === 'blocked' ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100' :
          s === 'canceled' ? 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-100' :
            'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-100';

  const renderRow = (t: TaskItem) => (
    <tr key={t.id} className="border-b last:border-0 align-top">
      <td className="px-4 py-2 align-top">
        <div className="font-medium text-gray-900" title={t.title}>{t.title}</div>
        {t.description && (
          <div className="text-xs text-gray-600 mt-0.5 break-words whitespace-pre-wrap">{t.description}</div>
        )}
      </td>
      <td className="px-4 py-2 align-top">
        {t.type && (
          <span className={`inline-flex items-center border rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[t.type as TaskType] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
            {TYPE_OPTIONS.find(o => o.value === t.type)?.label || t.type}
          </span>
        )}
      </td>
      <td className="px-4 py-2 align-top">
        <span className="text-sm text-gray-700">{venueNameById[t.venueId || ''] || (t.venueId ? t.venueId : '—')}</span>
      </td>
      <td className="px-4 py-2 align-top"><PriorityBadge p={t.priority} /></td>
      <td className="px-4 py-2 align-top">
        {t.assigneeId ? (
          <UserAvatar nameOrEmail={memberNameById[t.assigneeId] || t.assigneeId} size={28} className="shadow-sm" />
        ) : (<span className="text-gray-400 text-sm">—</span>)}
      </td>
      <td className="px-4 py-2 align-top">
        <span className="inline-flex items-center text-gray-700"><Calendar size={14} className="mr-1" />{fmt(t.dueAt) || '-'}</span>
      </td>
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
        <button className="text-gray-700 hover:text-black mr-3" onClick={() => openDetails(t)} title="View details">
          <Eye size={16} />
        </button>
        <button className="text-gray-700 hover:text-black mr-3" onClick={() => openEdit(t)} title="Edit">
          <Pencil size={16} />
        </button>
        <button className="text-rose-600 hover:text-rose-700" onClick={() => removeTask(t)} disabled={!canEditTask(t)} title="Delete task">
          <Trash2 size={16} />
        </button>
      </td>
    </tr>
  );

  return (
    <Page>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-semibold">Tasks • Central Departments</div>
        </div>

        {/* Controls row: view toggle on the left; filters/search only in list view */}
        <div className="mt-3 flex flex-wrap items-end gap-3">


          {/* Filters and search (only in list view) */}
          {viewMode === 'list' && (
            <>
              <div className="min-w-[180px]">
                <label className="block text-xs text-gray-600 mb-1">Department</label>
                <Dropdown
                  value={deptId}
                  onChange={(v) => setTasksState({ deptId: v })}
                  options={(() => {
                    const base = accessibleDepts.map(d => ({ value: d.id, label: d.name }));
                    const canAll = isSuperAdmin || canAdminEvent || accessibleDepts.length > 1;
                    return canAll ? [{ value: 'ALL', label: 'All Departments' }, ...base] : base;
                  })()}
                  fullWidth
                />
              </div>

              <div className="min-w-[160px]">
                <label className="block text-xs text-gray-600 mb-1">Status</label>
                <Dropdown
                  value={String(statusFilter)}
                  onChange={(v) => setTasksState({ statusFilter: v as any })}
                  options={[{ value: 'all', label: 'All Statuses' }, ...STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))]}
                  fullWidth
                />
              </div>

              <div className="min-w-[160px]">
                <label className="block text-xs text-gray-600 mb-1">Priority</label>
                <Dropdown
                  value={String(priorityFilter)}
                  onChange={(v) => setTasksState({ priorityFilter: v === 'all' ? 'all' : Number(v) })}
                  options={[{ value: 'all', label: 'All Priorities' }, ...[1, 2, 3, 4, 5].map(p => ({ value: String(p), label: PRIORITY_LABEL[p] }))]}
                  fullWidth
                />
              </div>

              <div className="min-w-[140px]">
                <label className="block text-xs text-gray-600 mb-1">Member</label>
                <Dropdown
                  value={String(tasksState.memberFilter || 'all')}
                  onChange={(v) => setTasksState({ memberFilter: v as any })}
                  options={[{ value: 'all', label: 'All Members' }, ...memberOptions.slice(1)]}
                  fullWidth
                />
              </div>

              <div className="min-w-[160px]">
                <label className="block text-xs text-gray-600 mb-1">Overdue</label>
                <label className="inline-flex items-center text-sm text-gray-700">
                  <input type="checkbox" className="mr-2" checked={overdueOnly} onChange={(e) => setTasksState({ overdueOnly: e.target.checked })} />
                  Overdue only
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="w-full flex items-end gap-3 flex-wrap md:flex-nowrap">
        {/* View toggle */}
        <div className="inline-flex items-center bg-gray-100 border border-gray-300 rounded-xl p-1 shrink-0">
          <button
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm transition ${viewMode === 'list'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-600'
              }`}
            onClick={() => setTasksState({ viewMode: 'list' })}
            title="List view"
          >
            <ListIcon size={16} className="mr-1" /> List
          </button>
          <button
            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm transition ${viewMode === 'board'
                ? 'bg-white shadow text-gray-900'
                : 'text-gray-600'
              }`}
            onClick={() => setTasksState({ viewMode: 'board' })}
            title="Board view"
          >
            <LayoutGrid size={16} className="mr-1" /> Board
          </button>
        </div>

        {/* Search box (label on top) */}
        <div className="flex flex-col flex-1 min-w-[220px]">
          <label className="block text-xs text-gray-600 mb-1">Search</label>
          <input
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="Search tasks"
            value={q}
            onChange={(e) => setTasksState({ q: e.target.value })}
            title="Search by title or description"
            aria-label="Search tasks"
          />
        </div>

        {/* Add Task button */}
        <button
          className="ml-auto inline-flex items-center px-3 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          onClick={() => setShowCreate(true)}
          title="Create task"
        >
          <Plus size={16} className="mr-1" /> Add Task
        </button>
      </div>
      <div style={{ height: '10px' }}></div>


      {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-3">{err}</div>}
      {loading && <Spinner label="Loading tasks" />}

      {!loading && (
        viewMode === 'board' ? (
          <TasksBoardView
            tasks={filtered}
            onChangeStatus={changeStatusFromDrawer}
            onView={openDetails}
            memberNameById={memberNameById}
          />
        ) : (
          deptId === 'ALL' ? (
            <div className="space-y-6">
              {accessibleDepts.map((d) => {
                const rows = (tasksByDept[d.id] || []).filter(matchesFilters);
                return (
                  <div key={d.id}>
                    <div className="text-xl md:text-2xl font-semibold text-gray-800 mb-2">{d.name}</div>
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
                          {rows.map(renderRow)}
                          {rows.length === 0 && (
                            <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">No tasks found.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
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
                  {filtered.map(renderRow)}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">No tasks found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        )
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

      {showCreate && (
        <SideDrawer
          open={showCreate}
          onClose={() => setShowCreate(false)}
          maxWidthClass="max-w-2xl"
          header={
            <>
              <div className="text-xl font-semibold truncate">Create Task</div>
              <div className="text-sm text-gray-600 truncate">{createForm.title || 'New central task'}</div>
            </>
          }
        >
          <div className="p-5">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Dept picker only if viewing ALL */}
              {deptId === 'ALL' && (
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Department <span className="text-rose-600">*</span></label>
                  <Dropdown
                    value={createDeptId || ''}
                    onChange={(v) => setCreateDeptId(v)}
                    options={accessibleDepts.map(d => ({ value: d.id, label: d.name }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">Required when creating from “All Departments”.</p>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Title <span className="text-rose-600">*</span></label>
                <input
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  value={createForm.title}
                  onChange={(e) => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Print badges for speakers"
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
                  options={(() => {
                    const targetDeptId = deptId === 'ALL' ? createDeptId : deptId;
                    const opts = targetDeptId ? (deptMemberOpts[targetDeptId] || []) : [];
                    return [{ value: '', label: 'Unassigned' }, ...opts];
                  })()}
                />
              </div>

              {/* Attachments */}
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Attachments</label>
                <div className="border border-dashed border-gray-300 rounded-md p-3 bg-gray-50">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => onPickCreateFiles(e.target.files)}
                    className="block w-full text-sm text-gray-700"
                  />
                  <div className="text-xs text-gray-500 mt-1">Add images or files. Images show a preview.</div>
                  {createFiles.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {createFiles.map((f, idx) => {
                        const isImg = f.file.type.startsWith('image/');
                        return (
                          <div key={idx} className="border rounded bg-white overflow-hidden shadow-sm">
                            <div className="relative w-full h-28 bg-gray-100 flex items-center justify-center">
                              {isImg ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={f.url} alt={f.file.name} className="object-cover w-full h-full" />
                              ) : (
                                <div className="text-xs text-gray-500 px-2 text-center break-words">
                                  {f.file.name}
                                </div>
                              )}
                              {f.progress > 0 && f.progress < 100 && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[11px] px-1 py-0.5 text-center">
                                  {Math.round(f.progress)}%
                                </div>
                              )}
                            </div>
                            <div className="px-2 py-1 text-[11px] text-gray-600 truncate" title={f.file.name}>{f.file.name}</div>
                            <button type="button" className="w-full text-xs text-rose-600 hover:text-rose-700 py-1 border-t" onClick={() => removeCreateFile(idx)}>Remove</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded-md text-sm text-gray-700 hover:text-black"
                onClick={() => setShowCreate(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                className="px-3 py-2 rounded-md text-sm bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
                onClick={createTask}
                disabled={creating || !createForm.title.trim() || (deptId === 'ALL' && !createDeptId)}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </SideDrawer>
      )}

      {editing && (
        <SideDrawer
          open={!!editing}
          onClose={() => setEditing(null)}
          maxWidthClass="max-w-2xl"
          header={
            <>
              <div className="text-xl font-semibold truncate">Edit Task</div>
              <div className="text-sm text-gray-600 truncate">{editForm.title || editing.title}</div>
            </>
          }
        >
          <div className="p-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Title</label>
                <input
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Description</label>
                <textarea
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  rows={4}
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              {currentEventId && (
                <div className="md:col-span-2">
                  <VenueSelect
                    eventId={currentEventId}
                    value={editForm.venueId}
                    onChange={(v) => setEditForm((f) => ({ ...f, venueId: v }))}
                    label="Venue"
                  />
                </div>
              )}
              <div className="md:col-span-2 grid md:grid-cols-4 gap-2">
                <div>
                  <label className="block text-sm mb-1">Priority</label>
                  <Dropdown
                    value={String(editForm.priority)}
                    onChange={(v) => setEditForm((f) => ({ ...f, priority: Number(v) }))}
                    options={[1, 2, 3, 4, 5].map(p => ({ value: String(p), label: PRIORITY_LABEL[p] }))}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Type</label>
                  <Dropdown
                    value={editForm.type}
                    onChange={(v) => setEditForm((f) => ({ ...f, type: v as TaskType }))}
                    options={TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Start Date</label>
                  <input type="date" className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                    value={editForm.startAt}
                    onChange={(e) => setEditForm((f) => ({ ...f, startAt: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Due Date</label>
                  <input type="date" className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                    value={editForm.dueAt}
                    onChange={(e) => setEditForm((f) => ({ ...f, dueAt: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">Status</label>
                <Dropdown
                  value={editForm.status}
                  onChange={(v) => setEditForm((f) => ({ ...f, status: v as TaskStatus }))}
                  options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Progress %</label>
                <input
                  type="number" min={0} max={100}
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  value={editForm.progressPct}
                  onChange={(e) => setEditForm((f) => ({ ...f, progressPct: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Assignee</label>
                <Dropdown
                  value={editForm.assigneeId || ''}
                  onChange={(v) => setEditForm((f) => ({ ...f, assigneeId: v }))}
                  options={(() => {
                    const id = editing?.departmentId || '';
                    const opts = id ? (deptMemberOpts[id] || []) : [];
                    return [{ value: '', label: 'Unassigned' }, ...opts];
                  })()}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Add Attachments</label>
                <div className="border border-dashed border-gray-300 rounded-md p-3 bg-gray-50">
                  <input type="file" multiple onChange={(e) => onPickEditFiles(e.target.files)} className="block w-full text-sm text-gray-700" />
                  <div className="text-xs text-gray-500 mt-1">Upload images or files. Images show a preview.</div>
                  {editFiles.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                      {editFiles.map((f, idx) => {
                        const isImg = f.file.type.startsWith('image/');
                        return (
                          <div key={idx} className="border rounded bg-white overflow-hidden shadow-sm">
                            <div className="relative w-full h-28 bg-gray-100 flex items-center justify-center">
                              {isImg ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={f.url} alt={f.file.name} className="object-cover w-full h-full" />
                              ) : (
                                <div className="text-xs text-gray-500 px-2 text-center break-words">
                                  {f.file.name}
                                </div>
                              )}
                              {f.progress > 0 && f.progress < 100 && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[11px] px-1 py-0.5 text-center">
                                  {Math.round(f.progress)}%
                                </div>
                              )}
                            </div>
                            <div className="px-2 py-1 text-[11px] text-gray-600 truncate" title={f.file.name}>{f.file.name}</div>
                            <button type="button" className="w-full text-xs text-rose-600 hover:text-rose-700 py-1 border-t" onClick={() => removeEditFile(idx)}>Remove</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Existing Attachments</label>
                {existingLoading ? (
                  <div className="text-xs text-gray-500">Loading attachments…</div>
                ) : existingAtt.length === 0 ? (
                  <div className="text-xs text-gray-500">No attachments yet.</div>
                ) : (
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {existingAtt.map((a) => {
                      const isImg = (a.mimeType || '').startsWith('image/');
                      const href = currentEventId ? fileUrl(currentEventId, a) : '#';
                      return (
                        <div key={a.id} className="group border rounded bg-white overflow-hidden shadow-sm">
                          <div className="relative w-full h-28 bg-gray-100 flex items-center justify-center">
                            {isImg ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <a href={href} target="_blank" rel="noopener noreferrer"><img src={href} alt={a.originalName} className="object-cover w-full h-full" /></a>
                            ) : (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center text-gray-500 w-full h-full">
                                <FileText size={24} />
                                <span className="text-[11px] mt-1">File</span>
                              </a>
                            )}
                            <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                              <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                                <Download size={12} className="mr-1" /> Open
                              </a>
                              <button
                                type="button"
                                className="inline-flex items-center bg-rose-600/80 hover:bg-rose-700 text-white text-[10px] px-1.5 py-0.5 rounded"
                                title="Delete attachment"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  if (!currentEventId) return;
                                  if (!confirm('Delete this attachment?')) return;
                                  try {
                                    await attachmentsService.remove(currentEventId, a.id);
                                    setExistingAtt(prev => prev.filter(x => x.id !== a.id));
                                  } catch {
                                    alert('Failed to delete attachment');
                                  }
                                }}
                              >
                                <Trash2 size={12} className="mr-1" /> Delete
                              </button>
                            </div>
                          </div>
                          <div className="px-2 py-1 text-[11px] text-gray-700 truncate" title={a.originalName}>{a.originalName}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button className="px-3 py-2 rounded-md text-sm text-gray-700 hover:text-black" onClick={() => setEditing(null)}>Cancel</button>
              <button className="px-3 py-2 rounded-md text-sm bg-blue-600 hover:bg-blue-700 text-white" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </SideDrawer>
      )}
    </Page>
  );
};
