import React, { useEffect, useState } from 'react';

interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  header?: React.ReactNode;
  maxWidthClass?: string; // e.g., 'max-w-2xl'
  children: React.ReactNode;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({ open, onClose, header, maxWidthClass = 'max-w-2xl', children }) => {
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setClosing(false);
      const t = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(t);
    } else {
      setEntered(false);
      setClosing(false);
    }
  }, [open]);

  if (!open && !closing) return null;

  const handleClose = () => {
    setClosing(true);
    setEntered(false);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end items-center">
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] ${entered && !closing ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <div
        className={`relative h-[calc(100%-2rem)] mt-4 mb-4 mr-4 w-full ${maxWidthClass} bg-white shadow-xl border border-gray-200 flex flex-col rounded-xl transform transition-all duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)] ${entered && !closing ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
      >
        {header && (
          <div className="p-5 border-b border-gray-200 flex items-start justify-between rounded-t-xl">
            <div className="min-w-0">{header}</div>
            <button className="p-2 rounded hover:bg-gray-100" onClick={handleClose} title="Close" aria-label="Close drawer">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

