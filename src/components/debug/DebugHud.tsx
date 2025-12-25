import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useContextStore } from '../../store/contextStore';
import { X, ChevronUp, ChevronDown, RefreshCw, Copy } from 'lucide-react';

export const DebugHud: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [minimized, setMinimized] = useState(false);

    // Auth Store
    const currentUser = useAuthStore(s => s.currentUser);
    const tenantId = useAuthStore(s => s.tenantId);

    // Context Store
    const context = useContextStore();

    if (!currentUser) return null; // Don't show if not logged in (or maybe show basic info?)

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard');
    };

    if (!isOpen) {
        return (
            <div className="fixed bottom-4 right-4 z-[9999]">
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-mono shadow-lg hover:bg-red-700 transition"
                    title="Open Debug HUD"
                >
                    DEBUG
                </button>
            </div>
        );
    }

    return (
        <div className={`fixed z-[9999] bg-gray-900/95 text-green-400 font-mono text-xs border border-green-800 shadow-2xl transition-all duration-200 
            ${minimized ? 'bottom-4 right-4 w-64 h-auto rounded-lg' : 'bottom-0 right-0 w-96 h-screen border-l'}
        `}>
            {/* Header */}
            <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
                <span className="font-bold flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    DEBUG HUD
                </span>
                <div className="flex gap-2">
                    <button onClick={() => context.refreshContext()} title="Refresh Context"><RefreshCw size={14} /></button>
                    <button onClick={() => setMinimized(!minimized)} title={minimized ? "Expand" : "Minimize"}>
                        {minimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button onClick={() => setIsOpen(false)} title="Close"><X size={14} /></button>
                </div>
            </div>

            {/* Content */}
            {!minimized && (
                <div className="h-[calc(100vh-40px)] overflow-y-auto p-4 space-y-6">

                    {/* Identity Section */}
                    <section>
                        <h3 className="text-white font-bold border-b border-gray-700 mb-2 pb-1">IDENTITY</h3>
                        <div className="space-y-1">
                            <div><span className="text-gray-500">ID:</span> {currentUser.id}</div>
                            <div><span className="text-gray-500">Email:</span> {currentUser.email}</div>
                            <div><span className="text-gray-500">Tenant:</span> {tenantId}</div>
                            <div className="flex gap-2 mt-1">
                                <Badge label="SuperAdmin" active={currentUser.isSuperAdmin} />
                                <Badge label="TenantMgr" active={currentUser.isTenantManager} />
                            </div>
                            <div className="mt-2">
                                <div className="text-gray-500 mb-1">Global/Tenant Perms:</div>
                                <div className="flex flex-wrap gap-1">
                                    {(currentUser.permissions || []).map(p => <PermBadge key={p} p={p} />)}
                                    {(!currentUser.permissions?.length) && <span className="text-gray-600 italic">None</span>}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Context Section */}
                    <section>
                        <h3 className="text-white font-bold border-b border-gray-700 mb-2 pb-1">EVENT CONTEXT</h3>
                        <div className="space-y-1">
                            <div><span className="text-gray-500">EventID:</span> {context.currentEventId || 'None'}</div>
                            <div><span className="text-gray-500">EventName:</span> {context.currentEventName || 'None'}</div>
                            <div><span className="text-gray-500">Structure:</span> {context.currentEventStructure || 'N/A'}</div>
                            <div className="text-yellow-500 mt-1">canAdminEvent: {String(context.canAdminEvent)}</div>
                            <div className="mt-2">
                                <div className="text-gray-500 mb-1">My Event Perms (Calculated):</div>
                                <div className="flex flex-wrap gap-1">
                                    {(context.eventPermissions || []).map(p => <PermBadge key={p} p={p} />)}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Memberships */}
                    <section>
                        <h3 className="text-white font-bold border-b border-gray-700 mb-2 pb-1">MEMBERSHIPS</h3>
                        {context.myMemberships.map((m, i) => (
                            <div key={i} className="mb-3 p-2 bg-gray-800 rounded border border-gray-700">
                                <div className="flex justify-between">
                                    <span className="text-blue-300">{typeof m.role === 'string' ? m.role : m.role.name}</span>
                                    <span className="text-gray-500 text-[10px]">{m.departmentId ? 'Department' : 'Global'}</span>
                                </div>
                                {m.departmentId && <div className="text-xs text-gray-400">DeptID: {m.departmentId}</div>}
                                {m.permissions && m.permissions.length > 0 && (
                                    <div className="mt-1 pt-1 border-t border-gray-700">
                                        <div className="text-[10px] text-gray-500">Role Specific Perms:</div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {m.permissions.map(p => <span key={p} className="text-[9px] bg-black px-1 rounded text-gray-300">{p}</span>)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {context.myMemberships.length === 0 && <div className="italic text-gray-600">No memberships found.</div>}
                    </section>

                    {/* Raw Store Dump */}
                    <section>
                        <details>
                            <summary className="cursor-pointer text-gray-500 hover:text-white">Raw State JSON</summary>
                            <pre className="mt-2 p-2 bg-black text-[10px] overflow-x-auto whitespace-pre-wrap rounded">
                                {JSON.stringify({
                                    auth: { ...currentUser },
                                    context: {
                                        loading: context.loadingContext,
                                        error: context.error,
                                        deptId: context.currentDeptId
                                    }
                                }, null, 2)}
                            </pre>
                            <button onClick={() => copyToClipboard(JSON.stringify(context, null, 2))} className="mt-2 flex items-center gap-1 text-blue-400 hover:text-blue-300">
                                <Copy size={12} /> Copy Full Context
                            </button>
                        </details>
                    </section>
                </div>
            )}
        </div>
    );
};

const Badge = ({ label, active }: { label: string, active: boolean }) => (
    <span className={`px-1.5 py-0.5 rounded text-[10px] border ${active ? 'bg-green-900 border-green-700 text-green-300' : 'bg-gray-800 border-gray-600 text-gray-500'}`}>
        {label}
    </span>
);

const PermBadge = ({ p }: { p: string }) => (
    <span className="px-1.5 py-0.5 bg-blue-900/50 border border-blue-800 text-blue-200 rounded text-[10px]" title={p}>
        {p}
    </span>
);
