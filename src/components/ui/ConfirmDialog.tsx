import React, { useEffect, useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = 'Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const [entered, setEntered] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(t);
    } else {
      setEntered(false);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const handleConfirm = async () => {
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-150 ${entered ? 'opacity-100' : 'opacity-0'}`} onClick={onCancel} />
      <div className={`relative z-10 w-full max-w-md bg-white rounded-lg shadow-lg border border-gray-200 p-4 transition-transform duration-150 ${entered ? 'scale-100' : 'scale-95'}`}>
        <div className="text-lg font-semibold mb-2">{title}</div>
        {message && <div className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">{message}</div>}
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1.5 text-sm rounded border" onClick={onCancel} disabled={busy}>{cancelText}</button>
          <button
            className={`px-3 py-1.5 text-sm rounded text-white ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? 'Please wait…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

