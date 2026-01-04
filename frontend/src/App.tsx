import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import LayoutV2 from './components/LayoutV2';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Community from './pages/Community';
import StockDetail from './pages/StockDetail';
import Recommendations from './pages/Recommendations';
import Watchlist from './pages/Watchlist';
import History from './pages/History';
import Performance from './pages/Performance';
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
import InlineLogin from './components/InlineLogin';
import { ensureVoterSession } from './lib/auth/ensureVoterSession';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F1EEE0]">
        <div className="text-[#6F6A60] font-mono">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <InlineLogin />;
  }

  return <>{children}</>;
}

function App() {
  // Initialize anonymous session on app load (optional, for better UX)
  // This ensures anonymous users have a session ready before they interact
  useEffect(() => {
    // Silently ensure anonymous session exists for voting
    // This is non-blocking and doesn't show errors to users
    ensureVoterSession().catch((error) => {
      // Silently handle errors - voting will work when user tries to vote
    });
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route element={<LayoutV2 />}>
          {/* Community routes - accessible to all */}
          <Route path="/community" element={<Community />} />
          <Route path="/stock/:ticker" element={<StockDetail />} />
          <Route path="/stock/:ticker/community" element={<StockDetail />} />
          <Route path="/stock/:ticker/community/:postId" element={<StockDetail />} />
          <Route path="/stock/:ticker/financials" element={<StockDetail />} />

          {/* User-specific routes */}
          <Route path="/recommendations" element={
            <PrivateRoute>
              <Recommendations />
            </PrivateRoute>
          } />
          <Route path="/watchlist" element={
            <PrivateRoute>
              <Watchlist />
            </PrivateRoute>
          } />
          <Route path="/history" element={
            <PrivateRoute>
              <History />
            </PrivateRoute>
          } />
          <Route path="/performance" element={
            <PrivateRoute>
              <Performance />
            </PrivateRoute>
          } />

          {/* Organization routes */}
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

          {/* Settings */}
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

          {/* Redirect root to community */}
          <Route path="/" element={<Navigate to="/community" replace />} />
        </Route>
        {/* Catch-all route for 404 errors */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
