import React from 'react';
import { Plus, ChevronRight, Mic } from 'lucide-react';
import { getReturnFromCacheOrCalculate } from '../lib/returnsCache';

interface RecommendationListProps {
    recommendations: any[];
    selectedStock: any;
    setSelectedStock: (rec: any) => void;
    viewMode: 'active' | 'watchlist' | 'history';
    setViewMode: (mode: 'active' | 'watchlist' | 'history') => void;
    handleCloseIdea: (rec: any, e: React.MouseEvent) => void;
    handlePromoteWatchlist: (rec: any, action: 'BUY' | 'SELL', e: React.MouseEvent) => void;
    handleDeleteWatchlist: (rec: any, e: React.MouseEvent) => void;
    onNewIdea: () => void;
    companyNames?: Record<string, string>;
}

export default function RecommendationList({
    recommendations,
    selectedStock,
    setSelectedStock,
    viewMode,
    setViewMode,
    handleCloseIdea,
    handlePromoteWatchlist,
    handleDeleteWatchlist: _handleDeleteWatchlist, // Kept for API compatibility but no longer used
    onNewIdea,
    companyNames = {}
}: RecommendationListProps) {

    const displayedRecommendations = recommendations.filter(rec => {
        if (viewMode === 'active') return rec.status === 'OPEN';
        if (viewMode === 'watchlist') return rec.status === 'WATCHLIST';
        if (viewMode === 'history') return rec.status === 'CLOSED';
        return false;
    });

    const activeCount = recommendations.filter(r => r.status === 'OPEN').length;
    const watchlistCount = recommendations.filter(r => r.status === 'WATCHLIST').length;
    const historyCount = recommendations.filter(r => r.status === 'CLOSED').length;

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)] min-w-[480px]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] flex-shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-[var(--text-primary)]">
                        My Ideas
                    </h1>
                    <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                            Saved
                        </button>
                        <button className="px-3 py-1.5 text-sm font-medium bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-1.5">
                            <Mic className="w-4 h-4" />
                            Podcast
                        </button>
                        <button
                            onClick={onNewIdea}
                            className="px-3 py-1.5 text-sm font-medium bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            <Plus className="w-4 h-4" />
                            New
                        </button>
                    </div>
                </div>
            </div>

            {/* View Mode Toggle */}
            <div className="px-6 py-3 border-b border-[var(--border-color)] flex-shrink-0">
                <div className="flex gap-2 p-1 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] justify-center max-w-md mx-auto">
                    <button
                        onClick={() => setViewMode('active')}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${viewMode === 'active' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--list-item-hover)]'}`}
                    >
                        Active
                        {activeCount > 0 && (
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${viewMode === 'active' ? 'bg-white/20' : 'bg-[var(--bg-secondary)]'}`}>
                                {activeCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setViewMode('watchlist')}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${viewMode === 'watchlist' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--list-item-hover)]'}`}
                    >
                        Watchlist
                        {watchlistCount > 0 && (
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${viewMode === 'watchlist' ? 'bg-white/20' : 'bg-[var(--bg-secondary)]'}`}>
                                {watchlistCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setViewMode('history')}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all ${viewMode === 'history' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--list-item-hover)]'}`}
                    >
                        History
                        {historyCount > 0 && (
                            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${viewMode === 'history' ? 'bg-white/20' : 'bg-[var(--bg-secondary)]'}`}>
                                {historyCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* List Content - Improved spacing */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent hover:scrollbar-thumb-slate-600">
                {displayedRecommendations.length === 0 ? (
                    <div className="flex items-center justify-center h-full px-6 py-10">
                        <div className="text-center">
                            <p className="text-[var(--text-secondary)] text-sm">
                                {viewMode === 'active' ? "No active recommendations." :
                                    viewMode === 'watchlist' ? "Watchlist is empty." : "No past ideas found."}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div>
                        {/* Table Header */}
                        <div className="px-6 py-4 bg-[var(--card-bg)] border-b border-[var(--border-color)] sticky top-0 z-10">
                            <div className="grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-3 px-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">TICKER</div>
                                <div className="col-span-2 px-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                                    {viewMode === 'watchlist' ? 'CURRENT PRICE' : 'ENTRY'}
                                </div>
                                {viewMode === 'watchlist' && (
                                    <>
                                        <div className="col-span-2 px-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">BUY PRICE</div>
                                        <div className="col-span-2 px-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">SELL PRICE</div>
                                    </>
                                )}
                                {viewMode !== 'watchlist' && (
                                    <div className="col-span-2 px-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">CURRENT PRICE</div>
                                )}
                                <div className={`px-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ${viewMode === 'watchlist' ? 'col-span-2' : 'col-span-3'}`}>RETURN</div>
                                <div className="col-span-1"></div>
                            </div>
                        </div>

                        {/* Table Rows */}
                        <div className="divide-y divide-white/5">
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

                                const isSelected = selectedStock?.id === rec.id;
                                const isPositive = ret >= 0;
                                const dateAdded = new Date(rec.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                                const companyName = companyNames[rec.ticker];

                                return (
                                    <div
                                        key={rec.id}
                                        onClick={() => setSelectedStock(rec)}
                                        className={`
                                            group relative cursor-pointer transition-all duration-200
                                            ${isSelected
                                                ? 'bg-indigo-500/10 border-l-2 border-indigo-500'
                                                : 'hover:bg-[var(--list-item-hover)] border-l-2 border-transparent'
                                            }
                                            px-6 py-5
                                        `}
                                    >
                                        <div className="grid grid-cols-12 gap-4 items-center">
                                            {/* Ticker Column */}
                                            <div className="col-span-3 px-2">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-semibold text-[var(--text-primary)] leading-tight">{rec.ticker}</span>
                                                    {companyName && (
                                                        <div className="text-xs text-[var(--text-secondary)] truncate">
                                                            {companyName}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`
                                                            text-[10px] font-bold uppercase px-2 py-0.5 rounded flex-shrink-0
                                                            ${rec.action === 'WATCH'
                                                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                                : rec.action === 'BUY'
                                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                                            }
                                                        `}>
                                                            {rec.action}
                                                        </span>
                                                        <span className="text-[10px] text-[var(--text-tertiary)]">{dateAdded}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Entry / Current Price Column */}
                                            <div className="col-span-2 px-2">
                                                {viewMode === 'watchlist' ? (
                                                    <span className="text-sm text-[var(--text-primary)] font-mono font-medium">
                                                        {hasCurrentPrice ? `₹${current.toFixed(2)}` : '-'}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-[var(--text-primary)] font-mono font-medium">
                                                        ₹{entry.toFixed(2)}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Current Price / BUY Price / SELL Price */}
                                            {viewMode === 'watchlist' ? (
                                                <>
                                                    <div className="col-span-2 px-2">
                                                        <span className={`text-sm font-mono font-medium ${rec.buy_price && hasCurrentPrice && current <= rec.buy_price
                                                            ? 'text-emerald-400 font-bold'
                                                            : 'text-[var(--text-primary)]'
                                                            }`}>
                                                            {rec.buy_price ? `₹${rec.buy_price.toFixed(2)}` : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="col-span-2 px-2">
                                                        <span className={`text-sm font-mono font-medium ${rec.sell_price && hasCurrentPrice && current >= rec.sell_price
                                                            ? 'text-rose-400 font-bold'
                                                            : 'text-[var(--text-primary)]'
                                                            }`}>
                                                            {rec.sell_price ? `₹${rec.sell_price.toFixed(2)}` : '-'}
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="col-span-2 px-2">
                                                    <span className="text-sm text-[var(--text-primary)] font-mono font-medium">
                                                        {hasCurrentPrice ? `₹${current.toFixed(2)}` : '-'}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Return Column */}
                                            <div className={`px-2 ${viewMode === 'watchlist' ? 'col-span-2' : 'col-span-3'}`}>
                                                {viewMode !== 'watchlist' ? (
                                                    <div className="flex items-center gap-4 whitespace-nowrap group/return">
                                                        <span className={`
                                                            text-sm font-semibold font-mono flex-shrink-0
                                                            ${ret === 0
                                                                ? 'text-[var(--text-primary)]'
                                                                : isPositive
                                                                    ? 'text-emerald-400'
                                                                    : 'text-rose-400'
                                                            }
                                                        `}>
                                                            {isPositive ? '+' : ''}{ret.toFixed(2)}%
                                                        </span>
                                                        {/* Action button only visible on hover with immediate appearance */}
                                                        {viewMode === 'active' && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCloseIdea(rec, e);
                                                                }}
                                                                className={`
                                                                    px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 whitespace-nowrap flex-shrink-0
                                                                    opacity-0 group-hover/return:opacity-100 pointer-events-none group-hover/return:pointer-events-auto
                                                                    ${rec.action === 'BUY'
                                                                        ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30'
                                                                        : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                                                                    }
                                                                `}
                                                                title={rec.action === 'BUY' ? 'SELL Position' : 'BUY Position'}
                                                            >
                                                                {rec.action === 'BUY' ? 'SELL' : 'BUY'}
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[var(--text-tertiary)]">-</span>
                                                )}
                                            </div>

                                            {/* Actions Column */}
                                            <div className="col-span-1 flex justify-end items-center gap-2 px-2">
                                                {viewMode === 'watchlist' && (
                                                    <>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePromoteWatchlist(rec, 'BUY', e);
                                                            }}
                                                            className="px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/30 transition-colors"
                                                        >
                                                            BUY
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePromoteWatchlist(rec, 'SELL', e);
                                                            }}
                                                            className="px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 rounded-lg border border-rose-500/30 transition-colors"
                                                        >
                                                            SELL
                                                        </button>
                                                    </>
                                                )}
                                                {/* Arrow indicator when selected */}
                                                {isSelected && (
                                                    <ChevronRight className="w-4 h-4 text-indigo-400 flex-shrink-0" />
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
    );
}
