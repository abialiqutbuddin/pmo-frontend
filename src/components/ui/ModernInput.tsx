import React, { InputHTMLAttributes, ReactNode, forwardRef } from 'react';

export interface ModernInputProps extends InputHTMLAttributes<HTMLInputElement> {
    icon?: ReactNode;
    label?: ReactNode;
    error?: string;
    fullWidth?: boolean;
}

export const ModernInput = forwardRef<HTMLInputElement, ModernInputProps>(
    ({ className, icon, label, error, fullWidth, ...props }, ref) => {
        return (
            <div className={`${fullWidth ? 'w-full' : 'inline-block'} ${className || ''}`}>
                {label && (
                    <label className="block text-xs font-medium text-gray-700 mb-1.5 ml-0.5">
                        {label}
                    </label>
                )}
                <div className="relative group">
                    {icon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors pointer-events-none">
                            {icon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={`
              w-full bg-white border border-gray-200 rounded-xl py-2 text-sm text-gray-900 placeholder:text-gray-400
              focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10
              transition-all duration-200
              disabled:opacity-60 disabled:bg-gray-50
              ${icon ? 'pl-9 pr-3' : 'px-3'}
              ${error ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10' : 'hover:border-gray-300'}
            `}
                        {...props}
                    />
                </div>
                {error && <p className="mt-1 text-xs text-rose-500 ml-0.5">{error}</p>}
            </div>
        );
    }
);
