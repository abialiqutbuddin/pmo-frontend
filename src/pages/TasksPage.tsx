// // frontend/src/pages/TasksPage.tsx
// import React, { useEffect, useMemo, useState } from 'react';
// import { useContextStore } from '../store/contextStore';
// import { useAuthStore } from '../store/authStore';
// import { usePageStateStore } from '../store/pageStateStore';
// import { tasksService } from '../services/tasks';
// import { bus } from '../lib/eventBus';
// import { departmentsService } from '../services/departments';
// import { eventsService } from '../services/events';
// import type { TaskItem, TaskStatus, TaskType } from '../types/task';
// import type { DepType } from '../services/tasks';
// import { Plus, Trash2, Pencil, Calendar, Flag, User, LayoutGrid, List as ListIcon, Paperclip, X } from 'lucide-react';
// import { Dropdown } from '../components/ui/Dropdown';
// import { UserAvatar } from '../components/ui/UserAvatar';
// import { Eye } from 'lucide-react';
// import { Spinner } from '../components/ui/Spinner';
// import { TaskDetailsDrawer } from '../components/tasks/TaskDetailsDrawer';
// import { SideDrawer } from '../components/ui/SideDrawer';
// import { TasksBoardView } from '../components/tasks/TaskBoardView';
// import { Page } from '../components/layout/Page';
// import { VenueSelect } from '../components/tasks/VenueSelect';
// import { zonesService } from '../services/zones';
// import { attachmentsService } from '../services/attachments';

// const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
//   { value: 'todo', label: 'To Do' },
//   { value: 'in_progress', label: 'In Progress' },
//   { value: 'blocked', label: 'Blocked' },
//   { value: 'done', label: 'Done' },
//   { value: 'canceled', label: 'Canceled' },
// ];

// function fmt(iso?: string | null) {
//   if (!iso) return '';
//   const d = new Date(iso);
//   if (Number.isNaN(d.getTime())) return '';
//   const dd = String(d.getDate()).padStart(2, '0');
//   const mm = String(d.getMonth() + 1).padStart(2, '0');
//   const yyyy = d.getFullYear();
//   return `${dd}-${mm}-${yyyy}`;
// }

// function isoToDateInput(iso?: string | null) {
//   if (!iso) return '';
//   const d = new Date(iso);
//   if (Number.isNaN(d.getTime())) return '';
//   const yyyy = d.getFullYear();
//   const mm = String(d.getMonth() + 1).padStart(2, '0');
//   const dd = String(d.getDate()).padStart(2, '0');
//   return `${yyyy}-${mm}-${dd}`;
// }

// function dateOnlyToISO(dateStr?: string | null) {
//   if (!dateStr) return undefined;
//   const d = new Date(`${dateStr}T00:00:00`);
//   if (Number.isNaN(d.getTime())) return undefined;
//   return d.toISOString();
// }

// const PRIORITY_LABEL: Record<number, string> = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low', 5: 'Very Low' };

// const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
//   { value: 'issue', label: 'Issue' },
//   { value: 'new_task', label: 'New Task' },
//   { value: 'taujeeh', label: 'Taujeeh' },
//   { value: 'improvement', label: 'Improvement' },
// ];

// const TYPE_COLOR: Record<TaskType, string> = {
//   issue: 'bg-rose-100 text-rose-800 border-rose-300',
//   new_task: 'bg-blue-100 text-blue-800 border-blue-300',
//   taujeeh: 'bg-amber-100 text-amber-800 border-amber-300',
//   improvement: 'bg-emerald-100 text-emerald-800 border-emerald-300',
// };

// const PriorityBadge: React.FC<{ p: number }> = ({ p }) => {
//   const color = p === 1 ? 'bg-rose-600' : p === 2 ? 'bg-orange-500' : p === 3 ? 'bg-amber-500' : p === 4 ? 'bg-emerald-500' : 'bg-gray-500';
//   return (
//     <span className={`inline-flex items-center ${color} text-white rounded px-2 py-0.5 text-xs`} title={`Priority ${p} (${PRIORITY_LABEL[p]})`}>
//       <Flag size={12} className="mr-1" /> {PRIORITY_LABEL[p]}
//     </span>
//   );
// };

// type CreateForm = {
//   title: string;
//   description: string;
//   priority: number;
//   startAt: string;
//   dueAt: string;
//   assigneeId: string;
//   venueId: string;
//   type: TaskType;
// };

// type TasksPageMode = 'full' | 'central' | 'zones';

// export const TasksPage: React.FC<{ mode?: TasksPageMode }> = ({ mode = 'full' }) => {
//   const { currentEventId, departments, myMemberships, canAdminEvent } = useContextStore();
//   const currentUserId = useAuthStore((s) => s.currentUser?.id);
//   const isSuperAdmin = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);

//   const tasksState = usePageStateStore((s) => s.tasks);
//   const setTasksState = usePageStateStore((s) => s.setTasks);
//   const deptId = tasksState.deptId;
//   const [tasks, setTasks] = useState<TaskItem[]>([]);
//   const [tasksByDept, setTasksByDept] = useState<Record<string, TaskItem[]>>({});
//   const [memberOptions, setMemberOptions] = useState<{ value: string; label: string }[]>([]);
//   const [memberNameById, setMemberNameById] = useState<Record<string, string>>({});
//   const [venueNameById, setVenueNameById] = useState<Record<string, string>>({});
//   const [zones, setZones] = useState<{ id: string; name: string; enabled: boolean }[]>([]);
//   const [zoneId, setZoneId] = useState<string>('ALL_ZONES');
//   const [zoneZDepts, setZoneZDepts] = useState<{ id: string; name: string }[]>([]);
//   const [zoneZDeptId, setZoneZDeptId] = useState<string>('ALL_ZDEPTS');
//   const [loading, setLoading] = useState(false);
//   const [err, setErr] = useState<string | null>(null);
//   const statusFilter = tasksState.statusFilter;
//   const priorityFilter = tasksState.priorityFilter;
//   const q = tasksState.q;
//   const overdueOnly = !!tasksState.overdueOnly;
//   const memberFilter = tasksState.memberFilter || 'all';

//   //view
//   const [viewing, setViewing] = useState<TaskItem | null>(null);

//   // Create/edit modal
//   const [showCreate, setShowCreate] = useState(false);
//   const [creating, setCreating] = useState(false);
//   const [createForm, setCreateForm] = useState<CreateForm>({ title: '', description: '', priority: 3, startAt: '', dueAt: '', assigneeId: '', venueId: '', type: 'new_task' });
//   const [createDeps, setCreateDeps] = useState<{ upstreamId: string; depType: DepType }[]>([]);
//   const [createCommon, setCreateCommon] = useState(false);
//   const [createFiles, setCreateFiles] = useState<{ file: File; url: string; progress: number }[]>([]);
//   const [createZDeptId, setCreateZDeptId] = useState<string>('');
//   const [createDeptId, setCreateDeptId] = useState<string>('');

//   // Edit modal
//   const [editing, setEditing] = useState<TaskItem | null>(null);
//   const [editForm, setEditForm] = useState<CreateForm & { progressPct: number; status: TaskStatus }>({ title: '', description: '', priority: 3, startAt: '', dueAt: '', assigneeId: '', venueId: '', type: 'new_task', progressPct: 0, status: 'todo' });
//   const [editCommon, setEditCommon] = useState(false);
//   const [editZoneZDepts, setEditZoneZDepts] = useState<{ id: string; name: string }[]>([]);
//   const [deps, setDeps] = useState<{ blockers: { upstreamId: string; depType: DepType; task: TaskItem }[] } | null>(null);
//   const [allTasksForDeps, setAllTasksForDeps] = useState<TaskItem[]>([]);
//   const [newDep, setNewDep] = useState<{ upstreamId: string; depType: DepType }>({ upstreamId: '', depType: 'finish_to_start' });

//   //BOARD VIEW
//   const viewMode = tasksState.viewMode;

//   // Compute accessible departments based on role
//   const accessibleDepts = useMemo(() => {
//     if (isSuperAdmin || canAdminEvent) return departments;
//     const ids = new Set((myMemberships.map((m) => m.departmentId).filter(Boolean) as string[]));
//     return departments.filter((d) => ids.has(d.id));
//   }, [isSuperAdmin, canAdminEvent, departments, myMemberships]);

//   // Choose default department
//   useEffect(() => {
//     if (!deptId && accessibleDepts.length > 0) {
//       const myDept = myMemberships.find((m) => m.departmentId && accessibleDepts.some((d) => d.id === m.departmentId))?.departmentId;
//       setTasksState({ deptId: myDept || accessibleDepts[0].id });
//     }
//   }, [accessibleDepts, myMemberships, deptId, setTasksState]);

