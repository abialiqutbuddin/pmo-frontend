import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface MultiSelectOption<T extends string | number = string> {
    value: T;
    label: string;
    disabled?: boolean;
}

interface ModernMultiSelectProps<T extends string | number = string> {
    values: T[];
    onChange: (values: T[]) => void;
    options: MultiSelectOption<T>[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    searchable?: boolean;
    fullWidth?: boolean;
    maxDisplayItems?: number;
}

export function ModernMultiSelect<T extends string | number = string>({
    values,
    onChange,
    options,
    placeholder = 'Select...',
    disabled,
    className = '',
    searchable,
    fullWidth,
    maxDisplayItems = 2,
}: ModernMultiSelectProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [q, setQ] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState<{ top: number; left: number; width: number; isUpwards?: boolean }>({ top: 0, left: 0, width: 0 });

    const selectedOptions = options.filter(o => values.includes(o.value));

    // Position calculation removed (handled on click)

    // Handle outside click including portal
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target as Node) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            const closeOnScroll = (e: Event) => {
                const target = e.target as HTMLElement;
                if (dropdownRef.current && dropdownRef.current.contains(target)) {
                    return;
                }
                setIsOpen(false);
            };
            window.addEventListener('scroll', closeOnScroll, { capture: true });
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
                window.removeEventListener('scroll', closeOnScroll, { capture: true });
            };
        }
    }, [isOpen]);

    // Focus search when opening
    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [isOpen, searchable]);

    const filteredOptions = searchable && q.trim()
        ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
        : options;

    const handleToggle = (optionValue: T) => {
        if (values.includes(optionValue)) {
            onChange(values.filter(v => v !== optionValue));
        } else {
            onChange([...values, optionValue]);
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([]);
    };

    // Display text
    const getDisplayText = () => {
        if (selectedOptions.length === 0) return placeholder;
        if (selectedOptions.length <= maxDisplayItems) {
            return selectedOptions.map(o => o.label).join(', ');
        }
        return `${selectedOptions.length} selected`;
    };

    const dropdown = isOpen && createPortal(
        <div
            ref={dropdownRef}
            style={{
                position: 'absolute',
                top: coords.top,
                left: coords.left,
                width: coords.width,
                zIndex: 9999,
                transform: coords.isUpwards ? 'translateY(-100%)' : 'none'
            }}
            className="portal-dropdown bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
            {/* Search */}
            {searchable && (
                <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder="Search..."
                            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                </div>
            )}
            {/* Options */}
            <div className="py-1">
                {/* Select All Option */}
                {filteredOptions.length > 0 && (
                    <div
                        onClick={() => {
                            const allValues = filteredOptions.filter(o => !o.disabled).map(o => o.value);
                            const allSelected = allValues.every(v => values.includes(v));
                            if (allSelected) {
                                // Unselect all visible
                                onChange(values.filter(v => !allValues.includes(v)));
                            } else {
                                // Select all visible
                                const newValues = [...values];
                                allValues.forEach(v => {
                                    if (!newValues.includes(v)) newValues.push(v);
                                });
                                onChange(newValues);
                            }
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-gray-50 border-b border-gray-100 mb-1"
                    >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${filteredOptions.every(o => o.disabled || values.includes(o.value))
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300'
                            }`}>
                            {filteredOptions.every(o => o.disabled || values.includes(o.value)) && <Check size={12} className="text-white" />}
                        </div>
                        <span className="font-medium text-blue-600">Select All</span>
                    </div>
                )}

                {filteredOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-400">No options</div>
                ) : (
                    filteredOptions.map(option => {
                        const isSelected = values.includes(option.value);
                        return (
                            <div
                                key={String(option.value)}
                                onClick={() => !option.disabled && handleToggle(option.value)}
                                className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${option.disabled
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:bg-gray-50'
                                    }`}
                            >
                                {/* Checkbox */}
                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected
                                    ? 'bg-blue-600 border-blue-600'
                                    : 'border-gray-300'
                                    }`}>
                                    {isSelected && <Check size={12} className="text-white" />}
                                </div>
                                <span className="truncate">{option.label}</span>
                            </div>
                        );
                    })
                )}
            </div>
        </div>,
        document.body
    );

    return (
        <>
            <div ref={containerRef} className={`relative ${fullWidth ? 'w-full' : ''} ${className}`}>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                        if (disabled) return;
                        if (!isOpen && containerRef.current) {
                            const rect = containerRef.current.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const openUpwards = spaceBelow < 350;

                            setCoords({
                                top: openUpwards ? rect.top + window.scrollY - 4 : rect.bottom + window.scrollY + 4,
                                left: rect.left + window.scrollX,
                                width: rect.width,
                                isUpwards: openUpwards
                            });
                        }
                        setIsOpen(!isOpen);
                    }}
                    className={`flex items-center justify-between gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white transition-colors ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-gray-300'
                        } ${fullWidth ? 'w-full' : 'min-w-[140px]'}`}
                >
                    <span className={`truncate ${selectedOptions.length === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
                        {getDisplayText()}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                        {selectedOptions.length > 0 && (
                            <X
                                size={14}
                                className="text-gray-400 hover:text-gray-600 cursor-pointer"
                                onClick={handleClear}
                            />
                        )}
                        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </button>
            </div>
            {dropdown}
        </>
    );
}
