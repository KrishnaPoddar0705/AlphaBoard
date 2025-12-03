import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leaderboard from './pages/Leaderboard';
import PublicLeaderboard from './pages/PublicLeaderboard';
import AnalystPerformance from './pages/AnalystPerformance';
import CreateOrganization from './components/organization/CreateOrganization';
import JoinOrganization from './components/organization/JoinOrganization';
import AdminDashboard from './components/organization/AdminDashboard';
import OrganizationSettings from './components/organization/OrganizationSettings';
import PrivacySettings from './components/settings/PrivacySettings';
import { useAuth } from './hooks/useAuth';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  
  if (!session) {
    return <Navigate to="/login" />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