//   // In Zones mode, default to ALL departments so only zonal filters are shown
//   useEffect(() => {
//     if (mode === 'zones') {
//       const canAll = isSuperAdmin || canAdminEvent || accessibleDepts.length > 1;
//       if (canAll && deptId !== 'ALL') {
//         setTasksState({ deptId: 'ALL' });
//       }
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [mode, accessibleDepts.length, isSuperAdmin, canAdminEvent]);

//   // Reset member filter when department changes
//   useEffect(() => {
//     setTasksState({ memberFilter: 'all' });
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [deptId]);

//   async function loadTasks(force?: boolean) {
//     if (!currentEventId || !deptId) return;
//     if (deptId === 'ALL' && accessibleDepts.length === 0) return; // wait until departments are ready
//     setLoading(true);
//     setErr(null);
//     try {
//       const pageMode = mode;
//       if (deptId === 'ALL') {
//         const res = await Promise.all(
//           accessibleDepts.map(async (d) => {
//             // Fetch base list per department with optional zone filter
//             let rows = await tasksService.list(currentEventId, d.id, {
//               force,
//               assigneeId: memberFilter !== 'all' ? (memberFilter as string) : undefined,
//               zoneId: (pageMode === 'zones' && zoneId && zoneId !== 'ALL_ZONES') ? zoneId : undefined,
//               zonalDeptRowId: (pageMode === 'zones' && zoneId !== 'ALL_ZONES' && zoneZDeptId !== 'ALL_ZDEPTS') ? zoneZDeptId : undefined,
//             });
//             rows = rows || [];
//             // Apply mode-specific filtering
//             if (pageMode === 'central') {
//               rows = rows.filter((t: any) => !t.zoneId);
//             } else if (pageMode === 'zones') {
//               // if specific zone selected, backend already filtered; for ALL_ZONES filter to only zonal tasks
//               rows = rows.filter((t: any) => !!t.zoneId);
//             } else {
//               // full mode: if specific zone selected, also include central tasks (merge)
//               if (zoneId && zoneId !== 'ALL_ZONES') {
//                 const central = await tasksService.list(currentEventId, d.id, { force, assigneeId: memberFilter !== 'all' ? (memberFilter as string) : undefined });
//                 rows = [...rows, ...(central || [])];
//               }
//             }
//             return { id: d.id, rows: rows.map((t: any) => ({ ...t, departmentId: d.id })) };
//           })
//         );
//         const by: Record<string, TaskItem[]> = {};
//         for (const r of res) by[r.id] = r.rows;
//         setTasksByDept(by);
//         const all = res.flatMap((r) => r.rows);
//         const dedup = Array.from(new Map(all.map((t: any) => [t.id, t])).values()) as TaskItem[];
//         setTasks(dedup);
//       } else {
//         let data = await tasksService.list(currentEventId, deptId, {
//           force,
//           assigneeId: memberFilter !== 'all' ? (memberFilter as string) : undefined,
//           zoneId: (mode === 'zones' && zoneId && zoneId !== 'ALL_ZONES') ? zoneId : undefined,
//           zonalDeptRowId: (mode === 'zones' && zoneId !== 'ALL_ZONES' && zoneZDeptId !== 'ALL_ZDEPTS') ? zoneZDeptId : undefined,
//         });
//         data = data || [];
//         if (mode === 'central') {
//           data = data.filter((t: any) => !t.zoneId);
//         } else if (mode === 'zones') {
//           data = data.filter((t: any) => !!t.zoneId);
//         } else {
//           if (zoneId && zoneId !== 'ALL_ZONES') {
//             const central = await tasksService.list(currentEventId, deptId, { force, assigneeId: memberFilter !== 'all' ? (memberFilter as string) : undefined });
//             data = [...data, ...(central || [])];
//           }
//         }
//         const withDept = (data as any[]).map((t) => ({ ...t, departmentId: deptId }));
//         setTasks(withDept as any);
//         setTasksByDept({ [deptId]: withDept as any });
//       }
//     } catch (e: any) {
//       setErr(e?.message || 'Failed to load tasks');
//     } finally {
//       setLoading(false);
//     }
//   }

//   useEffect(() => {
//     if (!currentEventId || !deptId) return;
//     if (deptId === 'ALL' && accessibleDepts.length === 0) return; // defer until departments load
//     loadTasks();
//     // subscribe to task changes (placeholder realtime bus)
//     const off = bus.on('tasks:changed', ({ eventId, departmentId }: any) => {
//       if (eventId === currentEventId && (deptId === 'ALL' || departmentId === deptId)) loadTasks(true);
//     });
//     return () => off();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [currentEventId, deptId, memberFilter, accessibleDepts, zoneId]);

//   // Load names: prefer department members; fall back to event members for names when assignee isn't in dept
//   useEffect(() => {
//     let mounted = true;
//     if (!currentEventId || !deptId) return;
//     (async () => {
//       try {
//         const deptRows = deptId === 'ALL' ? [] : await departmentsService.members.list(currentEventId, deptId).catch(() => []);
//         const eventRows = await eventsService.members.list(currentEventId).catch(() => []);
//         if (!mounted) return;
//         const deptList = Array.isArray(deptRows) ? deptRows : [];
//         const eventList = Array.isArray(eventRows) ? eventRows : [];
//         // Options for assignee: department members only (or event-wide if ALL)
//         const opts = (deptId === 'ALL' ? eventList : deptList).map((m: any) => ({ value: m.userId, label: m.user?.fullName || m.userId }));
//         setMemberOptions([{ value: '', label: 'Unassigned' }, ...opts]);
//         // Name map for rendering: union of dept + event members
//         const map: Record<string, string> = {};
//         for (const m of eventList) {
//           map[m.userId] = m.user?.fullName || map[m.userId] || m.userId;
//         }
//         for (const m of deptList) {
//           map[m.userId] = m.user?.fullName || map[m.userId] || m.userId;
//         }
//         setMemberNameById(map);
//       } catch {
//         setMemberOptions([{ value: '', label: 'Unassigned' }]);
//         setMemberNameById({});
//       }
//     })();
//     return () => {
//       mounted = false;
//     };
//   }, [currentEventId, deptId]);

//   // Load venues for current event to display names in list
//   useEffect(() => {
//     let mounted = true;
//     if (!currentEventId) return;
//     import('../services/venues').then(({ venuesService }) =>
//       venuesService.list(currentEventId!).then((rows) => {
//         if (!mounted) return;
//         const m: Record<string, string> = {};
//         for (const v of rows || []) m[v.id] = v.name;
//         setVenueNameById(m);
//       }).catch(() => setVenueNameById({}))
//     );
//     return () => { mounted = false };
//   }, [currentEventId, tasks]);

//   // Load zones when needed
//   useEffect(() => {
//     let mounted = true;
//     if (!currentEventId) return;
//     if (mode === 'central') { setZones([]); return; }
//     zonesService.list(currentEventId).then((rows) => {
//       if (!mounted) return;
//       setZones(rows || []);
//     }).catch(() => setZones([]));
//     return () => { mounted = false };
//   }, [currentEventId, mode]);

//   // Load zonal departments for selected zone
//   useEffect(() => {
//     let mounted = true;
//     if (!currentEventId) return;
//     if (mode !== 'zones' || !zoneId || zoneId === 'ALL_ZONES') { setZoneZDepts([]); setZoneZDeptId('ALL_ZDEPTS'); return; }
//     zonesService.listZoneZonalDepts(currentEventId, zoneId).then((rows) => {
//       if (!mounted) return;
//       setZoneZDepts(rows || []);
//       setZoneZDeptId('ALL_ZDEPTS');
//     }).catch(() => { setZoneZDepts([]); setZoneZDeptId('ALL_ZDEPTS'); });
//     return () => { mounted = false };
//   }, [currentEventId, mode, zoneId]);

//   // RBAC helpers
//   const canCreate = useMemo(() => {
//     if (!deptId || deptId === 'ALL') return false;
//     if (isSuperAdmin) return true;
//     const roles = myMemberships.filter((m) => !m.departmentId || m.departmentId === deptId).map((m) => m.role);
//     return roles.includes('OWNER') || roles.includes('PMO_ADMIN') || roles.includes('DEPT_HEAD') || roles.includes('DEPT_MEMBER');
//   }, [isSuperAdmin, myMemberships, deptId]);

//   const canViewAllInDept = useMemo(() => {
//     if (!deptId) return false;
//     if (isSuperAdmin || canAdminEvent) return true;
//     const roles = myMemberships.filter((m) => !m.departmentId || m.departmentId === deptId).map((m) => m.role);
//     return roles.includes('OWNER') || roles.includes('PMO_ADMIN') || roles.includes('DEPT_HEAD');
//   }, [isSuperAdmin, canAdminEvent, myMemberships, deptId]);

