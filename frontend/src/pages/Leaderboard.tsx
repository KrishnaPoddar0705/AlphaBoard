import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Award, TrendingUp, TrendingDown, Globe, Building2 } from 'lucide-react';
import { useOrganization } from '../hooks/useOrganization';
import AnalystProfile from '../components/AnalystProfile/AnalystProfile';

type LeaderboardType = 'organization' | 'public';

export default function Leaderboard() {
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

            // Fetch performance table for all metrics including cumulative_portfolio_return_pct
            // Batch queries if there are many user IDs to avoid URL length limits
            let orgPerformance: any[] = [];
            if (memberUserIds.length > 0) {
                const BATCH_SIZE = 100; // PostgREST has URL length limits
                for (let i = 0; i < memberUserIds.length; i += BATCH_SIZE) {
                    const batch = memberUserIds.slice(i, i + BATCH_SIZE);
                    const { data, error } = await supabase
                        .from('performance')
                        .select('user_id, cumulative_portfolio_return_pct, total_ideas, win_rate, alpha_pct')
                        .in('user_id', batch);
                    
                    if (error) {
                        console.error('Error fetching organization performance batch:', error);
                        // Continue with other batches
                    } else if (data) {
                        orgPerformance = orgPerformance.concat(data);
                    }
                }
            }

            const performanceMap = new Map<string, any>();
            orgPerformance?.forEach(p => {
                performanceMap.set(p.user_id, p);
            });

            const leaderboardData: any[] = [];

            // Use cached performance data from performance table
            for (const userId of memberUserIds) {
                const username = usernameMap.get(userId) || 'Unknown';
                const role = roleMap.get(userId) || 'analyst';
                const perf = performanceMap.get(userId);

                // Only include users who have performance data (have recommendations)
                if (perf) {
                    leaderboardData.push({
                        user_id: userId,
                        username: username,
                        total_ideas: perf.total_ideas || 0,
                        win_rate: perf.win_rate || 0,
                        total_return_pct: perf.cumulative_portfolio_return_pct || 0,
                        alpha_pct: perf.alpha_pct || 0,
                        sharpe_ratio: null, // sharpe_ratio not available in performance table
                        role: role,
                        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
                    });
                }
            }

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

            // Fetch performance table for all metrics including cumulative_portfolio_return_pct
            // Batch queries if there are many user IDs to avoid URL length limits
            let publicPerformance: any[] = [];
            if (publicUserIds.length > 0) {
                const BATCH_SIZE = 100; // PostgREST has URL length limits
                for (let i = 0; i < publicUserIds.length; i += BATCH_SIZE) {
                    const batch = publicUserIds.slice(i, i + BATCH_SIZE);
                    const { data, error } = await supabase
                        .from('performance')
                        .select('user_id, cumulative_portfolio_return_pct, total_ideas, win_rate, alpha_pct')
                        .in('user_id', batch);
                    
                    if (error) {
                        console.error('Error fetching public performance batch:', error);
                        // Continue with other batches
                    } else if (data) {
                        publicPerformance = publicPerformance.concat(data);
                    }
                }
            }

            const performanceMap = new Map<string, any>();
            publicPerformance?.forEach(p => {
                performanceMap.set(p.user_id, p);
            });

            const leaderboardData: any[] = [];

            // Use cached performance data from performance table
            for (const userId of publicUserIds) {
                const username = usernameMap.get(userId) || 'Unknown';
                const perf = performanceMap.get(userId);

                // Only include users who have performance data (have recommendations)
                if (perf) {
                    leaderboardData.push({
                        user_id: userId,
                        username: username,
                        total_ideas: perf.total_ideas || 0,
                        win_rate: perf.win_rate || 0,
                        total_return_pct: perf.cumulative_portfolio_return_pct || 0,
                        alpha_pct: perf.alpha_pct || 0,
                        sharpe_ratio: null, // sharpe_ratio not available in performance table
                        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
                    });
                }
            }

            // Sort by alpha_pct
            const allAnalysts = leaderboardData.sort((a, b) => (b.alpha_pct || 0) - (a.alpha_pct || 0));
            setAnalysts(allAnalysts);
        } catch (err) {
            console.error('Error calculating public leaderboard:', err);
            setAnalysts([]);
        }
    };

    if (orgLoading || loading) {
        return <div className="p-8 text-center text-[var(--text-primary)]">Loading leaderboard...</div>;
    }

    return (
        <div className="space-y-8 relative">
            {/* Background glow effects */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-500/20 rounded-full mix-blend-screen filter blur-3xl animate-blob pointer-events-none"></div>
            <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-500/20 rounded-full mix-blend-screen filter blur-3xl animate-blob animation-delay-2000 pointer-events-none"></div>

            <div className="text-center py-4 relative z-10">
                <h1 className="text-4xl font-bold text-[var(--text-primary)]">
                    {activeTab === 'organization' && organization 
                        ? `${organization.name} Leaderboard` 
                        : 'Public Leaderboard'}
                </h1>
                <p className="mt-2 text-[var(--text-secondary)] font-light">
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
                                ? 'bg-indigo-500/20 dark:bg-blue-500/20 text-indigo-700 dark:text-blue-200 border-2 border-indigo-500 dark:border-blue-400/30'
                                : 'bg-[var(--list-item-hover)] text-[var(--text-primary)] hover:bg-[var(--card-bg)] border-2 border-[var(--border-color)]'}
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
                                ? 'bg-indigo-500/20 dark:bg-blue-500/20 text-indigo-700 dark:text-blue-200 border-2 border-indigo-500 dark:border-blue-400/30'
                                : 'bg-[var(--list-item-hover)] text-[var(--text-primary)] hover:bg-[var(--card-bg)] border-2 border-[var(--border-color)]'}
                        `}
                    >
                        <Globe className="w-4 h-4" />
                        Public Leaderboard
                    </button>
                </div>
            )}

            <div className="glass-panel rounded-3xl overflow-hidden max-w-6xl mx-auto relative z-10 border-2 border-[var(--border-color)]">
                <table className="min-w-full divide-y divide-[var(--border-color)]">
                    <thead className="bg-[var(--card-bg)] border-b-2 border-[var(--border-color)]">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider font-bold">Rank</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider font-bold">Analyst</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider font-bold">Total Ideas</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider font-bold">Win Rate</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider font-bold">Total Return</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider font-bold">Alpha</th>
                            <th className="px-6 py-4 text-left text-xs font-medium text-[var(--text-primary)] uppercase tracking-wider font-bold">Sharpe</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)] bg-transparent text-[var(--text-primary)]">
                        {analysts.map((analyst, index) => (
                            <tr key={analyst.user_id}
                                onClick={() => setSelectedAnalyst({ ...analyst, rank: index + 1 })}
                                className={`
                hover:bg-[var(--list-item-hover)] transition-colors cursor-pointer border-b border-[var(--border-color)]
                ${analyst.username === 'You' ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : ''}
              `}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className={`
                      w-8 h-8 flex items-center justify-center rounded-full font-bold mr-2
                      ${index === 0 ? 'bg-yellow-400/20 text-yellow-600 dark:text-yellow-300 border-2 border-yellow-500 dark:border-yellow-400/30' :
                                                index === 1 ? 'bg-slate-300/20 text-slate-700 dark:text-slate-200 border-2 border-slate-500 dark:border-slate-300/30' :
                                                    index === 2 ? 'bg-orange-400/20 text-orange-600 dark:text-orange-300 border-2 border-orange-500 dark:border-orange-400/30' :
                                                        'text-[var(--text-primary)] border-2 border-[var(--border-color)]'}
                    `}>
                                            {index + 1}
                                        </div>
                                        {index === 0 && <Award className="w-5 h-5 text-yellow-500 dark:text-yellow-400 drop-shadow-lg" />}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <img src={analyst.avatar} alt={analyst.username} className="w-8 h-8 rounded-full bg-[var(--bg-secondary)]" />
                                        <div className="font-medium text-[var(--text-primary)]">{analyst.username}</div>
                                        {analyst.username === 'You' && <span className="text-xs bg-indigo-500/30 px-2 py-0.5 rounded text-indigo-200">Me</span>}
                                        {activeTab === 'organization' && organization && analyst.role === 'admin' && (
                                            <span className="text-xs bg-purple-500/30 px-2 py-0.5 rounded text-purple-200">Admin</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)]">
                                    {analyst.total_ideas}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-secondary)]">
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
                                    <div className="text-sm text-[var(--text-secondary)]" title={`Sharpe Ratio: ${analyst.sharpe_ratio?.toFixed(2) || 'N/A'}`}>
                                        {analyst.sharpe_ratio?.toFixed(2) || '-'}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {analysts.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-[var(--text-secondary)]">
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
