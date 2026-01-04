import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Award, TrendingUp, TrendingDown, Globe, Building2 } from 'lucide-react';
import { useOrganization } from '../hooks/useOrganization';
import AnalystProfile from '../components/AnalystProfile/AnalystProfile';
import { safeLog, safeError } from '../lib/logger';

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
            safeError('Error calculating leaderboard:', err);
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
                safeError('Error fetching organization members:', membersError);
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
                safeError('Error fetching organization profiles:', profilesError);
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
                        safeError('Error fetching organization performance batch:', error);
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
            safeError('Error calculating organization leaderboard:', err);
            setAnalysts([]);
        }
    };

    const calculatePublicLeaderboard = async () => {
        try {
            // Use secure database function to get public leaderboard users
            // This function runs server-side and ensures proper security checks
            const { data: publicProfiles, error: profilesError } = await supabase
                .rpc('get_public_leaderboard_users');

            if (profilesError) {
                safeError('Error fetching public leaderboard users:', profilesError);
                // Fallback: Get org members and filter securely
                safeLog('RPC function not available, using fallback method');
                
                const { data: orgMembers } = await supabase
                    .from('user_organization_membership')
                    .select('user_id');
                
                const orgMemberSet = new Set(orgMembers?.map((m: any) => m.user_id) || []);
                
                const { data: allPublicProfiles, error: fallbackError } = await supabase
                    .from('profiles')
                    .select('id, username')
                    .eq('is_private', false)
                    .not('username', 'is', null)
                    .neq('username', '');
                
                if (fallbackError) {
                    safeError('Error in fallback query:', fallbackError);
                    setAnalysts([]);
                    return;
                }
                
                // Filter out org members and anonymous users (users with null/empty username)
                const filteredProfiles = allPublicProfiles?.filter((p: any) => 
                    !orgMemberSet.has(p.id) && 
                    p.username && 
                    p.username.trim() !== ''
                ) || [];
                const publicUserIds = filteredProfiles.map((p: any) => p.id);
                
                if (publicUserIds.length === 0) {
                    safeLog('No public profiles found');
                    setAnalysts([]);
                    return;
                }
                
                // Continue with filtered profiles (same logic as below)
                const usernameMap = new Map<string, string>();
                filteredProfiles.forEach((p: any) => {
                    usernameMap.set(p.id, p.username || 'Unknown');
                });
                
                // Fetch performance data
                let publicPerformance: any[] = [];
                if (publicUserIds.length > 0) {
                    const BATCH_SIZE = 100;
                    for (let i = 0; i < publicUserIds.length; i += BATCH_SIZE) {
                        const batch = publicUserIds.slice(i, i + BATCH_SIZE);
                        const { data, error } = await supabase
                            .from('performance')
                            .select('user_id, cumulative_portfolio_return_pct, total_ideas, win_rate, alpha_pct')
                            .in('user_id', batch);
                        
                        if (error) {
                            safeError('Error fetching public performance batch:', error);
                        } else if (data) {
                            publicPerformance = publicPerformance.concat(data);
                        }
                    }
                }
                
                const performanceMap = new Map<string, any>();
                publicPerformance?.forEach((p: any) => {
                    performanceMap.set(p.user_id, p);
                });
                
                const leaderboardData: any[] = [];
                for (const userId of publicUserIds) {
                    const username = usernameMap.get(userId) || 'Unknown';
                    
                    // Skip anonymous users (null or empty username)
                    if (!username || username.trim() === '' || username === 'Unknown') {
                        continue;
                    }
                    
                    const perf = performanceMap.get(userId);
                    
                    leaderboardData.push({
                        user_id: userId,
                        username: username,
                        total_ideas: perf?.total_ideas || 0,
                        win_rate: perf?.win_rate || 0,
                        total_return_pct: perf?.cumulative_portfolio_return_pct || 0,
                        alpha_pct: perf?.alpha_pct || 0,
                        sharpe_ratio: null,
                        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
                    });
                }
                
                const allAnalysts = leaderboardData.sort((a, b) => (b.alpha_pct || 0) - (a.alpha_pct || 0));
                setAnalysts(allAnalysts);
                return;
            }

            if (!publicProfiles || publicProfiles.length === 0) {
                safeLog('No public profiles found');
                setAnalysts([]);
                return;
            }

            safeLog('Public profiles found (not in org, not private), count:', publicProfiles.length);
            const publicUserIds = publicProfiles.map((p: any) => p.id);

            safeLog('Public profiles found (not in org, not private), count:', publicProfiles.length);

            if (publicUserIds.length === 0) {
                safeLog('No public profiles found (users without organization membership and is_private is false)');
                setAnalysts([]);
                return;
            }

            // Create a map of user_id to username
            const usernameMap = new Map<string, string>();
            publicProfiles.forEach((p: any) => {
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
                        safeError('Error fetching public performance batch:', error);
                        // Continue with other batches
                    } else if (data) {
                        publicPerformance = publicPerformance.concat(data);
                    }
                }
            }

            safeLog('Performance data found, count:', publicPerformance.length);

            const performanceMap = new Map<string, any>();
            publicPerformance?.forEach(p => {
                performanceMap.set(p.user_id, p);
            });

            const leaderboardData: any[] = [];

            // Include all public users, even if they don't have performance data yet
            // Filter out anonymous users (users with null/empty username)
            for (const userId of publicUserIds) {
                const username = usernameMap.get(userId) || 'Unknown';
                
                // Skip anonymous users (null or empty username)
                if (!username || username.trim() === '' || username === 'Unknown') {
                    continue;
                }
                
                const perf = performanceMap.get(userId);

                // Include all users, using performance data if available, otherwise default to 0
                leaderboardData.push({
                    user_id: userId,
                    username: username,
                    total_ideas: perf?.total_ideas || 0,
                    win_rate: perf?.win_rate || 0,
                    total_return_pct: perf?.cumulative_portfolio_return_pct || 0,
                    alpha_pct: perf?.alpha_pct || 0,
                    sharpe_ratio: null, // sharpe_ratio not available in performance table
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
                });
            }

            safeLog('Final leaderboard data, count:', leaderboardData.length, 'analysts');

            // Sort by alpha_pct
            const allAnalysts = leaderboardData.sort((a, b) => (b.alpha_pct || 0) - (a.alpha_pct || 0));
            setAnalysts(allAnalysts);
        } catch (err) {
            safeError('Error calculating public leaderboard:', err);
            setAnalysts([]);
        }
    };

    if (orgLoading || loading) {
        return (
            <div className="p-5 md:p-7">
                <div className="text-center text-[#6F6A60]">Loading leaderboard...</div>
            </div>
        );
    }

    return (
        <div className="p-5 md:p-7 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-[28px] font-bold text-[#1C1B17] tracking-tight">
                        {activeTab === 'organization' && organization
                            ? `${organization.name} Leaderboard`
                            : 'Public Leaderboard'}
                    </h1>
                    <p className="mt-1 text-sm text-[#6F6A60]">
                        {activeTab === 'organization' && organization
                            ? `Organization members ranked by Alpha generation`
                            : 'Top public performers ranked by Alpha generation'}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            {organization?.id && (
                <div className="flex gap-3">
                    <button
                        onClick={() => setActiveTab('organization')}
                        className={`
                            px-4 py-2 rounded-lg font-medium transition-all text-sm
                            flex items-center gap-2
                            ${activeTab === 'organization'
                                ? 'bg-[#1C1B17] text-[#F7F2E6]'
                                : 'bg-[#F7F2E6] text-[#1C1B17] border border-[#D7D0C2] hover:bg-[#F1EEE0]'}
                        `}
                    >
                        <Building2 className="w-4 h-4" />
                        {organization.name}
                    </button>
                    <button
                        onClick={() => setActiveTab('public')}
                        className={`
                            px-4 py-2 rounded-lg font-medium transition-all text-sm
                            flex items-center gap-2
                            ${activeTab === 'public'
                                ? 'bg-[#1C1B17] text-[#F7F2E6]'
                                : 'bg-[#F7F2E6] text-[#1C1B17] border border-[#D7D0C2] hover:bg-[#F1EEE0]'}
                        `}
                    >
                        <Globe className="w-4 h-4" />
                        Public
                    </button>
                </div>
            )}

            {/* Mobile: Card view, Desktop: Table view */}
            <div className="space-y-3 md:hidden">
                {analysts.length === 0 ? (
                    <div className="p-8 text-center text-[#6F6A60]">
                        {activeTab === 'organization' && organization
                            ? `No members found in ${organization.name}.`
                            : 'No public analysts found.'}
                    </div>
                ) : (
                    analysts.map((analyst, index) => (
                        <div
                            key={analyst.user_id}
                            onClick={() => setSelectedAnalyst({ ...analyst, rank: index + 1 })}
                            className="bg-[#F7F2E6] border border-[#D7D0C2] rounded-lg p-4 space-y-3 cursor-pointer hover:bg-[#F1EEE0] transition-colors"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`
                                        w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm
                                        ${index === 0 ? 'bg-yellow-400/20 text-yellow-700 border-2 border-yellow-500' :
                                            index === 1 ? 'bg-slate-300/20 text-slate-700 border-2 border-slate-500' :
                                                index === 2 ? 'bg-orange-400/20 text-orange-700 border-2 border-orange-500' :
                                                    'bg-[#F1EEE0] text-[#1C1B17] border-2 border-[#D7D0C2]'}
                                    `}>
                                        {index + 1}
                                    </div>
                                    {index === 0 && <Award className="w-4 h-4 text-yellow-600" />}
                                    <img src={analyst.avatar} alt={analyst.username} className="w-8 h-8 rounded-full" />
                                    <div>
                                        <div className="font-medium text-[#1C1B17]">{analyst.username}</div>
                                        {activeTab === 'organization' && organization && analyst.role === 'admin' && (
                                            <span className="text-xs text-[#6F6A60]">Admin</span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`text-sm font-semibold ${analyst.alpha_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {analyst.alpha_pct?.toFixed(2)}% Alpha
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <div className="text-[#6F6A60] text-xs">Total Ideas</div>
                                    <div className="text-[#1C1B17] font-medium">{analyst.total_ideas}</div>
                                </div>
                                <div>
                                    <div className="text-[#6F6A60] text-xs">Win Rate</div>
                                    <div className="text-[#1C1B17] font-medium">{analyst.win_rate?.toFixed(1)}%</div>
                                </div>
                                <div>
                                    <div className="text-[#6F6A60] text-xs">Total Return</div>
                                    <div className={`font-medium flex items-center gap-1 ${analyst.total_return_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {analyst.total_return_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {analyst.total_return_pct?.toFixed(2)}%
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[#6F6A60] text-xs">Sharpe</div>
                                    <div className="text-[#1C1B17] font-medium">{analyst.sharpe_ratio?.toFixed(2) || '-'}</div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop: Table view */}
            <div className="hidden md:block bg-[#F7F2E6] border border-[#D7D0C2] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#D7D0C2]">
                        <thead className="bg-[#F1EEE0] border-b border-[#D7D0C2]">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-[#1C1B17] uppercase tracking-wider">Rank</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-[#1C1B17] uppercase tracking-wider">Analyst</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-[#1C1B17] uppercase tracking-wider">Total Ideas</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-[#1C1B17] uppercase tracking-wider">Win Rate</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-[#1C1B17] uppercase tracking-wider">Total Return</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-[#1C1B17] uppercase tracking-wider">Alpha</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-[#1C1B17] uppercase tracking-wider">Sharpe</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#D7D0C2] bg-[#F7F2E6]">
                            {analysts.map((analyst, index) => (
                                <tr
                                    key={analyst.user_id}
                                    onClick={() => setSelectedAnalyst({ ...analyst, rank: index + 1 })}
                                    className="hover:bg-[#F1EEE0] transition-colors cursor-pointer"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className={`
                                                w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm
                                                ${index === 0 ? 'bg-yellow-400/20 text-yellow-700 border-2 border-yellow-500' :
                                                    index === 1 ? 'bg-slate-300/20 text-slate-700 border-2 border-slate-500' :
                                                        index === 2 ? 'bg-orange-400/20 text-orange-700 border-2 border-orange-500' :
                                                            'bg-[#F1EEE0] text-[#1C1B17] border-2 border-[#D7D0C2]'}
                                            `}>
                                                {index + 1}
                                            </div>
                                            {index === 0 && <Award className="w-4 h-4 text-yellow-600" />}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <img src={analyst.avatar} alt={analyst.username} className="w-8 h-8 rounded-full" />
                                            <div className="font-medium text-[#1C1B17]">{analyst.username}</div>
                                            {activeTab === 'organization' && organization && analyst.role === 'admin' && (
                                                <span className="text-xs bg-[#1C1B17]/10 text-[#1C1B17] px-2 py-0.5 rounded">Admin</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#1C1B17]">
                                        {analyst.total_ideas}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#1C1B17]">
                                        {analyst.win_rate?.toFixed(1)}%
                                    </td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium flex items-center gap-1 ${analyst.total_return_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {analyst.total_return_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {analyst.total_return_pct?.toFixed(2)}%
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${analyst.alpha_pct >= 0 ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-rose-100 text-rose-700 border border-rose-300'}`}>
                                            {analyst.alpha_pct?.toFixed(2)}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#1C1B17]">
                                        {analyst.sharpe_ratio?.toFixed(2) || '-'}
                                    </td>
                                </tr>
                            ))}
                            {analysts.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-[#6F6A60]">
                                        {activeTab === 'organization' && organization
                                            ? `No members found in ${organization.name}.`
                                            : 'No public analysts found.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
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