//   const canEditTask = (t: TaskItem) => {
//     if (isSuperAdmin) return true;
//     const roles = myMemberships.filter((m) => !m.departmentId || m.departmentId === deptId).map((m) => m.role);
//     if (roles.includes('OWNER') || roles.includes('PMO_ADMIN') || roles.includes('DEPT_HEAD')) return true;
//     if (roles.includes('DEPT_MEMBER')) {
//       return t.creatorId === currentUserId || t.assigneeId === currentUserId;
//     }
//     return false;
//   };

//   function matchesFilters(t: TaskItem) {
//     const term = q.trim().toLowerCase();
//     const now = Date.now();
//     const matchStatus = statusFilter === 'all' ? true : t.status === statusFilter;
//     const matchPriority = priorityFilter === 'all' ? true : t.priority === priorityFilter;
//     const matchMember = memberFilter === 'all' ? true : t.assigneeId === memberFilter;
//     const isOverdue = !!t.dueAt && new Date(t.dueAt).getTime() < now && t.status !== 'done' && t.status !== 'canceled';
//     const matchOverdue = overdueOnly ? isOverdue : true;
//     const matchText = !term || t.title.toLowerCase().includes(term) || (t.description || '').toLowerCase().includes(term);
//     return matchStatus && matchPriority && matchMember && matchOverdue && matchText;
//   }

// const filtered = useMemo(() => tasks.filter(matchesFilters), [tasks, statusFilter, priorityFilter, memberFilter, overdueOnly, q]);

//   const renderTaskRow = (t: TaskItem) => {
//     const statusColor =
//       t.status === 'done'
//         ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
//         : t.status === 'in_progress'
//         ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100'
//         : t.status === 'blocked'
//         ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100'
//         : t.status === 'canceled'
//         ? 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-100'
//         : 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-100';

//     const statusBase = 'appearance-none text-sm rounded-md pl-3 pr-8 py-2 border focus:outline-none focus:ring-2 w-[124px] min-w-[124px]';

//     return (
//       <tr key={t.id} className="border-b last:border-0 align-top">
//         <td className="px-4 py-2 align-top">
//           <div className="font-medium text-gray-900" title={t.title}>
//             {t.title}
//           </div>
//           {t.description && (
//             <div className="text-xs text-gray-600 mt-0.5 break-words whitespace-pre-wrap">
//               {t.description}
//             </div>
//           )}
//         </td>
//         <td className="px-4 py-2 align-top">
//           {t.type && (
//             <span
//               className={`inline-flex items-center border rounded px-2 py-0.5 text-xs font-medium ${
//                 TYPE_COLOR[t.type as TaskType] || 'bg-gray-100 text-gray-800 border-gray-300'
//               }`}
//             >
//               {TYPE_OPTIONS.find((o) => o.value === t.type)?.label || t.type}
//             </span>
//           )}
//         </td>
//         <td className="px-4 py-2 align-top">
//           <span className="text-sm text-gray-700">
//             {venueNameById[t.venueId || ''] || (t.venueId ? t.venueId : '—')}
//           </span>
//         </td>
//         <td className="px-4 py-2 align-top">
//           <PriorityBadge p={t.priority} />
//         </td>
//         <td className="px-4 py-2 align-top">
//           {t.assigneeId ? (
//             <UserAvatar
//               nameOrEmail={memberNameById[t.assigneeId] || t.assigneeId}
//               size={28}
//               className="shadow-sm"
//             />
//           ) : (
//             <span className="text-gray-400 text-sm">—</span>
//           )}
//         </td>
//         <td className="px-4 py-2 align-top">
//           <span className="inline-flex items-center text-gray-700">
//             <Calendar size={14} className="mr-1" />
//             {fmt(t.dueAt) || '-'}
//           </span>
//         </td>
//         <td className="px-4 py-2 align-top">
//           <Dropdown
//             value={t.status}
//             onChange={(v) => changeStatus(t, v as TaskStatus)}
//             options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
//             title={canEditTask(t) ? 'Change status' : 'No permission to change status'}
//             disabled={!canEditTask(t)}
//             className={`${statusBase} ${statusColor}`}
//           />
//         </td>
//         <td className="px-4 py-2 text-right whitespace-nowrap align-top">
//           <button
//             className="text-gray-700 hover:text-black mr-3"
//             onClick={() => openDetails(t)}
//             title="View details"
//           >
//             <Eye size={16} />
//           </button>
//           <button
//             className="text-gray-700 hover:text-black mr-3"
//             onClick={() => openEdit(t)}
//             title="Edit"
//           >
//             <Pencil size={16} />
//           </button>
//           <button
//             className="text-rose-600 hover:text-rose-700"
//             onClick={() => removeTask(t)}
//             disabled={!canEditTask(t)}
//             title="Delete task"
//           >
//             <Trash2 size={16} />
//           </button>
//         </td>
//       </tr>
//     );
//   };

//   const renderTaskTable = (rows: TaskItem[]) => (
//     <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
//       <table className="w-full text-sm table-auto">
//         <colgroup>
//           <col style={{ width: '30%' }} />
//           <col style={{ width: '12%' }} />
//           <col style={{ width: '16%' }} />
//           <col style={{ width: '10%' }} />
//           <col style={{ width: '8%' }} />
//           <col style={{ width: '14%' }} />
//           <col style={{ width: '12%' }} />
//           <col style={{ width: '120px' }} />
//         </colgroup>
//         <thead className="bg-gray-50 border-b border-gray-200">
//           <tr>
//             <th className="text-left px-4 py-2 text-gray-600">Title</th>
//             <th className="text-left px-4 py-2 text-gray-600">Type</th>
//             <th className="text-left px-4 py-2 text-gray-600">Venue</th>
//             <th className="text-left px-4 py-2 text-gray-600">Priority</th>
//             <th className="text-left px-4 py-2 text-gray-600">Assignee</th>
//             <th className="text-left px-4 py-2 text-gray-600">Due</th>
//             <th className="text-left px-4 py-2 text-gray-600">Status</th>
//             <th className="text-right px-4 py-2 text-gray-600">Actions</th>
//           </tr>
//         </thead>
//         <tbody>
//           {rows.map(renderTaskRow)}
//           {rows.length === 0 && (
//             <tr>
//               <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
//                 No tasks found.
//               </td>
//             </tr>
//           )}
//         </tbody>
//       </table>
//     </div>
//   );

//   async function createTask() {
//     if (!currentEventId || !deptId) return;
//     if (!createForm.title.trim()) return;
//     setCreating(true);
//     try {
//       const targetDeptId = deptId === 'ALL' ? createDeptId : deptId;
//       if (!targetDeptId) throw new Error('Please choose a department');
//       const payload: any = {
//         title: createForm.title.trim(),
//         description: createForm.description?.trim() || undefined,
//         priority: Number(createForm.priority) || 3,
//         type: createForm.type,
//         startAt: createForm.startAt ? dateOnlyToISO(createForm.startAt) : undefined,
//         dueAt: createForm.dueAt ? dateOnlyToISO(createForm.dueAt) : undefined,
//         assigneeId: createForm.assigneeId?.trim() || undefined,
//         venueId: createForm.venueId?.trim() || undefined,
//         zoneId: zones.length > 0 ? (createCommon ? undefined : (createForm as any).zoneId || undefined) : undefined,
//       };
//       if (mode === 'zones' && !createCommon && zoneId !== 'ALL_ZONES' && createZDeptId) {
//         (payload as any).zonalDeptRowId = createZDeptId;
//       }
//       const created = await tasksService.create(currentEventId, targetDeptId, payload);
//       // Upload any selected files
//       for (let i = 0; i < createFiles.length; i++) {
//         const item = createFiles[i];
//         await attachmentsService.uploadWithProgress(
//           currentEventId,
//           'Task',
//           created.id,
//           item.file,
//           (pct) => setCreateFiles((prev) => prev.map((p, idx) => (idx === i ? { ...p, progress: pct } : p)))
//         ).catch(() => { });
//       }
//       // link dependencies if any
//       for (const d of createDeps) {
//         if (!d.upstreamId) continue;
//         try {
//           await tasksService.dependencies.add(currentEventId, targetDeptId, created.id, d);
//         } catch { }
//       }
//       setShowCreate(false);
//       setCreateForm({ title: '', description: '', priority: 3, startAt: '', dueAt: '', assigneeId: '', venueId: '', type: 'new_task' });
//       setCreateDeps([]);
//       // cleanup previews
//       setCreateFiles((prev) => {
//         prev.forEach((p) => URL.revokeObjectURL(p.url));
//         return [];
//       });
//       await loadTasks(true);
//     } catch (e) {
//       // surface minimal error
//       alert('Failed to create task. Select a department and check permissions.');
//     } finally {
//       setCreating(false);
//     }
//   }
//   function onPickCreateFiles(files: FileList | null) {
//     if (!files || files.length === 0) return;
//     const next = Array.from(files).map((f) => ({ file: f, url: URL.createObjectURL(f), progress: 0 }));
//     setCreateFiles((prev) => [...prev, ...next]);
//   }
//   function removeCreateFile(idx: number) {
//     setCreateFiles((prev) => {
//       const copy = [...prev];
//       const [rm] = copy.splice(idx, 1);
//       if (rm) URL.revokeObjectURL(rm.url);
//       return copy;
//     });
//   }

