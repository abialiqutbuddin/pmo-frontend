// frontend/src/components/layout/EventHeader.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useContextStore } from '../../store/contextStore';
import { Calendar, Info } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api';
import { Dropdown } from '../ui/Dropdown';

export const EventHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentEventId, currentEventName, refreshContext, selectEvent } = useContextStore();
  const isAuthed = !!useAuthStore((s) => s.accessToken);

  // Load events for dropdown
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!isAuthed) return;
    setLoading(true);
    api
      .get<{ id: string; name: string }[]>('/events')
      .then((list) => mounted && setEvents((list || []).map((e) => ({ id: e.id, name: e.name }))))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [isAuthed]);

  // keep context fresh when event changes
  useEffect(() => {
    if (currentEventId) refreshContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEventId]);

  const onEventsPage = location.pathname.startsWith('/events');

  return (
    <div className="px-6 py-3 border-b border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-4">
        {/* Event selector dropdown */}
        <div className="flex items-center" title="Select event">
          <Calendar size={18} className="text-blue-600 mr-2" />
          <Dropdown
            value={currentEventId ?? ''}
            onChange={async (id) => {
              if (!id) return;
              await selectEvent(id);
              navigate('/dashboard');
            }}
            options={events.map((e) => ({ value: e.id, label: e.name }))}
            placeholder={loading ? 'Loading events…' : 'Select event'}
          />
          {!currentEventId && !onEventsPage && (
            <button
              className="ml-3 text-sm text-blue-600 hover:underline"
              onClick={() => navigate('/events')}
              title="Open events list"
            >
              Browse
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
