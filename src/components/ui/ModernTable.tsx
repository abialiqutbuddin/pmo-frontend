import React, { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

export interface Column<T> {
    header: string;
    accessorKey?: keyof T;
    cell?: (item: T) => ReactNode;
    className?: string;
    headerClassName?: string;
}

export interface ModernTableProps<T> {
    data: T[];
    columns: Column<T>[];
    keyField: keyof T;
    selectedIds?: Set<string>;
    onSelect?: (id: string, selected: boolean) => void;
    onSelectAll?: (selected: boolean) => void;
    onRowClick?: (item: T) => void;
    isLoading?: boolean;
    pagination?: {
        page: number;
        pageSize: number;
        total: number;
        onChangePage: (page: number) => void;
    };
}

export function ModernTable<T>({
    data,
    columns,
    keyField,
    selectedIds,
    onSelect,
    onSelectAll,
    onRowClick,
    isLoading,
    pagination,
}: ModernTableProps<T>) {

    const allSelected = data.length > 0 && data.every((item) => selectedIds?.has(String(item[keyField])));
    const params = new URLSearchParams(window.location.search);

    // Calculate pagination range
    const start = pagination ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
    const end = pagination ? Math.min(pagination.page * pagination.pageSize, pagination.total) : data.length;

    if (isLoading) {
        return (
            <div className="w-full bg-white rounded-xl border border-gray-100 p-8 space-y-4">
                <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                        <div className="space-y-3">
                            <div className="h-12 bg-gray-50 rounded"></div>
                            <div className="h-12 bg-gray-50 rounded"></div>
                            <div className="h-12 bg-gray-50 rounded"></div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50/50">
                            {onSelect && (
                                <th className="py-3 pl-4 pr-2 w-10 border-r border-gray-200">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        checked={allSelected}
                                        onChange={(e) => onSelectAll?.(e.target.checked)}
                                    />
                                </th>
                            )}
                            {columns.map((col, idx) => (
                                <th
                                    key={idx}
                                    className={`py-3 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap border-r border-gray-200 last:border-r-0 ${col.headerClassName || ''}`}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length + (onSelect ? 1 : 0)} className="py-12 text-center text-gray-400 text-sm">
                                    No data found
                                </td>
                            </tr>
                        ) : (
                            data.map((item, rowIdx) => {
                                const id = String(item[keyField]);
                                const isSelected = selectedIds?.has(id);

                                return (
                                    <tr
                                        key={id}
                                        onClick={() => onRowClick?.(item)}
                                        className={`group transition-colors border-b border-gray-200 last:border-0 cursor-default ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : 'hover:bg-gray-50'
                                            }`}
                                    >
                                        {onSelect && (
                                            <td className="py-2.5 pl-4 pr-2 w-10 border-r border-gray-200" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    checked={isSelected}
                                                    onChange={(e) => onSelect?.(id, e.target.checked)}
                                                />
                                            </td>
                                        )}
                                        {columns.map((col, colIdx) => (
                                            <td
                                                key={colIdx}
                                                className={`py-2.5 px-3 text-sm text-gray-900 align-middle border-r border-gray-200 last:border-r-0 ${col.className || ''}`}
                                            >
                                                {col.cell
                                                    ? col.cell(item)
                                                    : col.accessorKey
                                                        ? String(item[col.accessorKey] ?? '—')
                                                        : null}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            {pagination && pagination.total > 0 && (
                <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="px-3 py-1 bg-white border border-gray-200 rounded text-sm font-medium text-gray-700 min-w-[2rem] text-center">
                            {pagination.pageSize}
                        </div>
                        <div className="text-sm text-gray-500">
                            Results: <span className="font-medium text-gray-900">{start} - {end}</span> of <span className="font-medium text-gray-900">{pagination.total}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => pagination.onChangePage(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={16} /> Previous
                        </button>
                        <div className="px-3 py-1 bg-white border border-gray-200 rounded text-sm font-medium text-gray-900">
                            {pagination.page}
                        </div>
                        <button
                            onClick={() => pagination.onChangePage(pagination.page + 1)}
                            disabled={end >= pagination.total}
                            className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ---- Sub-components for styling cells ----

export const TableStatusPill = ({
    status,
    label,
    dotColor = 'bg-gray-400',
}: {
    status?: string | boolean;
    label?: string;
    dotColor?: string;
}) => {
    return (
        <div className="inline-flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
            <span className="text-sm font-medium text-gray-700">{label || String(status)}</span>
        </div>
    );
};

export const TableBadge = ({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) => {
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${className || 'bg-gray-100 text-gray-800'}`}>
            {children}
        </span>
    );
};

export const TableUserCell = ({
    name,
    subtext,
    avatarUrl,
}: {
    name: string;
    subtext?: string;
    avatarUrl?: string | null;
}) => {
    return (
        <div className="flex items-center gap-3">
            {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full bg-gray-100 object-cover" />
            ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                    {name.charAt(0).toUpperCase()}
                </div>
            )}
            <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900">{name}</span>
                {subtext && <span className="text-xs text-gray-500">{subtext}</span>}
            </div>
        </div>
    );
};

export const TableTitleCell = ({
    title,
    subtitle,
}: {
    title: string;
    subtitle?: string;
}) => {
    return (
        <div className="flex flex-col py-1">
            <span className="text-sm font-semibold text-gray-900">{title}</span>
            {subtitle && <span className="text-xs text-gray-400 mt-0.5">{subtitle}</span>}
        </div>
    );
};
