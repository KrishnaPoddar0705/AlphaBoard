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
    Plus, Clock, TrendingUp, TrendingDown,
    Trash2, ChevronRight, Eye, Mic, X, Loader2
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
    handleDeleteWatchlist,
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
        <div className="h-full flex flex-col bg-slate-900 border-r border-white/5 overflow-hidden max-h-full">
            {/* Portfolio Podcast Modal */}
            {showPodcastModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-800 rounded-lg border border-white/10 p-6 w-full max-w-md">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">Weekly Portfolio Podcast</h3>
                            <button
                                onClick={() => setShowPodcastModal(false)}
                                className="text-slate-400 hover:text-white transition-colors"
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
                                className="px-4 py-2 text-sm text-slate-300 bg-transparent border border-white/10 
                                         rounded-lg hover:bg-white/5 transition-colors"
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
            <div className="flex-shrink-0 px-4 py-4 border-b border-white/5 bg-slate-900/95 backdrop-blur-sm z-10">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
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
                                     transition-all duration-200"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="hidden sm:inline">New</span>
                        </button>
                    </div>
                </div>

                {/* Saved Podcasts Section */}
                {session?.user?.id && showSavedPodcasts && (
                    <div className="mb-4 pb-4 border-b border-white/5">
                        <h3 className="text-sm font-semibold text-white mb-3">Saved Portfolio Podcasts</h3>
                        <PodcastList
                            userId={session.user.id}
                            podcastType="portfolio"
                            onPodcastSelect={(podcast) => setPodcastData(podcast)}
                        />
                    </div>
                )}

                {/* View Mode Toggle */}
                <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl border border-white/5">
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
                        {/* Table Header */}
                        <div className="px-6 py-3 bg-slate-800/50 border-b border-white/5 sticky top-0 z-10">
                            <div className="grid grid-cols-12 gap-3 items-center">
                                <div className="col-span-4 px-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Ticker</div>
                                <div className="col-span-2 px-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    {viewMode === 'watchlist' ? 'Current Price' : 'Entry'}
                                </div>
                                {viewMode !== 'watchlist' && (
                                    <div className="col-span-2 px-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Current Price</div>
                                )}
                                <div className={`px-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider ${viewMode === 'watchlist' ? 'col-span-4' : 'col-span-3'}`}>Return</div>
                                <div className={`${viewMode === 'watchlist' ? 'col-span-2' : 'col-span-1'}`}></div>
                            </div>
                        </div>
                        <div className="divide-y divide-white/5">
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
                                    onDelete={(e) => handleDeleteWatchlist(rec, e)}
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
                flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium
                rounded-lg transition-all duration-200
                ${active
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }
            `}
        >
            {children}
            {count > 0 && (
                <span className={`
                    px-1.5 py-0.5 text-[10px] font-bold rounded
                    ${active ? 'bg-white/20' : 'bg-slate-700'}
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
    onDelete: (e: React.MouseEvent) => void;
}

