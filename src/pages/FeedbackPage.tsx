import React, { useEffect, useMemo, useState } from 'react';
import { Page } from '../components/layout/Page';
import { useContextStore } from '../store/contextStore';
import { feedbackService, type FeedbackItem } from '../services/feedback';
import { venuesService } from '../services/venues';
import { Calendar } from 'lucide-react';

function fmt(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export const FeedbackPage: React.FC = () => {
  const { currentEventId } = useContextStore();
  const [rows, setRows] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [venueNameById, setVenueNameById] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!currentEventId) return;
      setLoading(true);
      setErr(null);
      try {
        const [list, venues] = await Promise.all([
          feedbackService.list(currentEventId),
          venuesService.list(currentEventId).catch(() => []),
        ]);
        if (!mounted) return;
        setRows(list || []);
        const map: Record<string, string> = {};
        for (const v of venues || []) map[v.id] = v.name;
        setVenueNameById(map);
      } catch (e: any) {
        setErr(e?.message || 'Failed to load feedback');
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { mounted = false };
  }, [currentEventId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      (r.name || '').toLowerCase().includes(term) ||
      (r.email || '').toLowerCase().includes(term) ||
      (r.phone || '').toLowerCase().includes(term) ||
      (r.description || '').toLowerCase().includes(term) ||
      (r.venueId && (venueNameById[r.venueId] || r.venueId).toLowerCase().includes(term))
    );
  }, [rows, q, venueNameById]);

  return (
    <Page>
      <div className="flex items-center mb-4">
        <h1 className="text-2xl font-semibold">Feedback</h1>
        <div className="ml-auto">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search feedback"
            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>
      {err && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded p-3 mb-3">{err}</div>}
      {loading && <div className="text-sm text-gray-600">Loading…</div>}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm table-auto">
          <colgroup>
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 text-gray-600">Name</th>
              <th className="text-left px-4 py-2 text-gray-600">Contact</th>
              <th className="text-left px-4 py-2 text-gray-600">Date</th>
              <th className="text-left px-4 py-2 text-gray-600">Venue</th>
              <th className="text-left px-4 py-2 text-gray-600">Description</th>
              <th className="text-left px-4 py-2 text-gray-600">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b last:border-0 align-top">
                <td className="px-4 py-2">{r.name || '—'}</td>
                <td className="px-4 py-2">
                  <div className="text-xs text-gray-700">{r.email || '—'}</div>
                  <div className="text-xs text-gray-500">{r.phone || ''}</div>
                </td>
                <td className="px-4 py-2"><span className="inline-flex items-center text-gray-700"><Calendar size={14} className="mr-1" />{fmt(r.dateOccurred) || '—'}</span></td>
                <td className="px-4 py-2">{r.venueId ? (venueNameById[r.venueId] || r.venueId) : '—'}</td>
                <td className="px-4 py-2"><div className="whitespace-pre-wrap break-words text-gray-800 text-sm">{r.description}</div></td>
                <td className="px-4 py-2">{fmt(r.createdAt) || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No feedback found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Page>
  );
};

