// frontend/src/components/ui/Dropdown.tsx
import React from 'react';
import { ChevronDown } from 'lucide-react';

export type Option = { value: string; label: string; disabled?: boolean };

interface DropdownProps {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
  fullWidth?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  title,
  fullWidth,
}) => {
  return (
    <div className={fullWidth ? 'w-full relative' : 'relative inline-block'}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={
          className || [
            'appearance-none text-sm rounded-md pl-3 pr-8 py-2',
            'border border-gray-200 bg-gray-50 hover:bg-gray-100',
            'focus:outline-none focus:ring-2 focus:ring-blue-600',
            fullWidth ? 'w-full' : 'max-w-[260px]'
          ].join(' ')
        }
        title={title}
      >
        {placeholder && (
          <option value="" disabled={true}>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
    </div>
  );
};
