import React, { useState, useEffect } from 'react';
import { tasksService } from '../../services/tasks';
import { api } from '../../api';
import { departmentsService } from '../../services/departments';
import { Search, Plus, Link2 } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import { ModernInput } from '../ui/ModernInput';
import { ModernSelect } from '../ui/ModernSelect';

interface DependencyTask {
    id: string;
    title: string;
    status: string;
    department?: { id: string; name: string };
}

interface DependencySelectorProps {
    eventId: string;
    currentDeptId: string; // The department of the task being created/edited (to filter scope if needed)
    selectedIds: string[]; // IDs already selected
    onSelect: (task: DependencyTask) => void;
}

export const DependencySelector: React.FC<DependencySelectorProps> = ({ eventId, currentDeptId, selectedIds, onSelect }) => {
    const [targetDeptId, setTargetDeptId] = useState(currentDeptId);
    const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<DependencyTask[]>([]);
    const [searching, setSearching] = useState(false);
    const [loadingDepts, setLoadingDepts] = useState(false);

    // Create Mode
    const [createMode, setCreateMode] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (!eventId) return;
        setLoadingDepts(true);
        departmentsService.list(eventId)
            .then(depts => {
                setDepartments(depts);
                if (depts.length > 0 && !targetDeptId) setTargetDeptId(depts[0].id);
            })
            .catch(() => { })
            .finally(() => setLoadingDepts(false));
    }, [eventId]);

    const handleSearch = async () => {
        // Context ID is needed for the URL. Use current or target or fallback to first dept.
        const contextId = currentDeptId || targetDeptId || (departments.length > 0 ? departments[0].id : '');
        if (!contextId) return; // Can't search without a valid path context

        setSearching(true);
        try {
            const res = await tasksService.search(eventId, contextId, searchQuery, targetDeptId || contextId);
            // Filter out already selected tasks
            setSearchResults(res.filter((t: any) => !selectedIds.includes(t.id)));
        } catch (e) {
            console.error('Search failed', e);
        } finally {
            setSearching(false);
        }
    };


    // Auto-search on mount or when dept changes (eager loading)
    useEffect(() => {
        if (eventId && departments.length > 0) {
            handleSearch();
        }
    }, [departments, currentDeptId, targetDeptId]); // Added targetDeptId to refresh list on dropdown change

    const handleCreateLink = async () => {
        if (!newTaskTitle.trim() || !targetDeptId) return;
        setCreating(true);
        try {
            const newTask = await tasksService.create(eventId, targetDeptId, {
                title: newTaskTitle,
                priority: 3
            });
            onSelect({ id: newTask.id, title: newTask.title, status: newTask.status, department: { id: targetDeptId, name: departments.find(d => d.id === targetDeptId)?.name || 'Unknown' } });
            api.post<void>(`/events/${eventId}/departments/${targetDeptId}/tasks/${newTask.id}/dependencies`, { blockerId: newTask.id }).catch(() => { });
            setCreateMode(false);
            setNewTaskTitle('');
        } catch (e) {
            console.error('Failed to create task', e);
            alert('Failed to create task');
        } finally {
            setCreating(false);
            // Optionally refresh search results to show it? No need, it is already selected.
        }
    };

    if (createMode) {
        return (
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="text-sm font-semibold text-gray-800 mb-3">Create New Blocker Task</div>
                <div className="flex flex-col gap-3">
                    <ModernSelect
                        value={targetDeptId}
                        onChange={(v) => setTargetDeptId(v)}
                        options={departments.map(d => ({ value: d.id, label: d.name }))}
                        disabled={true} // Lock to current selection context for simplicity? Or allow change? Original was disabled.
                        className="w-full"
                    />
                    <ModernInput
                        placeholder="New Task Title..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        autoFocus
                        fullWidth
                    />
                    <div className="flex justify-end gap-2 mt-1">
                        <button
                            onClick={() => setCreateMode(false)}
                            className="text-xs text-gray-600 font-medium px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateLink}
                            disabled={creating || !newTaskTitle.trim()}
                            className="text-xs bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors shadow-sm"
                        >
                            {creating ? 'Creating...' : 'Create & Link'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                    <div className="w-1/3 min-w-[120px]">
                        <ModernSelect
                            value={targetDeptId}
                            onChange={(v) => setTargetDeptId(v)}
                            options={loadingDepts ? [{ value: '', label: 'Loading...' }] : departments.map(d => ({ value: d.id, label: d.name }))}
                            disabled={loadingDepts}
                            placeholder="Select Dept..."
                            fullWidth
                        />
                    </div>
                    <div className="flex-1">
                        <ModernInput
                            placeholder="Search by title..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            icon={<Search size={14} />}
                            fullWidth
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleSearch}
                        className="px-4 bg-gray-100 border border-gray-200 rounded-xl text-xs font-semibold hover:bg-gray-200 text-gray-700 transition-colors"
                    >
                        Find
                    </button>
                </div>
            </div>

            {searching && <div className="mt-6 flex justify-center"><Spinner size="sm" /></div>}

            {!searching && searchResults.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Search Results</div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200">
                        {searchResults.map(res => (
                            <button
                                key={res.id}
                                type="button"
                                className="w-full flex items-center justify-between p-2.5 bg-gray-50 border border-gray-100 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all text-left group"
                                onClick={() => {
                                    onSelect(res);
                                    setSearchResults(prev => prev.filter(p => p.id !== res.id));
                                }}
                            >
                                <div className="min-w-0 flex-1 mr-3">
                                    <div className="text-sm font-medium text-gray-900 truncate">{res.title}</div>
                                    <div className="text-[11px] text-gray-500 mt-0.5">{res.status}</div>
                                </div>
                                <div className="flex items-center text-blue-600 opacity-0 group-hover:opacity-100 font-medium text-xs bg-blue-100 px-2 py-1 rounded-md">
                                    Link <Link2 size={12} className="ml-1" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {!searching && searchQuery && searchResults.length === 0 && (
                <div className="mt-4 text-sm text-gray-500 italic text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    No tasks found.
                    <button onClick={() => setCreateMode(true)} className="block mx-auto mt-2 text-blue-600 hover:text-blue-700 font-medium text-xs">
                        Create New Task?
                    </button>
                </div>
            )}

            {/* Find Link for explicit create action even if results exist */}
            {!searching && !createMode && searchResults.length > 0 && (
                <div className="mt-3 text-[11px] text-right">
                    <button onClick={() => setCreateMode(true)} className="text-blue-600 hover:text-blue-700 font-medium flex items-center justify-end w-full gap-1 hover:underline">
                        <Plus size={12} /> Create new task in this dept
                    </button>
                </div>
            )}

            {!searching && !createMode && !searchQuery && searchResults.length === 0 && (
                <div className="mt-3 text-[11px] text-right">
                    <button onClick={() => setCreateMode(true)} className="text-blue-600 hover:text-blue-700 font-medium flex items-center justify-end w-full gap-1 hover:underline">
                        <Plus size={12} /> Create new task
                    </button>
                </div>
            )}
        </div>
    );
};
