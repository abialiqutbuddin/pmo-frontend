import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Page } from '../components/layout/Page';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Handle,
  MiniMap,
  Node,
  NodeProps,
  Position,
  ReactFlowInstance,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import {
  Download,
  Layers,
  LocateFixed,
  Printer,
  Users,
  GitBranch,
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { useContextStore } from '../store/contextStore';
import { useAuthStore } from '../store/authStore';
import { eventsService } from '../services/events';
import { departmentsService } from '../services/departments';
import { Spinner } from '../components/ui/Spinner';

/* --- Visualization Components --- */

type TitleNodeData = {
  title: string;
  departmentCount: number;
  memberCount: number;
};
type DepartmentNodeData = {
  id: string;
  name: string;
  description?: string;
  color: string;
  memberCount: number;
  isHead?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  canEdit?: boolean;
};
type MemberNodeData = {
  name: string;
  role: string;
  email?: string;
};

const titleHandleStyle = { width: 12, height: 12, background: '#eef2ff', border: '2px solid #4338ca' };
const deptHandleStyleTop = { width: 10, height: 10, background: '#dbeafe', border: '2px solid #0f172a' };
const deptHandleStyleBottom = { width: 10, height: 10, background: '#dbeafe', border: '2px solid #0f172a' };
const memberHandleStyle = { width: 8, height: 8, background: '#cbd5f5', border: '2px solid #334155' };

const TitleNode: React.FC<NodeProps<TitleNodeData>> = ({ data }) => (
  <div className="min-w-[240px] rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 shadow-xl text-white relative">
    <div className="text-sm uppercase tracking-wide text-white/70">Organogram</div>
    <div className="mt-1 text-2xl font-semibold leading-snug">{data.title}</div>
    <div className="mt-3 flex items-center gap-4 text-sm text-white/80">
      <span className="inline-flex items-center gap-1"><Layers size={14} /> {data.departmentCount} depts</span>
      <span className="inline-flex items-center gap-1"><Users size={14} /> {data.memberCount} members</span>
    </div>
    <Handle type="source" position={Position.Bottom} style={titleHandleStyle} />
  </div>
);

const DepartmentNode: React.FC<NodeProps<DepartmentNodeData>> = ({ data }) => (
  <div className="min-w-[200px] max-w-[260px] rounded-xl border-2 bg-white px-3 py-2 shadow-md relative group hover:shadow-lg transition-all" style={{ borderColor: data.color }}>
    <Handle type="target" position={Position.Top} style={deptHandleStyleTop} />
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: data.color }} />
      <div className="font-semibold leading-tight text-gray-900 text-sm flex-1 truncate">{data.name}</div>
      {data.canEdit && (
        <div className="hidden group-hover:flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); data.onEdit?.(data.id); }} className="p-1 hover:bg-blue-100 rounded text-blue-600" title="Edit"><Pencil size={12} /></button>
          <button onClick={(e) => { e.stopPropagation(); data.onDelete?.(data.id); }} className="p-1 hover:bg-red-100 rounded text-red-600" title="Delete"><Trash2 size={12} /></button>
        </div>
      )}
    </div>
    {data.description && <div className="mt-1 text-xs text-gray-500 line-clamp-2">{data.description}</div>}
    <div className="mt-2 text-[10px] font-medium uppercase tracking-wide text-gray-400 flex justify-between">
      <span>{data.memberCount} members</span>
    </div>
    <Handle type="source" position={Position.Bottom} style={deptHandleStyleBottom} />
  </div>
);

const MemberNode: React.FC<NodeProps<MemberNodeData>> = ({ data }) => (
  <div className="min-w-[160px] max-w-[200px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left shadow-sm relative hover:bg-white transition-colors">
    <Handle type="target" position={Position.Top} style={memberHandleStyle} />
    <div className="text-sm font-semibold text-slate-900 truncate">{data.name}</div>
    <div className="text-xs text-slate-500 truncate" title={data.role}>{data.role}</div>
  </div>
);

const nodeTypes = {
  title: TitleNode,
  department: DepartmentNode,
  member: MemberNode,
};