//   async function changeStatus(task: TaskItem, status: TaskStatus) {
//     if (!currentEventId) return;
//     const targetDept = task.departmentId || deptId;
//     if (!targetDept || targetDept === 'ALL') return;
//     try {
//       const res = await tasksService.changeStatus(currentEventId, targetDept, task.id, { status });
//       setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: res.status, progressPct: res.progressPct } : t)));
//     } catch (e) {
//       alert('Not allowed to change status');
//     }
//   }

//   async function updateTask(task: TaskItem, patch: Partial<TaskItem>) {
//     if (!currentEventId) return;
//     const targetDept = task.departmentId || deptId;
//     if (!targetDept || targetDept === 'ALL') return;
//     try {
//       const payload: any = {
//         title: patch.title,
//         description: patch.description,
//         priority: patch.priority,
//         type: (patch as any).type,
//         startAt: patch.startAt === '' ? null : patch.startAt ? dateOnlyToISO(patch.startAt) : undefined,
//         dueAt: patch.dueAt === '' ? null : patch.dueAt ? dateOnlyToISO(patch.dueAt) : undefined,
//         assigneeId: patch.assigneeId === '' ? null : patch.assigneeId ?? undefined,
//         venueId: (patch as any).venueId === '' ? null : (patch as any).venueId ?? undefined,
//         zoneId: (patch as any).zoneId === '' ? null : (patch as any).zoneId ?? undefined,
//         zonalDeptRowId: (patch as any).zonalDeptRowId === '' ? null : (patch as any).zonalDeptRowId ?? undefined,
//       };
//       const res = await tasksService.update(currentEventId, targetDept, task.id, payload);
//       // Re-fetch or optimistic merge
//       await loadTasks(true);
//       return res;
//     } catch (e) {
//       alert('Failed to update task');
//     }
//   }

//   // add
//   function openDetails(t: TaskItem) {
//     setViewing(t);
//   }

//   // add
//   async function changeStatusFromDrawer(task: TaskItem, status: TaskStatus) {
//     if (!currentEventId) return;
//     const targetDept = task.departmentId || deptId;
//     if (!targetDept || targetDept === 'ALL') return;
//     try {
//       const res = await tasksService.changeStatus(currentEventId, targetDept, task.id, { status });
//       // reflect in list + drawer
//       setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: res.status, progressPct: res.progressPct } : t)));
//       setViewing((cur) => (cur && cur.id === task.id ? { ...cur, status: res.status, progressPct: res.progressPct } : cur));
//     } catch {
//       alert('Not allowed to change status');
//     }
//   }

//   function openEdit(t: TaskItem) {
//     setEditing(t);
//     setEditForm({
//       title: t.title,
//       description: t.description || '',
//       priority: t.priority,
//       startAt: isoToDateInput(t.startAt),
//       dueAt: isoToDateInput(t.dueAt),
//       assigneeId: t.assigneeId || '',
//       venueId: t.venueId || '',
//       type: (t.type as TaskType) || 'new_task',
//       progressPct: t.progressPct || 0,
//       status: t.status,
//     });
//     setEditCommon(!t.zoneId);
//     // load zonal departments for selected task zone
//     if (currentEventId && t.zoneId) {
//       zonesService.listZoneZonalDepts(currentEventId, t.zoneId).then(rows => setEditZoneZDepts(rows || [])).catch(() => setEditZoneZDepts([]));
//     } else {
//       setEditZoneZDepts([]);
//     }
//     // load dependencies + candidate tasks
//     if (currentEventId) {
//       const targetDept = t.departmentId || deptId;
//       if (!targetDept || targetDept === 'ALL') return;
//       tasksService.dependencies
//         .list(currentEventId, targetDept, t.id)
//         .then((d) => setDeps({ blockers: d.blockers || [] }))
//         .catch(() => setDeps({ blockers: [] }));
//       tasksService
//         .list(currentEventId, targetDept)
//         .then((rows) => setAllTasksForDeps((rows || []).filter((x) => x.id !== t.id)))
//         .catch(() => setAllTasksForDeps([]));
//     }
//   }

//   async function removeTask(task: TaskItem) {
//     if (!currentEventId) return;
//     const targetDept = task.departmentId || deptId;
//     if (!targetDept || targetDept === 'ALL') return;
//     if (!confirm('Delete this task?')) return;
//     try {
//       await tasksService.remove(currentEventId, targetDept, task.id);
//       setTasks((prev) => prev.filter((t) => t.id !== task.id));
//     } catch (e) {
//       alert('Failed to delete task');
//     }
//   }

//   const DepartmentSelect = (
//     <Dropdown
//       value={deptId}
//       onChange={(v) => setTasksState({ deptId: v })}
//       options={(() => {
//         const base = accessibleDepts.map((d) => ({ value: d.id, label: d.name }));
//         const canAll = isSuperAdmin || canAdminEvent || accessibleDepts.length > 1;
//         return canAll ? [{ value: 'ALL', label: 'All Departments' }, ...base] : base;
//       })()}
//       placeholder={accessibleDepts.length ? undefined : 'No department'}
//       title="Choose department"
//       fullWidth={false}
//     />
//   );

//   return (
//     <Page>
//       <div className="flex flex-wrap items-center gap-2 mb-4">
//         <div className="text-2xl font-semibold mr-2">{mode === 'central' ? 'Tasks • Central Departments' : mode === 'zones' ? 'Tasks • Zones' : 'Tasks'}</div>
//         <div className="ml-auto flex items-center gap-3">
//           {(mode !== 'central') && zones.length > 0 && (
//             <div className="flex items-center gap-2" title="Zone">
//               <span className="text-xs text-gray-600">Zone</span>
//               <Dropdown
//                 value={zoneId}
//                 onChange={(v) => setZoneId(v)}
//                 options={[{ value: 'ALL_ZONES', label: 'All Zones' }, ...zones.map((z) => ({ value: z.id, label: z.name }))]}
//               />
//             </div>
//           )}
//           {(mode === 'zones' && zoneId !== 'ALL_ZONES') && (
//             <div className="flex items-center gap-2" title="Zonal Department">
//               <span className="text-xs text-gray-600">Zonal Dept</span>
//               <Dropdown
//                 value={zoneZDeptId}
//                 onChange={(v) => setZoneZDeptId(v)}
//                 options={[{ value: 'ALL_ZDEPTS', label: 'All Zonal Departments' }, ...zoneZDepts.map((d) => ({ value: d.id, label: d.name }))]}
//               />
//             </div>
//           )}
//           {mode !== 'zones' && (
//             <div className="flex items-center gap-2" title="Department">
//               <span className="text-xs text-gray-600">Dept</span>
//               {DepartmentSelect}
//             </div>
//           )}
//           <div className="flex items-center gap-2" title="Filter by status">
//             <span className="text-xs text-gray-600">Status</span>
//             <Dropdown
//               value={String(statusFilter)}
//               onChange={(v) => setTasksState({ statusFilter: v as TaskStatus | 'all' })}
//               options={[{ value: 'all', label: 'All Statuses' }, ...STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))]}
//             />
//           </div>
//           <div className="flex items-center gap-2" title="Filter by priority">
//             <span className="text-xs text-gray-600">Priority</span>
//             <Dropdown
//               value={String(priorityFilter)}
//               onChange={(v) => setTasksState({ priorityFilter: v === 'all' ? 'all' : Number(v) })}
//               options={[{ value: 'all', label: 'All Priorities' }, ...[1, 2, 3, 4, 5].map((p) => ({ value: String(p), label: PRIORITY_LABEL[p] }))]}
//             />
//           </div>
//           <div className="relative">
//             <input
//               className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
//               placeholder="Search tasks"
//               value={q}
//               onChange={(e) => setTasksState({ q: e.target.value })}
//               title="Search by title or description"
//             />
//           </div>
//           <label className="inline-flex items-center text-sm text-gray-700">
//             <input
//               type="checkbox"
//               className="mr-2"
//               checked={overdueOnly}
//               onChange={(e) => setTasksState({ overdueOnly: e.target.checked })}
//             />
//             Overdue only
//           </label>
//           {canViewAllInDept && (
//             <div className="flex items-center gap-2" title="Filter by member">
//               <span className="text-xs text-gray-600">Member</span>
//               <Dropdown
//                 value={String(memberFilter)}
//                 onChange={(v) => setTasksState({ memberFilter: v as any })}
//                 options={[{ value: 'all', label: 'All Members' }, ...memberOptions.slice(1)]}
//               />
//             </div>
//           )}
//           <button
//             className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2 text-sm disabled:opacity-60"
//             onClick={() => {
//               // Pre-fill zone for zones view
//               if (mode === 'zones' && zoneId && zoneId !== 'ALL_ZONES') {
//                 setCreateForm((f: any) => ({ ...f, zoneId }));
//               }
//               // Pre-fill department for create when current view is ALL
//               setCreateDeptId(deptId === 'ALL' ? (accessibleDepts[0]?.id || '') : deptId);
//               setCreateZDeptId('');
//               setShowCreate(true);
//             }}
//             disabled={!(isSuperAdmin || canAdminEvent || (deptId !== 'ALL' && canCreate) || (deptId === 'ALL' && accessibleDepts.length > 0))}
//             title={canCreate ? 'Create task' : (deptId === 'ALL' ? 'Select a department to create tasks' : 'You do not have permission to create tasks')}
//           >
//             <Plus size={16} className="mr-1" /> New Task
//           </button>
//         </div>
//       </div>

