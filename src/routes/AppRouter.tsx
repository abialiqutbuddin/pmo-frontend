import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout';
import { ChatPage } from '../pages/ChatPage';
import { LoginPage } from '../pages/LoginPage';
import { EventsListPage } from '../pages/EventsListPage';
import { EventCreatePage } from '../pages/EventCreatePage';
import { useAuthStore } from '../store/authStore';
import { useContextStore } from '../store/contextStore';
import { EventDashboardPage } from '../pages/EventDashboardPage';
import { MyDepartmentPage } from '../pages/MyDepartmentPage';
import { TasksPage } from '../pages/TasksPage';
import { CentralTasksPage } from '../pages/CentralTasksPage';
import { ZonesTasksPage } from '../pages/ZonesTasksPage';
import { AdminPanelPage } from '../pages/AdminPanelPage';
import { ManageDepartmentsPage } from '../pages/ManageDepartmentsPage';
import { ManageZonesPage } from '../pages/ManageZonesPage';
import { EventSelectRedirectPage } from '../pages/EventSelectRedirectPage';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { GanttPage } from '../pages/GanttPage';
import { FeedbackPage } from '../pages/FeedbackPage';
import { SettingsPage } from '../pages/SettingsPage';
import { UserProfilePage } from '../pages/UserProfilePage';

// --- Placeholder pages ---
const DashboardPage = () => <div className="p-8 text-3xl font-bold">Dashboard Page</div>;
// const IssuesPage = () => <div className="p-8 text-3xl font-bold">Issue Center Page</div>;
// removed inline SettingsPage; real page imported

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const RequireEvent: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const eventId = useContextStore((s) => s.currentEventId);
  if (!eventId) return <Navigate to="/events" replace />;
  return children;
};

const RequireAdmin: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const canAdmin = useContextStore((s) => s.canAdminEvent);
  if (!canAdmin) return <Navigate to="/dashboard" replace />;
  return children;
};

const RequireSuperAdmin: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const isSA = !!useAuthStore((s) => s.currentUser?.isSuperAdmin);
  if (!isSA) return <Navigate to="/dashboard" replace />;
  return children;
};

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Auth routes (no sidebar) */}
      <Route path="/login" element={<LoginPage />} />

      {/* Main app with sidebar */}
      <Route path="/" element={<MainLayout />}>
        {/* Redirect root to Events */}
        <Route index element={<Navigate to="/events" replace />} />

        <Route
          path="dashboard"
          element={
            <RequireAuth>
              <RequireEvent>
                <EventDashboardPage />
              </RequireEvent>
            </RequireAuth>
          }
        />
        <Route
          path="chat"
          element={
            <RequireAuth>
              <RequireEvent>
                <ChatPage />
              </RequireEvent>
            </RequireAuth>
          }
        />
        <Route path="tasks" element={<Navigate to="/tasks/central" replace />} />
        <Route
          path="tasks/central"
          element={
            <RequireAuth>
              <RequireEvent>
                <CentralTasksPage />
              </RequireEvent>
            </RequireAuth>
          }
        />
        <Route
          path="tasks/zones"
          element={
            <RequireAuth>
              <RequireEvent>
                <ZonesTasksPage />
              </RequireEvent>
            </RequireAuth>
          }
        />
        <Route
          path="feedback"
          element={
            <RequireAuth>
              <RequireEvent>
                <FeedbackPage />
              </RequireEvent>
            </RequireAuth>
          }
        />
        <Route
          path="gantt"
          element={
            <RequireAuth>
              <RequireEvent>
                <GanttPage />
              </RequireEvent>
            </RequireAuth>
          }
        />
        <Route
          path="settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />

        <Route
          path="profile"
          element={
            <RequireAuth>
              <UserProfilePage />
            </RequireAuth>
          }
        />

        <Route
          path="me/department"
          element={
            <RequireAuth>
              <RequireEvent>
                <MyDepartmentPage />
              </RequireEvent>
            </RequireAuth>
          }
        />

        <Route
          path="admin"
          element={<Navigate to="/admin/settings/departments" replace />}
        />
        <Route path="admin/departments" element={<Navigate to="/admin/settings/departments" replace />} />
        <Route path="admin/departments/:departmentId" element={<Navigate to="/admin/settings/departments" replace />} />

        <Route
          path="admin/settings/departments"
          element={
            <RequireAuth>
              <RequireEvent>
                <RequireAdmin>
                  <ManageDepartmentsPage />
                </RequireAdmin>
              </RequireEvent>
            </RequireAuth>
          }
        />
        <Route
          path="admin/settings/zones"
          element={
            <RequireAuth>
              <RequireEvent>
                <RequireAdmin>
                  <ManageZonesPage />
                </RequireAdmin>
              </RequireEvent>
            </RequireAuth>
          }
        />
        <Route
          path="admin/departments/:departmentId"
          element={
            <RequireAuth>
              <RequireEvent>
                <RequireAdmin>
                  <AdminPanelPage />
                </RequireAdmin>
              </RequireEvent>
            </RequireAuth>
          }
        />
        <Route
          path="admin/users"
          element={
            <RequireAuth>
              <RequireSuperAdmin>
                <AdminUsersPage />
              </RequireSuperAdmin>
            </RequireAuth>
          }
        />

        {/* Events */}
        <Route
          path="events"
          element={
            <RequireAuth>
              <EventsListPage />
            </RequireAuth>
          }
        />
        <Route
          path="events/:eventId"
          element={
            <RequireAuth>
              <EventSelectRedirectPage />
            </RequireAuth>
          }
        />
        <Route
          path="events/new"
          element={
            <RequireAuth>
              <EventCreatePage />
            </RequireAuth>
          }
        />
      </Route>
    </Routes>
  );
};