/* --- Department Modal --- */
interface DeptModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  dept?: { id: string; name: string; parentId?: string | null };
  allDepts: { id: string; name: string }[];
  onClose: () => void;
  onSave: (name: string, parentId: string | null, saveToDb: boolean) => Promise<void>;
  saving: boolean;
}
const DeptModal: React.FC<DeptModalProps> = ({ open, mode, dept, allDepts, onClose, onSave, saving }) => {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [saveToDb, setSaveToDb] = useState(false);

  useEffect(() => {
    if (open) {
      setName(dept?.name || '');
      setParentId(dept?.parentId ?? null);
      setSaveToDb(false); // Reset checkbox on open
    }
  }, [open, dept]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
        <h2 className="text-lg font-bold text-gray-900 mb-4">{mode === 'create' ? 'Add Department' : 'Edit Department'}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. Marketing"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Department (Optional)</label>
            <select
              value={parentId || ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">— No Parent (Root) —</option>
              {allDepts.filter(d => d.id !== dept?.id).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          {mode === 'create' && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <input
                type="checkbox"
                id="saveToDb"
                checked={saveToDb}
                onChange={(e) => setSaveToDb(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="saveToDb" className="text-sm text-gray-700">
                Also create in database <span className="text-gray-400">(permanent)</span>
              </label>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSave(name.trim(), parentId, saveToDb)}
            disabled={!name.trim() || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Spinner size="sm" />}
            {mode === 'create' ? (saveToDb ? 'Create & Save' : 'Add to Chart') : 'Save'}
          </button>
        </div>
        {mode === 'create' && !saveToDb && (
          <p className="mt-3 text-xs text-amber-600 bg-amber-50 p-2 rounded">
            Note: This will only add to the visual chart. It won't be saved until you check the box above.
          </p>
        )}
      </div>
    </div>
  );
};


/* --- Main Component --- */

export const OrganogramBuilderPage: React.FC = () => {
  const { currentEventId, currentEventName, canAdminEvent, myMemberships } = useContextStore();
  const isSuperAdmin = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);
  const isTenantManager = !!useAuthStore((s) => s.currentUser?.isTenantManager);

  const [loading, setLoading] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [exporting, setExporting] = useState<'none' | 'png' | 'pdf'>('none');
  const previewRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [allDepts, setAllDepts] = useState<{ id: string; name: string; parentId?: string | null }[]>([]);
  const [allMembers, setAllMembers] = useState<any[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingDept, setEditingDept] = useState<{ id: string; name: string; parentId?: string | null } | undefined>();
  const [saving, setSaving] = useState(false);

  // Edit mode toggle - when OFF, organogram is view-only; when ON, changes are saved to database
  const [editModeEnabled, setEditModeEnabled] = useState(false);

  const palette = ['#2563eb', '#0ea5e9', '#dc2626', '#16a34a', '#d946ef', '#f97316', '#14b8a6', '#facc15'];
  const canEdit = canAdminEvent || isSuperAdmin || isTenantManager;
  const isEditActive = canEdit && editModeEnabled; // Actually allow editing only when toggle is on

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!currentEventId) return;
    setLoading(true);
    setError(null);
    try {
      const depts = await departmentsService.list(currentEventId, { force: forceRefresh });
      const members = await eventsService.members.list(currentEventId);
      setAllDepts(depts);
      setAllMembers(members);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [currentEventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build nodes/edges when data changes
  useEffect(() => {
    if (!allDepts.length) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const handleEdit = (id: string) => {
      const d = allDepts.find(x => x.id === id);
      if (d) {
        setEditingDept(d);
        setModalMode('edit');
        setModalOpen(true);
      }
    };
    const handleDelete = async (id: string) => {
      if (!confirm('Delete this department?')) return;
      try {
        await departmentsService.remove(currentEventId!, id);
        loadData(true);
      } catch (e: any) {
        alert(e.message || 'Failed to delete');
      }
    };

    const deptMap = new Map<string, any>(allDepts.map(d => [d.id, { ...d, children: [], members: [] }]));
    const roots: any[] = [];
    allMembers.forEach(m => {
      if (m.departmentId && deptMap.has(m.departmentId)) {
        deptMap.get(m.departmentId).members.push(m);
      }
    });
    allDepts.forEach(d => {
      const node = deptMap.get(d.id);
      if (d.parentId && deptMap.has(d.parentId)) {
        deptMap.get(d.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    const nextNodes: Node[] = [];
    const nextEdges: Edge[] = [];
    const NODE_WIDTH = 260;

    nextNodes.push({
      id: 'root',
      type: 'title',
      data: { title: currentEventName || 'Event', departmentCount: allDepts.length, memberCount: allMembers.length },
      position: { x: 0, y: 0 },
    });

    function traverse(dept: any, depth: number, xOffset: number): { width: number; center: number } {
      const selfWidth = Math.max(NODE_WIDTH, 100);
      if (!dept.children || dept.children.length === 0) {
        const pos = { x: xOffset, y: (depth * 250) + 200 };
        nextNodes.push({
          id: dept.id,
          type: 'department',
          data: {
            id: dept.id,
            name: dept.name,
            description: dept.description,
            color: palette[depth % palette.length],
            memberCount: dept.members.length,
            canEdit: isEditActive,
            onEdit: handleEdit,
            onDelete: handleDelete,
          },
          position: pos,
        });
        nextEdges.push({ id: `e-${dept.id}`, source: dept.parentId || 'root', target: dept.id, type: 'smoothstep', style: { stroke: '#94a3b8' } });
        dept.members.forEach((m: any, i: number) => {
          nextNodes.push({
            id: `${dept.id}-m-${m.userId}`,
            type: 'member',
            data: { name: m.user?.fullName || 'User', role: m.role?.name || 'Member' },
            position: { x: pos.x + 20, y: pos.y + 100 + (i * 50) },
          });
          nextEdges.push({ id: `e-m-${dept.id}-${m.userId}`, source: dept.id, target: `${dept.id}-m-${m.userId}`, style: { stroke: '#cbd5f5' } });
        });
        return { width: selfWidth, center: xOffset + selfWidth / 2 };
      }

      let childrenWidth = 0;
      const childCenters: number[] = [];
      let startX = xOffset;
      dept.children.forEach((child: any) => {
        const dim = traverse(child, depth + 1, startX);
        childCenters.push(dim.center);
        childrenWidth += dim.width + 40;
        startX += dim.width + 40;
      });

      const myCenter = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
      const myPos = { x: myCenter - selfWidth / 2, y: (depth * 250) + 200 };

      nextNodes.push({
        id: dept.id,
        type: 'department',
        data: {
          id: dept.id,
          name: dept.name,
          description: dept.description,
          color: palette[depth % palette.length],
          memberCount: dept.members.length,
          canEdit: isEditActive,
          onEdit: handleEdit,
          onDelete: handleDelete,
        },
        position: myPos,
      });
      nextEdges.push({ id: `e-${dept.id}`, source: dept.parentId || 'root', target: dept.id, type: 'smoothstep', style: { stroke: '#94a3b8' } });
      dept.members.forEach((m: any, i: number) => {
        nextNodes.push({
          id: `${dept.id}-m-${m.userId}`,
          type: 'member',
          data: { name: m.user?.fullName || 'User', role: m.role?.name || 'Member' },
          position: { x: myPos.x + 20, y: myPos.y + 100 + (i * 50) },
        });
        nextEdges.push({ id: `e-m-${dept.id}-${m.userId}`, source: dept.id, target: `${dept.id}-m-${m.userId}`, style: { stroke: '#cbd5f5' } });
      });

      return { width: Math.max(selfWidth, childrenWidth), center: myCenter };
    }

    let rootX = 0;
    roots.forEach((root) => {
      const dim = traverse(root, 0, rootX);
      nextEdges.push({ id: `e-root-${root.id}`, source: 'root', target: root.id, type: 'smoothstep', animated: true });
      rootX += dim.width + 100;
    });

    const totalW = rootX;
    setNodes([{ ...nextNodes[0], position: { x: (totalW / 2) - 120, y: 0 } }, ...nextNodes.slice(1)]);
    setEdges(nextEdges);
  }, [allDepts, allMembers, currentEventName, isEditActive, currentEventId, loadData]);

  const handleOpenCreate = () => {
    setEditingDept(undefined);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleSave = async (name: string, parentId: string | null, saveToDb: boolean) => {
    if (!currentEventId) return;
    setSaving(true);
    try {
      if (modalMode === 'create') {
        if (saveToDb) {
          // Save to database
          await departmentsService.create(currentEventId, name, parentId || undefined);
          loadData(true); // Force refresh to show changes immediately
        } else {
          // Add to local state only (visual-only, temporary)
          const tempId = `temp-${Date.now()}`;
          setAllDepts(prev => [...prev, { id: tempId, name, parentId }]);
        }
      } else if (editingDept) {
        // Edit always saves to DB
        await departmentsService.rename(currentEventId, editingDept.id, name);
        loadData(true);
      }
      setModalOpen(false);
    } catch (e: any) {
      alert(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const fileSafeTitle = (currentEventName || 'organogram').toLowerCase().replace(/\s+/g, '-');
  const exportAsImage = useCallback(async () => {
    if (!previewRef.current) return;
    setExporting('png');
    try {
      const dataUrl = await toPng(previewRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: '#f8fafc' });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${fileSafeTitle}.png`;
      link.click();
    } finally { setExporting('none'); }
  }, [fileSafeTitle]);

  const exportAsPdf = useCallback(async () => {
    if (!previewRef.current) return;
    setExporting('pdf');
    try {
      const rect = previewRef.current.getBoundingClientRect();
      const dataUrl = await toPng(previewRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: '#f8fafc' });
      const pdf = new jsPDF({ orientation: rect.width > rect.height ? 'landscape' : 'portrait', unit: 'px', format: 'a4' });
      const width = pdf.internal.pageSize.getWidth();
      pdf.addImage(dataUrl, 'PNG', 20, 20, width - 40, (width - 40) * (rect.height / rect.width));
      pdf.save(`${fileSafeTitle}.pdf`);
    } finally { setExporting('none'); }
  }, [fileSafeTitle]);

  return (
    <Page className="bg-slate-50 h-[calc(100vh-64px)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-wrap items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch size={20} className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Visual Organogram</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {isEditActive ? 'Edit mode - changes will be saved' : 'View-only mode'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Edit Mode Toggle */}
          {canEdit && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editModeEnabled}
                onChange={(e) => setEditModeEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Enable Editing</span>
            </label>
          )}
          {isEditActive && (
            <button
              onClick={handleOpenCreate}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium"
            >
              <Plus size={16} /> Add Department
            </button>
          )}
          <button onClick={() => flowInstance?.fitView({ duration: 800 })} className="p-2 text-gray-600 hover:bg-gray-100 rounded border border-gray-200" title="Center View"><LocateFixed size={18} /></button>
          <button onClick={exportAsImage} className="p-2 text-blue-600 hover:bg-blue-50 rounded border border-blue-200" title="Export PNG"><Download size={18} /></button>
          <button onClick={exportAsPdf} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded border border-indigo-200" title="Export PDF"><Printer size={18} /></button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative" ref={previewRef}>
        {loading && <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80"><Spinner label="Building structure..." size="lg" /></div>}
        {error && <div className="absolute inset-0 z-50 flex items-center justify-center"><div className="bg-rose-50 text-rose-600 p-4 rounded border border-rose-200">{error}</div></div>}

        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            onInit={setFlowInstance}
            nodesDraggable={canEdit}
            nodesConnectable={false}
            zoomOnScroll
            panOnScroll
            minZoom={0.2}
            fitView
          >
            <MiniMap nodeColor={n => n.type === 'department' ? (n.data.color || '#ccc') : '#eee'} />
            <Controls />
            <Background color="#f1f5f9" gap={20} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {/* Department Modal */}
      <DeptModal
        open={modalOpen}
        mode={modalMode}
        dept={editingDept}
        allDepts={allDepts}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        saving={saving}
      />
    </Page>
  );
};
