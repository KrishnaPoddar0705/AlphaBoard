/**
 * Layout V3 Component
 * 
 * Main layout with sidebar navigation replacing top navbar.
 * Features:
 * - Desktop: Sidebar navigation
 * - Mobile: Sheet-based sidebar
 * - Responsive design
 * - Feature flag controlled (UI_V3)
 */

import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useClerk, useUser } from '@clerk/clerk-react';
import { supabase } from '../../lib/supabase';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarFooter,
} from '../ui/sidebar';
import {
  LayoutDashboard,
  Trophy,
  LogOut,
  User,
  BarChart2,
  Building2,
  Settings,
  Users,
  FileText,
  Menu,
  Eye,
  Briefcase,
  FileCheck,
  ArrowRight,
} from 'lucide-react';
import AlertsDropdown from '../AlertsDropdown';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { TopNavBar } from './TopNavBar';

export default function LayoutV3() {
  const { session, loading: authLoading } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const location = useLocation();
  const [organization, setOrganization] = useState<{ id: string; name: string; role: string } | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  // Helper function to check if a path is active
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const fetchOrganization = useCallback(async () => {
    if (!user?.id) {
      setOrganization(null);
      setLoadingOrg(false);
      return;
    }

    try {
      setLoadingOrg(true);

      // Always fetch the latest session from Supabase to ensure we have the most up-to-date info
      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      const supabaseUserId = supabaseSession?.user?.id;

      if (!supabaseUserId) {
        // Retry after a short delay if session isn't ready yet
        console.log('No Supabase user ID available yet, will retry...');
        setTimeout(() => {
          if (user?.id) {
            fetchOrganization();
          }
        }, 1000);
        return;
      }

      // Verify this Supabase user matches the current Clerk user
      // by checking the mapping table
      const { data: mapping } = await supabase
        .from('clerk_user_mapping')
        .select('clerk_user_id')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      if (!mapping || mapping.clerk_user_id !== user.id) {
        // Session doesn't match current Clerk user - clear organization
        console.log('Supabase session does not match current Clerk user');
        setOrganization(null);
        setLoadingOrg(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_organization_membership')
        .select('organization_id, role, organizations(id, name)')
        .eq('user_id', supabaseUserId)
        .maybeSingle();

      if (!error && data) {
        const org = data.organizations as any;
        setOrganization({
          id: data.organization_id,
          name: org?.name || 'Unknown',
          role: data.role,
        });
      } else {
        setOrganization(null);
      }
    } catch (err) {
      console.error('Error fetching organization:', err);
      setOrganization(null);
    } finally {
      setLoadingOrg(false);
    }
  }, [user?.id, session?.user?.id]);

  // Listen for Supabase auth state changes to fetch organization when session becomes available
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (authSession?.user?.id && user?.id) {
        // Session is ready, fetch organization
        fetchOrganization();
      }
    });

    return () => subscription.unsubscribe();
  }, [user?.id, fetchOrganization]);

  useEffect(() => {
    if (user?.id && !authLoading && session?.user?.id) {
      // User is logged in, auth is loaded, and Supabase session is ready
      fetchOrganization();
    } else if (!user?.id) {
      // Clear organization when user logs out
      setOrganization(null);
      setLoadingOrg(false);
    }
  }, [user?.id, authLoading, session?.user?.id, fetchOrganization]);

  const handleLogout = async () => {
    try {
      // Clear Supabase session first
      await supabase.auth.signOut();

      // Clear Supabase auth data from localStorage (Supabase stores session there)
      // Supabase uses keys like: sb-<project-ref>-auth-token
      const supabaseKeys = Object.keys(localStorage).filter(key =>
        key.includes('supabase') || key.includes('sb-') || key.startsWith('sb_')
      );
      supabaseKeys.forEach(key => localStorage.removeItem(key));

      // Clear sessionStorage as well
      const supabaseSessionKeys = Object.keys(sessionStorage).filter(key =>
        key.includes('supabase') || key.includes('sb-') || key.startsWith('sb_')
      );
      supabaseSessionKeys.forEach(key => sessionStorage.removeItem(key));

      // Clear organization state
      setOrganization(null);

      // Sign out from Clerk
      await signOut();

      // Navigate to login
      navigate('/');
    } catch (error) {
      console.error('Error during logout:', error);
      // Still try to sign out from Clerk even if Supabase signout fails
      await signOut();
      navigate('/');
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar
          organization={organization}
          loadingOrg={loadingOrg}
          user={user}
          isActive={isActive}
          onLogout={handleLogout}
        />
        <SidebarInset className="flex-1 flex flex-col min-w-0">
          <TopNavBar />
          <div className="flex-1 overflow-hidden">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar({
  organization,
  loadingOrg,
  user,
  isActive,
  onLogout,
}: {
  organization: { id: string; name: string; role: string } | null;
  loadingOrg: boolean;
  user: any;
  isActive: (path: string) => boolean;
  onLogout: () => void;
}) {
  const userName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}`
    : user?.username || user?.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'User';
  const userRole = organization?.role === 'admin' ? 'Senior Analyst' : 'Analyst';
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* User Profile Section */}
        <div className="flex items-center gap-3 px-2 py-4">
          <Avatar>
            <AvatarImage src={user?.imageUrl} alt={userName} />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{userName}</span>
            <span className="text-xs text-muted-foreground">{userRole}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/')}>
                  <Link to="/">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/watchlist')}>
                  <Link to="/">
                    <Eye className="w-4 h-4" />
                    <span>Watchlist</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/portfolio')}>
                  <Link to="/">
                    <Briefcase className="w-4 h-4" />
                    <span>Portfolio</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/recommendations')}>
                  <Link to="/">
                    <FileCheck className="w-4 h-4" />
                    <span>Recommendations</span>
                    <Badge variant="secondary" className="ml-auto">3</Badge>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/reports')}>
                  <Link to="/">
                    <FileText className="w-4 h-4" />
                    <span>Reports</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>ADMIN</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/team')}>
                  <Link to="/">
                    <Users className="w-4 h-4" />
                    <span>Team</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive('/settings')}>
                  <Link to="/settings/privacy">
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onLogout} className="w-full">
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
              <ArrowRight className="w-4 h-4 ml-auto" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