//       {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-3">{err}</div>}
//       {loading && <Spinner label="Loading tasks" />}

//       <div className="inline-flex items-center bg-gray-100 border border-gray-300 rounded-xl p-1">
//         <button
//           className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm transition ${viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
//           onClick={() => setTasksState({ viewMode: 'list' })}
//           title="List view"
//         >
//           <ListIcon size={16} className="mr-1" /> List
//         </button>
//         <button
//           className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm transition ${viewMode === 'board' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
//           onClick={() => setTasksState({ viewMode: 'board' })}
//           title="Board view"
//         >
//           <LayoutGrid size={16} className="mr-1" /> Board
//         </button>
//       </div>

//       <div style={{ height: '10px' }}></div>
//       {!loading && (
//         <>
//           {viewMode === 'list' ? (
//             mode === 'zones' ? (
//               <>
//                 {/* Zones: always a single table of filtered tasks */}
//                 <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
//           <table className="w-full text-sm table-auto">
//             <colgroup>
//               <col style={{ width: '30%' }} />
//               <col style={{ width: '12%' }} />
//               <col style={{ width: '16%' }} />
//               <col style={{ width: '10%' }} />
//               <col style={{ width: '8%' }} />
//               <col style={{ width: '14%' }} />
//               <col style={{ width: '12%' }} />
//               <col style={{ width: '120px' }} />
//             </colgroup>
//             <thead className="bg-gray-50 border-b border-gray-200">
//               <tr>
//                 <th className="text-left px-4 py-2 text-gray-600">Title</th>
//                 <th className="text-left px-4 py-2 text-gray-600">Type</th>
//                 <th className="text-left px-4 py-2 text-gray-600">Venue</th>
//                 <th className="text-left px-4 py-2 text-gray-600">Priority</th>
//                 <th className="text-left px-4 py-2 text-gray-600">Assignee</th>
//                 <th className="text-left px-4 py-2 text-gray-600">Due</th>
//                 <th className="text-left px-4 py-2 text-gray-600">Status</th>
//                 <th className="text-right px-4 py-2 text-gray-600">Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {filtered.map((t) => (
//                 <tr key={t.id} className="border-b last:border-0 align-top">
//                   <td className="px-4 py-2 align-top">
//                     <div className="font-medium text-gray-900" title={t.title}>{t.title}</div>
//                     {t.description && (
//                       <div className="text-xs text-gray-600 mt-0.5 break-words whitespace-pre-wrap">
//                         {t.description}
//                       </div>
//                     )}
//                   </td>
//                   <td className="px-4 py-2 align-top">
//                     {t.type && (
//                       <span className={`inline-flex items-center border rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[t.type as TaskType] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
//                         {TYPE_OPTIONS.find(o => o.value === t.type)?.label || t.type}
//                       </span>
//                     )}
//                   </td>
//                   <td className="px-4 py-2 align-top">
//                     <span className="text-sm text-gray-700">{venueNameById[t.venueId || ''] || (t.venueId ? t.venueId : '—')}</span>
//                   </td>
//                   <td className="px-4 py-2 align-top"><PriorityBadge p={t.priority} /></td>
//                   <td className="px-4 py-2 align-top">
//                     {t.assigneeId ? (
//                       <UserAvatar
//                         nameOrEmail={memberNameById[t.assigneeId] || t.assigneeId}
//                         size={28}
//                         className="shadow-sm"
//                       />
//                     ) : (
//                       <span className="text-gray-400 text-sm">—</span>
//                     )}
//                   </td>
//                   <td className="px-4 py-2 align-top"><span className="inline-flex items-center text-gray-700"><Calendar size={14} className="mr-1" />{fmt(t.dueAt) || '-'}</span></td>
//                   <td className="px-4 py-2 align-top">
//                     {(() => {
//                       const color =
//                         t.status === 'done' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100' :
//                           t.status === 'in_progress' ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100' :
//                             t.status === 'blocked' ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100' :
//                               t.status === 'canceled' ? 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-100' :
//                                 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-100';
//                       const base = 'appearance-none text-sm rounded-md pl-3 pr-8 py-2 border focus:outline-none focus:ring-2 w-[124px] min-w-[124px]';
//                       return (
//                         <Dropdown
//                           value={t.status}
//                           onChange={(v) => changeStatus(t, v as TaskStatus)}
//                           options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
//                           title={canEditTask(t) ? 'Change status' : 'No permission to change status'}
//                           disabled={!canEditTask(t)}
//                           className={`${base} ${color}`}
//                         />
//                       );
//                     })()}
//                   </td>
//                   <td className="px-4 py-2 text-right whitespace-nowrap align-top">
//                     <button className="text-gray-700 hover:text-black mr-3" onClick={() => openDetails(t)} title="View details">
//                       <Eye size={16} />
//                     </button>
//                     <button className="text-gray-700 hover:text-black mr-3" onClick={() => openEdit(t)} title="Edit">
//                       <Pencil size={16} />
//                     </button>
//                     <button
//                       className="text-rose-600 hover:text-rose-700"
//                       onClick={() => removeTask(t)}
//                       disabled={!canEditTask(t)}
//                       title="Delete task"
//                     >
//                       <Trash2 size={16} />
//                     </button>
//                   </td>
//                 </tr>
//               ))}
//               {filtered.length === 0 && (
//                 <tr>
//                   <td colSpan={8} className="px-4 py-6 text-center text-gray-500">No tasks found.</td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>
//       ) : (
//       deptId === 'ALL' ? (
//       <div className="space-y-6">
//         {accessibleDepts.map((d) => {
//           const rows = (tasksByDept[d.id] || []).filter(matchesFilters);
//           return (
//             <div key={d.id}>
//               <div className="text-xl md:text-2xl font-semibold text-gray-800 mb-2">{d.name}</div>
//               <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
//                 <table className="w-full text-sm table-auto">
//                   <colgroup>
//                     <col style={{ width: '30%' }} />
//                     <col style={{ width: '12%' }} />
//                     <col style={{ width: '16%' }} />
//                     <col style={{ width: '10%' }} />
//                     <col style={{ width: '8%' }} />
//                     <col style={{ width: '14%' }} />
//                     <col style={{ width: '12%' }} />
//                     <col style={{ width: '120px' }} />
//                   </colgroup>
//                   <thead className="bg-gray-50 border-b border-gray-200">
//                     <tr>
//                       <th className="text-left px-4 py-2 text-gray-600">Title</th>
//                       <th className="text-left px-4 py-2 text-gray-600">Type</th>
//                       <th className="text-left px-4 py-2 text-gray-600">Venue</th>
//                       <th className="text-left px-4 py-2 text-gray-600">Priority</th>
//                       <th className="text-left px-4 py-2 text-gray-600">Assignee</th>
//                       <th className="text-left px-4 py-2 text-gray-600">Due</th>
//                       <th className="text-left px-4 py-2 text-gray-600">Status</th>
//                       <th className="text-right px-4 py-2 text-gray-600">Actions</th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {rows.map((t) => (
//                       <tr key={t.id} className="border-b last:border-0 align-top">
//                         <td className="px-4 py-2 align-top">
//                           <div className="font-medium text-gray-900" title={t.title}>{t.title}</div>
//                           {t.description && (
//                             <div className="text-xs text-gray-600 mt-0.5 break-words whitespace-pre-wrap">
//                               {t.description}
//                             </div>
//                           )}
//                         </td>
//                         <td className="px-4 py-2 align-top">
//                           {t.type && (
//                             <span className={`inline-flex items-center border rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[t.type as TaskType] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
//                               {TYPE_OPTIONS.find(o => o.value === t.type)?.label || t.type}
//                             </span>
//                           )}
//                         </td>
//                         <td className="px-4 py-2 align-top">
//                           <span className="text-sm text-gray-700">{venueNameById[t.venueId || ''] || (t.venueId ? t.venueId : '—')}</span>
//                         </td>
//                         <td className="px-4 py-2 align-top"><PriorityBadge p={t.priority} /></td>
//                         <td className="px-4 py-2 align-top">
//                           {t.assigneeId ? (
//                             <UserAvatar
//                               nameOrEmail={memberNameById[t.assigneeId] || t.assigneeId}
//                               size={28}
//                               className="shadow-sm"
//                             />
//                           ) : (
//                             <span className="text-gray-400 text-sm">—</span>
//                           )}
//                         </td>
//                         <td className="px-4 py-2 align-top"><span className="inline-flex items-center text-gray-700"><Calendar size={14} className="mr-1" />{fmt(t.dueAt) || '-'}</span></td>
//                         <td className="px-4 py-2 align-top">
//                           {(() => {
//                             const color =
//                               t.status === 'done' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100' :
//                                 t.status === 'in_progress' ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100' :
//                                   t.status === 'blocked' ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100' :
//                                     t.status === 'canceled' ? 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-100' :
//                                       'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-100';
//                             const base = 'appearance-none text-sm rounded-md pl-3 pr-8 py-2 border focus:outline-none focus:ring-2 w-[124px] min-w-[124px]';
//                             return (
//                               <Dropdown
//                                 value={t.status}
//                                 onChange={(v) => changeStatus(t, v as TaskStatus)}
//                                 options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
//                                 title={canEditTask(t) ? 'Change status' : 'No permission to change status'}
//                                 disabled={!canEditTask(t)}
//                                 className={`${base} ${color}`}
//                               />
//                             );
//                           })()}
//                         </td>
//                         <td className="px-4 py-2 text-right whitespace-nowrap align-top">
//                           <button className="text-gray-700 hover:text-black mr-3" onClick={() => openDetails(t)} title="View details">
//                             <Eye size={16} />
//                           </button>
//                           <button className="text-gray-700 hover:text-black mr-3" onClick={() => openEdit(t)} title="Edit">
//                             <Pencil size={16} />
//                           </button>
//                           <button
//                             className="text-rose-600 hover:text-rose-700"
//                             onClick={() => removeTask(t)}
//                             disabled={!canEditTask(t)}
//                             title="Delete task"
//                           >
//                             <Trash2 size={16} />
//                           </button>
//                         </td>
//                       </tr>
//                     ))}
//                     {rows.length === 0 && (
//                       <tr>
//                         <td colSpan={8} className="px-4 py-6 text-center text-gray-500">No tasks found.</td>
//                       </tr>
//                     )}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//           );
//         })}
//       </div>
//       ) : (
//       <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
//         <table className="w-full text-sm table-auto">
//           <colgroup>
//             <col style={{ width: '30%' }} />
//             <col style={{ width: '12%' }} />
//             <col style={{ width: '16%' }} />
//             <col style={{ width: '10%' }} />
//             <col style={{ width: '8%' }} />
//             <col style={{ width: '14%' }} />
//             <col style={{ width: '12%' }} />
//             <col style={{ width: '120px' }} />
//           </colgroup>
//           <thead className="bg-gray-50 border-b border-gray-200">
//             <tr>
//               <th className="text-left px-4 py-2 text-gray-600">Title</th>
//               <th className="text-left px-4 py-2 text-gray-600">Type</th>
//               <th className="text-left px-4 py-2 text-gray-600">Venue</th>
//               <th className="text-left px-4 py-2 text-gray-600">Priority</th>
//               <th className="text-left px-4 py-2 text-gray-600">Assignee</th>
//               <th className="text-left px-4 py-2 text-gray-600">Due</th>
//               <th className="text-left px-4 py-2 text-gray-600">Status</th>
//               <th className="text-right px-4 py-2 text-gray-600">Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {filtered.map((t) => (
//               <tr key={t.id} className="border-b last:border-0 align-top">
//                 <td className="px-4 py-2 align-top">
//                   <div className="font-medium text-gray-900" title={t.title}>{t.title}</div>
//                   {t.description && (
//                     <div className="text-xs text-gray-600 mt-0.5 break-words whitespace-pre-wrap">
//                       {t.description}
//                     </div>
//                   )}
//                 </td>
//                 <td className="px-4 py-2 align-top">
//                   {t.type && (
//                     <span className={`inline-flex items-center border rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[t.type as TaskType] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
//                       {TYPE_OPTIONS.find(o => o.value === t.type)?.label || t.type}
//                     </span>
//                   )}
//                 </td>
//                 <td className="px-4 py-2 align-top">
//                   <span className="text-sm text-gray-700">{venueNameById[t.venueId || ''] || (t.venueId ? t.venueId : '—')}</span>
//                 </td>
//                 <td className="px-4 py-2 align-top"><PriorityBadge p={t.priority} /></td>
//                 <td className="px-4 py-2 align-top">
//                   {t.assigneeId ? (
//                     <UserAvatar
//                       nameOrEmail={memberNameById[t.assigneeId] || t.assigneeId}
//                       size={28}
//                       className="shadow-sm"
//                     />
//                   ) : (
//                     <span className="text-gray-400 text-sm">—</span>
//                   )}
//                 </td>
//                 <td className="px-4 py-2 align-top"><span className="inline-flex items-center text-gray-700"><Calendar size={14} className="mr-1" />{fmt(t.dueAt) || '-'}</span></td>
//                 <td className="px-4 py-2 align-top">
//                   {(() => {
//                     const color =
//                       t.status === 'done' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100' :
//                         t.status === 'in_progress' ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100' :
//                           t.status === 'blocked' ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100' :
//                             t.status === 'canceled' ? 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-100' :
//                               'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-100';
//                     const base = 'appearance-none text-sm rounded-md pl-3 pr-8 py-2 border focus:outline-none focus:ring-2 w-[124px] min-w-[124px]';
//                     return (
//                       <Dropdown
//                         value={t.status}
//                         onChange={(v) => changeStatus(t, v as TaskStatus)}
//                         options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
//                         title={canEditTask(t) ? 'Change status' : 'No permission to change status'}
//                         disabled={!canEditTask(t)}
//                         className={`${base} ${color}`}
//                       />
//                     );
//                   })()}
//                 </td>
//                 <td className="px-4 py-2 text-right whitespace-nowrap align-top">
//                   <button className="text-gray-700 hover:text-black mr-3" onClick={() => openDetails(t)} title="View details">
//                     <Eye size={16} />
//                   </button>
//                   <button className="text-gray-700 hover:text-black mr-3" onClick={() => openEdit(t)} title="Edit">
//                     <Pencil size={16} />
//                   </button>
//                   <button
//                     className="text-rose-600 hover:text-rose-700"
//                     onClick={() => removeTask(t)}
//                     disabled={!canEditTask(t)}
//                     title="Delete task"
//                   >
//                     <Trash2 size={16} />
//                   </button>
//                 </td>
//               </tr>
//             ))}
//             {filtered.length === 0 && (
//               <tr>
//                 <td colSpan={8} className="px-4 py-6 text-center text-gray-500">No tasks found.</td>
//               </tr>
//             )}
//           </tbody>
//         </table>
//       </div>
//       )
//             )}
//       ) : (
//       <TasksBoardView
//         tasks={filtered}
//         onChangeStatus={changeStatusFromDrawer}
//         onView={openDetails}
//         memberNameById={memberNameById}
//       />
//           )}
//     </>
//   )
// }

