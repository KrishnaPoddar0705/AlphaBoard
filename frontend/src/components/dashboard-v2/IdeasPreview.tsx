/**
 * Ideas Preview Component
 * 
 * Preview list of ideas with link to full Ideas page.
 * Features:
 * - Recent ideas display
 * - Quick actions
 * - Link to full ideas page
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../ui-v2/Card';
import { SectionHeader } from '../ui-v2/SectionHeader';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';

interface IdeasPreviewProps {
  recommendations: any[];
  maxItems?: number;
  onIdeaClick?: (idea: any) => void;
}

export function IdeasPreview({
  recommendations,
  maxItems = 5,
  onIdeaClick,
}: IdeasPreviewProps) {
  const activeIdeas = recommendations
    .filter(r => r.status === 'OPEN')
    .slice(0, maxItems);

  const formatReturn = (returnPct: number | null | undefined) => {
    if (returnPct === null || returnPct === undefined) return 'N/A';
    const sign = returnPct >= 0 ? '+' : '';
    return `${sign}${returnPct.toFixed(2)}%`;
  };

  const getReturnColor = (returnPct: number | null | undefined) => {
    if (returnPct === null || returnPct === undefined) return 'text-[var(--text-tertiary)]';
    return returnPct >= 0 ? 'text-emerald-400' : 'text-red-400';
  };

  return (
    <Card variant="elevated" padding="lg">
      <CardHeader>
        <SectionHeader
          title="My Ideas"
          actions={
            <Link
              to="/ideas"
              className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          }
        />
      </CardHeader>
      <CardContent>
        {activeIdeas.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[var(--text-secondary)] mb-4">No active ideas</p>
            <Link
              to="/ideas"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-400 transition-colors text-sm font-medium"
            >
              Add Your First Idea
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {activeIdeas.map((idea) => {
              const returnPct = idea.current_price && idea.entry_price
                ? ((idea.current_price - idea.entry_price) / idea.entry_price) * 100 * (idea.action === 'SELL' ? -1 : 1)
                : null;

              return (
                <div
                  key={idea.id}
                  onClick={() => onIdeaClick?.(idea)}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--list-item-hover)] transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {idea.ticker}
                      </span>
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded',
                        idea.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      )}>
                        {idea.action}
                      </span>
                    </div>
                    {idea.thesis && (
                      <p className="text-xs text-[var(--text-secondary)] truncate">
                        {idea.thesis}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className={clsx('text-sm font-semibold tabular-nums', getReturnColor(returnPct))}>
                      {formatReturn(returnPct)}
                    </div>
                    {returnPct !== null && returnPct !== undefined && (
                      returnPct >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )
                    )}
                  </div>
                </div>
              );
            })}
            {recommendations.filter(r => r.status === 'OPEN').length > maxItems && (
              <Link
                to="/ideas"
                className="block text-center py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                View {recommendations.filter(r => r.status === 'OPEN').length - maxItems} more ideas
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

