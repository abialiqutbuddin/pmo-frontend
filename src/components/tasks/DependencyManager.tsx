import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { tasksService } from '../../services/tasks';
import { departmentsService } from '../../services/departments';
import { Spinner } from '../ui/Spinner';
import { Dropdown } from '../ui/Dropdown';
import { Search, Link as LinkIcon, Plus, Trash2 } from 'lucide-react';
import { TaskStatus } from '../../types/task';

// Simple types for local usage if full types aren't available yet
type DependencyTask = {
    id: string;
    title: string;
    status: TaskStatus;
    priority: number;
    department?: { id: string; name: string };
};

interface DependencyManagerProps {
    eventId: string;
    departmentId: string;
    taskId: string;
}

export const DependencyManager: React.FC<DependencyManagerProps> = ({ eventId, departmentId, taskId }) => {
    const [loading, setLoading] = useState(true);
    const [blockers, setBlockers] = useState<DependencyTask[]>([]);
    const [dependents, setDependents] = useState<DependencyTask[]>([]);

    // Add Mode State
    const [isAdding, setIsAdding] = useState(false);
    const [targetDeptId, setTargetDeptId] = useState<string>('');
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<DependencyTask[]>([]);
    const [searching, setSearching] = useState(false);

    const [createMode, setCreateMode] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await tasksService.getDependencies(eventId, departmentId, taskId);
            setBlockers(data.blockers.map((b: any) => b.task));
            setDependents(data.dependents.map((d: any) => d.task));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadDepartments = async () => {
        try {
            // We need a list of departments in the event to populate the dropdown
            const depts = await departmentsService.list(eventId);
            setDepartments(depts);
            if (depts.length > 0 && !targetDeptId) setTargetDeptId(depts[0].id);
        } catch (e) { console.error(e); }
    }

    useEffect(() => {
        loadData();
        loadDepartments();
    }, [taskId]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const res = await tasksService.search(eventId, departmentId, searchQuery, targetDeptId);
            // Filter out self and already linked tasks
            const existingIds = new Set([...blockers.map(b => b.id), ...dependents.map(d => d.id), taskId]);
            setSearchResults(res.filter((t: any) => !existingIds.has(t.id)));
        } catch (e) {
            console.error(e);
        } finally {
            setSearching(false);
        }
    };

    const handleLink = async (blockerId: string) => {
        try {
            await tasksService.addDependency(eventId, departmentId, taskId, { blockerId });
            setIsAdding(false);
            setSearchResults([]);
            setSearchQuery('');
            loadData();
        } catch (e) {
            alert('Failed to link dependency');
        }
    };

    const handleCreateAndLink = async () => {
        if (!newTaskTitle.trim()) return;
        try {
            // 1. Create Task in target dept
            const newTask = await tasksService.create(eventId, targetDeptId, { title: newTaskTitle, priority: 3, type: 'new_task' });
            // 2. Link it
            await tasksService.addDependency(eventId, departmentId, taskId, { blockerId: newTask.id });

            setIsAdding(false);
            setCreateMode(false);
            setNewTaskTitle('');
            loadData();
        } catch (e) {
            alert('Failed to create and link task');
        }
    }

    const handleRemove = async (blockerId: string) => {
        if (!confirm('Remove this dependency?')) return;
        try {
            await tasksService.removeDependency(eventId, departmentId, taskId, { blockerId });
            loadData();
        } catch (e) {
            alert('Failed to remove dependency');
        }
    };

    return (
        <div className="space-y-6">
            {/* Waiting On (Blockers) */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">Waiting On (Blockers)</h3>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                    >
                        <Plus size={14} /> Add Dependency
                    </button>
                </div>

                {isAdding && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        {!createMode ? (
                            <>
                                <div className="flex flex-col gap-3">
                                    <div className="text-xs font-semibold text-gray-700">Find a task to link:</div>
                                    <select
                                        className="text-sm border-gray-300 rounded-md py-1.5"
                                        value={targetDeptId}
                                        onChange={(e) => setTargetDeptId(e.target.value)}
                                    >
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 text-sm border-gray-300 rounded-md"
                                            placeholder="Search task title..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                        <button onClick={handleSearch} className="px-3 py-1.5 bg-gray-200 rounded text-xs font-medium hover:bg-gray-300">
                                            Search
                                        </button>
                                    </div>
                                </div>

                                {searching && <div className="mt-2 text-xs text-gray-500">Searching...</div>}

                                {searchResults.length > 0 && (
                                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                                        {searchResults.map(res => (
                                            <div key={res.id} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded">
                                                <span className="text-xs truncate flex-1 mr-2">{res.title} <span className="text-gray-400">({res.status})</span></span>
                                                <button onClick={() => handleLink(res.id)} className="text-xs text-blue-600 hover:underline">Link</button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {!searching && searchQuery && searchResults.length === 0 && (
                                    <div className="mt-2 text-xs text-gray-500">
                                        No tasks found. <button onClick={() => setCreateMode(true)} className="text-blue-600 hover:underline font-medium">Create New Request?</button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <div className="text-xs font-semibold text-gray-700">Create new request in selected department:</div>
                                <input
                                    className="text-sm border-gray-300 rounded-md"
                                    placeholder="Task Title (e.g. Order Bricks)"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setCreateMode(false)} className="text-xs text-gray-500">Back</button>
                                    <button onClick={handleCreateAndLink} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Create & Link</button>
                                </div>
                            </div>
                        )}

                        <div className="mt-2 text-right">
                            <button onClick={() => { setIsAdding(false); setCreateMode(false); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    {loading ? <Spinner /> : blockers.length === 0 ? (
                        <div className="text-sm text-gray-400 italic">No blocking tasks.</div>
                    ) : (
                        blockers.map(t => (
                            <div key={t.id} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">{t.title}</div>
                                    <div className="text-xs text-gray-500 flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${t.status === 'done' ? 'bg-green-500' : 'bg-orange-500'}`} />
                                        {t.department?.name || 'Same Dept'} • {t.status}
                                    </div>
                                </div>
                                <button onClick={() => handleRemove(t.id)} className="text-gray-400 hover:text-red-500 p-1">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Blocking (Dependents) - Read Only for now roughly */}
            <div className="opacity-75">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Blocking (Dependents)</h3>
                <div className="space-y-2">
                    {dependents.length === 0 ? (
                        <div className="text-sm text-gray-400 italic">This task is not blocking anyone.</div>
                    ) : (
                        dependents.map(t => (
                            <div key={t.id} className="flex items-center justify-between p-2 bg-gray-50 border border-gray-200 rounded-lg">
                                <div className="min-w-0">
                                    <div className="text-sm text-gray-700 truncate">{t.title}</div>
                                    <div className="text-xs text-gray-500">{t.department?.name}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