// {/* Create drawer */ }
// <SideDrawer
//   open={showCreate}
//   onClose={() => setShowCreate(false)}
//   maxWidthClass="max-w-2xl"
//   header={<div className="text-xl font-semibold">Create Task</div>}
// >
//   <div className="p-5">
//     <div className="space-y-3">
//       <div>
//         <label className="block text-sm mb-1">Title</label>
//         <input
//           className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
//           value={createForm.title}
//           onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
//           placeholder="Short task description"
//           required
//         />
//       </div>
//       <div>
//         <label className="block text-sm mb-1">Description</label>
//         <textarea
//           className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
//           rows={3}
//           value={createForm.description}
//           onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
//           placeholder="Details or context"
//         />
//       </div>
//       <div>
//         {currentEventId && (
//           <VenueSelect
//             eventId={currentEventId}
//             value={createForm.venueId}
//             onChange={(v) => setCreateForm((f) => ({ ...f, venueId: v }))}
//             label="Venue"
//           />
//         )}
//       </div>
//       <div className="grid md:grid-cols-4 gap-2">
//         <div>
//           <label className="block text-sm mb-1">Priority</label>
//           <Dropdown
//             value={String(createForm.priority)}
//             onChange={(v) => setCreateForm((f) => ({ ...f, priority: Number(v) }))}
//             options={[1, 2, 3, 4, 5].map((p) => ({ value: String(p), label: PRIORITY_LABEL[p] }))}
//           />
//         </div>
//         <div>
//           <label className="block text-sm mb-1">Type</label>
//           <Dropdown
//             value={createForm.type}
//             onChange={(v) => setCreateForm((f) => ({ ...f, type: v as TaskType }))}
//             options={TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
//           />
//         </div>
//         <div>
//           <label className="block text-sm mb-1">Start Date</label>
//           <input
//             type="date"
//             className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
//             value={createForm.startAt}
//             onChange={(e) => setCreateForm((f) => ({ ...f, startAt: e.target.value }))}
//           />
//         </div>
//         <div>
//           <label className="block text-sm mb-1">Due Date</label>
//           <input
//             type="date"
//             className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
//             value={createForm.dueAt}
//             onChange={(e) => setCreateForm((f) => ({ ...f, dueAt: e.target.value }))}
//           />
//         </div>
//       </div>
//       <div>
//         <label className="block text-sm mb-1">Assignee</label>
//         <Dropdown
//           value={createForm.assigneeId}
//           onChange={(v) => setCreateForm((f) => ({ ...f, assigneeId: v }))}
//           options={memberOptions}
//           fullWidth
//         />
//       </div>
//       {(mode !== 'central') && zones.length > 0 && (
//         <div className="flex items-center gap-2">
//           <label className="inline-flex items-center text-sm">
//             <input type="checkbox" className="mr-2" checked={createCommon} onChange={(e) => setCreateCommon(e.target.checked)} />
//             Common across all zones
//           </label>
//           <span className="text-xs text-gray-500">(Visible in every zone)</span>
//         </div>
//       )}
//       {/* Department selection for create when viewing ALL or in Zones */}
//       {(deptId === 'ALL' || mode === 'zones') && (
//         <div>
//           <label className="block text-sm mb-1">Department</label>
//           <Dropdown
//             value={createDeptId}
//             onChange={(v) => setCreateDeptId(v)}
//             options={accessibleDepts.map(d => ({ value: d.id, label: d.name }))}
//           />
//         </div>
//       )}
//       {(mode === 'zones' && !createCommon && zoneId !== 'ALL_ZONES' && zoneZDepts.length > 0) && (
//         <div>
//           <label className="block text-sm mb-1">Zonal Department</label>
//           <Dropdown value={createZDeptId} onChange={(v) => setCreateZDeptId(v)} options={[{ value: '', label: 'None' }, ...zoneZDepts.map(d => ({ value: d.id, label: d.name }))]} />
//         </div>
//       )}
//       {/* Attachments */}
//       <div>
//         <div className="flex items-center justify-between mb-2">
//           <label className="block text-sm font-medium">Attachments</label>
//           <label className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800 cursor-pointer">
//             <Paperclip size={16} /> Attach files
//             <input type="file" multiple className="hidden" onChange={(e) => onPickCreateFiles(e.target.files)} accept="image/*,video/*,application/pdf" />
//           </label>
//         </div>
//         {createFiles.length > 0 && (
//           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
//             {createFiles.map((it, idx) => (
//               <div key={idx} className="relative border rounded-md overflow-hidden bg-gray-50">
//                 <button type="button" className="absolute right-1 top-1 bg-white/80 rounded-full p-1 shadow" onClick={() => removeCreateFile(idx)} title="Remove">
//                   <X size={14} />
//                 </button>
//                 {it.file.type.startsWith('image/') ? (
//                   <img src={it.url} alt={it.file.name} className="w-full h-28 object-cover" />
//                 ) : (
//                   <div className="w-full h-28 flex items-center justify-center text-xs text-gray-600 p-2 text-center">
//                     {it.file.name}
//                   </div>
//                 )}
//                 {it.progress > 0 && it.progress < 100 && (
//                   <div className="absolute bottom-0 left-0 right-0 bg-blue-600 h-1" style={{ width: `${it.progress}%` }} />
//                 )}
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//       {/* Dependencies */}
//       <div className="mt-2">
//         <div className="text-sm font-medium mb-2">Dependencies (Blockers)</div>
//         <div className="flex items-center gap-2">
//           <Dropdown
//             value={''}
//             onChange={(v) => setCreateDeps((prev) => [...prev, { upstreamId: v, depType: 'finish_to_start' }])}
//             options={[{ value: '', label: 'Select task to add' }, ...tasks.map((t) => ({ value: t.id, label: t.title }))]}
//             fullWidth
//           />
//         </div>
//         {createDeps.length > 0 && (
//           <div className="mt-2 space-y-2">
//             {createDeps.map((d, idx) => (
//               <div key={idx} className="flex items-center gap-2 text-sm">
//                 <span className="flex-1">{tasks.find((t) => t.id === d.upstreamId)?.title || d.upstreamId}</span>
//                 <Dropdown
//                   value={d.depType}
//                   onChange={(v) => setCreateDeps((prev) => prev.map((x, i) => (i === idx ? { ...x, depType: v as DepType } : x)))}
//                   options={[
//                     { value: 'finish_to_start', label: 'Finish to start' },
//                     { value: 'start_to_start', label: 'Start to start' },
//                     { value: 'finish_to_finish', label: 'Finish to finish' },
//                     { value: 'start_to_finish', label: 'Start to finish' },
//                   ]}
//                 />
//                 <button
//                   className="text-rose-600 hover:text-rose-700"
//                   onClick={() => setCreateDeps((prev) => prev.filter((_, i) => i !== idx))}
//                   title="Remove"
//                 >
//                   Remove
//                 </button>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//     <div className="mt-5 flex justify-end gap-2">
//       <button className="px-3 py-2 rounded-md text-sm text-gray-700 hover:text-black" onClick={() => setShowCreate(false)}>
//         Cancel
//       </button>
//       <button
//         className="px-3 py-2 rounded-md text-sm bg-blue-600 hover:bg-blue-700 text-white"
//         onClick={createTask}
//         disabled={creating || !createForm.title.trim()}
//       >
//         Create
//       </button>
//     </div>
//   </div>
// </SideDrawer>

