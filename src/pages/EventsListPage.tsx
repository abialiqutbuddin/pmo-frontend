// frontend/src/pages/EventsListPage.tsx
import React, { useEffect, useState } from 'react';
import { Spinner } from '../components/ui/Spinner';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { EventSummary } from '../types/events';
import { useContextStore } from '../store/contextStore';
import { useAuthStore } from '../store/authStore';
import { CalendarCheck2 } from 'lucide-react';

function formatDateTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

export const EventsListPage: React.FC = () => {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const navigate = useNavigate();
  const { currentEventId, selectEvent } = useContextStore();
  const isSuperAdmin = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api
      .get<EventSummary[]>('/events')
      .then((data) => mounted && setEvents(data || []))
      .catch((e) => mounted && setErr(e?.message || 'Failed to load events'))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Events</h1>
        {isSuperAdmin && (
          <Link
            to="/events/new"
            className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 text-sm font-medium"
            title="Create a new event"
          >
            New Event
          </Link>
        )}
      </div>

      {loading && <div className="py-6"><Spinner label="Loading events" /></div>}

      {!loading && err && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{err}</div>
      )}

      {!loading && !err && events.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-600">
          <div className="text-lg font-medium mb-2">No events yet</div>
          <div className="mb-4">Create your first event to get started.</div>
          <Link
            to="/events/new"
            className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 text-sm font-medium"
          >
            Create Event
          </Link>
        </div>
      )}

      {!loading && !err && events.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-semibold">{ev.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {ev.startsAt || ev.endsAt
                      ? `${formatDateTime(ev.startsAt)}${ev.endsAt ? ` → ${formatDateTime(ev.endsAt)}` : ''}`
                      : 'No schedule set'}
                  </div>
                </div>
                {currentEventId === ev.id && (
                  <div className="text-emerald-600 flex items-center text-xs font-medium" title="Currently selected">
                    <CalendarCheck2 size={16} className="mr-1" /> Active
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-3">Created: {formatDateTime(ev.createdAt)}</div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  className="inline-flex items-center bg-gray-900 hover:bg-black text-white rounded-md px-3 py-1.5 text-sm"
                  onClick={async () => {
                    await selectEvent(ev.id, ev.name);
                    navigate('/dashboard');
                  }}
                  title="Use this event"
                >
                  Select
                </button>
                {isSuperAdmin && (
                  <button
                    className="text-sm text-blue-600 hover:underline"
                    onClick={async () => {
                      await selectEvent(ev.id, ev.name);
                      navigate('/admin');
                    }}
                    title="Manage this event"
                  >
                    Manage
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
