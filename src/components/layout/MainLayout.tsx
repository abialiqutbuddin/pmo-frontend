import React from 'react';
import { Outlet } from 'react-router-dom';
import { MainSidebar } from './MainSidebar';
import { EventHeader } from './EventHeader';
import { Breadcrumbs } from './Breadcrumbs';

export const MainLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Main Navigation Sidebar */}
      <MainSidebar />

      {/* Content Area */}
      <main className="flex-1 h-screen flex flex-col overflow-hidden">
        {/* Top bar with current event + department */}
        <EventHeader />
        <Breadcrumbs />

        {/* Active page content fills remaining height */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
