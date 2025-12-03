import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Award, TrendingUp, TrendingDown, Users, Globe, Building2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useOrganization } from '../hooks/useOrganization';
import { getPrice, getLeaderboardPerformance } from '../lib/api';
import AnalystProfile from '../components/AnalystProfile/AnalystProfile';

type LeaderboardType = 'organization' | 'public';

export default function Leaderboard() {
    const { session } = useAuth();
    const { organization, loading: orgLoading } = useOrganization();
    const [analysts, setAnalysts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAnalyst, setSelectedAnalyst] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<LeaderboardType | null>(null);
    const [hasInitialized, setHasInitialized] = useState(false);

    // Set initial tab based on organization membership - only once when org loading completes
    useEffect(() => {
        if (!orgLoading && !hasInitialized) {
            const initialTab = organization?.id ? 'organization' : 'public';
            setActiveTab(initialTab);
            setHasInitialized(true);
        }
    }, [orgLoading, organization, hasInitialized]);

    // Recalculate leaderboard when tab changes or organization changes
    // Only trigger after initialization is complete
    useEffect(() => {
        if (!orgLoading && hasInitialized && activeTab) {
            calculateLeaderboard();
        }
    }, [activeTab, hasInitialized, orgLoading]);

    const calculateLeaderboard = async () => {
        // Don't proceed if still loading organization or not initialized
        if (orgLoading || !hasInitialized || !activeTab) {
            return;
        }

        setLoading(true);
        try {
            if (activeTab === 'organization') {
                if (organization?.id) {
                    await calculateOrganizationLeaderboard(organization.id);
                } else {
                    // User switched to org tab but has no org - show empty
                    setAnalysts([]);
                }
            } else if (activeTab === 'public') {
                await calculatePublicLeaderboard();
            }
        } catch (err) {
            console.error(err);
            setAnalysts([]);
        } finally {
            setLoading(false);
        }
    };

    const calculateOrganizationLeaderboard = async (organizationId: string) => {
        try {
            // Get all members of the organization (without trying to join profiles)
            const { data: memberships, error: membersError } = await supabase
                .from('user_organization_membership')
                .select('user_id, role')
                .eq('organization_id', organizationId);

            if (membersError) {
                console.error('Error fetching organization members:', membersError);
                setAnalysts([]);
                return;
            }

            const memberUserIds = memberships?.map(m => m.user_id) || [];
            
            if (memberUserIds.length === 0) {
                setAnalysts([]);
                return;
            }

            // Create a map of user_id to role for quick lookup
            const roleMap = new Map<string, 'admin' | 'analyst'>();
            memberships?.forEach(m => {
                roleMap.set(m.user_id, m.role as 'admin' | 'analyst');
            });

            // Fetch profiles for organization members
            const { data: orgProfiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, username')
                .in('id', memberUserIds)
                .eq('organization_id', organizationId); // Ensure they belong to this org

            if (profilesError) {
                console.error('Error fetching organization profiles:', profilesError);
                setAnalysts([]);
                return;
            }

            // Create a map of user_id to username
            const usernameMap = new Map<string, string>();
            orgProfiles?.forEach(p => {
                usernameMap.set(p.id, p.username || 'Unknown');
            });

            // Fetch performance for organization members only
            const { data: orgPerformance, error: perfError } = await supabase
                .from('performance')
                .select('*')
                .in('user_id', memberUserIds)
                .order('alpha_pct', { ascending: false });

            if (perfError) {
                console.error('Error fetching organization performance:', perfError);
                // Continue with empty performance data
            }

            const leaderboardData: any[] = [];

            // Add organization members with their performance data
            memberUserIds.forEach(userId => {
                const username = usernameMap.get(userId) || 'Unknown';
                const role = roleMap.get(userId) || 'analyst';
                const perf = orgPerformance?.find(p => p.user_id === userId);

                leaderboardData.push({
                    user_id: userId,
                    username: username,
                    total_ideas: perf?.total_ideas || 0,
                    win_rate: perf?.win_rate || 0,
                    total_return_pct: perf?.total_return_pct || 0,
                    alpha_pct: perf?.alpha_pct || 0,
                    sharpe_ratio: perf?.sharpe_ratio || null,
                    role: role,
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
                });
            });

            // Sort by alpha_pct
            const allAnalysts = leaderboardData.sort((a, b) => (b.alpha_pct || 0) - (a.alpha_pct || 0));
            setAnalysts(allAnalysts);
        } catch (err) {
            console.error('Error calculating organization leaderboard:', err);
            setAnalysts([]);
        }
    };

    const calculatePublicLeaderboard = async () => {
        try {
            // Fetch ONLY public leaderboard (users without org, not private)
            const { data: publicProfiles } = await supabase
                .from('profiles')
                .select('id, username')
                .is('organization_id', null)
                .eq('is_private', false);

            const publicUserIds = publicProfiles?.map(p => p.id) || [];
            
            if (publicUserIds.length === 0) {
                setAnalysts([]);
                return;
            }

            // Create a map of user_id to username
            const usernameMap = new Map<string, string>();
            publicProfiles?.forEach(p => {
                usernameMap.set(p.id, p.username || 'Unknown');
            });

            // Fetch performance for public users only
            const { data: publicPerformance, error: perfError } = await supabase
                .from('performance')
                .select('*')
                .in('user_id', publicUserIds)
                .order('alpha_pct', { ascending: false });

            if (perfError) {
                console.error('Error fetching public performance:', perfError);
                // Continue with empty performance data
            }

            const leaderboardData: any[] = [];
            
            // Add public users with their performance data
            publicUserIds.forEach(userId => {
                const username = usernameMap.get(userId) || 'Unknown';
                const perf = publicPerformance?.find(p => p.user_id === userId);

                leaderboardData.push({
                    user_id: userId,
                    username: username,
                    total_ideas: perf?.total_ideas || 0,
                    win_rate: perf?.win_rate || 0,
                    total_return_pct: perf?.total_return_pct || 0,
                    alpha_pct: perf?.alpha_pct || 0,
                    sharpe_ratio: perf?.sharpe_ratio || null,
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
                });
            });

            // Sort by alpha_pct
            const allAnalysts = leaderboardData.sort((a, b) => (b.alpha_pct || 0) - (a.alpha_pct || 0));
            setAnalysts(allAnalysts);
        } catch (err) {
            console.error('Error calculating public leaderboard:', err);
            setAnalysts([]);
        }
    };

    if (orgLoading || loading) {
        return <div className="p-8 text-center text-white">Loading leaderboard...</div>;
    }

    return (
        <div className="space-y-8 relative">
            {/* Background glow effects */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-500/20 rounded-full mix-blend-screen filter blur-3xl animate-blob pointer-events-none"></div>
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-500/20 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="text-center py-4 relative z-10">
                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-purple-200">
                    {activeTab === 'organization' && organization 
                        ? `${organization.name} Leaderboard` 
                        : 'Public Leaderboard'}
                </h1>
                <p className="mt-2 text-blue-200/60 font-light">
                    {activeTab === 'organization' && organization
                        ? `Organization members ranked by Alpha generation`
                        : 'Top public performers ranked by Alpha generation'}
                </p>
            </div>

            {/* Tabs */}
            {organization?.id && (
                <div className="flex justify-center gap-4 relative z-10">
                    <button
                        onClick={() => setActiveTab('organization')}
                        className={`
                            px-6 py-3 rounded-lg font-medium transition-all
                            flex items-center gap-2
                            ${activeTab === 'organization'
                                ? 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-transparent'}
                        `}
                    >
                        <Building2 className="w-4 h-4" />
                        {organization.name}
                    </button>
                    <button
                        onClick={() => setActiveTab('public')}
                        className={`
                            px-6 py-3 rounded-lg font-medium transition-all
                            flex items-center gap-2
                            ${activeTab === 'public'
                                ? 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                                : 'bg-white/5 text-white/60 hover:bg-white/10 border border-transparent'}
                        `}
                    >
                        <Globe className="w-4 h-4" />
                        Public Leaderboard
                    </button>
                </div>
            )}

            <div className="glass-panel rounded-3xl overflow-hidden max-w-6xl mx-auto relative z-10">
                <table className="min-w-full divide-y divide-white/10">
                    <thead className="bg-white/5">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Rank</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Analyst</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Total Ideas</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Win Rate</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Total Return</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Alpha</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-blue-200/70 uppercase tracking-wider">Sharpe</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-transparent text-white">
                        {analysts.map((analyst, index) => (
                            <tr key={analyst.user_id}
                                onClick={() => setSelectedAnalyst({ ...analyst, rank: index + 1 })}
                                className={`
                hover:bg-white/5 transition-colors cursor-pointer
                ${analyst.username === 'You' ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : ''}
              `}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className={`
                      w-8 h-8 flex items-center justify-center rounded-full font-bold mr-2
                      ${index === 0 ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30' :
                                                index === 1 ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30' :
                                                    index === 2 ? 'bg-orange-400/20 text-orange-300 border border-orange-400/30' :
                                                        'text-white/40'}
                    `}>
                                            {index + 1}
                                        </div>
                                        {index === 0 && <Award className="w-5 h-5 text-yellow-400 drop-shadow-lg" />}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <img src={analyst.avatar} alt={analyst.username} className="w-8 h-8 rounded-full bg-white/10" />
                                        <div className="font-medium text-white">{analyst.username}</div>
                                        {analyst.username === 'You' && <span className="text-xs bg-indigo-500/30 px-2 py-0.5 rounded text-indigo-200">Me</span>}
                                        {activeTab === 'organization' && organization && analyst.role === 'admin' && (
                                            <span className="text-xs bg-purple-500/30 px-2 py-0.5 rounded text-purple-200">Admin</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                                    {analyst.total_ideas}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                                    {analyst.win_rate?.toFixed(1)}%
                                </td>
                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${analyst.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    <div className="flex items-center gap-1">
                                        {analyst.total_return_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {analyst.total_return_pct?.toFixed(2)}%
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-3 py-1 inline-flex text-sm font-bold rounded-full ${analyst.alpha_pct >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                                        {analyst.alpha_pct?.toFixed(2)}%
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-white/70" title={`Sharpe Ratio: ${analyst.sharpe_ratio?.toFixed(2) || 'N/A'}`}>
                                        {analyst.sharpe_ratio?.toFixed(2) || '-'}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {analysts.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-white/50">
                                    {activeTab === 'organization' && organization
                                        ? `No members found in ${organization.name}.`
                                        : 'No public analysts found.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {selectedAnalyst && (
                <AnalystProfile
                    analyst={selectedAnalyst}
                    onClose={() => setSelectedAnalyst(null)}
                />
            )}
        </div>
    );
}
