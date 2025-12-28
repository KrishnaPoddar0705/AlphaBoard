/**
 * StockHeader Component
 * 
 * Premium sticky header for stock detail view featuring:
 * - Large, prominent price display
 * - Price change indicator with color coding
 * - Entry and Exit prices (for closed positions)
 * - Expand/collapse button for fullscreen mode
 * - Smooth transitions and glassmorphic styling
 * 
 * @component
 */

import { X, Maximize2, Minimize2, TrendingUp, TrendingDown, ArrowLeft } from 'lucide-react';

interface StockHeaderProps {
    ticker: string;
    currentPrice: number;
    entryPrice: number;
    entryDate?: string;
    exitPrice?: number;
    exitDate?: string;
    priceChange?: number;
    priceChangePercent?: number;
    isSticky?: boolean;
    isExpanded?: boolean;
    onClose: () => void;
    onToggleExpand?: () => void;
    currencySymbol?: string;
}

export function StockHeader({
    ticker,
    currentPrice,
    entryPrice,
    entryDate,
    exitPrice,
    exitDate,
    priceChange,
    priceChangePercent,
    isSticky = false,
    isExpanded = false,
    onClose,
    onToggleExpand,
    currencySymbol = '₹',
}: StockHeaderProps) {

    // Use exit price if available (for closed positions), otherwise use current price
    const displayPrice = exitPrice ?? currentPrice;
    const change = priceChange ?? (displayPrice - entryPrice);
    const changePercent = priceChangePercent ?? ((change / entryPrice) * 100);
    const isPositive = change >= 0;

    // Format dates
    const formatDate = (dateString?: string) => {
        if (!dateString) return null;
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return null;
        }
    };

    const formattedEntryDate = formatDate(entryDate);
    const formattedExitDate = formatDate(exitDate);

    return (
        <div
            className={`
                sticky top-0 z-30 transition-all duration-300
                ${isSticky
                    ? 'bg-[var(--bg-primary)]/95 backdrop-blur-xl shadow-lg shadow-black/20 border-b border-[var(--border-color)]'
                    : 'bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-primary)]/95'
                }
            `}
        >
            <div className="px-4 md:px-6 py-3 md:py-4">
                <div className="flex items-start justify-between gap-4">
                    {/* Left: Ticker & Price Info */}
                    <div className="flex-1 min-w-0">
                        {/* Ticker & Status */}
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-[var(--text-primary)] truncate">
                                {ticker}
                            </h1>
                        </div>

                        {/* Price Display */}
                        <div className="flex items-baseline gap-2 md:gap-4 flex-wrap">
                            {/* Current/Exit Price - Large & Prominent */}
                            <span className={`
                                text-2xl md:text-3xl lg:text-4xl font-mono font-bold tracking-tight
                                ${isPositive ? 'text-emerald-400' : 'text-rose-400'}
                            `}>
                                {currencySymbol}{displayPrice?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>

                            {/* Price Change */}
                            <div className={`
                                flex items-center gap-1.5 px-2 md:px-2.5 py-1 rounded-lg text-xs md:text-sm font-semibold
                                ${isPositive
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }
                            `}>
                                {isPositive ? (
                                    <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
                                ) : (
                                    <TrendingDown className="w-3 h-3 md:w-4 md:h-4" />
                                )}
                                <span>{isPositive ? '+' : ''}{changePercent.toFixed(2)}%</span>
                            </div>

                            {/* Entry Price */}
                            <span className="text-xs md:text-sm text-[var(--text-secondary)]">
                                Entry: <span className="font-mono text-[var(--text-primary)]">{currencySymbol}{entryPrice?.toFixed(2)}</span>
                                {formattedEntryDate && (
                                    <span className="ml-1 md:ml-2 text-[var(--text-tertiary)] hidden sm:inline">({formattedEntryDate})</span>
                                )}
                            </span>

                            {/* Exit Price & Date (only show if position is closed) */}
                            {exitPrice && (
                                <>
                                    <span className="text-sm text-[var(--text-secondary)]">
                                        Exit: <span className="font-mono text-[var(--text-primary)]">{currencySymbol}{exitPrice.toFixed(2)}</span>
                                    </span>
                                    {formattedExitDate && (
                                        <span className="text-sm text-[var(--text-secondary)]">
                                            Exit Date: <span className="font-mono text-[var(--text-primary)]">{formattedExitDate}</span>
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Mobile Back Button */}
                        <button
                            onClick={onClose}
                            className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
                            title="Back"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>

                        {/* Expand/Collapse Button - Hidden on mobile */}
                        {onToggleExpand && (
                            <button
                                onClick={onToggleExpand}
                                className="hidden md:flex p-2 hover:bg-[var(--list-item-hover)] rounded-lg transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                title={isExpanded ? "Collapse" : "Expand"}
                            >
                                {isExpanded ? (
                                    <Minimize2 className="w-5 h-5" />
                                ) : (
                                    <Maximize2 className="w-5 h-5" />
                                )}
                            </button>
                        )}

                        {/* Close Button - Hidden on mobile */}
                        <button
                            onClick={onClose}
                            className="hidden md:flex p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default StockHeader;

