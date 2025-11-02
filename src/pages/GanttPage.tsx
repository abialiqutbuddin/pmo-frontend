// frontend/src/pages/GanttPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useContextStore } from '../store/contextStore';
import { useAuthStore } from '../store/authStore';
import { usePageStateStore } from '../store/pageStateStore';
import { tasksService } from '../services/tasks';
import { bus } from '../lib/eventBus';
import { usersService } from '../services/users';
import { UserAvatar } from '../components/ui/UserAvatar';
import { departmentsService } from '../services/departments';
import { eventsService } from '../services/events';
import type { TaskItem } from '../types/task';
import { Dropdown } from '../components/ui/Dropdown';

type Scale = 'day' | 'week';
type Theme = 'default' | 'pastel' | 'contrast';

const ROW_H = 44;             // compact rows per request
const LEFT_W = 320;           // frozen pane width (S.# + Title)

const THEMES: Record<Theme, Record<string, string>> = {
  default: {
    todo: 'bg-gray-300',
    in_progress: 'bg-blue-500',
    blocked: 'bg-rose-500',
    done: 'bg-emerald-600',
    canceled: 'bg-gray-400',
  },
  pastel: {
    todo: 'bg-gray-200',
    in_progress: 'bg-sky-300',
    blocked: 'bg-rose-300',
    done: 'bg-green-300',
    canceled: 'bg-slate-300',
  },
  contrast: {
    todo: 'bg-black',
    in_progress: 'bg-blue-700',
    blocked: 'bg-red-700',
    done: 'bg-green-700',
    canceled: 'bg-neutral-700',
  },
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function daysBetween(a: Date, b: Date) { const ms = startOfDay(b).getTime()-startOfDay(a).getTime(); return Math.ceil(ms/86400000); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function fmtDay(d: Date) { return d.toLocaleDateString(undefined,{ month:'short', day:'numeric'}); }
function fmtDate(iso?: string|null) { if (!iso) return ''; return new Date(iso).toLocaleDateString(undefined,{ month:'short', day:'numeric'}); }
function fmtMonth(d: Date) { return d.toLocaleDateString(undefined,{ month: 'short', year: 'numeric'}); }

export const GanttPage: React.FC = () => {
  const { currentEventId, departments, myMemberships, canAdminEvent } = useContextStore();
  const isSuperAdmin = !!useAuthStore((s)=>s.currentUser?.isSuperAdmin);

  const gantt = usePageStateStore((s) => s.gantt);
  const setGantt = usePageStateStore((s) => s.setGantt);
  const deptId = gantt.deptId;
  const scale = gantt.scale;
  const theme = gantt.theme;
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [memberMap, setMemberMap] = useState<Record<string,string>>({});
  const [assigneeInfo, setAssigneeInfo] = useState<Record<string, { itsId?: string | null; profileImage?: string | null; fullName?: string; }>>({});
  const [err, setErr] = useState<string | null>(null);
  const [tip, setTip] = useState<{ text: string; x: number; y: number; show: boolean } | null>(null);

  // Scroll refs
  const headerScrollRef = useRef<HTMLDivElement>(null); // timeline header (x)
  const rightBodyRef    = useRef<HTMLDivElement>(null); // timeline body (x,y)
  const leftBodyRef     = useRef<HTMLDivElement>(null); // frozen body (y)

  const STATUS_COLOR = THEMES[theme];

  // Access control → visible departments
  const accessibleDepts = useMemo(()=>{
    if (isSuperAdmin || canAdminEvent) return departments;
    const ids = new Set((myMemberships.map(m=>m.departmentId).filter(Boolean) as string[]));
    return departments.filter(d=>ids.has(d.id));
  },[isSuperAdmin, canAdminEvent, departments, myMemberships]);

  useEffect(()=>{
    if (!deptId && accessibleDepts.length) setGantt({ deptId: accessibleDepts[0].id });
  },[accessibleDepts, deptId, setGantt]);

  // Fetch tasks + members (cached via services)
  useEffect(()=>{
    let mounted = true;
    async function load(){
      if (!currentEventId || !deptId) return;
      try {
        setErr(null);
        const list = await tasksService.list(currentEventId, deptId);
        if (!mounted) return;
        setTasks(list || []);
        const mems = await departmentsService.members.list(currentEventId, deptId).catch(()=>[]);
        if (!mounted) return;
        const m: Record<string,string> = {};
        for (const r of mems||[]) {
          // prefer full name; fallback to displayName; last fallback id
          m[r.userId] = r.user?.fullName || r.user?.displayName || r.userId;
        }
        setMemberMap(m);

        // Build assignee details from dept + event members (no per-user fetch)
        const evMembers = await eventsService.members.list(currentEventId).catch(()=>[]);
        const patch: Record<string, any> = {};
        for (const r of mems||[]) {
          patch[r.userId] = { itsId: (r.user as any)?.itsId ?? null, profileImage: (r.user as any)?.profileImage ?? null, fullName: r.user?.fullName };
        }
        for (const r of evMembers||[]) {
          if (!patch[r.userId]) patch[r.userId] = { itsId: (r.user as any)?.itsId ?? null, profileImage: (r.user as any)?.profileImage ?? null, fullName: r.user?.fullName };
        }
        if (Object.keys(patch).length) setAssigneeInfo(prev => ({ ...prev, ...patch }));
      } catch (e: any) {
        setErr(e?.message || 'Failed to load');
      }
    }
    load();
    const off = bus.on('tasks:changed', ({ eventId, departmentId }: any) => {
      if (eventId === currentEventId && departmentId === deptId) load();
    });
    return ()=>{ mounted = false; off(); };
  },[currentEventId, deptId]);

  // Timeline window
  const dated = tasks.filter(t=>t.startAt || t.dueAt);
  const today = startOfDay(new Date());
  const minStart = startOfDay(new Date(dated.length ? Math.min(...dated.map(t=> new Date(t.startAt||t.dueAt!).getTime())) : today.getTime()));
  const maxEnd = startOfDay(new Date(dated.length ? Math.max(...dated.map(t=> new Date(t.dueAt||t.startAt||today).getTime())) : addDays(today, 21).getTime()));
  const chartStart = addDays(minStart, -3);
  const chartEnd   = addDays(maxEnd, 7);
  const totalDays  = Math.max(1, daysBetween(chartStart, chartEnd));
  const dayWidth   = scale==='day' ? 28 : 14;
  const gridWidth  = totalDays * dayWidth;
  const days: Date[] = Array.from({length: totalDays}, (_,i)=> addDays(chartStart, i));

  function posForDate(iso?: string|null) {
    if (!iso) return null; const d = startOfDay(new Date(iso));
    return Math.max(0, Math.min(gridWidth, daysBetween(chartStart, d)*dayWidth));
  }
  function widthForRange(start?: string|null, end?: string|null) {
    const s = posForDate(start);
    const e = posForDate(end);
    if (s === null && e === null) return null;

    // Both start and end provided: inclusive of end day
    if (s !== null && e !== null) {
      const left = s;
      const width = Math.max(dayWidth, (e - s) + dayWidth);
      return { left, width };
    }

    // Only start provided: default span of 2 days
    if (s !== null) {
      return { left: s, width: dayWidth * 2 };
    }

    // Only end provided: show a 1-day bar on the end day
    if (e !== null) {
      return { left: e, width: dayWidth };
    }

    return null;
  }

  const unscheduled = tasks.filter(t=>!t.startAt && !t.dueAt);

  // Center on today (initial + button)
  useEffect(()=>{
    const pos = posForDate(new Date().toISOString());
    if (headerScrollRef.current && pos!=null) {
      headerScrollRef.current.scrollLeft = Math.max(0, pos - headerScrollRef.current.clientWidth/2);
    }
    if (rightBodyRef.current && pos!=null) {
      rightBodyRef.current.scrollLeft = Math.max(0, pos - rightBodyRef.current.clientWidth/2);
    }
  },[gridWidth, scale]);

  // Sync horizontal scroll: header <-> right body
  useEffect(()=>{
    const headerEl = headerScrollRef.current;
    const rightEl  = rightBodyRef.current;
    if (!headerEl || !rightEl) return;
    let from: 'header'|'right'|'' = '';
    const onHeader = () => { if (from==='right') return; from='header'; rightEl.scrollLeft = headerEl.scrollLeft; from=''; };
    const onRight  = () => { if (from==='header') return; from='right';  headerEl.scrollLeft = rightEl.scrollLeft; from=''; };
    headerEl.addEventListener('scroll', onHeader);
    rightEl.addEventListener('scroll', onRight);
    return ()=>{ headerEl.removeEventListener('scroll', onHeader); rightEl.removeEventListener('scroll', onRight); };
  },[]);

  // Sync vertical scroll: left body <-> right body (row alignment)
  useEffect(()=>{
    const leftEl  = leftBodyRef.current;
    const rightEl = rightBodyRef.current;
    if (!leftEl || !rightEl) return;
    let from: 'left'|'right'|'' = '';
    const onLeft  = () => { if (from==='right') return; from='left';  rightEl.scrollTop = leftEl.scrollTop;  from=''; };
    const onRight = () => { if (from==='left')  return; from='right'; leftEl.scrollTop  = rightEl.scrollTop; from=''; };
    leftEl.addEventListener('scroll', onLeft);
    rightEl.addEventListener('scroll', onRight);
    return ()=>{ leftEl.removeEventListener('scroll', onLeft); rightEl.removeEventListener('scroll', onRight); };
  },[]);

  // (Bars have their own inline tooltip; columns shouldn't show tips.)

  return (
    <div className="p-6">
      {/* Controls */}
      <div className="flex items-start gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Gantt</h1>
          <p className="text-sm text-gray-500">Department timelines. Today is marked in red.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Dropdown
            value={deptId}
            onChange={(v)=>setGantt({ deptId: v })}
            options={accessibleDepts.map(d=>({value:d.id,label:d.name}))}
            title="Department"
          />
          <Dropdown
            value={scale}
            onChange={(v)=>setGantt({ scale: v as Scale })}
            options={[{value:'day',label:'Day'},{value:'week',label:'Week'}]}
            title="Scale"
          />
          <Dropdown
            value={theme}
            onChange={(v)=>setGantt({ theme: v as Theme })}
            options={[
              {value:'default',label:'Theme: Default'},
              {value:'pastel',label:'Theme: Pastel'},
              {value:'contrast',label:'Theme: Contrast'},
            ]}
            title="Colors"
          />
          <button
            type="button"
            onClick={()=>{
              const pos = posForDate(new Date().toISOString());
              if (pos!=null) {
                headerScrollRef.current && (headerScrollRef.current.scrollLeft = Math.max(0, pos - (headerScrollRef.current.clientWidth/2)));
                rightBodyRef.current  && (rightBodyRef.current.scrollLeft  = Math.max(0, pos - (rightBodyRef.current.clientWidth/2)));
              }
            }}
            className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
          >
            Center on Today
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-3">
        <span className="font-medium">Legend:</span>
        {Object.entries({
          todo: 'To do',
          in_progress: 'In progress',
          blocked: 'Blocked',
          done: 'Done',
          canceled: 'Canceled',
        }).map(([k, label])=>(
          <span key={k} className="inline-flex items-center gap-2">
            <span className={`inline-block w-3 h-3 rounded ${STATUS_COLOR[k]||'bg-gray-400'}`} />
            {label}
          </span>
        ))}
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        {/* Header row: left (frozen columns) + right (timeline header) */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {/* Frozen header */}
          <div className="shrink-0" style={{ width: LEFT_W }}>
            <div className={`grid grid-cols-[64px_minmax(220px,1fr)] ${scale==='day' ? 'grid-rows-2' : ''} text-xs font-medium text-gray-600 border-b border-gray-200`}>
              <div className={`px-3 py-2 border-r border-gray-200 text-center flex items-center justify-center ${scale==='day' ? 'row-span-2' : ''}`}>S.#</div>
              <div className={`px-3 py-2 text-center flex items-center justify-center ${scale==='day' ? 'row-span-2' : ''}`}>Title</div>
            </div>
          </div>

          {/* Timeline header (scroll X) */}
          <div className="relative grow overflow-x-auto" ref={headerScrollRef}>
            <div className="relative" style={{ width: gridWidth }}>
              <div className="absolute left-0 top-0 bottom-0 border-l border-gray-200 pointer-events-none" />
              {/* Month band */}
              {scale === 'day' && (
                <div className="flex text-[11px] text-gray-600 select-none border-b border-gray-200">
                  {(() => {
                    const chunks: { label: string; span: number }[] = [];
                    let i = 0;
                    while (i < days.length) {
                      const monthLabel = fmtMonth(days[i]);
                      let span = 1;
                      while (i + span < days.length && days[i + span].getMonth() === days[i].getMonth()) span++;
                      chunks.push({ label: monthLabel, span });
                      i += span;
                    }
                    return chunks.map((c, idx)=>(
                      <div key={idx} className="border-r border-gray-200 text-center" style={{ width: c.span * dayWidth }}>
                        <div className="py-1">{c.label}</div>
                      </div>
                    ));
                  })()}
                </div>
              )}
              {/* Day/Week band */}
              <div className="flex text-xs text-gray-600 select-none">
                {days.map((d, i)=> (
                  <div key={i} className="border-r border-gray-200 text-center" style={{ width: dayWidth }}>
                    {scale==='day' ? fmtDay(d) : `W${Math.ceil(d.getDate()/7)}\n${d.toLocaleDateString(undefined,{month:'short'})}`}
                  </div>
                ))}
              </div>
              {/* Today overlay (covers entire today column) */}
              <div
                className="absolute top-0 bottom-0 bg-rose-500/20 border-l-2 border-r-2 border-rose-500/50 pointer-events-none"
                style={{ left: posForDate(today.toISOString()) ?? 0, width: dayWidth }}
              />
            </div>
          </div>
        </div>

        {/* Bodies: left (frozen rows, scroll Y) + right (timeline rows, scroll X/Y). Height fits viewport. */}
        <div className="flex" style={{ maxHeight: 'calc(100vh - 300px)' }}>
          {/* Frozen body (S.# + Title only, small text) */}
          <div className="shrink-0 overflow-y-auto" ref={leftBodyRef} style={{ width: LEFT_W }}>
            {tasks.map((t, i)=>(
              <div key={t.id} className="grid grid-cols-[64px_minmax(220px,1fr)] border-b border-gray-100" style={{ height: ROW_H }}>
                {/* S.# */}
                <div className="px-3 flex items-center justify-center text-xs text-gray-600 border-r border-gray-200">{i+1}</div>
                {/* Title */}
                <div className="px-3 flex items-center gap-2 text-xs text-gray-800 truncate">
                  <span className={`inline-block w-2 h-2 rounded-full ${STATUS_COLOR[t.status]||'bg-gray-400'}`} />
                  <span className="truncate" title={undefined}>{t.title}</span>
                  {t.assigneeId && (
                    <UserAvatar
                      nameOrEmail={memberMap[t.assigneeId] || t.assigneeId}
                      imageUrl={assigneeInfo[t.assigneeId]?.profileImage}
                      itsId={assigneeInfo[t.assigneeId]?.itsId}
                      size={22}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Timeline body */}
          <div className="relative grow overflow-x-auto overflow-y-auto" ref={rightBodyRef}>
            {/* Rows container (one div per task, same height as left) */}
            <div>
              {tasks.map((t)=>{
                const range = widthForRange(t.startAt, t.dueAt);
                return (
                  <div key={t.id} className="relative border-b border-gray-100" style={{ height: ROW_H }}>
                    {/* vertical grid */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {days.map((_,i)=> (
                        <div key={i} className="border-r border-gray-100" style={{ width: dayWidth }} />
                      ))}
                    </div>
                    {/* left boundary line per row */}
                    <div className="absolute left-0 top-0 bottom-0 border-l border-gray-100 pointer-events-none" />

                    {/* Today overlay (covers entire today column) */}
                    <div
                      className="absolute top-0 bottom-0 bg-rose-500/20 border-l-2 border-r-2 border-rose-500/50 pointer-events-none"
                      style={{ left: posForDate(today.toISOString()) ?? 0, width: dayWidth }}
                    />

                    {/* bar */}
                    {range && (
                      <div
                        className={`absolute rounded h-3 ${STATUS_COLOR[t.status]||'bg-gray-400'} shadow-sm`}
                        style={{ left: range.left, top: (ROW_H/2 - 6), width: range.width }}
                        onMouseEnter={(e) => {
                          const text = [
                            t.title,
                            `Assignee: ${memberMap[t.assigneeId||''] || 'Unassigned'}`,
                            `Status: ${t.status || '-'}`,
                            `Start: ${fmtDate(t.startAt) || '-'}`,
                            `Due: ${fmtDate(t.dueAt) || '-'}`,
                            typeof t.progressPct==='number' ? `Progress: ${t.progressPct}%` : '',
                          ].filter(Boolean).join('\n');
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const cx = r.left + r.width / 2;
                          const below = r.bottom + 8;
                          const above = r.top - 8;
                          const y = below + 64 < window.innerHeight ? below : above;
                          setTip({ text, x: Math.min(window.innerWidth - 8, Math.max(8, cx)), y, show: true });
                        }}
                        onMouseLeave={() => setTip(null)}
                      >
                        {typeof t.progressPct === 'number' && (
                          <div className="h-3 bg-black/20 rounded" style={{ width: `${t.progressPct}%` }} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Absolute grid width layer to set the scrollable width */}
            <div className="pointer-events-none" style={{ width: gridWidth, height: 0 }} />
          </div>
        </div>
      </div>

      {/* Unscheduled */}
      {unscheduled.length > 0 && (
        <div className="mt-6">
          <div className="text-sm font-medium mb-2 text-gray-700">Unscheduled</div>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-600">S.#</th>
                  <th className="text-left px-4 py-2 text-gray-600">Title</th>
                  <th className="text-left px-4 py-2 text-gray-600">Assignee</th>
                </tr>
              </thead>
              <tbody>
                {unscheduled.map((t, idx)=> (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{idx+1}</td>
                    <td className="px-4 py-2">{t.title}</td>
                    <td className="px-4 py-2">{memberMap[t.assigneeId||''] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Fixed tooltip overlay */}
      {tip?.show && (
        <div
          className="fixed z-[1000] pointer-events-none whitespace-pre rounded bg-gray-900 px-2 py-1 text-[11px] text-white shadow"
          style={{ left: tip.x, top: tip.y, transform: 'translateX(-50%)' }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
};