// {/* Edit drawer */ }
// {
//   editing && (
//     <SideDrawer
//       open={!!editing}
//       onClose={() => setEditing(null)}
//       maxWidthClass="max-w-2xl"
//       header={
//         <>
//           <div className="text-xl font-semibold truncate">Edit Task</div>
//           <div className="text-sm text-gray-600 truncate">{editForm.title || editing.title}</div>
//         </>
//       }
//     >
//       <div className="p-5">
//         <div className="grid md:grid-cols-2 gap-4">
//           <div className="md:col-span-2">
//             <label className="block text-sm mb-1">Title</label>
//             <input
//               className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
//               value={editForm.title}
//               onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
//             />
//           </div>
//           <div className="md:col-span-2">
//             <label className="block text-sm mb-1">Description</label>
//             <textarea
//               className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
//               rows={4}
//               value={editForm.description}
//               onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
//             />
//           </div>
//           <div className="md:col-span-2">
//             {currentEventId && (
//               <VenueSelect
//                 eventId={currentEventId}
//                 value={editForm.venueId}
//                 onChange={(v) => setEditForm((f) => ({ ...f, venueId: v }))}
//                 label="Venue"
//               />
//             )}
//           </div>
//           {(mode !== 'central') && zones.length > 0 && (
//             <div className="md:col-span-2 flex items-center gap-2">
//               <label className="inline-flex items-center text-sm">
//                 <input type="checkbox" className="mr-2" checked={editCommon} onChange={(e) => {
//                   setEditCommon(e.target.checked);
//                   setEditForm((f: any) => ({ ...f, zoneId: e.target.checked ? '' : f.zoneId }));
//                 }} />
//                 Common across all zones
//               </label>
//               <span className="text-xs text-gray-500">(Visible in every zone)</span>
//             </div>
//           )}
//           {(mode !== 'central') && zones.length > 0 && (
//             <div className="md:col-span-2">
//               <label className="block text-sm mb-1">Zone</label>
//               <Dropdown
//                 value={(editForm as any).zoneId || ''}
//                 onChange={async (v) => {
//                   setEditForm((f: any) => ({ ...f, zoneId: v }));
//                   if (currentEventId && v) {
//                     const rows = await zonesService.listZoneZonalDepts(currentEventId, v).catch(() => []);
//                     setEditZoneZDepts(rows || []);
//                   } else {
//                     setEditZoneZDepts([]);
//                   }
//                 }}
//                 options={[{ value: '', label: 'No Zone' }, ...zones.map(z => ({ value: z.id, label: z.name }))]}
//               />
//             </div>
//           )}
//           {(mode === 'zones' && (editForm as any).zoneId) && (
//             <div className="md:col-span-2">
//               <label className="block text-sm mb-1">Zonal Department</label>
//               <Dropdown
//                 value={(editForm as any).zonalDeptRowId || ''}
//                 onChange={(v) => setEditForm((f: any) => ({ ...f, zonalDeptRowId: v }))}
//                 options={[{ value: '', label: 'None' }, ...editZoneZDepts.map(d => ({ value: d.id, label: d.name }))]}
//               />
//             </div>
//           )}
//           {/* Priority, Type, Start, Due in one row */}
//           <div className="md:col-span-2 grid md:grid-cols-4 gap-2">
//             <div>
//               <label className="block text-sm mb-1">Priority</label>
//               <Dropdown
//                 value={String(editForm.priority)}
//                 onChange={(v) => setEditForm((f) => ({ ...f, priority: Number(v) }))}
//                 options={[1, 2, 3, 4, 5].map((p) => ({ value: String(p), label: PRIORITY_LABEL[p] }))}
//               />
//             </div>
//             <div>
//               <label className="block text-sm mb-1">Type</label>
//               <Dropdown
//                 value={editForm.type}
//                 onChange={(v) => setEditForm((f) => ({ ...f, type: v as TaskType }))}
//                 options={TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
//               />
//             </div>
//             <div>
//               <label className="block text-sm mb-1">Start Date</label>
//               <input
//                 type="date"
//                 className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
//                 value={editForm.startAt}
//                 onChange={(e) => setEditForm((f) => ({ ...f, startAt: e.target.value }))}
//               />
//             </div>
//             <div>
//               <label className="block text-sm mb-1">Due Date</label>
//               <input
//                 type="date"
//                 className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
//                 value={editForm.dueAt}
//                 onChange={(e) => setEditForm((f) => ({ ...f, dueAt: e.target.value }))}
//               />
//             </div>
//           </div>
//           <div>
//             <label className="block text-sm mb-1">Status</label>
//             <Dropdown
//               value={editForm.status}
//               onChange={(v) => setEditForm((f) => ({ ...f, status: v as TaskStatus }))}
//               options={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
//             />
//           </div>
//           <div>
//             <label className="block text-sm mb-1">Progress %</label>
//             <input
//               type="number"
//               min={0}
//               max={100}
//               className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
//               value={editForm.progressPct}
//               onChange={(e) =>
//                 setEditForm((f) => ({ ...f, progressPct: Math.max(0, Math.min(100, Number(e.target.value))) }))
//               }
//             />
//           </div>
//           <div>
//             <AssigneeSelect
//               deptId={deptId}
//               value={editForm.assigneeId}
//               onChange={(v) => setEditForm((f) => ({ ...f, assigneeId: v }))}
//               options={memberOptions.slice(1)}
//             />
//           </div>
//         </div>

