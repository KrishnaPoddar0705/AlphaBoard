import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import Layout from './components/Layout';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Leaderboard from './pages/Leaderboard';
import PublicLeaderboard from './pages/PublicLeaderboard';
import AnalystPerformance from './pages/AnalystPerformance';
import CreateOrganization from './components/organization/CreateOrganization';
import JoinOrganization from './components/organization/JoinOrganization';
import AdminDashboard from './components/organization/AdminDashboard';
import OrganizationSettings from './components/organization/OrganizationSettings';
import PrivacySettings from './components/settings/PrivacySettings';
import ResearchLibrary from './pages/ResearchLibrary';
import ReportDetail from './pages/ReportDetail';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) return <div>Loading...</div>;

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route element={<Layout />}>
          <Route path="/" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/leaderboard/public" element={<PublicLeaderboard />} />
          <Route path="/analyst/:id/performance" element={
            <PrivateRoute>
              <AnalystPerformance />
            </PrivateRoute>
          } />
          <Route path="/organization/create" element={
            <PrivateRoute>
              <CreateOrganization />
            </PrivateRoute>
          } />
          <Route path="/organization/join" element={
            <PrivateRoute>
              <JoinOrganization />
            </PrivateRoute>
          } />
          <Route path="/organization/admin" element={
            <PrivateRoute>
              <AdminDashboard />
            </PrivateRoute>
          } />
          <Route path="/organization/settings" element={
            <PrivateRoute>
              <OrganizationSettings />
            </PrivateRoute>
          } />
          <Route path="/settings/privacy" element={
            <PrivateRoute>
              <PrivacySettings />
            </PrivateRoute>
          } />
          <Route path="/profile" element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } />
          <Route path="/research" element={
            <PrivateRoute>
              <ResearchLibrary />
            </PrivateRoute>
          } />
          <Route path="/research/:id" element={
            <PrivateRoute>
              <ReportDetail />
            </PrivateRoute>
          } />
        </Route>
        {/* Catch-all route for 404 errors */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
