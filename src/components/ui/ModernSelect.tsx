import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface ModernSelectOption<T extends string | number | boolean = string> {
    value: T;
    label: string;
    disabled?: boolean;
}

interface ModernSelectProps<T extends string | number | boolean = string> {
    value: T | undefined;
    onChange: (value: T) => void;
    options: ModernSelectOption<T>[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    searchable?: boolean;
    renderTrigger?: (option: ModernSelectOption<T> | undefined) => ReactNode;
    renderOption?: (option: ModernSelectOption<T>, isSelected: boolean) => ReactNode;
    fullWidth?: boolean;
}

export function ModernSelect<T extends string | number | boolean = string>({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    disabled,
    className = '',
    searchable,
    renderTrigger,
    renderOption,
    fullWidth
}: ModernSelectProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [q, setQ] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [coords, setCoords] = useState<{ top: number; left: number; width: number; isUpwards?: boolean }>({ top: 0, left: 0, width: 0 });

    const selectedOption = options.find(o => o.value === value);

    // Close when clicking outside
    useEffect(() => {
        const fn = (e: MouseEvent) => {
            // If clicking inside the container OR inside the portal dropdown (we can allow bubbling to handle this, but portal events bubble to React tree)
            // Actually, since we use Portal, mousedown on the dropdown bubbles to containerRef in React event system? 
            // With native events, it might not.
            // We need a ref for the dropdown content too if we want to check native 'contains'.
            // But simpler: just check if target is NOT in containerRef.
            // Wait, if I click the dropdown in Portal, it is NOT in containerRef.
            // So we need to ignore clicks that are inside the portal.
            // Best way: use a ref for the portal content.
        };
        // Implementation below
    }, []);

    // Position calculation removed (handled on click)

    // Handle outside click including portal
    const dropdownRef = useRef<HTMLDivElement>(null);
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
        if (!isOpen) setQ('');
    }, [isOpen, searchable]);

    const filtered = searchable
        ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
        : options;

    return (
        <div className={`relative ${fullWidth ? 'w-full' : 'inline-block'} ${className}`} ref={containerRef}>
            {/* Trigger */}
            <div
                onClick={() => {
                    if (!disabled) {
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
                    }
                }}
                className={`
          flex items-center justify-between
          bg-white border transition-all cursor-pointer
          ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50 border-gray-200' : 'hover:bg-gray-50'}
          ${isOpen ? 'ring-2 ring-blue-100 border-blue-500 shadow-sm' : 'border-gray-200'}
          rounded-xl px-3 py-2 text-sm min-h-[40px] select-none
        `}
            >
                <div className="flex-1 truncate mr-2">
                    {renderTrigger ? (
                        renderTrigger(selectedOption)
                    ) : (
                        selectedOption ? (
                            <span className="text-gray-900 font-medium">{selectedOption.label}</span>
                        ) : (
                            <span className="text-gray-400 font-medium">{placeholder}</span>
                        )
                    )}
                </div>
                {!disabled && (
                    <ChevronDown
                        size={16}
                        className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                )}
            </div>

            {/* Dropdown Menu via Portal */}
            {isOpen && !disabled && createPortal(
                <div
                    ref={dropdownRef}
                    style={{
                        position: 'absolute',
                        top: coords.top,
                        left: coords.left,
                        width: Math.max(coords.width, 220),
                        zIndex: 9999,
                        transform: coords.isUpwards ? 'translateY(-100%)' : 'none'
                    }}
                    className="portal-dropdown bg-white border border-gray-100 rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-100 origin-top-left overflow-hidden"
                >
                    {searchable && (
                        <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                            <div className="relative">
                                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                                <input
                                    ref={searchInputRef}
                                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
                                    placeholder="Search..."
                                    value={q}
                                    onChange={e => setQ(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                />
                                {q && (
                                    <button onClick={() => setQ('')} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="max-h-[240px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-8 text-center text-sm text-gray-400">
                                No results found
                            </div>
                        ) : (
                            filtered.map((opt) => {
                                const isSelected = opt.value === value;
                                return (
                                    <div
                                        key={String(opt.value)}
                                        onClick={() => {
                                            if (opt.disabled) return;
                                            onChange(opt.value);
                                            setIsOpen(false);
                                        }}
                                        className={`
                      relative flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition select-none
                      ${opt.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 active:bg-gray-100'}
                      ${isSelected ? 'bg-blue-50/60 text-blue-700 font-medium' : 'text-gray-700'}
                    `}
                                    >
                                        <div className="flex-1 mr-3 truncate">
                                            {renderOption ? renderOption(opt, isSelected) : opt.label}
                                        </div>
                                        {isSelected && <Check size={16} className="text-blue-600 flex-shrink-0" />}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
