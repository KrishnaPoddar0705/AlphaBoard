import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, Trophy, LogOut, User, BarChart2, Building2, Settings, Users } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Layout() {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [organization, setOrganization] = useState<{ id: string; name: string; role: string } | null>(null);
    const [loadingOrg, setLoadingOrg] = useState(true);

    useEffect(() => {
        if (session?.user?.id) {
            fetchOrganization();
        } else {
            setLoadingOrg(false);
        }
    }, [session]);

    const fetchOrganization = async () => {
        try {
            const { data, error } = await supabase
                .from('user_organization_membership')
                .select('organization_id, role, organizations(id, name)')
                .eq('user_id', session!.user!.id)
                .single();

            if (!error && data) {
                const org = data.organizations as any;
                setOrganization({
                    id: data.organization_id,
                    name: org?.name || 'Unknown',
                    role: data.role,
                });
            }
        } catch (err) {
            console.error('Error fetching organization:', err);
        } finally {
            setLoadingOrg(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    return (
        <div className="min-h-screen">
            <nav className="glass border-b border-white/10 relative z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center">
                                <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-purple-200">AlphaBoard</span>
                            </div>
                            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                <Link to="/" className="border-blue-400 text-white inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                    <LayoutDashboard className="w-4 h-4 mr-2" />
                                    Dashboard
                                </Link>
                                <Link to="/leaderboard" className="border-transparent text-gray-300 hover:text-white hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                    <Trophy className="w-4 h-4 mr-2" />
                                    Performance Tracker
                                </Link>
                                {session?.user?.id && (
                                    <Link to={`/analyst/${session.user.id}/performance`} className="border-transparent text-gray-300 hover:text-white hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                        <BarChart2 className="w-4 h-4 mr-2" />
                                        Performance
                                    </Link>
                                )}
                                {organization && organization.role === 'admin' && (
                                    <Link to="/organization/admin" className="border-transparent text-gray-300 hover:text-white hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                        <Building2 className="w-4 h-4 mr-2" />
                                        {organization.name}
                                    </Link>
                                )}
                                {!organization && !loadingOrg && (
                                    <div className="flex items-center gap-2">
                                        <Link to="/organization/join" className="border-transparent text-gray-300 hover:text-white hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                            <Users className="w-4 h-4 mr-2" />
                                            Join Org
                                        </Link>
                                        <Link to="/organization/create" className="border-transparent text-gray-300 hover:text-white hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                            <Building2 className="w-4 h-4 mr-2" />
                                            Create Org
                                        </Link>
                                    </div>
                                )}
                                {session?.user?.id && (
                                    <Link to="/settings/privacy" className="border-transparent text-gray-300 hover:text-white hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                        <Settings className="w-4 h-4 mr-2" />
                                        Settings
                                    </Link>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center">
                            {session ? (
                                <button
                                    onClick={handleLogout}
                                    className="ml-3 inline-flex items-center px-4 py-2 border border-white/10 text-sm font-medium rounded-md text-white bg-white/5 hover:bg-white/10 focus:outline-none backdrop-blur-sm transition-all"
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Sign Out
                                </button>
                            ) : (
                                <Link
                                    to="/login"
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

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 relative z-0">
                <Outlet />
            </main>
        </div>
    );
}

