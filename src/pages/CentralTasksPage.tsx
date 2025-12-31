import React, { useEffect, useMemo, useState } from 'react';
import { Page } from '../components/layout/Page';
import { ModernSelect, ModernSelectOption } from '../components/ui/ModernSelect';

import { ModernInput } from '../components/ui/ModernInput';
import { TaskFilters } from '../components/tasks/TaskFilters';
import { useContextStore } from '../store/contextStore';
import { useAuthStore } from '../store/authStore';
import { usePageStateStore } from '../store/pageStateStore';
import { DepType, tasksService } from '../services/tasks';
import { departmentsService } from '../services/departments';
import { eventsService } from '../services/events';
import type { TaskItem, TaskStatus, TaskType } from '../types/task';
import { Spinner } from '../components/ui/Spinner';
import { ModernTable, TableStatusPill, TableBadge, TableUserCell, TableTitleCell } from '../components/ui/ModernTable';
import { Eye, Pencil, Trash2, Calendar, Plus, LayoutGrid, FileText, Download, Search, List } from 'lucide-react';
import { SideDrawer } from '../components/ui/SideDrawer';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { UserAvatar } from '../components/ui/UserAvatar';
import { VenueSelect } from '../components/tasks/VenueSelect';
import { TasksBoardView } from '../components/tasks/TaskBoardView';
import { TaskDetailsDrawer } from '../components/tasks/TaskDetailsDrawer';
import { DependencySelector } from '../components/tasks/DependencySelector';
import { attachmentsService } from '../services/attachments';
import { format } from 'date-fns';
import { BASE_URL } from '../api';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
  { value: 'canceled', label: 'Canceled' },
];

const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'new_task', label: 'Task' },
  { value: 'issue', label: 'Issue' },
  { value: 'taujeeh', label: 'Taujeeh' },
  { value: 'improvement', label: 'Improvement' },
];

