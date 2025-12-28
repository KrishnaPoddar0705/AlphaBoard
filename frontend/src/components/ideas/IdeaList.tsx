/**
 * IdeaList Component
 * 
 * Premium list view for stock recommendations featuring:
 * - Clean table layout with hover effects
 * - View mode toggle (Active, Watchlist, History)
 * - Quick action buttons
 * - Animated selection states
 * - Mobile-responsive drawer mode
 * 
 * @component
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus, Clock, TrendingUp,
    ChevronRight, Eye, Mic, X, Loader2
} from 'lucide-react';
import { IdeaListItemSkeleton } from '../ui/Skeleton';
import { getStockSummary, getStockNews, generatePodcast } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import DateRangePicker from '../ui/DateRangePicker';
import PodcastPlayer from '../PodcastPlayer';
import PodcastList from '../PodcastList';
import { getReturnFromCacheOrCalculate, clearExpiredReturns } from '../../lib/returnsCache';

interface IdeaListProps {
    recommendations: any[];
    selectedStock: any;
    setSelectedStock: (rec: any) => void;
    viewMode: 'active' | 'watchlist' | 'history';
    setViewMode: (mode: 'active' | 'watchlist' | 'history') => void;
    handleCloseIdea: (rec: any, e: React.MouseEvent) => void;
    handlePromoteWatchlist: (rec: any, action: 'BUY' | 'SELL', e: React.MouseEvent) => void;
    handleDeleteWatchlist: (rec: any, e: React.MouseEvent) => void;
    onNewIdea: () => void;
    isLoading?: boolean;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

export function IdeaList({
    recommendations,
    selectedStock,
    setSelectedStock,
    viewMode,
    setViewMode,
    handleCloseIdea,
    handlePromoteWatchlist,
    handleDeleteWatchlist: _handleDeleteWatchlist, // Kept for API compatibility but no longer used
    onNewIdea,
    isLoading = false,
    isCollapsed: _isCollapsed = false,
    onToggleCollapse: _onToggleCollapse,
}: IdeaListProps) {
    const { session } = useAuth();

    // Filter recommendations by view mode
    const displayedRecommendations = recommendations.filter(rec => {
        if (viewMode === 'active') return rec.status === 'OPEN';
        if (viewMode === 'watchlist') return rec.status === 'WATCHLIST';
        if (viewMode === 'history') return rec.status === 'CLOSED';
        return false;
    });

    // State to cache company names
    const [companyNames, setCompanyNames] = useState<Record<string, string>>({});

    // Portfolio podcast state
    const [showPodcastModal, setShowPodcastModal] = useState(false);
    const [podcastLoading, setPodcastLoading] = useState(false);
    const [podcastData, setPodcastData] = useState<any>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showSavedPodcasts, setShowSavedPodcasts] = useState(false);

    // Memoize ticker list for dependency
    const tickerList = useMemo(() =>
        displayedRecommendations.map(r => r.ticker).sort().join(','),
        [displayedRecommendations]
    );

    // Clear expired returns cache on mount
    useEffect(() => {
        clearExpiredReturns();
    }, []);

    // Fetch company names for displayed recommendations
    useEffect(() => {
        const fetchCompanyNames = async () => {
            const tickersToFetch = displayedRecommendations
                .map(rec => rec.ticker)
                .filter(ticker => !companyNames[ticker]); // Only fetch if not already cached

            if (tickersToFetch.length === 0) return;

            // Fetch company names in parallel
            const namePromises = tickersToFetch.map(async (ticker) => {
                try {
                    const summary = await getStockSummary(ticker);
                    return { ticker, name: summary?.companyName || null };
                } catch (error) {
                    console.warn(`Failed to fetch company name for ${ticker}:`, error);
                    return { ticker, name: null };
                }
            });

            const results = await Promise.all(namePromises);
            const newNames: Record<string, string> = {};

            results.forEach(({ ticker, name }) => {
                if (name) {
                    newNames[ticker] = name;
                }
            });

            if (Object.keys(newNames).length > 0) {
                setCompanyNames(prev => ({ ...prev, ...newNames }));
            }
        };

        if (displayedRecommendations.length > 0) {
            fetchCompanyNames();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tickerList]);

    const handleGeneratePortfolioPodcast = async () => {
        if (!startDate || !endDate) {
            alert('Please select a date range');
            return;
        }

        if (!session?.user?.id) {
            alert('Please log in to generate podcasts');
            return;
        }

        // Get active portfolio stocks (OPEN status)
        const activeStocks = recommendations.filter(r => r.status === 'OPEN');

        if (activeStocks.length === 0) {
            alert('No active positions in your portfolio. Add some stocks first.');
            return;
        }

        setPodcastLoading(true);
        try {
            // Fetch news for each stock
            const portfolioNews: Record<string, any[]> = {};
            const companyNamesMap: Record<string, string> = {};

            for (const stock of activeStocks) {
                try {
                    // Get company name if not cached
                    let companyName = companyNames[stock.ticker];
                    if (!companyName) {
                        const summary = await getStockSummary(stock.ticker);
                        companyName = summary?.companyName || stock.ticker;
                        companyNamesMap[stock.ticker] = companyName;
                    } else {
                        companyNamesMap[stock.ticker] = companyName;
                    }

                    // Fetch news
                    const newsData = await getStockNews(stock.ticker);
                    const articles = newsData.articles || newsData || [];

                    // Filter news by date range
                    const filteredArticles = articles.filter((article: any) => {
                        const articleDate = new Date(article.published_at);
                        const start = new Date(startDate);
                        const end = new Date(endDate);
                        return articleDate >= start && articleDate <= end;
                    });

                    if (filteredArticles.length > 0) {
                        portfolioNews[stock.ticker] = filteredArticles.slice(0, 5); // Limit to top 5 per stock
                    }
                } catch (error) {
                    console.error(`Error fetching news for ${stock.ticker}:`, error);
                }
            }

            if (Object.keys(portfolioNews).length === 0) {
                alert('No news found for your portfolio in the selected date range.');
                setPodcastLoading(false);
                return;
            }

            // Generate podcast
            const podcastRequest = {
                type: 'portfolio' as const,
                weekStart: startDate,
                weekEnd: endDate,
                portfolioNews,
                user_id: session?.user?.id,
            };

            console.log('Generating portfolio podcast with user_id:', session?.user?.id);
            const result = await generatePodcast(podcastRequest);
            console.log('Portfolio podcast generated successfully:', result);
            setPodcastData(result);
            setShowPodcastModal(false);
            setShowSavedPodcasts(true); // Show saved list after generating new podcast
            // Trigger refresh
            setTimeout(() => {
                window.dispatchEvent(new Event('podcast-refresh'));
            }, 500);
        } catch (error: any) {
            console.error('Error generating portfolio podcast:', error);
            alert(`Failed to generate podcast: ${error.message || 'Unknown error'}`);
        } finally {
            setPodcastLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[var(--bg-primary)] border-r border-[var(--border-color)] overflow-hidden max-h-full">
            {/* Portfolio Podcast Modal */}
            {showPodcastModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-[var(--text-primary)]">Weekly Portfolio Podcast</h3>
                            <button
                                onClick={() => setShowPodcastModal(false)}
                                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <DateRangePicker
                            startDate={startDate}
                            endDate={endDate}
                            onStartDateChange={setStartDate}
                            onEndDateChange={setEndDate}
                        />
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setShowPodcastModal(false)}
                                className="px-4 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] 
                                         rounded-lg hover:bg-[var(--list-item-hover)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGeneratePortfolioPodcast}
                                disabled={podcastLoading || !startDate || !endDate}
                                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 
                                         hover:bg-purple-500 rounded-lg transition-colors
                                         disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {podcastLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Mic className="w-4 h-4" />
                                        <span>Generate Podcast</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Podcast Player Modal */}
            {podcastData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <PodcastPlayer
                            podcastTitle={podcastData.podcastTitle}
                            script={podcastData.script}
                            audioBase64={podcastData.audioBase64}
                            highlights={podcastData.highlights}
                            duration={podcastData.duration}
                            podcastType={podcastData.podcastType || "portfolio"}
                            weekStart={podcastData.weekStart || startDate}
                            weekEnd={podcastData.weekEnd || endDate}
                            onClose={() => {
                                setPodcastData(null);
                                // Also clear PodcastList's internal state if it exists
                                window.dispatchEvent(new Event('podcast-close'));
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex-shrink-0 px-4 md:px-4 py-3 md:py-4 border-b border-[var(--border-color)] bg-[var(--bg-primary)]/95 backdrop-blur-sm z-10">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                    <h1 className="text-lg md:text-xl font-bold text-[var(--text-primary)]">
                        My Ideas
                    </h1>
                    <div className="flex items-center gap-2">
                        {session?.user?.id && (
                            <button
                                onClick={() => setShowSavedPodcasts(!showSavedPodcasts)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                                         bg-slate-700 hover:bg-slate-600 text-white rounded-lg
                                         transition-all duration-200"
                                title="Show Saved Podcasts"
                            >
                                <span className="hidden sm:inline">Saved</span>
                            </button>
                        )}
                        <button
                            onClick={() => setShowPodcastModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                                     bg-purple-600 hover:bg-purple-500 text-white rounded-lg
                                     shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30
                                     transition-all duration-200"
                            title="Generate Portfolio Podcast"
                        >
                            <Mic className="w-4 h-4" />
                            <span className="hidden sm:inline">Podcast</span>
                        </button>
                        <button
                            onClick={onNewIdea}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                                     bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg
                                     shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30
                                     transition-all duration-200 min-h-[44px] md:min-h-0"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">New</span>
                        </button>
                    </div>
                </div>

                {/* Saved Podcasts Section */}
                {session?.user?.id && showSavedPodcasts && (
                    <div className="mb-4 pb-4 border-b border-[var(--border-color)]">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Saved Portfolio Podcasts</h3>
                        <PodcastList
                            userId={session.user.id}
                            podcastType="portfolio"
                            onPodcastSelect={(podcast) => setPodcastData(podcast)}
                        />
                    </div>
                )}

                {/* View Mode Toggle - Hidden on mobile (using bottom nav instead) */}
                <div className="hidden md:flex gap-2 p-1 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] overflow-x-auto justify-center max-w-md mx-auto">
                    <ViewModeButton
                        active={viewMode === 'active'}
                        onClick={() => setViewMode('active')}
                        count={recommendations.filter(r => r.status === 'OPEN').length}
                    >
                        Active
                    </ViewModeButton>
                    <ViewModeButton
                        active={viewMode === 'watchlist'}
                        onClick={() => setViewMode('watchlist')}
                        count={recommendations.filter(r => r.status === 'WATCHLIST').length}
                    >
                        Watchlist
                    </ViewModeButton>
                    <ViewModeButton
                        active={viewMode === 'history'}
                        onClick={() => setViewMode('history')}
                        count={recommendations.filter(r => r.status === 'CLOSED').length}
                    >
                        History
                    </ViewModeButton>
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent hover:scrollbar-thumb-slate-600">
                {isLoading ? (
                    // Loading Skeletons
                    <div className="divide-y divide-white/5">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <IdeaListItemSkeleton key={i} />
                        ))}
                    </div>
                ) : displayedRecommendations.length === 0 ? (
                    // Empty State
                    <EmptyState viewMode={viewMode} onNewIdea={onNewIdea} />
                ) : (
                    // Idea List
                    <div>
                        {/* Table Header - Hidden on mobile */}
                        <div className="hidden md:block px-6 py-4 bg-[var(--card-bg)] border-b border-[var(--border-color)] sticky top-0 z-10">
                            <div className="grid grid-cols-12 gap-4 items-center">
                                <div className="col-span-3 px-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">TICKER</div>
                                <div className="col-span-2 px-2 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                                    {viewMode === 'watchlist' ? 'CURRENT PRICE' : 'ENTRY'}
                                </div>
                                {viewMode === 'watchlist' && (
                                    <>
                                        <div className="col-span-2 px-2 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">BUY PRICE</div>
                                        <div className="col-span-2 px-2 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">SELL PRICE</div>
                                    </>
                                )}
                                {viewMode !== 'watchlist' && (
                                    <div className="col-span-2 px-2 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">CURRENT PRICE</div>
                                )}
                                <div className={`px-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ${viewMode === 'watchlist' ? 'col-span-2' : 'col-span-3'}`}>RETURN</div>
                                <div className="col-span-1"></div>
                            </div>
                        </div>
                        <div className="md:divide-y md:divide-white/5">
                            {displayedRecommendations.map((rec) => (
                                <IdeaListItem
                                    key={rec.id}
                                    recommendation={rec}
                                    companyName={companyNames[rec.ticker]}
                                    isSelected={selectedStock?.id === rec.id}
                                    viewMode={viewMode}
                                    onSelect={() => setSelectedStock(rec)}
                                    onClose={(e) => handleCloseIdea(rec, e)}
                                    onPromote={(action, e) => handlePromoteWatchlist(rec, action, e)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * View Mode Toggle Button
 */
interface ViewModeButtonProps {
    active: boolean;
    onClick: () => void;
    count: number;
    children: React.ReactNode;
}

function ViewModeButton({ active, onClick, count, children }: ViewModeButtonProps) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium
                rounded-lg transition-all duration-200 flex-shrink-0 min-h-[44px] whitespace-nowrap
                ${active
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--list-item-hover)]'
                }
            `}
        >
            {children}
            {count > 0 && (
                <span className={`
                    px-1.5 py-0.5 text-[10px] font-bold rounded
                    ${active ? 'bg-[var(--list-item-bg)]' : 'bg-[var(--bg-secondary)]'}
                `}>
                    {count}
                </span>
            )}
        </button>
    );
}

/**
 * Individual Idea List Item
 */
interface IdeaListItemProps {
    recommendation: any;
    companyName?: string;
    isSelected: boolean;
    viewMode: 'active' | 'watchlist' | 'history';
    onSelect: () => void;
    onClose: (e: React.MouseEvent) => void;
    onPromote: (action: 'BUY' | 'SELL', e: React.MouseEvent) => void;
}

function IdeaListItem({
    recommendation: rec,
    companyName,
    isSelected,
    viewMode,
    onSelect,
    onClose,
    onPromote,
}: IdeaListItemProps) {
    const entry = rec.entry_price || 0;
    const isClosed = rec.status === 'CLOSED';
    const current = isClosed ? (rec.exit_price || entry) : rec.current_price;

    // Calculate return using cache
    let ret = 0;
    if (isClosed && rec.final_return_pct !== undefined) {
        // For closed positions, use final_return_pct if available
        ret = rec.final_return_pct;
    } else if (entry > 0 && viewMode !== 'watchlist') {
        // Use the smart cache function which prioritizes current_price when available
        ret = getReturnFromCacheOrCalculate(
            rec.ticker,
            entry,
            current || null,
            rec.action || 'BUY'
        );
    }

    const isPositive = ret >= 0;
    const dateAdded = new Date(rec.entry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    // Detect currency based on ticker
    const isUSStock = !rec.ticker.includes('.NS') && !rec.ticker.includes('.BO');
    const currencySymbol = isUSStock ? '$' : '₹';

    return (
        <div
            onClick={onSelect}
            className={`
                    group relative cursor-pointer transition-all duration-200
                ${isSelected
                    ? 'bg-indigo-500/10 border-l-2 border-indigo-500'
                    : 'hover:bg-[var(--list-item-hover)] border-l-2 border-transparent'
                }
                    md:px-6 md:py-4
                `}
        >
            {/* Mobile Card Layout - Improved spacing and clarity */}
            <div className="md:hidden p-4 mb-3 bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] shadow-sm active:scale-[0.98] transition-transform">
                {/* Row 1: Ticker + Return */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                        <div className="text-lg font-bold text-[var(--text-primary)] mb-1">{rec.ticker}</div>
                        {companyName && (
                            <div className="text-xs text-[var(--text-secondary)] truncate mb-1">{companyName}</div>
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
                    {viewMode !== 'watchlist' && (
                        <div className={`
                            text-xl font-bold font-mono flex-shrink-0 ml-2 px-3 py-1.5 rounded-lg
                            ${isPositive
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }
                        `}>
                            {isPositive ? '+' : ''}{ret.toFixed(2)}%
                        </div>
                    )}
                </div>

                {/* Row 2: Prices - Better spacing */}
                <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-[var(--border-color)]">
                    {viewMode === 'watchlist' ? (
                        <>
                            <div>
                                <div className="text-[10px] text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Current</div>
                                <div className="text-base font-mono font-semibold text-[var(--text-primary)]">
                                    {current ? `${currencySymbol}${current.toFixed(2)}` : '-'}
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] text-[var(--text-secondary)] mb-1 uppercase tracking-wider">BUY Target</div>
                                <div className={`text-base font-mono font-semibold ${rec.buy_price && current && current <= rec.buy_price
                                    ? 'text-emerald-400'
                                    : 'text-[var(--text-primary)]'
                                    }`}>
                                    {rec.buy_price ? `${currencySymbol}${rec.buy_price.toFixed(2)}` : '-'}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <div className="text-[10px] text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Entry</div>
                                <div className="text-base font-mono font-semibold text-[var(--text-primary)]">{currencySymbol}{entry.toFixed(2)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-[var(--text-secondary)] mb-1 uppercase tracking-wider">Current</div>
                                <div className="text-base font-mono font-semibold text-[var(--text-primary)]">
                                    {current ? `${currencySymbol}${current.toFixed(2)}` : '-'}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Row 3: Quick Action Buttons - Improved touch targets */}
                <div className="flex items-center gap-2">
                    {viewMode === 'watchlist' && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPromote('BUY', e);
                                }}
                                className="flex-1 px-4 py-3 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20 rounded-xl border border-emerald-500/30 transition-all active:scale-95 min-h-[48px] flex items-center justify-center"
                            >
                                BUY
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPromote('SELL', e);
                                }}
                                className="flex-1 px-4 py-3 text-sm font-bold text-rose-400 hover:bg-rose-500/20 rounded-xl border border-rose-500/30 transition-all active:scale-95 min-h-[48px] flex items-center justify-center"
                            >
                                SELL
                            </button>
                        </>
                    )}
                    {viewMode === 'active' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose(e);
                            }}
                            className={`
                                w-full px-4 py-3 text-sm font-bold rounded-xl border transition-all active:scale-95 min-h-[48px] flex items-center justify-center
                                ${rec.action === 'BUY'
                                    ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border-rose-500/30'
                                    : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-emerald-500/30'
                                }
                            `}
                        >
                            {rec.action === 'BUY' ? 'SELL Position' : 'BUY Position'}
                        </button>
                    )}
                </div>
            </div>

            {/* Desktop Table Layout - Improved spacing */}
            <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                {/* Ticker & Action - Better padding and spacing */}
                <div className={`col-span-3 px-2`}>
                    <div className="flex flex-col gap-1">
                        <span className="text-[var(--text-primary)] font-semibold text-sm leading-tight">{rec.ticker}</span>
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

                {/* Entry Price / Current Price */}
                <div className="col-span-2 px-2">
                    {viewMode === 'watchlist' ? (
                        <span className="text-sm text-[var(--text-primary)] font-mono font-medium">
                            {current ? `${currencySymbol}${current.toFixed(2)}` : '-'}
                        </span>
                    ) : (
                        <span className="text-sm text-[var(--text-primary)] font-mono font-medium">
                            {currencySymbol}{entry.toFixed(2)}
                        </span>
                    )}
                </div>

                {/* Current Price */}
                {viewMode !== 'watchlist' && (
                    <div className="col-span-2 px-2">
                        <span className="text-sm text-[var(--text-primary)] font-mono font-medium">
                            {current ? `${currencySymbol}${current.toFixed(2)}` : '-'}
                        </span>
                    </div>
                )}

                {/* BUY Price & SELL Price (for watchlist) */}
                {viewMode === 'watchlist' && (
                    <>
                        <div className="col-span-2 px-2">
                            <span className={`text-sm font-mono font-medium ${rec.buy_price
                                ? current && current <= rec.buy_price
                                    ? 'text-emerald-400 font-bold'
                                    : 'text-[var(--text-primary)]'
                                : 'text-[var(--text-secondary)]'
                                }`}>
                                {rec.buy_price ? `${currencySymbol}${rec.buy_price.toFixed(2)}` : '-'}
                            </span>
                        </div>
                        <div className="col-span-2 px-2">
                            <span className={`text-sm font-mono font-medium ${rec.sell_price
                                ? current && current >= rec.sell_price
                                    ? 'text-rose-400 font-bold'
                                    : 'text-[var(--text-primary)]'
                                : 'text-[var(--text-secondary)]'
                                }`}>
                                {rec.sell_price ? `${currencySymbol}${rec.sell_price.toFixed(2)}` : '-'}
                            </span>
                        </div>
                    </>
                )}

                {/* Return - Better spacing with hover-only action button */}
                <div className={`px-2 ${viewMode === 'watchlist' ? 'col-span-2' : 'col-span-3'}`}>
                    {viewMode !== 'watchlist' ? (
                        <div className="flex items-center gap-4 whitespace-nowrap group/return">
                            <span className={`
                                text-sm font-semibold font-mono flex-shrink-0
                                ${isPositive ? 'text-emerald-400' : 'text-rose-400'}
                            `}>
                                {isPositive ? '+' : ''}{ret.toFixed(2)}%
                            </span>
                            {/* Action button only visible on hover */}
                            {viewMode === 'active' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClose(e);
                                    }}
                                    className={`
                                        px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex-shrink-0
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

                {/* Actions Column - Always visible */}
                <div className="col-span-1 flex justify-end items-center gap-2 px-2">
                    {viewMode === 'watchlist' && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPromote('BUY', e);
                                }}
                                className="px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/30 transition-colors"
                            >
                                BUY
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPromote('SELL', e);
                                }}
                                className="px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 rounded-lg border border-rose-500/30 transition-colors"
                            >
                                SELL
                            </button>
                        </>
                    )}
                    {/* Arrow indicator - always visible when selected */}
                    {isSelected && (
                        <ChevronRight className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * Empty State Component
 */
function EmptyState({
    viewMode,
    onNewIdea
}: {
    viewMode: 'active' | 'watchlist' | 'history';
    onNewIdea: () => void;
}) {
    const messages = {
        active: {
            icon: <TrendingUp className="w-10 h-10 text-[var(--text-tertiary)]" />,
            title: 'No active ideas',
            description: 'Start tracking your investment thesis by adding a new idea.',
            action: 'Add First Idea',
        },
        watchlist: {
            icon: <Eye className="w-10 h-10 text-slate-600" />,
            title: 'Watchlist is empty',
            description: 'Add stocks you want to monitor before making a decision.',
            action: 'Add to Watchlist',
        },
        history: {
            icon: <Clock className="w-10 h-10 text-slate-600" />,
            title: 'No past ideas',
            description: 'Closed positions will appear here for performance tracking.',
            action: null,
        },
    };

    const { icon, title, description, action } = messages[viewMode];

    return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="p-4 rounded-2xl bg-[var(--card-bg)] mb-4">
                {icon}
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
            <p className="text-sm text-[var(--text-secondary)] max-w-xs mb-6">{description}</p>
            {action && (
                <button
                    onClick={onNewIdea}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium
                             bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg
                             transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    {action}
                </button>
            )}
        </div>
    );
}

export default IdeaList;

