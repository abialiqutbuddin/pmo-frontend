import React from 'react';

type Size = 'sm' | 'md' | 'lg';

function sizeToPx(size: Size | number) {
  if (typeof size === 'number') return size;
  return size === 'sm' ? 16 : size === 'md' ? 24 : 32;
}

export const Spinner: React.FC<{
  size?: Size | number;
  label?: string;
  inline?: boolean; // if false, centers in a flex container
  className?: string;
}> = ({ size = 'md', label, inline, className }) => {
  const px = sizeToPx(size);
  const spinner = (
    <div className={`flex items-center ${inline ? '' : 'justify-center'} ${className || ''}`}>
      <div
        className="animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
        style={{ width: px, height: px }}
        aria-label={label || 'Loading'}
        role="status"
      />
      {label && <span className="ml-2 text-sm text-gray-600">{label}</span>}
    </div>
  );
  return spinner;
};

export const SpinnerOverlay: React.FC<{ label?: string }>= ({ label }) => (
  <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
    <Spinner size={32} label={label} />
  </div>
);

