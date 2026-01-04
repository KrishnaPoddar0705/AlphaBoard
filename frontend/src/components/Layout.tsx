import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useClerk, useUser } from '@clerk/clerk-react';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, Trophy, LogOut, User, BarChart2, Building2, Settings, Users, FileText, Menu } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import AlertsDropdown from './AlertsDropdown';
import { MobileNavDrawer } from './MobileNavDrawer';
import { MobileBottomNav } from './MobileBottomNav';

export default function Layout() {
    const { session, loading: authLoading } = useAuth();
    const { user } = useUser();
    const { signOut } = useClerk();
    const navigate = useNavigate();
    const location = useLocation();
    const [organization, setOrganization] = useState<{ id: string; name: string; role: string } | null>(null);
    const [loadingOrg, setLoadingOrg] = useState(true);
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

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
    }, [user?.id, authLoading, session?.user?.id, fetchOrganization]); // Depend on auth state and Supabase session

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
            // Still try to sign out from Clerk even if Supabase signout fails
            await signOut();
            navigate('/');
        }
    };

    return (
        <div className="min-h-screen">
            <nav className="glass border-b border-[var(--border-color)] relative z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-14 md:h-16">
                        <div className="flex items-center">
                            <div className="flex-shrink-0 flex items-center">
                                <span className="text-xl font-bold text-[var(--text-primary)]">AlphaBoard</span>
                            </div>
                            {/* Mobile Hamburger Menu */}
                            <button
                                onClick={() => setIsMobileNavOpen(true)}
                                className="ml-4 md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] min-w-[44px] min-h-[44px] flex items-center justify-center"
                                title="Menu"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                <Link
                                    to="/"
                                    className={`${isActive('/') ? 'border-indigo-500 text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/50'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                                >
                                    <LayoutDashboard className="w-4 h-4 mr-2" />
                                    Dashboard
                                </Link>
                                <Link
                                    to="/leaderboard"
                                    className={`${isActive('/leaderboard') ? 'border-indigo-500 text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/50'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                                >
                                    <Trophy className="w-4 h-4 mr-2" />
                                    Performance Tracker
                                </Link>
                                {user?.id && (
                                    <Link
                                        to={`/analyst/${user.id}/performance`}
                                        className={`${isActive('/analyst') ? 'border-indigo-500 text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/50'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                                    >
                                        <BarChart2 className="w-4 h-4 mr-2" />
                                        Performance
                                    </Link>
                                )}
                                {user?.id && organization && (
                                    <Link
                                        to="/research"
                                        className={`${isActive('/research') ? 'border-indigo-500 text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/50'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                                    >
                                        <FileText className="w-4 h-4 mr-2" />
                                        Institutional Memory
                                    </Link>
                                )}
                                {organization && organization.role === 'admin' && (
                                    <Link
                                        to="/organization/admin"
                                        className={`${isActive('/organization/admin') ? 'border-indigo-500 text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/50'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                                    >
                                        <Building2 className="w-4 h-4 mr-2" />
                                        Admin Dashboard
                                    </Link>
                                )}
                                {!organization && !loadingOrg && user?.id && (
                                    <>
                                        <Link
                                            to="/organization/join"
                                            className={`${isActive('/organization/join') ? 'border-indigo-500 text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/50'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                                        >
                                            <Users className="w-4 h-4 mr-2" />
                                            Join Org
                                        </Link>
                                        <Link
                                            to="/organization/create"
                                            className={`${isActive('/organization/create') ? 'border-indigo-500 text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/50'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                                        >
                                            <Building2 className="w-4 h-4 mr-2" />
                                            Create Org
                                        </Link>
                                    </>
                                )}
                                {user?.id && (
                                    <>
                                        <Link
                                            to="/profile"
                                            className={`${isActive('/profile') ? 'border-indigo-500 text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/50'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                                        >
                                            <User className="w-4 h-4 mr-2" />
                                            Profile
                                        </Link>
                                        <Link
                                            to="/settings/privacy"
                                            className={`${isActive('/settings') ? 'border-indigo-500 text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-indigo-500/50'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                                        >
                                            <Settings className="w-4 h-4 mr-2" />
                                            Settings
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-4">
                            {user && location.pathname !== '/' && <AlertsDropdown />}
                            {user ? (
                                <>
                                    {/* Mobile: Icon only */}
                                    <button
                                        onClick={handleLogout}
                                        className="md:hidden p-2 border border-[var(--border-color)] rounded-md text-[var(--text-primary)] bg-white/5 hover:bg-white/10 focus:outline-none backdrop-blur-sm transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                                        title="Sign Out"
                                    >
                                        <LogOut className="w-5 h-5" />
                                    </button>
                                    {/* Desktop: With text */}
                                    <button
                                        onClick={handleLogout}
                                        className="hidden md:inline-flex items-center px-4 py-2 border border-[var(--border-color)] text-sm font-medium rounded-md text-[var(--text-primary)] bg-white/5 hover:bg-white/10 focus:outline-none backdrop-blur-sm transition-all"
                                    >
                                        <LogOut className="w-4 h-4 mr-2" />
                                        Sign Out
                                    </button>
                                </>
                            ) : (
                                <Link
                                    to="/"
                                    className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                                >
                                    <User className="w-4 h-4 mr-2" />
                                    Sign In
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 relative z-0 pb-20 md:pb-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}>
                <Outlet />
            </main>

            {/* Mobile Bottom Navigation - Will be rendered by Dashboard for view mode switching */}
            {location.pathname !== '/' && <MobileBottomNav />}

            {/* Mobile Navigation Drawer */}
            <MobileNavDrawer
                isOpen={isMobileNavOpen}
                onClose={() => setIsMobileNavOpen(false)}
                user={user}
                organization={organization}
            />
        </div>
    );
}

