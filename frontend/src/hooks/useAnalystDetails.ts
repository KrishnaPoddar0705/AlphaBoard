import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getVisibleRecommendations } from '../lib/edgeFunctions';
import { safeError, safeWarn } from '../lib/logger';
import type { IrrTarget, Recommendation } from '../components/organization/dashboard/types';

const isNotWatchlist = (r: any) => r.status !== 'WATCHLIST' && r.action !== 'WATCH';

/**
 * Lazily loads one analyst's recommendations and IRR targets when their dashboard
 * row is expanded, caching per user so re-opening a row costs nothing.
 *
 * `teamId` scopes the recommendations through get-visible-recommendations, which now
 * resolves a team by recommendation tag rather than by author.
 */
export function useAnalystDetails(teamId: string | null) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation[]>>({});
  const [irrTargets, setIrrTargets] = useState<Record<string, IrrTarget[]>>({});

  const toggle = useCallback(async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);

    if (recommendations[userId]) return;

    try {
      let recs: Recommendation[] = [];
      let edgeFunctionWorked = false;

      try {
        const response = await getVisibleRecommendations(teamId || undefined, undefined);
        recs = (response.recommendations || [])
          .filter((r: any) => r.user_id === userId)
          .filter(isNotWatchlist);
        edgeFunctionWorked = true;
      } catch (err) {
        safeWarn('Failed to fetch via Edge Function, falling back to a direct query', err);
      }

      // Only fall back when the Edge Function actually FAILED. The original code
      // fell back whenever it returned zero rows, which meant an analyst with no
      // recommendations in the selected team was shown all of their recommendations
      // instead -- silently defeating the team filter it was there to respect.
      if (!edgeFunctionWorked) {
        const { data: recData } = await supabase
          .from('recommendations')
          .select('id, user_id, ticker, action, entry_price, exit_price, status, thesis, entry_date, images, final_return_pct, final_alpha_pct')
          .eq('user_id', userId)
          .neq('status', 'WATCHLIST')
          .neq('action', 'WATCH')
          .order('entry_date', { ascending: false });
        recs = recData || [];
      }

      setRecommendations((prev) => ({ ...prev, [userId]: recs }));

      // The table is still named price_targets; the rows hold IRR targets now.
      const { data: targets } = await supabase
        .from('price_targets')
        .select('id, ticker, target_irr, timeframe_start_months, timeframe_end_months, target_price, target_date, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      setIrrTargets((prev) => ({ ...prev, [userId]: targets || [] }));
    } catch (err) {
      safeError('Error fetching analyst details:', err);
      // Cache the empty result so an expand/collapse loop does not retry forever.
      setRecommendations((prev) => ({ ...prev, [userId]: [] }));
      setIrrTargets((prev) => ({ ...prev, [userId]: [] }));
    }
  }, [expandedUserId, recommendations, teamId]);

  /** Drop the cache -- the team filter changed, so the scoped answers are stale. */
  const reset = useCallback(() => {
    setExpandedUserId(null);
    setRecommendations({});
    setIrrTargets({});
  }, []);

  return { expandedUserId, recommendations, irrTargets, toggle, reset };
}
