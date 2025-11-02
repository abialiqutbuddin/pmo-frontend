// frontend/src/components/layout/Breadcrumbs.tsx
import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useContextStore } from '../../store/contextStore';

type Crumb = { label: string; to?: string };

export const Breadcrumbs: React.FC = () => {
  const { pathname } = useLocation();
  const params = useParams<{ departmentId?: string }>();
  const { currentEventName, departments } = useContextStore();

  const deptName = params.departmentId
    ? departments.find((d) => d.id === params.departmentId)?.name || 'Department'
    : undefined;

  const items: Crumb[] = [];

  if (pathname.startsWith('/events')) {
    items.push({ label: 'Events', to: '/events' });
    if (pathname === '/events/new') items.push({ label: 'New' });
  } else if (pathname.startsWith('/admin/users')) {
    items.push({ label: 'Users' });
  } else if (pathname.startsWith('/admin')) {
    items.push({ label: 'Events', to: '/events' });
    items.push({ label: currentEventName || 'Event', to: '/dashboard' });
    items.push({ label: 'Manage' });
    if (params.departmentId) items.push({ label: deptName! });
  } else if (pathname.startsWith('/me/department')) {
    items.push({ label: 'Department' });
  } else if (pathname.startsWith('/chat')) {
    items.push({ label: 'Chat' });
  } else if (pathname.startsWith('/tasks')) {
    items.push({ label: 'Tasks' });
  } else if (pathname.startsWith('/issues')) {
    items.push({ label: 'Issues' });
  } else if (pathname.startsWith('/gantt')) {
    items.push({ label: 'Gantt' });
  } else if (pathname.startsWith('/settings')) {
    items.push({ label: 'Settings' });
  } else if (pathname.startsWith('/dashboard')) {
    items.push({ label: 'Dashboard' });
  }

  if (items.length === 0) return null;

  return (
    <nav className="px-6 py-2 bg-white border-b border-gray-200 text-sm" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2 text-gray-600">
        {items.map((c, idx) => (
          <li key={idx} className="flex items-center">
            {c.to ? (
              <Link className="hover:text-gray-900" to={c.to}>
                {c.label}
              </Link>
            ) : (
              <span className="text-gray-800">{c.label}</span>
            )}
            {idx < items.length - 1 && <span className="mx-2 text-gray-400">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
};

