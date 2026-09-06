import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatPercent, type AnalystPerformance } from './types';

/**
 * The analyst roster with expandable detail rows.
 *
 * The expanded content comes in through `renderExpanded` rather than being built
 * here, because the two dashboards fetch it differently -- the admin view loads a
 * member's recommendations on demand, the team view already has the team's. The
 * table only owns which row is open.
 */
export default function AnalystPerformanceTable({
  title,
  rows,
  expandedUserId,
  onToggle,
  renderExpanded,
  emptyLabel = 'No analyst performance data available',
}: {
  title: string;
  rows: AnalystPerformance[];
  expandedUserId: string | null;
  onToggle: (userId: string) => void;
  renderExpanded: (userId: string) => React.ReactNode;
  emptyLabel?: string;
}) {
  return (
    <div className="glass rounded-xl shadow-xl mb-8 border border-[var(--border-color)]">
      <div className="p-6 border-b border-[var(--border-color)]">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border-color)]">
          <thead className="bg-[var(--card-bg)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider w-8" />
              {['Analyst', 'Teams', 'Total Ideas', 'Win Rate', '12M Return', 'Sharpe'].map((label) => (
                <th
                  key={label}
                  className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-slate-900/30 divide-y divide-white/10">
            {rows.map((analyst) => (
              <React.Fragment key={analyst.userId}>
                <tr
                  className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => onToggle(analyst.userId)}
                >
                  <td className="px-6 py-4">
                    {expandedUserId === analyst.userId ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-[var(--text-primary)]">
                      {analyst.username || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {analyst.teams && analyst.teams.length > 0 ? (
                        analyst.teams.map((team) => (
                          <span
                            key={team.id}
                            className="px-2 py-1 text-xs bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30"
                          >
                            {team.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[var(--text-tertiary)]">No teams</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[var(--text-primary)]">{analyst.totalRecommendations}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[var(--text-primary)]">{analyst.winRate.toFixed(1)}%</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${analyst.returns['12M'] >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPercent(analyst.returns['12M'])}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[var(--text-primary)]">
                      {analyst.sharpe ? analyst.sharpe.toFixed(2) : 'N/A'}
                    </div>
                  </td>
                </tr>
                {expandedUserId === analyst.userId && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 bg-[var(--card-bg)]">
                      {renderExpanded(analyst.userId)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-[var(--text-secondary)]">
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
