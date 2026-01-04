/**
 * Stock Panel Slide-Out Component
 * 
 * A second panel that slides out from the LEFT side, positioned after the main sidebar.
 * Shows recommendations, watchlist, and history in a table format matching RecommendationList.
 */

import { useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { getReturnFromCacheOrCalculate } from '../../lib/returnsCache';

interface StockPanelSlideOutProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations: any[];
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
  viewMode: 'active' | 'watchlist' | 'history';
  onViewModeChange: (mode: 'active' | 'watchlist' | 'history') => void;
  onRefresh: () => void;
  onCloseIdea?: (rec: any, e: React.MouseEvent) => void;
  onPromoteWatchlist?: (rec: any, action: 'BUY' | 'SELL', e: React.MouseEvent) => void;
  companyNames?: Record<string, string>;
  sidebarWidth?: number;
}

export function StockPanelSlideOut({
  isOpen,
  onClose,
  recommendations,
  selectedTicker,
  onSelectTicker,
  viewMode,
  onViewModeChange,
  onRefresh: _onRefresh,
  onCloseIdea,
  onPromoteWatchlist,
  companyNames = {},
  sidebarWidth = 256,
}: StockPanelSlideOutProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when panel is open on mobile
      if (window.innerWidth < 1024) {
        document.body.style.overflow = 'hidden';
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

  // Filter recommendations by view mode
  const displayedRecommendations = recommendations.filter(rec => {
    if (viewMode === 'active') return rec.status === 'OPEN';
    if (viewMode === 'watchlist') return rec.status === 'WATCHLIST';
    if (viewMode === 'history') return rec.status === 'CLOSED';
    return false;
  });

  const activeCount = recommendations.filter(r => r.status === 'OPEN').length;
  const watchlistCount = recommendations.filter(r => r.status === 'WATCHLIST').length;
  const historyCount = recommendations.filter(r => r.status === 'CLOSED').length;

  const getCurrencySymbol = (ticker: string) => {
    if (ticker.includes('.NS') || ticker.includes('.BO')) return '₹';
    return '$';
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fadeIn"
        onClick={onClose}
      />

      {/* Slide-Out Panel - LEFT SIDE */}
      <div
        className={clsx(
          'fixed z-50 bg-[var(--paper-bg)] border-r border-[var(--paper-border)] shadow-2xl',
          'h-full top-0 bottom-0',
          isMobile
            ? 'left-0 right-0 w-full animate-slideInLeft'
            : 'w-[480px] animate-slideInLeft',
          'flex flex-col'
        )}
        onClick={(e) => e.stopPropagation()}
        style={{
          borderRadius: isMobile ? '0' : '0 var(--paper-radius-lg) var(--paper-radius-lg) 0',
          left: isMobile ? '0' : `${sidebarWidth}px`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--paper-border)] flex-shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-[var(--paper-ink)]">
              My Stocks
            </h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg hover:bg-[var(--paper-bg-alt)] transition-colors text-[var(--paper-muted)] hover:text-[var(--paper-ink)]"
            aria-label="Close panel"
            style={{ borderRadius: 'var(--paper-radius-lg)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="px-6 py-3 border-b border-[var(--paper-border)] flex-shrink-0">
          <div className="flex gap-2 p-1 bg-[var(--paper-bg-alt)] rounded-xl border border-[var(--paper-border)] justify-center max-w-md mx-auto">
            <button
              onClick={() => onViewModeChange('active')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                viewMode === 'active'
                  ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)] shadow-lg'
                  : 'text-[var(--paper-muted)] hover:text-[var(--paper-ink)] hover:bg-[var(--paper-bg)]'
              )}
              style={{ borderRadius: 'var(--paper-radius-lg)' }}
            >
              Active
              {activeCount > 0 && (
                <span className={clsx(
                  'px-1.5 py-0.5 text-[10px] font-bold rounded',
                  viewMode === 'active' ? 'bg-[var(--paper-bg)]/20' : 'bg-[var(--paper-bg-alt)]'
                )}>
                  {activeCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onViewModeChange('watchlist')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                viewMode === 'watchlist'
                  ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)] shadow-lg'
                  : 'text-[var(--paper-muted)] hover:text-[var(--paper-ink)] hover:bg-[var(--paper-bg)]'
              )}
              style={{ borderRadius: 'var(--paper-radius-lg)' }}
            >
              Watchlist
              {watchlistCount > 0 && (
                <span className={clsx(
                  'px-1.5 py-0.5 text-[10px] font-bold rounded',
                  viewMode === 'watchlist' ? 'bg-[var(--paper-bg)]/20' : 'bg-[var(--paper-bg-alt)]'
                )}>
                  {watchlistCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onViewModeChange('history')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                viewMode === 'history'
                  ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)] shadow-lg'
                  : 'text-[var(--paper-muted)] hover:text-[var(--paper-ink)] hover:bg-[var(--paper-bg)]'
              )}
              style={{ borderRadius: 'var(--paper-radius-lg)' }}
            >
              History
              {historyCount > 0 && (
                <span className={clsx(
                  'px-1.5 py-0.5 text-[10px] font-bold rounded',
                  viewMode === 'history' ? 'bg-[var(--paper-bg)]/20' : 'bg-[var(--paper-bg-alt)]'
                )}>
                  {historyCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {displayedRecommendations.length === 0 ? (
            <div className="flex items-center justify-center h-full px-6 py-10">
              <div className="text-center">
                <p className="text-[var(--paper-muted)] text-sm">
                  {viewMode === 'active' ? "No active recommendations." :
                    viewMode === 'watchlist' ? "Watchlist is empty." : "No past ideas found."}
                </p>
              </div>
            </div>
          ) : (
            <div>
              {/* Table Header */}
              <div className="px-6 py-4 bg-[var(--paper-bg-alt)] border-b border-[var(--paper-border)] sticky top-0 z-10">
                <div className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-3 px-2 text-xs font-semibold text-[var(--paper-muted)] uppercase tracking-wider">TICKER</div>
                  <div className="col-span-2 px-2 text-xs font-semibold text-[var(--paper-muted)] uppercase tracking-wider">
                    {viewMode === 'watchlist' ? 'CURRENT PRICE' : 'ENTRY'}
                  </div>
                  {viewMode === 'watchlist' && (
                    <>
                      <div className="col-span-2 px-2 text-xs font-semibold text-[var(--paper-muted)] uppercase tracking-wider">BUY PRICE</div>
                      <div className="col-span-2 px-2 text-xs font-semibold text-[var(--paper-muted)] uppercase tracking-wider">SELL PRICE</div>
                    </>
                  )}
                  {viewMode !== 'watchlist' && (
                    <div className="col-span-2 px-2 text-xs font-semibold text-[var(--paper-muted)] uppercase tracking-wider">CURRENT PRICE</div>
                  )}
                  <div className={clsx('px-2 text-xs font-semibold text-[var(--paper-muted)] uppercase tracking-wider', viewMode === 'watchlist' ? 'col-span-2' : 'col-span-3')}>RETURN</div>
                  <div className="col-span-1"></div>
                </div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-[var(--paper-rule-light)]">
                {displayedRecommendations.map((rec) => {
                  const entry = rec.entry_price || 0;
                  const isClosed = rec.status === 'CLOSED';
                  const current = isClosed ? (rec.exit_price || entry) : rec.current_price;
                  const hasCurrentPrice = current !== undefined && current !== null;

                  let ret = 0;
                  if (isClosed && rec.final_return_pct !== undefined) {
                    ret = rec.final_return_pct;
                  } else if (hasCurrentPrice && entry > 0 && viewMode !== 'watchlist') {
                    ret = getReturnFromCacheOrCalculate(
                      rec.ticker,
                      entry,
                      current || null,
                      rec.action || 'BUY'
                    );
                  }

                  const isSelected = selectedTicker === rec.ticker;
                  const isPositive = ret >= 0;
                  const dateAdded = new Date(rec.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                  const companyName = companyNames[rec.ticker];
                  const currencySymbol = getCurrencySymbol(rec.ticker);

                  return (
                    <div
                      key={rec.id}
                      onClick={() => onSelectTicker(rec.ticker)}
                      className={clsx(
                        'group relative cursor-pointer transition-all duration-200 px-6 py-5',
                        isSelected
                          ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)] border-l-2 border-[var(--paper-ink)]'
                          : 'hover:bg-[var(--paper-bg-alt)] border-l-2 border-transparent'
                      )}
                    >
                      <div className="grid grid-cols-12 gap-4 items-center">
                        {/* Ticker Column */}
                        <div className="col-span-3 px-2">
                          <div className="flex flex-col gap-1">
                            <span className={clsx(
                              'text-sm font-semibold leading-tight',
                              isSelected ? 'text-[var(--paper-bg)]' : 'text-[var(--paper-ink)]'
                            )}>
                              {rec.ticker}
                            </span>
                            {companyName && (
                              <div className={clsx(
                                'text-xs truncate',
                                isSelected ? 'text-[var(--paper-bg)] opacity-80' : 'text-[var(--paper-muted)]'
                              )}>
                                {companyName}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className={clsx(
                                'text-[10px] font-bold uppercase px-2 py-0.5 rounded flex-shrink-0',
                                rec.action === 'WATCH'
                                  ? 'bg-blue-500/20 text-blue-600 border border-blue-500/30'
                                  : rec.action === 'BUY'
                                    ? 'bg-[var(--pos-green)]/20 text-[var(--pos-green)] border border-[var(--pos-green)]/30'
                                    : 'bg-[var(--neg-red)]/20 text-[var(--neg-red)] border border-[var(--neg-red)]/30',
                                isSelected && 'border-opacity-50'
                              )}>
                                {rec.action}
                              </span>
                              <span className={clsx(
                                'text-[10px]',
                                isSelected ? 'text-[var(--paper-bg)] opacity-70' : 'text-[var(--paper-muted)]'
                              )}>
                                {dateAdded}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Entry / Current Price Column */}
                        <div className="col-span-2 px-2">
                          <span className={clsx(
                            'text-sm font-mono font-medium',
                            isSelected ? 'text-[var(--paper-bg)]' : 'text-[var(--paper-ink)]'
                          )}>
                            {viewMode === 'watchlist' 
                              ? (hasCurrentPrice ? `${currencySymbol}${current.toFixed(2)}` : '-')
                              : `${currencySymbol}${entry.toFixed(2)}`
                            }
                          </span>
                        </div>

                        {/* Current Price / BUY Price / SELL Price */}
                        {viewMode === 'watchlist' ? (
                          <>
                            <div className="col-span-2 px-2">
                              <span className={clsx(
                                'text-sm font-mono font-medium',
                                rec.buy_price && hasCurrentPrice && current <= rec.buy_price
                                  ? 'text-[var(--pos-green)] font-bold'
                                  : isSelected ? 'text-[var(--paper-bg)]' : 'text-[var(--paper-ink)]'
                              )}>
                                {rec.buy_price ? `${currencySymbol}${rec.buy_price.toFixed(2)}` : '-'}
                              </span>
                            </div>
                            <div className="col-span-2 px-2">
                              <span className={clsx(
                                'text-sm font-mono font-medium',
                                rec.sell_price && hasCurrentPrice && current >= rec.sell_price
                                  ? 'text-[var(--neg-red)] font-bold'
                                  : isSelected ? 'text-[var(--paper-bg)]' : 'text-[var(--paper-ink)]'
                              )}>
                                {rec.sell_price ? `${currencySymbol}${rec.sell_price.toFixed(2)}` : '-'}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="col-span-2 px-2">
                            <span className={clsx(
                              'text-sm font-mono font-medium',
                              isSelected ? 'text-[var(--paper-bg)]' : 'text-[var(--paper-ink)]'
                            )}>
                              {hasCurrentPrice ? `${currencySymbol}${current.toFixed(2)}` : '-'}
                            </span>
                          </div>
                        )}

                        {/* Return Column */}
                        <div className={clsx('px-2', viewMode === 'watchlist' ? 'col-span-2' : 'col-span-3')}>
                          {viewMode !== 'watchlist' ? (
                            <div className="flex items-center gap-4 whitespace-nowrap group/return">
                              <span className={clsx(
                                'text-sm font-semibold font-mono flex-shrink-0',
                                ret === 0
                                  ? (isSelected ? 'text-[var(--paper-bg)]' : 'text-[var(--paper-ink)]')
                                  : isPositive
                                    ? 'text-[var(--pos-green)]'
                                    : 'text-[var(--neg-red)]'
                              )}>
                                {isPositive ? '+' : ''}{ret.toFixed(2)}%
                              </span>
                              {/* Action button only visible on hover */}
                              {viewMode === 'active' && onCloseIdea && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCloseIdea(rec, e);
                                  }}
                                  className={clsx(
                                    'px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0',
                                    'opacity-0 group-hover/return:opacity-100 pointer-events-none group-hover/return:pointer-events-auto',
                                    rec.action === 'BUY'
                                      ? 'bg-[var(--neg-red)]/20 text-[var(--neg-red)] hover:bg-[var(--neg-red)]/30 border border-[var(--neg-red)]/30'
                                      : 'bg-[var(--pos-green)]/20 text-[var(--pos-green)] hover:bg-[var(--pos-green)]/30 border border-[var(--pos-green)]/30'
                                  )}
                                  style={{ borderRadius: 'var(--paper-radius-lg)' }}
                                  title={rec.action === 'BUY' ? 'SELL Position' : 'BUY Position'}
                                >
                                  {rec.action === 'BUY' ? 'SELL' : 'BUY'}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className={clsx(
                              'text-sm',
                              isSelected ? 'text-[var(--paper-bg)] opacity-70' : 'text-[var(--paper-muted)]'
                            )}>
                              -
                            </span>
                          )}
                        </div>

                        {/* Actions Column */}
                        <div className="col-span-1 flex justify-end items-center gap-2 px-2">
                          {viewMode === 'watchlist' && onPromoteWatchlist && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPromoteWatchlist(rec, 'BUY', e);
                                }}
                                className="px-3 py-1.5 text-xs font-bold text-[var(--pos-green)] hover:bg-[var(--pos-green)]/20 rounded-lg border border-[var(--pos-green)]/30 transition-colors"
                                style={{ borderRadius: 'var(--paper-radius-lg)' }}
                              >
                                BUY
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPromoteWatchlist(rec, 'SELL', e);
                                }}
                                className="px-3 py-1.5 text-xs font-bold text-[var(--neg-red)] hover:bg-[var(--neg-red)]/20 rounded-lg border border-[var(--neg-red)]/30 transition-colors"
                                style={{ borderRadius: 'var(--paper-radius-lg)' }}
                              >
                                SELL
                              </button>
                            </>
                          )}
                          {/* Arrow indicator when selected */}
                          {isSelected && (
                            <ChevronRight className={clsx(
                              'w-4 h-4 flex-shrink-0',
                              isSelected ? 'text-[var(--paper-bg)]' : 'text-[var(--paper-ink)]'
                            )} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