//         {/* Dependencies */}
//         <div className="mt-6">
//           <div className="text-sm font-medium mb-2">Dependencies (Blockers)</div>
//           <div className="space-y-2">
//             {(deps?.blockers || []).map((b) => (
//               <div
//                 key={b.upstreamId}
//                 className="flex items-center justify-between border border-gray-100 rounded px-3 py-2"
//               >
//                 <div className="text-sm">
//                   <span className="font-medium">{b.task.title}</span>
//                   <span className="ml-2 text-xs text-gray-500">
//                     {PRIORITY_LABEL[b.task.priority]} • {b.task.status}
//                   </span>
//                 </div>
//                 <button
//                   className="text-rose-600 hover:text-rose-700 text-sm"
//                   onClick={async () => {
//                     if (!currentEventId || !deptId || !editing) return;
//                     await tasksService.dependencies.remove(currentEventId!, deptId!, editing!.id, b.upstreamId);
//                     // reload deps
//                     const d = await tasksService.dependencies.list(currentEventId!, deptId!, editing!.id);
//                     setDeps({ blockers: d.blockers || [] });
//                   }}
//                   title="Remove dependency"
//                 >
//                   Remove
//                 </button>
//               </div>
//             ))}
//             <div className="flex items-center gap-2">
//               <Dropdown
//                 value={newDep.upstreamId}
//                 onChange={(v) => setNewDep((s) => ({ ...s, upstreamId: v }))}
//                 options={[{ value: '', label: 'Select task' }, ...allTasksForDeps.map((t) => ({ value: t.id, label: t.title }))]}
//               />
//               <Dropdown
//                 value={newDep.depType}
//                 onChange={(v) => setNewDep((s) => ({ ...s, depType: v as DepType }))}
//                 options={[
//                   { value: 'finish_to_start', label: 'Finish to start' },
//                   { value: 'start_to_start', label: 'Start to start' },
//                   { value: 'finish_to_finish', label: 'Finish to finish' },
//                   { value: 'start_to_finish', label: 'Start to finish' },
//                 ]}
//               />
//               <button
//                 className="inline-flex items-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-3 py-2 text-sm"
//                 onClick={async () => {
//                   if (!newDep.upstreamId || !currentEventId || !deptId || !editing) return;
//                   await tasksService.dependencies.add(currentEventId!, deptId!, editing!.id, newDep);
//                   const d = await tasksService.dependencies.list(currentEventId!, deptId!, editing!.id);
//                   setDeps({ blockers: d.blockers || [] });
//                   setNewDep({ upstreamId: '', depType: 'finish_to_start' });
//                 }}
//                 title="Add dependency"
//               >
//                 Add
//               </button>
//             </div>
//           </div>
//         </div>

//         <div className="mt-6 flex justify-end gap-2">
//           <button
//             className="px-3 py-2 rounded-md text-sm text-gray-700 hover:text-black"
//             onClick={() => setEditing(null)}
//           >
//             Cancel
//           </button>
//           <button
//             className="px-3 py-2 rounded-md text-sm bg-blue-600 hover:bg-blue-700 text-white"
//             onClick={async () => {
//               if (!editing) return;
//               await updateTask(editing, {
//                 title: editForm.title,
//                 description: editForm.description,
//                 priority: editForm.priority,
//                 startAt: editForm.startAt,
//                 dueAt: editForm.dueAt,
//                 assigneeId: editForm.assigneeId,
//                 venueId: editForm.venueId,
//                 type: editForm.type,
//               });
//               // Save status/progress separately via status endpoint
//               try {
//                 if (currentEventId && deptId) {
//                   await tasksService.changeStatus(currentEventId, deptId, editing.id, {
//                     status: editForm.status,
//                     progressPct: editForm.progressPct,
//                   });
//                 }
//               } catch { }
//               setEditing(null);
//             }}
//           >
//             Save
//           </button>
//         </div>
//       </div>
//     </SideDrawer>
//   )
// }
// {
//   viewing && (
//     <TaskDetailsDrawer
//       task={viewing}
//       eventId={currentEventId!}
//       memberNameById={memberNameById}
//       onClose={() => setViewing(null)}
//       onChangeStatus={(s) => changeStatusFromDrawer(viewing, s)}
//     />
//   )
// }
//     </Page >
//   );
// };



// /* ---- Assignee dropdown backed by department members ---- */
// const AssigneeSelect: React.FC<{ deptId: string; value: string; onChange: (v: string) => void; options?: { value: string; label: string }[] }> = ({ deptId, value, onChange, options }) => {
//   const { currentEventId } = useContextStore();
//   const [opts, setOpts] = useState<{ value: string; label: string }[]>(options || []);
//   useEffect(() => {
//     if (options) return; // use provided options
//     let mounted = true;
//     if (!currentEventId || !deptId) return;
//     departmentsService.members
//       .list(currentEventId, deptId)
//       .then((rows) => {
//         if (!mounted) return;
//         const items = (rows || []).map((m) => ({ value: m.userId, label: m.user?.fullName || m.userId }));
//         setOpts(items);
//       })
//       .catch(() => setOpts([]));
//     return () => {
//       mounted = false;
//     };
//   }, [currentEventId, deptId, options]);
//   const final = options || opts;
//   return (
//     <div>
//       <label className="block text-sm mb-1">Assignee</label>
//       <Dropdown value={value || ''} onChange={onChange} options={[{ value: '', label: 'Unassigned' }, ...final]} />
//     </div>
//   );
// };
