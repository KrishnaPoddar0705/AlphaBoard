/**
 * StockSelectionPanel Component
 * 
 * Side panel for selecting stocks from Recommendations, Watchlist, and History.
 * Displays list of stocks with their current status and allows selection.
 */

// import React from 'react';
import clsx from 'clsx';
import { PaperCard } from './paper/PaperCard';
// import { HairlineDivider } from './paper/HairlineDivider'; // Unused

interface StockSelectionPanelProps {
  recommendations: any[];
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
  viewMode: 'active' | 'watchlist' | 'history';
  onViewModeChange: (mode: 'active' | 'watchlist' | 'history') => void;
  className?: string;
}

export function StockSelectionPanel({
  recommendations,
  selectedTicker,
  onSelectTicker,
  viewMode,
  onViewModeChange,
  className = '',
}: StockSelectionPanelProps) {
  // Filter recommendations by view mode
  const filteredRecs = recommendations.filter((rec) => {
    if (viewMode === 'active') return rec.status === 'OPEN';
    if (viewMode === 'watchlist') return rec.status === 'WATCHLIST';
    if (viewMode === 'history') return rec.status === 'CLOSED';
    return false;
  });

  // Get unique tickers (group by ticker)
  const uniqueTickers = Array.from(
    new Map(filteredRecs.map((rec) => [rec.ticker, rec])).values()
  );

  const getReturnDisplay = (rec: any) => {
    if (rec.status === 'CLOSED' && rec.final_return_pct !== undefined) {
      return rec.final_return_pct;
    }
    if (rec.entry_price && rec.current_price) {
      const returnPct =
        ((rec.current_price - rec.entry_price) / rec.entry_price) * 100;
      return rec.action === 'SELL' ? -returnPct : returnPct;
    }
    return null;
  };

  return (
    <PaperCard padding="none" className={clsx('h-full flex flex-col rounded-lg', className)}>
      {/* Header */}
      <div className="p-4 border-b border-[var(--paper-rule)]">
        <h2 className="text-lg font-bold text-[var(--paper-ink)] mb-3">
          My Stocks
        </h2>
        
        {/* View Mode Tabs */}
        <div className="flex gap-1 rounded-lg bg-[var(--paper-bg-alt)] p-1">
          <button
            onClick={() => onViewModeChange('active')}
            className={clsx(
              'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              viewMode === 'active'
                ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                : 'text-[var(--paper-muted)] hover:text-[var(--paper-ink)]'
            )}
          >
            Active
          </button>
          <button
            onClick={() => onViewModeChange('watchlist')}
            className={clsx(
              'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              viewMode === 'watchlist'
                ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                : 'text-[var(--paper-muted)] hover:text-[var(--paper-ink)]'
            )}
          >
            Watchlist
          </button>
          <button
            onClick={() => onViewModeChange('history')}
            className={clsx(
              'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              viewMode === 'history'
                ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                : 'text-[var(--paper-muted)] hover:text-[var(--paper-ink)]'
            )}
          >
            History
          </button>
        </div>
      </div>

      {/* Stock List */}
      <div className="flex-1 overflow-y-auto">
        {uniqueTickers.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-[var(--paper-muted)]">
              No {viewMode === 'active' ? 'active' : viewMode === 'watchlist' ? 'watchlist' : 'closed'} stocks
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--paper-rule-light)]">
            {uniqueTickers.map((rec, index) => {
              const isSelected = rec.ticker === selectedTicker;
              const returnPct = getReturnDisplay(rec);
              const isPositive = returnPct !== null && returnPct >= 0;

              return (
                <button
                  key={`${rec.ticker}-${index}`}
                  onClick={() => onSelectTicker(rec.ticker)}
                  className={clsx(
                    'w-full p-4 text-left transition-colors rounded-lg',
                    isSelected
                      ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                      : 'hover:bg-[var(--paper-bg-alt)] text-[var(--paper-ink)]'
                  )}
                  style={{ borderRadius: 'var(--paper-radius-lg)' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">{rec.ticker}</span>
                    {returnPct !== null && (
                      <span
                        className={clsx(
                          'text-xs font-medium',
                          isSelected
                            ? 'text-[var(--paper-bg)]'
                            : isPositive
                            ? 'text-[var(--pos-green)]'
                            : 'text-[var(--neg-red)]'
                        )}
                      >
                        {isPositive ? '+' : ''}
                        {returnPct.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  {rec.current_price && (
                    <div className={clsx(
                      'text-xs',
                      isSelected ? 'text-[var(--paper-bg)] opacity-80' : 'text-[var(--paper-muted)]'
                    )}>
                      {(() => {
                        const symbol = rec.ticker.includes('.NS') || rec.ticker.includes('.BO') ? '₹' : '$';
                        return `${symbol}${rec.current_price.toFixed(2)}`;
                      })()}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </PaperCard>
  );
}

