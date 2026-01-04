import { useState, useEffect, useCallback } from 'react';
import { getVisibleRecommendations } from '../lib/edgeFunctions';

interface UseTeamRecommendationsOptions {
    teamId?: string | null;
    status?: 'OPEN' | 'CLOSED' | 'WATCHLIST';
    autoFetch?: boolean;
}

export function useTeamRecommendations(options: UseTeamRecommendationsOptions = {}) {
    const { teamId, status, autoFetch = true } = options;
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchRecommendations = useCallback(async () => {
        if (!autoFetch) return;

        setLoading(true);
        setError(null);
        try {
            const response = await getVisibleRecommendations(teamId || undefined, status);
            setRecommendations(response.recommendations || []);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch recommendations';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [teamId, status, autoFetch]);

    useEffect(() => {
        fetchRecommendations();
    }, [fetchRecommendations]);

    return {
        recommendations,
        loading,
        error,
        refresh: fetchRecommendations,
    };
}