function IdeaListItem({
    recommendation: rec,
    companyName,
    isSelected,
    viewMode,
    onSelect,
    onClose,
    onPromote,
    onDelete,
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
    const dateAdded = new Date(rec.entry_date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
    });

    return (
        <div
            onClick={onSelect}
            className={`
                group relative px-6 py-3 cursor-pointer transition-all duration-200
                ${isSelected
                    ? 'bg-indigo-500/10 border-l-2 border-indigo-500'
                    : 'hover:bg-white/5 border-l-2 border-transparent'
                }
            `}
        >
            <div className="grid grid-cols-12 gap-2 items-center">
                {/* Ticker & Action */}
                {/* 
                    Reduced column width from col-span-5 to col-span-4.
                    Added overflow-hidden and min-w-0 to prevent overflow.
                    All text elements use truncate to ensure no overflow.
                */}
                <div className="col-span-4 px-3 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-sm">{rec.ticker}</span>
                    </div>
                    {companyName && (
                        <div className="text-xs text-slate-400 mt-0.5 truncate block min-w-0">
                            {companyName}
                        </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`
                            text-[10px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0
                            ${rec.action === 'WATCH'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : rec.action === 'BUY'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }
                        `}>
                            {rec.action}
                        </span>
                        <span className="text-[10px] text-slate-500">{dateAdded}</span>
                    </div>
                </div>

                {/* Entry Price / Current Price */}
                {/* 
                    Reduced column width maintained at col-span-2.
                    Added overflow-hidden and min-w-0 to prevent overflow.
                    Text uses truncate to ensure numbers are always visible.
                */}
                <div className="col-span-2 px-3 text-right">
                    {viewMode === 'watchlist' ? (
                        <span className="text-sm text-slate-300 font-mono">
                            {current ? `₹${current.toFixed(2)}` : '-'}
                        </span>
                    ) : (
                        <span className="text-sm text-slate-300 font-mono">
                            ₹{entry.toFixed(2)}
                        </span>
                    )}
                </div>

                {/* Current Price */}
                {/* 
                    Added overflow-hidden and min-w-0 to prevent overflow.
                    Text uses truncate to ensure numbers are always visible.
                */}
                {viewMode !== 'watchlist' && (
                    <div className="col-span-2 px-3 text-right min-w-0 overflow-hidden">
                        <span className="text-sm text-slate-300 font-mono">
                            {current ? `₹${current.toFixed(2)}` : '-'}
                        </span>
                    </div>
                )}

                {/* Return */}
                {/* 
                    Flex container with whitespace-nowrap prevents text wrapping and ensures
                    the percentage value and SELL badge never overlap.
                    justify-end aligns content to the right, gap-2 provides spacing between elements.
                    Increased column width (col-span-3) to accommodate SELL button on the right.
                    Added overflow-hidden and min-w-0 to prevent overflow.
                */}
                <div className={`px-3 text-right min-w-0 overflow-hidden ${viewMode === 'watchlist' ? 'col-span-4' : 'col-span-3'}`}>
                    {viewMode !== 'watchlist' ? (
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                            {/* 
                                Percentage value wrapped in flex-shrink-0 to prevent compression.
                                This ensures the percentage text (e.g., "102.57%") is always fully visible
                                and never gets truncated or overlapped by adjacent elements.
                            */}
                            <div className={`
                                inline-flex items-center gap-1 text-sm font-semibold flex-shrink-0
                                ${isPositive ? 'text-emerald-400' : 'text-rose-400'}
                            `}>
                                {isPositive ? (
                                    <TrendingUp className="w-3 h-3 flex-shrink-0" />
                                ) : (
                                    <TrendingDown className="w-3 h-3 flex-shrink-0" />
                                )}
                                <span className="font-mono">{Math.abs(ret).toFixed(2)}%</span>
                            </div>
                            {/* 
                                SELL/BUY button - 25% smaller, appears only on hover.
                                Positioned to the right of the percentage text.
                                Reduced padding: px-3→px-2.25 (25% smaller), py-1.5→py-1.125 (25% smaller).
                                Reduced font size: text-xs→text-[10px] (approximately 25% smaller).
                            */}
                            {viewMode === 'active' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onClose(e);
                                    }}
                                    className={`
                                        px-[9px] py-[4.5px] text-[10px] font-bold rounded-md transition-all whitespace-nowrap flex-shrink-0
                                        opacity-0 group-hover:opacity-100
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
                        <span className="text-slate-500">-</span>
                    )}
                </div>

                {/* Actions */}
                {/* 
                    Actions column - SELL button moved to Return column.
                    Only watchlist actions remain here.
                */}
                <div className="col-span-1 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {viewMode === 'watchlist' && (
                        <>
                            <button
                                onClick={(e) => onPromote('BUY', e)}
                                className="px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 rounded-lg border border-emerald-500/30 transition-colors"
                            >
                                BUY
                            </button>
                            <button
                                onClick={(e) => onPromote('SELL', e)}
                                className="px-3 py-1.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20 rounded-lg border border-rose-500/30 transition-colors"
                            >
                                SELL
                            </button>
                            <button
                                onClick={onDelete}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Selection Indicator */}
            {isSelected && (
                <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
            )}
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
            icon: <TrendingUp className="w-10 h-10 text-slate-600" />,
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
            <div className="p-4 rounded-2xl bg-slate-800/50 mb-4">
                {icon}
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-slate-400 max-w-xs mb-6">{description}</p>
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

