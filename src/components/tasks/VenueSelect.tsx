import React, { useEffect, useRef, useState } from 'react';
import { venuesService, type VenueItem } from '../../services/venues';

type Props = {
  eventId: string;
  value?: string;
  onChange: (venueId: string) => void;
  label?: string;
};

export const VenueSelect: React.FC<Props> = ({ eventId, value, onChange, label }) => {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<VenueItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      try {
        const rows = await venuesService.list(eventId, q.trim() || undefined);
        if (!mounted) return;
        setItems(rows);
      } finally {
        setLoading(false);
      }
    }
    run();
    return () => { mounted = false };
  }, [eventId, q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selected = items.find(x => x.id === value);
  const showAdd = q.trim().length > 0 && !items.some(x => x.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <div className="relative" ref={wrapRef}>
      {label && <label className="block text-sm mb-1">{label}</label>}
      <div className="flex gap-2">
        <input
          className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          placeholder="Search or add venue"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-sm max-h-60 overflow-auto">
          {loading && <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>}
          {!loading && items.map((it) => (
            <button
              key={it.id}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${it.id===value ? 'bg-blue-50' : ''}`}
              onClick={() => { onChange(it.id); setQ(it.name); setOpen(false); }}
            >
              {it.name}
            </button>
          ))}
          {!loading && showAdd && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
              onClick={async () => {
                const name = q.trim();
                if (!name) return;
                const created = await venuesService.create(eventId, name);
                setItems((prev) => {
                  const next = [...prev, created].sort((a,b)=> a.name.localeCompare(b.name));
                  return next;
                });
                onChange(created.id);
                setQ(created.name);
                setOpen(false);
              }}
            >
              + Add "{q.trim()}"
            </button>
          )}
          {!loading && items.length === 0 && !showAdd && (
            <div className="px-3 py-2 text-sm text-gray-500">No venues</div>
          )}
        </div>
      )}
      {selected && (
        <div className="mt-1 text-xs text-gray-500">Selected: {selected.name}</div>
      )}
    </div>
  );
};

