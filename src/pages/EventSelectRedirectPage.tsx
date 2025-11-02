// frontend/src/pages/EventSelectRedirectPage.tsx
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContextStore } from '../store/contextStore';

export const EventSelectRedirectPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { selectEvent } = useContextStore();

  useEffect(() => {
    if (eventId) {
      // We don't know the name here; refreshContext will populate it
      selectEvent(eventId).finally(() => navigate('/dashboard', { replace: true }));
    } else {
      navigate('/events', { replace: true });
    }
  }, [eventId, selectEvent, navigate]);

  return <div className="p-6 text-gray-600">Switching event…</div>;
};