const TYPE_COLOR: Record<TaskType, string> = {
  new_task: 'bg-blue-100 text-blue-800 border-blue-200',
  issue: 'bg-rose-100 text-rose-800 border-rose-200',
  taujeeh: 'bg-purple-100 text-purple-800 border-purple-200',
  improvement: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const PRIORITY_LABEL: Record<number, string> = {
  1: 'Critical',
  2: 'High',
  3: 'Medium',
  4: 'Low',
  5: 'Lowest',
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

const fmt = (d?: string | null) => d ? format(new Date(d), 'MMM d, yyyy') : '';
const dateOnlyToISO = (d: string) => new Date(d).toISOString();
const isoToDateInput = (d?: string | null) => d ? d.split('T')[0] : '';
const fileUrl = (eventId: string, att: { objectKey?: string }) =>
  att.objectKey ? `${BASE_URL}/events/${eventId}/files/${att.objectKey}` : '#';

const PriorityBadge = ({ p }: { p: number }) => {
  const label = PRIORITY_LABEL[p] || p;
  const color =
    p === 1 ? 'bg-rose-100 text-rose-800 border-rose-200' :
      p === 2 ? 'bg-orange-100 text-orange-800 border-orange-200' :
        p === 3 ? 'bg-amber-100 text-amber-800 border-amber-200' :
          'bg-gray-100 text-gray-800 border-gray-200';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
      {label}
    </span>
  );
};

// Helper for status that looks like a pill but acts like a select
const StatusSelect = ({
  value,
  onChange,
  disabled
}: {
  value: TaskStatus;
  onChange: (v: TaskStatus) => void;
  disabled?: boolean;
}) => {
  return (
    <ModernSelect
      value={value}
      onChange={onChange}
      options={STATUS_OPTIONS}
      disabled={disabled}
      className="min-w-[150px]"
      renderTrigger={(opt) => {
        const v = opt?.value || value;
        const label = opt?.label || STATUS_OPTIONS.find(o => o.value === v)?.label || v;
        const dotColor =
          v === 'done' ? 'bg-emerald-500' :
            v === 'in_progress' ? 'bg-blue-500' :
              v === 'blocked' ? 'bg-rose-500' :
                v === 'canceled' ? 'bg-slate-500' :
                  'bg-gray-400';
        return <TableStatusPill status={v} label={label} dotColor={dotColor} />;
      }}
    />
  );
};


export const CentralTasksPage: React.FC = () => {
  const { currentEventId, departments, myMemberships, canAdminEvent } = useContextStore();
  const isSuperAdmin = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);
  const currentUserId = useAuthStore((s) => s.currentUser?.id);

  const tasksState = usePageStateStore((s) => s.tasks);
  const setTasksState = usePageStateStore((s) => s.setTasks);
  const deptIds = tasksState.deptIds;

  // Pagination & Selection
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(false);
  // ... (rest of existing state)



  const [err, setErr] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksByDept, setTasksByDept] = useState<Record<string, TaskItem[]>>({});
  const [memberOptions, setMemberOptions] = useState<{ value: string; label: string }[]>([]);
  const [memberNameById, setMemberNameById] = useState<Record<string, string>>({});
  const [deptMemberOpts, setDeptMemberOpts] = useState<Record<string, { value: string; label: string }[]>>({});
  const [venueNameById, setVenueNameById] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<any[]>([]); // For memberMap

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

  // Edit Dependencies State
  const [editDependencies, setEditDependencies] = useState<{ id: string; title: string; status: string }[]>([]);
  const [loadingEditDeps, setLoadingEditDeps] = useState(false);
  const [showCreateDepSearch, setShowCreateDepSearch] = useState(false);
  const [showEditDepSearch, setShowEditDepSearch] = useState(false);

  const statusFilters = tasksState.statusFilters;
  const priorityFilter = tasksState.priorityFilter;
  const q = tasksState.q;
  const overdueOnly = !!tasksState.overdueOnly;
  const memberFilter = tasksState.memberFilter || 'all';

  const viewMode = tasksState.viewMode;
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});

  // view / edit drawers
  const [viewing, setViewing] = useState<TaskItem | null>(null);
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string; description: string; priority: number; startAt: string; dueAt: string;
    assigneeId: string; venueId: string; type: TaskType; status: TaskStatus; progressPct: number;
  }>({ title: '', description: '', priority: 3, startAt: '', dueAt: '', assigneeId: '', venueId: '', type: 'new_task', status: 'todo', progressPct: 0 });

  // Delete confirmation modal state
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; task?: TaskItem }>(() => ({ open: false }));

  // Permissions - Check Tenant AND Event permissions
  const hasAuthPermission = useAuthStore((s) => s.hasPermission);
  const hasEventPermission = useContextStore((s) => s.hasEventPermission);

  const hasPermission = (module: string, action: string) => {
    return hasAuthPermission(module, action) || hasEventPermission(module, action);
  };

  const accessibleDepts = useMemo(() => {
    return departments;
  }, [departments]);

  const isTM = !!useAuthStore((s) => s.currentUser?.isTenantManager);

  const writableDepts = useMemo(() => {
    // SuperAdmin and TenantManager have write access everywhere
    if (isSuperAdmin || canAdminEvent || isTM) return departments;

    // (role is now string name, permissions is string array from store update)
    const globalWithWrite = myMemberships.find(m =>
      !m.departmentId &&
      (m.permissions?.includes('tasks:create') || m.permissions?.includes('tasks:create_all'))
    );
    if (globalWithWrite) return departments;

    const ids = new Set<string>();
    for (const m of myMemberships) {
      if (
        m.departmentId &&
        (m.permissions?.includes('tasks:create') || m.permissions?.includes('tasks:create_all'))
      ) {
        ids.add(m.departmentId);
      }
    }
    return departments.filter(d => ids.has(d.id));
  }, [isSuperAdmin, canAdminEvent, departments, myMemberships]);

  // No auto-select for multi-select - start with empty (all)

  // REPLACE your existing `loadTasks` function in CentralTasksPage with this version.
  // This removes all zone-related logic and ensures the Central page only loads NON-zonal (central) tasks.

  async function loadTasks(force?: boolean) {
    if (!currentEventId) return;
    if (deptIds.length === 0 && accessibleDepts.length === 0) return;

    setLoading(true);
    setErr(null);

    try {
      const assignee =
        memberFilter !== 'all' ? (memberFilter as string) : undefined;

      // Determine which departments to fetch:
      // If none selected (empty), fetch all accessible.
      // If some selected, fetch those.
      // We accept deptIds containing only valid IDs now.
      // If 'ALL' is in the list, treat it as all accessible are selected (or none filtered)
      const isAll = deptIds.length === 0 || deptIds.includes('ALL');
      const targets = isAll
        ? accessibleDepts
        : departments.filter(d => deptIds.includes(d.id));

      if (targets.length === 0) {
        setTasks([]);
        setTasksByDept({});
        return;
      }

      // Fetch per department, keep only central (no zoneId)
      const res = await Promise.all(
        targets.map(async (d) => {
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

    } catch (e: any) {
      console.error(e);
      setErr(e.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }





  useEffect(() => {
    if (showCreate && deptIds.length === 0 && !createDeptId && accessibleDepts.length > 0) {
      setCreateDeptId(accessibleDepts[0].id);
    }
  }, [showCreate, deptIds, createDeptId, accessibleDepts]);

  // Members: options + name map (dedup by userId to avoid duplicates from multiple roles)
  useEffect(() => {
    if (!currentEventId || !deptIds[0] || '') return;
    (async () => {
      try {
        const deptRows = deptIds.length === 0 ? [] : await departmentsService.members.list(currentEventId, deptIds[0] || '').catch(() => []);
        const eventRows = await eventsService.members.list(currentEventId).catch(() => []);

        // Build options from either event-wide or department-specific members, dedup by userId
        const baseRows = (deptIds.length === 0 ? eventRows : deptRows) || [];
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
  }, [currentEventId, deptIds[0] || '']);

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
    } catch { }
  }

  // When create modal is open, load member options for target department
  useEffect(() => {
    if (!showCreate) return;
    const targetDeptId = deptIds.length === 0 ? createDeptId : deptIds[0];
    if (targetDeptId) void ensureDeptMemberOptions(targetDeptId);
  }, [showCreate, deptIds, createDeptId]);

  // When editing, load member options for the task's department
  useEffect(() => {
    if (!editing?.departmentId) return;
    void ensureDeptMemberOptions(editing.departmentId);
  }, [editing?.departmentId]);

  // Load tasks when deps change
  // Load tasks when deps change
  useEffect(() => {
    if (!currentEventId) return;

    // If we're on ALL, wait until we actually know which departments are accessible
    if (deptIds.length === 0 && accessibleDepts.length === 0) return;

    // Fetch (no need to include filters that are purely client-side)
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEventId, deptIds, memberFilter, accessibleDepts]);

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


  // Members
  useEffect(() => {
    let mounted = true;
    if (!currentEventId) return;
    import('../services/users').then(({ usersService }) =>
      usersService.list().then((rows) => {
        if (!mounted) return;
        setUsers(rows || []);
        const m: Record<string, string> = {};
        const opts: { value: string; label: string }[] = [];
        for (const u of rows || []) {
          m[u.id] = u.fullName;
          opts.push({ value: u.id, label: u.fullName });
        }
        setMemberNameById(m);
        setMemberOptions(opts);
      }).catch(() => { })
    );
    return () => { mounted = false; };
  }, [currentEventId]);
  const memberMap = useMemo(() => {
    const map: Record<string, { name: string; avatar?: string }> = {};
    for (const u of users || []) {
      map[u.id] = { name: u.fullName, avatar: u.profileImage };
    }
    return map;
  }, [users]);


  const canCreate = useMemo(() => {
    if (deptIds.length === 0) return writableDepts.length > 0;
    return deptIds.some(id => writableDepts.some(d => d.id === id));
  }, [deptIds[0] || '', writableDepts]);

  // Debugging logs
  useEffect(() => {
    console.log('--- DEBUG PERMISSIONS ---');
    console.log('My Memberships:', myMemberships);
    console.log('Writable Depts:', writableDepts);
    console.log('Can Create:', canCreate);
    console.log('Dept Ids:', deptIds);
    myMemberships.forEach(m => {
      console.log(`Member of ${m.departmentId || 'Global'} with perms:`, m.permissions);
    });
    console.log('-------------------------');
  }, [currentEventId, deptIds, accessibleDepts, myMemberships, writableDepts, canCreate]);

  const canEditTask = (t: TaskItem) => {
    // Full update access via RBAC
    if (hasPermission('tasks', 'update')) return true;
    // Fallback: own tasks if user has read access
    if (hasPermission('tasks', 'read')) {
      return t.creatorId === currentUserId || t.assigneeId === currentUserId;
    }
    return false;
  };

  const canDeleteTask = (t: TaskItem) => {
    if (hasPermission('tasks', 'delete')) return true;
    return false;
  };

  async function createTask() {
    if (!currentEventId) return;
    if (!createForm.title.trim()) return;
    setCreating(true);
    try {
      const targetDeptId = deptIds.length === 0 ? createDeptId : deptIds[0] || '';
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
        ).catch((err) => {
          console.error('Upload failed', err);
          alert(`Failed to upload ${item.file.name}: ${err.message}`);
        });
      }
      // link dependencies if any
      for (const d of createDeps) {
        if (!d.upstreamId) continue;
        try {
          await tasksService.addDependency(currentEventId, targetDeptId, created.id, { blockerId: d.upstreamId });
        } catch { }
      }
      setShowCreate(false);
      setCreateForm({ title: '', description: '', priority: 3, startAt: '', dueAt: '', assigneeId: '', venueId: '', type: 'new_task' });
      setCreateForm({ title: '', description: '', priority: 3, startAt: '', dueAt: '', assigneeId: '', venueId: '', type: 'new_task' });
      setCreateDeps([]);
      setShowCreate(false);
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
    const matchStatus = statusFilters.length === 0 ? true : statusFilters.includes(t.status);
    const matchPriority = !priorityFilter || priorityFilter === 'all' ? true : String(t.priority) === String(priorityFilter);
    const matchMember = !memberFilter || memberFilter === 'all' ? true : t.assigneeId === memberFilter;
    const isOverdue = !!t.dueAt && new Date(t.dueAt).getTime() < now && t.status !== 'done' && t.status !== 'canceled';
    const matchOverdue = overdueOnly ? isOverdue : true;
    const matchText = !term || t.title.toLowerCase().includes(term) || (t.description || '').toLowerCase().includes(term);

    // Date Range (Due Date)
    let matchDate = true;
    if (dateRange.from || dateRange.to) {
      if (!t.dueAt) {
        matchDate = false;
      } else {
        const d = new Date(t.dueAt).getTime();
        if (dateRange.from) {
          const fromTime = new Date(dateRange.from).getTime();
          if (d < fromTime) matchDate = false;
        }
        if (matchDate && dateRange.to) {
          // End of day
          const toDate = new Date(dateRange.to);
          toDate.setHours(23, 59, 59, 999);
          if (d > toDate.getTime()) matchDate = false;
        }
      }
    }

    return matchStatus && matchPriority && matchMember && matchOverdue && matchText && matchDate;
  }
  const filtered = useMemo(() => tasks.filter(matchesFilters), [tasks, statusFilters, priorityFilter, memberFilter, overdueOnly, q]);

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
  async function openEdit(t: TaskItem) {
    setEditing(t);
    // Load Dependencies
    setEditDependencies([]);
    if (currentEventId && t.departmentId) {
      setLoadingEditDeps(true);
      try {
        const data = await tasksService.getDependencies(currentEventId, t.departmentId, t.id);
        setEditDependencies(data.blockers.map((b: any) => ({
          id: b.task.id,
          title: b.task.title,
          status: b.task.status
        })));
      } catch { }
      finally { setLoadingEditDeps(false); }
    }

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
  function removeTask(task: TaskItem) {
    setConfirmDelete({ open: true, task });
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
          } catch (err: any) {
            console.error('Edit upload failed', err);
            alert(`Failed to upload ${item.file.name}: ${err.message}`);
          }
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
      } catch { }

      // Update Dependencies if changed
      // We do a simple diff: remove removed, add added.
      // NOTE: For simplicity, we can just remove all and re-add, but that destroys history/meta if any.
      // Better: check which IDs are in `editDependencies` vs original. 
      // For this step, let's assume `editDependencies` is the source of truth.
      // We need to know what was there originally? Or we just "Upsert".
      // The `DependencyManager` does it one by one. Here we want bulk save or immediate save? 
      // The user expects "Save" button to commit everything. 
      // Strategy:
      // 1. Get current blockers from server (fresh)
      // 2. Diff with local state
      // 3. Apply changes.

      const currentDeps = await tasksService.getDependencies(currentEventId, editing.departmentId, editing.id);
      const serverBlockerIds = new Set(currentDeps.blockers.map((b: any) => b.task.id));
      const localBlockerIds = new Set(editDependencies.map(d => d.id));

      // To Add
      for (const d of editDependencies) {
        if (!serverBlockerIds.has(d.id)) {
          await tasksService.addDependency(currentEventId, editing.departmentId, editing.id, { blockerId: d.id }).catch(() => { });
        }
      }
      // To Remove
      for (const b of currentDeps.blockers) {
        if (!localBlockerIds.has(b.task.id)) {
          await tasksService.removeDependency(currentEventId, editing.departmentId, editing.id, { blockerId: b.task.id }).catch(() => { });
        }
      }

      setEditing(null);
    } catch {
      alert('Failed to update task');
    }
  }



  const columns = useMemo(() => [
    {
      header: 'Title',
      cell: (t: TaskItem) => (
        <TableTitleCell
          title={t.title}
          subtitle={t.description ? (t.description.length > 50 ? t.description.slice(0, 50) + '...' : t.description) : `#${t.id.slice(-4).toUpperCase()}`}
        />
      ),
      className: 'w-[300px]'
    },
    {
      header: 'Assigned to',
      cell: (t: TaskItem) => (
        t.assigneeId ? (
          <TableUserCell
            name={memberNameById[t.assigneeId] || 'Unknown'}
            avatarUrl={null}
          />
        ) : <span className="text-gray-400 text-sm">-</span>
      ),
      className: 'w-[180px]'
    },
    {
      header: 'Status',
      cell: (t: TaskItem) => (
        <StatusSelect
          value={t.status}
          onChange={(v) => changeStatus(t, v)}
          disabled={!canEditTask(t)}
        />
      ),
      className: 'w-[140px]'
    },
    {
      header: 'Type',
      cell: (t: TaskItem) => (
        t.type ? (
          <TableBadge className={TYPE_COLOR[t.type] || 'bg-gray-100 text-gray-800'}>
            {TYPE_OPTIONS.find(o => o.value === t.type)?.label || t.type}
          </TableBadge>
        ) : null
      ),
      className: 'w-[100px]'
    },
    {
      header: 'Timeline',
      cell: (t: TaskItem) => {
        const start = t.startAt ? fmt(t.startAt) : null;
        const due = t.dueAt ? fmt(t.dueAt) : null;
        if (!start && !due) return <span className="text-gray-400 text-xs">-</span>;
        if (start && due) return <span className="text-gray-600 text-xs font-medium whitespace-nowrap">{start} - {due}</span>;
        return <span className="text-gray-600 text-xs font-medium whitespace-nowrap">{start || due}</span>;
      },
      className: 'w-[180px]'
    },
    {
      header: 'Actions',
      className: 'text-center w-[120px]',
      cell: (t: TaskItem) => (
        <div className="flex items-center justify-center gap-2">
          <button className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors" onClick={(e) => { e.stopPropagation(); openDetails(t); }} title="View">
            <Eye size={16} />
          </button>
          {canEditTask(t) && (
            <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" onClick={(e) => { e.stopPropagation(); openEdit(t); }} title="Edit">
              <Pencil size={16} />
            </button>
          )}
          {canDeleteTask(t) && (
            <button className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors" onClick={(e) => { e.stopPropagation(); removeTask(t); }} title="Delete">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )
    }
  ], [memberNameById, venueNameById, currentUserId, hasAuthPermission, hasEventPermission]);

  return (
    <Page>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-semibold">Tasks</div>
        </div>

        {/* Controls row */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-2">
          {/* Left: View Tabs */}
          <div className="flex items-center gap-6 relative">
            {/* Sliding underline indicator - Adjust position based on active tab */}
            <div
              className={`absolute bottom-0 h-0.5 bg-blue-600 transition-all duration-300 ease-in-out ${viewMode === 'list' ? 'left-0 w-[52px]' : 'left-[76px] w-[64px]'
                }`}
            />

            <button
              onClick={() => setTasksState({ viewMode: 'list' })}
              className={`flex items-center gap-2 pb-2 text-sm font-medium transition-colors ${viewMode === 'list'
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <List size={16} />
              List
            </button>
            <button
              onClick={() => setTasksState({ viewMode: 'board' })}
              className={`flex items-center gap-2 pb-2 text-sm font-medium transition-colors ${viewMode === 'board'
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <LayoutGrid size={16} />
              Board
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Animated Search */}
            <div className="w-48 focus-within:w-72 transition-all duration-300 ease-in-out">
              <ModernInput
                placeholder="Search tasks..."
                value={tasksState.q || ''}
                onChange={e => setTasksState({ q: e.target.value })}
                icon={<Search size={16} />}
                fullWidth
                className="bg-gray-50 border-gray-200 focus:bg-white"
              />
            </div>

            <TaskFilters
              deptIds={deptIds}
              onChangeDepts={(ids) => setTasksState({ deptIds: ids })}
              deptOptions={accessibleDepts.map(d => ({ value: d.id, label: d.name }))}
              statusFilters={tasksState.statusFilters}
              onChangeStatuses={(v) => setTasksState({ statusFilters: v as TaskStatus[] })}
              statusOptions={[{ value: 'all', label: 'All Status' }, ...STATUS_OPTIONS]}
              memberFilter={tasksState.memberFilter}
              onChangeMember={(v) => setTasksState({ memberFilter: v })}
              memberOptions={[{ value: 'all', label: 'All Members' }, ...memberOptions]}
              dateRange={dateRange}
              onChangeDateRange={setDateRange}
            />

            {canCreate && (
              <button
                className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 flex items-center shadow-sm transition-all hover:shadow-md ml-2"
                onClick={() => setShowCreate(true)}
              >
                <Plus size={16} className="mr-1.5" /> New Task
              </button>
            )}
          </div>
        </div>
        <div className="h-4" />

        {err && <div className="text-red-600 bg-red-50 p-3 rounded mb-4 border border-red-200">{err}</div>}

        {loading ? <div className="py-12"><Spinner label="Loading tasks..." /></div> : (
          viewMode === 'board' ? (
            <TasksBoardView
              tasks={filtered}
              onChangeStatus={changeStatusFromDrawer}
              onView={openDetails}
              memberNameById={memberNameById}
            />
          ) : (
            <>
              {(deptIds.length === 0 || deptIds.includes('ALL')) ? (
                <div className="space-y-8">
                  {accessibleDepts.map(dept => {
                    const deptTasks = tasksByDept[dept.id] || [];
                    const deptFiltered = deptTasks.filter(matchesFilters);

                    // ALWAYS render table structure, even if empty
                    return (
                      <div key={dept.id}>
                        <h3 className="text-lg font-semibold mb-3 px-1">{dept.name}</h3>
                        <ModernTable
                          data={deptFiltered}
                          keyField="id"
                          columns={columns}
                          selectedIds={selectedTasks}
                          onSelect={(id: string, val: boolean) => {
                            const next = new Set(selectedTasks);
                            if (val) next.add(id); else next.delete(id);
                            setSelectedTasks(next);
                          }}
                          onSelectAll={(val: boolean) => {
                            const ids = deptFiltered.map(t => t.id);
                            const next = new Set(selectedTasks);
                            if (val) ids.forEach(id => next.add(id));
                            else ids.forEach(id => next.delete(id));
                            setSelectedTasks(next);
                          }}
                          isLoading={loading}
                        />
                        {deptFiltered.length === 0 && (
                          <div className="text-xs text-gray-400 mt-1 italic pl-1">No matching tasks found</div>
                        )}
                      </div>
                    );
                  })}
                  {Object.values(tasksByDept).every(list => list.length === 0) && (
                    <div className="text-center py-12 text-gray-500 hidden">No tasks found.</div>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  {accessibleDepts.filter(d => deptIds.includes(d.id)).map(dept => {
                    const deptTasks = tasksByDept[dept.id] || [];
                    const deptFiltered = deptTasks.filter(matchesFilters);

                    return (
                      <div key={dept.id}>
                        <h3 className="text-lg font-semibold mb-3 px-1">{dept.name}</h3>
                        <ModernTable
                          data={deptFiltered}
                          keyField="id"
                          columns={columns}
                          selectedIds={selectedTasks}
                          onSelect={(id: string, val: boolean) => {
                            const next = new Set(selectedTasks);
                            if (val) next.add(id); else next.delete(id);
                            setSelectedTasks(next);
                          }}
                          onSelectAll={(val: boolean) => {
                            const ids = deptFiltered.map(t => t.id);
                            const next = new Set(selectedTasks);
                            if (val) ids.forEach(id => next.add(id));
                            else ids.forEach(id => next.delete(id));
                            setSelectedTasks(next);
                          }}
                          isLoading={loading}
                        />
                        {deptFiltered.length === 0 && (
                          <div className="text-xs text-gray-400 mt-1 italic pl-1">No matching tasks found</div>
                        )}
                      </div>
                    );
                  })}
                  {accessibleDepts.filter(d => deptIds.includes(d.id)).every(d => (tasksByDept[d.id] || []).filter(matchesFilters).length === 0) && (
                    <div className="text-center py-12 text-gray-500">No tasks found.</div>
                  )}
                </div>
              )}
            </>
          )
        )}
        {
          viewing && (
            <TaskDetailsDrawer
              task={viewing}
              eventId={currentEventId!}
              departmentId={viewing.departmentId || undefined}
              memberNameById={memberNameById}
              memberMap={memberMap}
              onClose={() => setViewing(null)}
              onChangeStatus={(s) => changeStatusFromDrawer(viewing, s)}
            />
          )
        }

        {
          showCreate && (
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
                  {deptIds.length === 0 && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1.5 ml-0.5">Department <span className="text-rose-600">*</span></label>
                      <ModernSelect
                        value={createDeptId || ''}
                        onChange={(v) => setCreateDeptId(v)}
                        options={writableDepts.map(d => ({ value: d.id, label: d.name }))}
                        fullWidth
                      />
                      <p className="text-xs text-gray-500 mt-1">Required when creating from “All Departments”.</p>
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <ModernInput
                      label={<>Title <span className="text-rose-600">*</span></>}
                      value={createForm.title}
                      onChange={(e) => setCreateForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g., Print badges for speakers"
                      fullWidth
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 ml-0.5">Description</label>
                    <textarea
                      className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                      rows={3}
                      value={createForm.description}
                      onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Add a description..."
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
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 ml-0.5">Priority</label>
                    <ModernSelect
                      value={String(createForm.priority)}
                      onChange={(v) => setCreateForm(f => ({ ...f, priority: Number(v) }))}
                      options={[1, 2, 3, 4, 5].map(p => ({ value: String(p), label: PRIORITY_LABEL[p] }))}
                      fullWidth
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 ml-0.5">Type</label>
                    <ModernSelect
                      value={createForm.type}
                      onChange={(v) => setCreateForm(f => ({ ...f, type: v as TaskType }))}
                      options={TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                      fullWidth
                    />
                  </div>

                  <div>
                    <ModernInput
                      type="date"
                      label="Start Date"
                      value={createForm.startAt}
                      onChange={(e) => setCreateForm(f => ({ ...f, startAt: e.target.value }))}
                      fullWidth
                    />
                  </div>

                  <div>
                    <ModernInput
                      type="date"
                      label="Due Date"
                      value={createForm.dueAt}
                      onChange={(e) => setCreateForm(f => ({ ...f, dueAt: e.target.value }))}
                      fullWidth
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 ml-0.5">Assignee</label>
                    <ModernSelect
                      value={createForm.assigneeId || ''}
                      onChange={(v) => setCreateForm(f => ({ ...f, assigneeId: v }))}
                      options={(() => {
                        const targetDeptId = deptIds.length === 0 ? createDeptId : deptIds[0] || '';
                        const opts = targetDeptId ? (deptMemberOpts[targetDeptId] || []) : [];
                        return [{ value: '', label: 'Unassigned' }, ...opts];
                      })()}
                      fullWidth
                      searchable
                    />
                  </div>

                  {/* Dependencies (Create) */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dependencies (Blockers)</label>

                    {/* Selected List */}
                    <div className="mb-3 space-y-2">
                      {createDeps.length === 0 && !showCreateDepSearch && (
                        <div className="text-sm text-gray-400 italic">No blockers added.</div>
                      )}
                      {createDeps.map(d => (
                        <div key={d.upstreamId} className="flex items-center justify-between text-sm bg-white p-2.5 rounded-lg border border-gray-200 hover:border-red-200 group transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                            <span className="font-medium text-gray-700">Task #{d.upstreamId.slice(-4).toUpperCase()}</span>
                          </div>
                          <button type="button" className="text-gray-400 hover:text-red-600 p-1" title="Remove" onClick={() => setCreateDeps(prev => prev.filter(x => x.upstreamId !== d.upstreamId))}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Trigger */}
                    {!showCreateDepSearch ? (
                      <button
                        type="button"
                        onClick={() => setShowCreateDepSearch(true)}
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium px-1 py-0.5"
                      >
                        <Plus size={16} /> Add Blocker
                      </button>
                    ) : (
                      <div className="bg-gray-50 p-3 rounded-xl border border-blue-100 ring-1 ring-blue-500/10 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Find Task to Block</span>
                          <button onClick={() => setShowCreateDepSearch(false)} className="text-xs text-gray-500 hover:text-gray-700 underline">Done</button>
                        </div>
                        <DependencySelector
                          eventId={currentEventId || ''}
                          currentDeptId={deptIds.length === 0 ? createDeptId : deptIds[0] || ''}
                          selectedIds={createDeps.map(d => d.upstreamId)}
                          onSelect={(t) => setCreateDeps(prev => [...prev, { upstreamId: t.id, depType: 'finish_to_start' }])}
                        />
                      </div>
                    )}
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
                    disabled={creating || !createForm.title.trim() || (deptIds.length === 0 && !createDeptId)}
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </SideDrawer>
          )
        }

        {
          editing && (
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
                    <ModernInput
                      label="Title"
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      fullWidth
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 ml-0.5">Description</label>
                    <textarea
                      className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-200"
                      rows={4}
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Add a description..."
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
                      <label className="block text-xs font-medium text-gray-700 mb-1.5 ml-0.5">Priority</label>
                      <ModernSelect
                        value={String(editForm.priority)}
                        onChange={(v) => setEditForm((f) => ({ ...f, priority: Number(v) }))}
                        options={[1, 2, 3, 4, 5].map(p => ({ value: String(p), label: PRIORITY_LABEL[p] }))}
                        fullWidth
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5 ml-0.5">Type</label>
                      <ModernSelect
                        value={editForm.type}
                        onChange={(v) => setEditForm((f) => ({ ...f, type: v as TaskType }))}
                        options={TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                        fullWidth
                      />
                    </div>
                    <div>
                      <ModernInput
                        type="date"
                        label="Start Date"
                        value={editForm.startAt}
                        onChange={(e) => setEditForm((f) => ({ ...f, startAt: e.target.value }))}
                        fullWidth
                      />
                    </div>
                    <div>
                      <ModernInput
                        type="date"
                        label="Due Date"
                        value={editForm.dueAt}
                        onChange={(e) => setEditForm((f) => ({ ...f, dueAt: e.target.value }))}
                        fullWidth
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 ml-0.5">Status</label>
                    <ModernSelect
                      value={editForm.status}
                      onChange={(v) => setEditForm((f) => ({ ...f, status: v as TaskStatus }))}
                      options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
                      fullWidth
                    />
                  </div>
                  <div>
                    <ModernInput
                      type="number" min={0} max={100}
                      label="Progress %"
                      value={editForm.progressPct}
                      onChange={(e) => setEditForm((f) => ({ ...f, progressPct: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                      fullWidth
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 ml-0.5">Assignee</label>
                    <ModernSelect
                      value={editForm.assigneeId || ''}
                      onChange={(v) => setEditForm((f) => ({ ...f, assigneeId: v }))}
                      options={(() => {
                        const id = editing?.departmentId || '';
                        const opts = id ? (deptMemberOpts[id] || []) : [];
                        return [{ value: '', label: 'Unassigned' }, ...opts];
                      })()}
                      fullWidth
                      searchable
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dependencies (Blockers)</label>
                    {loadingEditDeps ? <div className="text-xs text-gray-500">Loading dependencies...</div> : (
                      <>
                        <div className="mb-3 space-y-2">
                          {editDependencies.length === 0 && !showEditDepSearch && (
                            <div className="text-sm text-gray-400 italic">No blockers linked.</div>
                          )}
                          {editDependencies.map(d => (
                            <div key={d.id} className="flex items-center justify-between text-sm bg-white p-2.5 rounded-lg border border-gray-200 hover:border-red-200 group transition-colors">
                              <div className="truncate flex-1 mr-2 flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${d.status === 'done' ? 'bg-emerald-400' : 'bg-orange-400'}`}></div>
                                <span className="font-medium text-gray-700 truncate">{d.title}</span>
                                <span className="text-xs text-gray-400 shrink-0">({d.status})</span>
                              </div>
                              <button type="button" className="text-gray-400 hover:text-red-600 p-1" title="Remove" onClick={() => setEditDependencies(prev => prev.filter(x => x.id !== d.id))}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>

                        {!showEditDepSearch ? (
                          <button
                            type="button"
                            onClick={() => setShowEditDepSearch(true)}
                            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium px-1 py-0.5"
                          >
                            <Plus size={16} /> Add Blocker
                          </button>
                        ) : (
                          <div className="bg-gray-50 p-3 rounded-xl border border-blue-100 ring-1 ring-blue-500/10 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Find Task to Block</span>
                              <button onClick={() => setShowEditDepSearch(false)} className="text-xs text-gray-500 hover:text-gray-700 underline">Done</button>
                            </div>
                            <DependencySelector
                              eventId={currentEventId || ''}
                              currentDeptId={editing?.departmentId || ''}
                              selectedIds={editDependencies.map(d => d.id)}
                              onSelect={(t) => setEditDependencies(prev => [...prev, { id: t.id, title: t.title, status: t.status }])}
                            />
                          </div>
                        )}
                      </>
                    )}
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
          )
        }
        {/* Delete confirmation modal */}
        <ConfirmDialog
          open={confirmDelete.open}
          title="Delete Task"
          message={(() => {
            const t = confirmDelete.task;
            if (!t) return '';
            const dn = departments.find((d) => d.id === t.departmentId)?.name || t.departmentId || '';
            return `Title: ${t.title}\nDepartment: ${dn}\n\nThis action cannot be undone. Continue?`;
          })()}
          confirmText="Delete"
          cancelText="Cancel"
          danger
          onCancel={() => setConfirmDelete({ open: false })}
          onConfirm={async () => {
            const t = confirmDelete.task;
            if (!t || !currentEventId || !t.departmentId) { setConfirmDelete({ open: false }); return; }
            try {
              await tasksService.remove(currentEventId, t.departmentId, t.id);
              // Update flat list
              setTasks((prev) => prev.filter((x) => x.id !== t.id));
              // Update per-dept map for ALL view
              setTasksByDept((prev) => {
                const next = { ...prev } as Record<string, TaskItem[]>;
                const did = t.departmentId!;
                if (next[did]) next[did] = next[did].filter((x) => x.id !== t.id);
                return next;
              });
            } catch {
              alert('Failed to delete task');
            } finally {
              setConfirmDelete({ open: false });
            }
          }}
        />
      </div>
    </Page >
  );
};
