// frontend/src/pages/EventCreatePage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsService } from '../services/events';

function toIsoOrUndefined(v: string) {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export const EventCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [structure, setStructure] = useState<'ZONAL' | 'HIERARCHICAL'>('ZONAL');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      await eventsService.create({
        name,
        startsAt: toIsoOrUndefined(startsAt),
        endsAt: toIsoOrUndefined(endsAt),
        structure,
      });
      navigate('/events', { replace: true });
    } catch (e: any) {
      setErr(e?.message || 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Create Event</h1>

      {err && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</div>
      )}

      <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-lg p-6 max-w-xl space-y-4">
        <div>
          <label className="block text-sm mb-1">Event Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="e.g., City Marathon 2025"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Event Structure</label>
          <select
            value={structure}
            onChange={(e) => setStructure(e.target.value as 'ZONAL' | 'HIERARCHICAL')}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="ZONAL">Zonal (Central + Zone-based departments)</option>
            <option value="HIERARCHICAL">Hierarchical (Nested department structure)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            {structure === 'ZONAL'
              ? 'Best for events with geographic zones and zone-specific teams'
              : 'Best for events with parent-child department relationships'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Starts At</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Ends At</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 text-sm font-medium"
          >
            {submitting ? 'Creating…' : 'Create Event'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/events')}
            className="text-gray-600 hover:text-gray-800 rounded-md px-3 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
