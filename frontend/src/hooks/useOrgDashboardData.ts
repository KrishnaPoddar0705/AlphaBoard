import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { safeError, safeLog } from '../lib/logger';
import { getUserFriendlyError } from '../lib/errorSanitizer';
import type {
  AnalystPerformance,
  OrganizationUser,
} from '../components/organization/dashboard/types';

interface UseOrgDashboardDataOptions {
  orgId: string | null;
  /**
   * Narrow the roster to these users before any of the heavy queries run. The Team
   * Dashboard passes its team's members, so it never fetches the whole organization
   * and throws most of it away. Undefined means "the whole organization".
   */
  restrictToUserIds?: string[];
  /** Skip fetching entirely -- used while a team selection is still resolving. */
  enabled?: boolean;
}

/**
 * Loads everything both dashboards show: the member roster and a computed
 * performance row per analyst.
 *
 * Metrics are derived from raw recommendations rather than the `performance` table,
 * which is only consulted as a fallback for members who have no recommendations yet.
 * That behaviour is carried over from the original Admin Dashboard unchanged --
 * including the fact that the 1M/3M/6M/12M buckets all hold the same average closed
 * return, and sharpe/volatility/drawdown are placeholders.
 */
export function useOrgDashboardData({
  orgId,
  restrictToUserIds,
  enabled = true,
}: UseOrgDashboardDataOptions) {
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [performance, setPerformance] = useState<AnalystPerformance[]>([]);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serialised so the effect below re-runs on content change rather than on every
  // new array identity, which a caller building this list inline would produce on
  // each render.
  const restrictKey = restrictToUserIds ? restrictToUserIds.join(',') : '';

  const fetchData = useCallback(async () => {
    if (!orgId || !enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: orgData } = await supabase
        .from('organizations')
        .select('join_code')
        .eq('id', orgId)
        .single();
      setJoinCode(orgData?.join_code ?? null);

      const { data: membersData, error: membersError } = await supabase
        .from('user_organization_membership')
        .select('user_id, role, joined_at')
        .eq('organization_id', orgId);

      if (membersError) {
        safeError('Error fetching members:', membersError);
      }

      const restrictSet = restrictKey ? new Set(restrictKey.split(',')) : null;
      const members = (membersData || []).filter(
        (m: any) => !restrictSet || restrictSet.has(m.user_id)
      );

      if (members.length === 0) {
        setUsers([]);
        setPerformance([]);
        setLoading(false);
        return;
      }

      const userIds = members.map((m: any) => m.user_id);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, email')
        .in('id', userIds);

      const usernameById = new Map<string, string>();
      const emailById = new Map<string, string>();
      profilesData?.forEach((p: any) => {
        usernameById.set(p.id, p.username);
        emailById.set(p.id, p.email);
      });

      setUsers(
        members.map((m: any) => ({
          userId: m.user_id,
          username: usernameById.get(m.user_id) || 'Unknown User',
          email: emailById.get(m.user_id) || 'No email on record',
          role: m.role,
          joinedAt: m.joined_at,
        }))
      );

      const { data: allRecommendations, error: recsError } = await supabase
        .from('recommendations')
        .select('id, user_id, status, action, final_return_pct, entry_date')
        .in('user_id', userIds)
        .neq('status', 'WATCHLIST')
        .neq('action', 'WATCH');

      if (recsError) {
        safeError('Error fetching recommendations:', recsError);
      }

      const { data: teamMemberships } = await supabase
        .from('team_members')
        .select('user_id, team_id, teams(id, name)')
        .in('user_id', userIds);

      const teamsByUser = new Map<string, Array<{ id: string; name: string }>>();
      teamMemberships?.forEach((tm: any) => {
        const team = tm.teams as any;
        if (!team) return;
        if (!teamsByUser.has(tm.user_id)) teamsByUser.set(tm.user_id, []);
        teamsByUser.get(tm.user_id)!.push({ id: team.id, name: team.name });
      });

      const { data: perfData } = await supabase
        .from('performance')
        .select('user_id, total_ideas, win_rate, total_return_pct, alpha_pct')
        .in('user_id', userIds);

      setPerformance(
        members.map((m: any) => {
          const userId = m.user_id;
          const userRecs = (allRecommendations || []).filter((r: any) => r.user_id === userId);
          const closedRecs = userRecs.filter((r: any) => r.status === 'CLOSED');
          const profitable = closedRecs.filter((r: any) => (r.final_return_pct || 0) > 0).length;
          const winRate = closedRecs.length > 0 ? (profitable / closedRecs.length) * 100 : 0;
          const avgReturn =
            closedRecs.length > 0
              ? closedRecs.reduce((sum: number, r: any) => sum + (r.final_return_pct || 0), 0) /
                closedRecs.length
              : 0;

          const perf = perfData?.find((p: any) => p.user_id === userId);
          const totalRecs = userRecs.length > 0 ? userRecs.length : perf?.total_ideas || 0;
          const finalWinRate = userRecs.length > 0 ? winRate : perf?.win_rate || 0;
          const finalReturn = closedRecs.length > 0 ? avgReturn : perf?.total_return_pct || 0;

          return {
            userId,
            username: usernameById.get(userId) || 'Unknown',
            returns: { '1M': finalReturn, '3M': finalReturn, '6M': finalReturn, '12M': finalReturn },
            sharpe: 0,
            volatility: 0,
            drawdown: 0,
            totalRecommendations: totalRecs,
            openPositions: userRecs.filter((r: any) => r.status === 'OPEN').length,
            closedPositions: closedRecs.length,
            winRate: finalWinRate,
            teams: teamsByUser.get(userId) || [],
          };
        })
      );

      safeLog('Dashboard data loaded for', userIds.length, 'members');
    } catch (err: any) {
      safeError('Error loading dashboard data:', err);
      setError(getUserFriendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [orgId, restrictKey, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { users, performance, joinCode, loading, error, refetch: fetchData };
}
