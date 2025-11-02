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
import { AdminPanelPage } from '../pages/AdminPanelPage';
import { EventSelectRedirectPage } from '../pages/EventSelectRedirectPage';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { GanttPage } from '../pages/GanttPage';
import { SettingsPage } from '../pages/SettingsPage';
import { UserProfilePage } from '../pages/UserProfilePage';

// --- Placeholder pages ---
const DashboardPage = () => <div className="p-8 text-3xl font-bold">Dashboard Page</div>;
const IssuesPage = () => <div className="p-8 text-3xl font-bold">Issue Center Page</div>;
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
        <Route
          path="tasks"
          element={
            <RequireAuth>
              <RequireEvent>
                <TasksPage />
              </RequireEvent>
            </RequireAuth>
          }
        />
        <Route
          path="issues"
          element={
            <RequireAuth>
              <RequireEvent>
                <IssuesPage />
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
          path="admin/departments"
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
