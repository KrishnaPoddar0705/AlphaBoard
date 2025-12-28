/**
 * IdeaCardMobile Component
 * 
 * Mobile-native card component for displaying stock ideas featuring:
 * - Premium fintech-grade design
 * - Clear visual hierarchy
 * - Touch-optimized interactions
 * - Color-coded returns
 * - Prominent action buttons
 * 
 * @component
 */

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { getReturnFromCacheOrCalculate } from '../../lib/returnsCache';
import { ReturnSparkline } from '../charts/ReturnSparkline';

interface IdeaCardMobileProps {
    recommendation: any;
    isSelected: boolean;
    viewMode: 'active' | 'watchlist' | 'history';
    onSelect: () => void;
    onClose: (e: React.MouseEvent) => void;
    onPromote: (action: 'BUY' | 'SELL', e: React.MouseEvent) => void;
    companyName?: string;
}

export function IdeaCardMobile({
    recommendation: rec,
    companyName,
    isSelected,
    viewMode,
    onSelect,
    onClose,
    onPromote,
}: IdeaCardMobileProps) {
    const entry = rec.entry_price || 0;
    const isClosed = rec.status === 'CLOSED';
    const current = isClosed ? (rec.exit_price || entry) : rec.current_price;

    // Calculate return using cache
    let ret = 0;
    if (isClosed && rec.final_return_pct !== undefined) {
        ret = rec.final_return_pct;
    } else if (entry > 0 && viewMode !== 'watchlist') {
        ret = getReturnFromCacheOrCalculate(
            rec.ticker,
            entry,
            current || null,
            rec.action || 'BUY'
        );
    }

    const isPositive = ret >= 0;
    const dateAdded = new Date(rec.entry_date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
    });

    // Generate sparkline data (last 7 days of return history)
    const sparklineData = useMemo(() => {
        const data = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            // For simplicity, use current return for all points
            // In production, you'd fetch historical return data
            let dayReturn = ret;
            if (entry > 0 && current) {
                dayReturn = getReturnFromCacheOrCalculate(
                    rec.ticker,
                    entry,
                    current,
                    rec.action || 'BUY'
                );
            }

            data.push({ date: dateKey, return: dayReturn });
        }
        return data;
    }, [rec.ticker, entry, current, ret, rec.action]);

    return (
        <div
            onClick={onSelect}
            className={`
                relative bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)]
                p-5 shadow-lg transition-all duration-200 active:scale-[0.98]
                ${isSelected ? 'ring-2 ring-indigo-500/50 border-indigo-500/50' : 'hover:border-indigo-500/30'}
            `}
        >
            {/* Header: Ticker + Return */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">{rec.ticker}</h3>
                        <span className={`
                            text-[10px] font-bold uppercase px-2 py-0.5 rounded
                            ${rec.action === 'WATCH'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : rec.action === 'BUY'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }
                        `}>
                            {rec.action}
                        </span>
                    </div>
                    {companyName && (
                        <p className="text-xs text-[var(--text-secondary)] truncate">{companyName}</p>
                    )}
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{dateAdded}</p>
                </div>

                {/* Return Badge with Sparkline */}
                {viewMode !== 'watchlist' && (
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className={`
                            flex items-center gap-1 px-3 py-1.5 rounded-xl
                            ${isPositive
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }
                        `}>
                            {isPositive ? (
                                <TrendingUp className="w-3.5 h-3.5" />
                            ) : (
                                <TrendingDown className="w-3.5 h-3.5" />
                            )}
                            <span className="text-sm font-bold font-mono">
                                {isPositive ? '+' : ''}{ret.toFixed(2)}%
                            </span>
                        </div>
                        {/* Sparkline */}
                        <div className="w-20 h-8">
                            <ReturnSparkline
                                data={sparklineData}
                                height={32}
                                isPositive={isPositive}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Price Information - Better spacing */}
            <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-[var(--border-color)]">
                {viewMode === 'watchlist' ? (
                    <>
                        <div>
                            <p className="text-[10px] text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Current</p>
                            <p className="text-base font-mono font-semibold text-[var(--text-primary)]">
                                {current ? `₹${current.toFixed(2)}` : '-'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-[var(--text-secondary)] mb-1 uppercase tracking-wider">BUY Target</p>
                            <p className={`text-base font-mono font-semibold ${rec.buy_price && current && current <= rec.buy_price
                                ? 'text-emerald-400'
                                : 'text-[var(--text-primary)]'
                                }`}>
                                {rec.buy_price ? `₹${rec.buy_price.toFixed(2)}` : '-'}
                            </p>
                        </div>
                    </>
                ) : (
                    <>
                        <div>
                            <p className="text-[10px] text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Entry</p>
                            <p className="text-base font-mono font-semibold text-[var(--text-primary)]">
                                ₹{entry.toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Current</p>
                            <p className="text-base font-mono font-semibold text-[var(--text-primary)]">
                                {current ? `₹${current.toFixed(2)}` : '-'}
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
                {viewMode === 'watchlist' ? (
                    <>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onPromote('BUY', e);
                            }}
                            className="flex-1 px-4 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 
                                     font-bold rounded-xl border border-emerald-500/30 transition-all
                                     active:scale-95 min-h-[48px] flex items-center justify-center gap-2"
                        >
                            <TrendingUp className="w-4 h-4" />
                            BUY
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onPromote('SELL', e);
                            }}
                            className="flex-1 px-4 py-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 
                                     font-bold rounded-xl border border-rose-500/30 transition-all
                                     active:scale-95 min-h-[48px] flex items-center justify-center gap-2"
                        >
                            <TrendingDown className="w-4 h-4" />
                            SELL
                        </button>
                    </>
                ) : viewMode === 'active' ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose(e);
                        }}
                        className={`
                            w-full px-4 py-3 font-bold rounded-xl border transition-all
                            active:scale-95 min-h-[48px] flex items-center justify-center gap-2
                            ${rec.action === 'BUY'
                                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border-rose-500/30'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30'
                            }
                        `}
                    >
                        {rec.action === 'BUY' ? (
                            <>
                                <TrendingDown className="w-4 h-4" />
                                SELL Position
                            </>
                        ) : (
                            <>
                                <TrendingUp className="w-4 h-4" />
                                BUY Position
                            </>
                        )}
                    </button>
                ) : null}
            </div>
        </div>
    );
}

export default IdeaCardMobile;

