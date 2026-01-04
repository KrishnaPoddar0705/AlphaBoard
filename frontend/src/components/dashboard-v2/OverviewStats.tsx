/**
 * Overview Stats Component
 * 
 * Row of stat cards showing key metrics:
 * - Total Return
 * - Win Rate
 * - Active Ideas
 * - Alerts
 */

import { useMemo } from 'react';
import { StatCard } from '../ui-v2/StatCard';
import { TrendingUp, Target, AlertCircle, Lightbulb } from 'lucide-react';

interface OverviewStatsProps {
  recommendations: any[];
  portfolioReturns: Array<{ week: string; return: number; cumulativeReturn: number }>;
  alertsCount?: number;
  loading?: boolean;
}

export function OverviewStats({
  recommendations,
  portfolioReturns,
  alertsCount = 0,
  loading = false,
}: OverviewStatsProps) {
  // Calculate metrics
  const metrics = useMemo(() => {
    const activeIdeas = recommendations.filter(r => r.status === 'OPEN').length;
    const closedIdeas = recommendations.filter(r => r.status === 'CLOSED');
    const winningIdeas = closedIdeas.filter(r => (r.final_return_pct || 0) > 0).length;
    const winRate = closedIdeas.length > 0 ? (winningIdeas / closedIdeas.length) * 100 : 0;

    // Total return from portfolio returns (cumulative)
    const totalReturn = portfolioReturns.length > 0
      ? portfolioReturns[portfolioReturns.length - 1]?.cumulativeReturn || 0
      : 0;

    return {
      totalReturn,
      winRate,
      activeIdeas,
      alertsCount,
    };
  }, [recommendations, portfolioReturns, alertsCount]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-[var(--card-bg)] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Total Return"
        value={metrics.totalReturn}
        trend={{
          value: metrics.totalReturn,
          label: 'Cumulative',
        }}
        icon={<TrendingUp className="w-8 h-8" />}
        variant="highlight"
      />
      <StatCard
        label="Win Rate"
        value={`${metrics.winRate.toFixed(1)}%`}
        description={`${metrics.winRate > 0 ? Math.round((metrics.winRate / 100) * recommendations.filter(r => r.status === 'CLOSED').length) : 0} of ${recommendations.filter(r => r.status === 'CLOSED').length} closed`}
        icon={<Target className="w-8 h-8" />}
      />
      <StatCard
        label="Active Ideas"
        value={metrics.activeIdeas}
        description={`${recommendations.filter(r => r.status === 'WATCHLIST').length} in watchlist`}
        icon={<Lightbulb className="w-8 h-8" />}
      />
      <StatCard
        label="Alerts"
        value={metrics.alertsCount}
        description="Price alerts active"
        icon={<AlertCircle className="w-8 h-8" />}
        variant={metrics.alertsCount > 0 ? 'highlight' : 'default'}
      />
    </div>
  );
}

