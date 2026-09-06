import { useState } from 'react';
import { FileText } from 'lucide-react';
import RecommendationDetailCard from './RecommendationDetailCard';
import type { IrrTarget, Recommendation } from './types';

type ActionFilter = 'ALL' | 'BUY' | 'SELL';
type StatusFilter = 'ALL' | 'OPEN' | 'CLOSED';

const isNotWatchlist = (r: Recommendation) => r.status !== 'WATCHLIST' && r.action !== 'WATCH';

/**
 * The body of an expanded analyst row: their recommendations with BUY/SELL and
 * OPEN/CLOSED filters.
 *
 * Filter state lives here rather than in the dashboard above. In the original
 * AdminDashboard it sat at the page level, so opening a second analyst inherited the
 * first one's filters -- and the "no recommendations match" empty state could appear
 * for someone the user had not filtered anything on.
 */
export default function AnalystRecommendationList({
  recommendations,
  irrTargets,
}: {
  recommendations: Recommendation[];
  irrTargets: IrrTarget[];
}) {
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const visible = recommendations.filter((r) =>
    isNotWatchlist(r) &&
    (actionFilter === 'ALL' || r.action === actionFilter) &&
    (statusFilter === 'ALL' || r.status === statusFilter)
  );

  const hasAnyRecommendations = recommendations.filter(isNotWatchlist).length > 0;

  const filterButton = (
    active: boolean,
    activeClass: string,
    label: string,
    onClick: () => void
  ) => (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
        active ? activeClass : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      {label}
    </button>
  );

  const indigo = 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30';

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h4 className="font-semibold text-[var(--text-primary)] flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5" />
            All Recommendations ({visible.length})
          </h4>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--text-secondary)] font-medium">Action:</label>
              <div className="flex gap-1 bg-[var(--card-bg)] rounded-lg p-1 border border-[var(--border-color)]">
                {filterButton(actionFilter === 'ALL', indigo, 'All', () => setActionFilter('ALL'))}
                {filterButton(actionFilter === 'BUY', 'bg-green-500/20 text-green-400 border border-green-500/30', 'BUY', () => setActionFilter('BUY'))}
                {filterButton(actionFilter === 'SELL', 'bg-red-500/20 text-red-400 border border-red-500/30', 'SELL', () => setActionFilter('SELL'))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-[var(--text-secondary)] font-medium">Status:</label>
              <div className="flex gap-1 bg-[var(--card-bg)] rounded-lg p-1 border border-[var(--border-color)]">
                {filterButton(statusFilter === 'ALL', indigo, 'All', () => setStatusFilter('ALL'))}
                {filterButton(statusFilter === 'OPEN', indigo, 'OPEN', () => setStatusFilter('OPEN'))}
                {filterButton(statusFilter === 'CLOSED', 'bg-slate-500/20 text-slate-400 border border-slate-500/30', 'CLOSED', () => setStatusFilter('CLOSED'))}
              </div>
            </div>
          </div>
        </div>

        {visible.length > 0 ? (
          <div className="space-y-4">
            {visible.map((rec) => (
              <RecommendationDetailCard
                key={rec.id}
                recommendation={rec}
                irrTargets={irrTargets}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--text-secondary)] bg-[var(--card-bg)] rounded border border-[var(--border-color)]">
            {!hasAnyRecommendations
              ? 'No recommendations yet'
              : `No recommendations match the selected filters (${actionFilter !== 'ALL' ? actionFilter : ''} ${statusFilter !== 'ALL' ? statusFilter : ''})`.trim()}
          </div>
        )}
      </div>
    </div>
  );
}
