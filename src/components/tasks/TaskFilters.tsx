import React, { useState, useRef, useEffect } from 'react';
import { Filter, X, Calendar, RotateCcw } from 'lucide-react';
import { ModernSelect } from '../ui/ModernSelect';
import { ModernMultiSelect } from '../ui/ModernMultiSelect';
import { ModernInput } from '../ui/ModernInput';
import { UserAvatar } from '../ui/UserAvatar'; // Assuming this exists or similar

interface TaskFiltersProps {
    // Department - now multi-select
    deptIds: string[];
    onChangeDepts: (ids: string[]) => void;
    deptOptions: { value: string; label: string }[];

    // Status - now multi-select
    statusFilters: string[];
    onChangeStatuses: (statuses: string[]) => void;
    statusOptions: { value: string; label: string }[];

    // Assignee (keeping single select)
    memberFilter?: string;
    onChangeMember: (id: string) => void;
    memberOptions: { value: string; label: string }[];

    // Date Range
    dateRange: { from?: string; to?: string };
    onChangeDateRange: (range: { from?: string; to?: string }) => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
    deptIds, onChangeDepts, deptOptions,
    statusFilters, onChangeStatuses, statusOptions,
    memberFilter, onChangeMember, memberOptions,
    dateRange, onChangeDateRange
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                // If clicking inside a known portal dropdown, ignore
                if ((event.target as HTMLElement).closest('.portal-dropdown')) return;
                setIsOpen(false);
            }
        }
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Helpers to count active filters
    const activeCount = [
        deptIds.length > 0,
        statusFilters.length > 0,
        memberFilter && memberFilter !== 'all',
        dateRange.from || dateRange.to
    ].filter(Boolean).length;

    const handleResetAll = () => {
        onChangeDepts([]);
        onChangeStatuses([]);
        onChangeMember('all');
        onChangeDateRange({ from: '', to: '' });
    };

    return (
        <div className="relative inline-block text-left" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors
          ${isOpen || activeCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
                <Filter size={16} />
                <span>Filters</span>
                {activeCount > 0 && (
                    <span className="flex items-center justify-center bg-blue-600 text-white text-[10px] w-5 h-5 rounded-full">
                        {activeCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-900">Filter Tasks</h3>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-4 space-y-5 max-h-[70vh] overflow-y-auto">

                        {/* Date Range */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700">Due Date Range</label>
                                {(dateRange.from || dateRange.to) && (
                                    <button
                                        onClick={() => onChangeDateRange({ from: '', to: '' })}
                                        className="text-xs text-blue-600 hover:text-blue-700"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <ModernInput
                                    label="From"
                                    type="date"
                                    value={dateRange.from || ''}
                                    onChange={(e) => onChangeDateRange({ ...dateRange, from: e.target.value })}
                                />
                                <ModernInput
                                    label="To"
                                    type="date"
                                    value={dateRange.to || ''}
                                    onChange={(e) => onChangeDateRange({ ...dateRange, to: e.target.value })}
                                />
                            </div>
                        </div>

                        <hr className="border-gray-100" />

                        {/* Department - Multi-select */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700">Department</label>
                            </div>
                            <ModernMultiSelect
                                values={deptIds}
                                onChange={onChangeDepts}
                                options={deptOptions}
                                placeholder="All Departments"
                                searchable
                                fullWidth
                            />
                        </div>

                        <hr className="border-gray-100" />

                        {/* Status - Multi-select */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700">Status</label>
                                {statusFilters.length > 0 && (
                                    <button
                                        onClick={() => onChangeStatuses([])}
                                        className="text-xs text-blue-600 hover:text-blue-700"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                            <ModernMultiSelect
                                values={statusFilters}
                                onChange={onChangeStatuses}
                                options={statusOptions}
                                placeholder="All Status"
                                fullWidth
                            />
                        </div>

                        <hr className="border-gray-100" />

                        {/* Assignee */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700">Assignee</label>
                                {memberFilter && memberFilter !== 'all' && (
                                    <button
                                        onClick={() => onChangeMember('all')}
                                        className="text-xs text-blue-600 hover:text-blue-700"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                            <ModernSelect
                                value={memberFilter || 'all'}
                                onChange={onChangeMember}
                                options={memberOptions}
                                searchable
                                fullWidth
                                renderOption={(opt) => (
                                    <div className="flex items-center gap-2">
                                        {opt.value !== 'all' ? <UserAvatar nameOrEmail={opt.label} size={20} className="w-5 h-5 text-[10px]" /> : <div className="w-5" />}
                                        <span>{opt.label}</span>
                                    </div>
                                )}
                            />
                        </div>

                    </div>

                    <div className="p-4 bg-gray-50 rounded-b-xl border-t border-gray-100 flex justify-between items-center">
                        <button
                            onClick={handleResetAll}
                            className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 bg-white px-3 py-1.5 rounded-lg shadow-sm"
                        >
                            Reset all
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-sm text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 rounded-lg shadow-sm font-medium"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
