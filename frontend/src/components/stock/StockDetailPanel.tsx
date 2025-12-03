/**
 * StockDetailPanel Component
 * 
 * Main container for stock detail view featuring:
 * - Sticky header with price info
 * - Tab navigation (Charts, Summary, Financials, AI, News)
 * - Smooth scrolling content area
 * - Investment thesis section
 * - Responsive 8-column grid layout
 * 
 * @component
 */

import { useState, useEffect, useRef } from 'react';
import { Loader, Newspaper, Mic } from 'lucide-react';
import { StockHeader } from './StockHeader';
import { StockTabs } from './StockTabs';
import type { TabId } from './StockTabs';
import { ChartsSection } from './ChartsSection';
import { SummarySection } from './SummarySection';
import { FinancialsSection } from './FinancialsSection';
import { AIInsightsSection } from './AIInsightsSection';
import { Card } from '../ui/Card';
import { StockDetailSkeleton } from '../ui/Skeleton';
import {
    getStockSummary,
    getStockHistory,
    getIncomeStatement,
    getBalanceSheet,
    getCashFlow,
    getQuarterly,
    getStockNews,
    generatePodcast,
} from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import NewsCard from '../NewsCard';
import PodcastPlayer from '../PodcastPlayer';
import PodcastList from '../PodcastList';
import { PriceTargetTimeline } from './PriceTargetTimeline';

interface StockDetailPanelProps {
    stock: any;
    onClose: () => void;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

export function StockDetailPanel({
    stock,
    onClose,
    isExpanded = false,
    onToggleExpand,
}: StockDetailPanelProps) {
    const { session } = useAuth();
    
    // State
    const [activeTab, setActiveTab] = useState<TabId>('chart');
    const [isSticky, setIsSticky] = useState(false);
    const [loading, setLoading] = useState(true);
    const [financialsLoading, setFinancialsLoading] = useState(false);
    const [newsLoading, setNewsLoading] = useState(false);
    const [podcastLoading, setPodcastLoading] = useState(false);
    const [podcastData, setPodcastData] = useState<any>(null);
    const [companyName, setCompanyName] = useState<string>('');
    const [showSavedPodcasts, setShowSavedPodcasts] = useState(false);
    
    // Date range state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [customReturn, setCustomReturn] = useState<number | null>(null);

    // Data state
    const [data, setData] = useState<any>({
        financials: {},
        chartData: [],
        incomeStatement: [],
        balanceSheet: [],
        cashFlow: [],
        quarterly: [],
        news: [],
    });

    // Refs
    const scrollRef = useRef<HTMLDivElement>(null);

    // Handle scroll for sticky header
    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        const handleScroll = () => {
            setIsSticky(container.scrollTop > 50);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    // Fetch initial data
    useEffect(() => {
        fetchData();
        fetchCompanyName();
    }, [stock.ticker]);

    const fetchCompanyName = async () => {
        try {
            const summary = await getStockSummary(stock.ticker);
            if (summary?.companyName) {
                setCompanyName(summary.companyName);
            }
        } catch (err) {
            console.error('Failed to fetch company name:', err);
        }
    };

    // Fetch news when News tab is activated
    useEffect(() => {
        if (activeTab === 'news' && data.news.length === 0 && !newsLoading) {
            fetchNews();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // Calculate custom returns
    useEffect(() => {
        if (startDate && endDate && data?.chartData?.length > 0) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const sortedData = [...data.chartData].sort((a: any, b: any) => 
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            let startPrice = null;
            let endPrice = null;

            for (const point of sortedData) {
                const d = new Date(point.date);
                if (!startPrice && d >= start) startPrice = point.close;
                if (d <= end) endPrice = point.close;
            }

            if (startPrice && endPrice) {
                setCustomReturn(((endPrice - startPrice) / startPrice) * 100);
            } else {
                setCustomReturn(null);
            }
        }
    }, [startDate, endDate, data.chartData]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [summary, history] = await Promise.all([
                getStockSummary(stock.ticker),
                getStockHistory(stock.ticker),
            ]);

            setData((prev: any) => ({
                ...prev,
                financials: summary || {},
                chartData: history || [],
            }));
            setLoading(false);
            fetchFinancials();
        } catch (err) {
            console.error('Failed to fetch stock data:', err);
            setLoading(false);
        }
    };

    const fetchFinancials = async () => {
        setFinancialsLoading(true);
        try {
            const [income, balance, cash, quarterly] = await Promise.allSettled([
                getIncomeStatement(stock.ticker),
                getBalanceSheet(stock.ticker),
                getCashFlow(stock.ticker),
                getQuarterly(stock.ticker),
            ]);

            setData((prev: any) => ({
                ...prev,
                incomeStatement: income.status === 'fulfilled' ? income.value : [],
                balanceSheet: balance.status === 'fulfilled' ? balance.value : [],
                cashFlow: cash.status === 'fulfilled' ? cash.value : [],
                quarterly: quarterly.status === 'fulfilled' ? quarterly.value : [],
            }));
        } catch (e) {
            console.error('Failed to fetch financials:', e);
        } finally {
            setFinancialsLoading(false);
        }
    };

    const fetchNews = async () => {
        setNewsLoading(true);
        try {
            const newsData = await getStockNews(stock.ticker);
            setData((prev: any) => ({ ...prev, news: newsData.articles || newsData || [] }));
        } catch (e: any) {
            console.error('Error fetching news', e);
            setData((prev: any) => ({ ...prev, news: [] }));
        } finally {
            setNewsLoading(false);
        }
    };

    const handleGeneratePodcast = async () => {
        if (!data.news || data.news.length === 0) {
            alert('No news available to generate podcast. Please refresh news first.');
            return;
        }

        if (!session?.user?.id) {
            alert('Please log in to generate podcasts');
            return;
        }

        setPodcastLoading(true);
        try {
            // Ensure we have company name
            let name = companyName;
            if (!name) {
                const summary = await getStockSummary(stock.ticker);
                name = summary?.companyName || stock.ticker;
                setCompanyName(name);
            }

            const podcastRequest = {
                type: 'single-stock' as const,
                ticker: stock.ticker,
                companyName: name,
                news: data.news.slice(0, 10), // Limit to top 10 articles
                user_id: session.user.id,
            };

            console.log('Generating podcast with user_id:', session.user.id);
            const result = await generatePodcast(podcastRequest);
            console.log('Podcast generated successfully:', result);
            setPodcastData(result);
            setShowSavedPodcasts(true); // Show saved list after generating new podcast
            // Trigger refresh of saved podcasts list
            setTimeout(() => {
                window.dispatchEvent(new Event('podcast-refresh'));
            }, 500);
        } catch (error: any) {
            console.error('Error generating podcast:', error);
            alert(`Failed to generate podcast: ${error.message || 'Unknown error'}`);
        } finally {
            setPodcastLoading(false);
        }
    };

    const handleDateRangeChange = (start: string, end: string) => {
        setStartDate(start);
        setEndDate(end);
    };

    // Loading State
    if (loading) {
        return (
            <div className="h-full bg-slate-900 animate-fadeIn">
                <StockDetailSkeleton />
            </div>
        );
    }

    const financials = data?.financials || {};

    return (
        <div className="absolute inset-0 bg-slate-900 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent animate-slideInRight">
            {/* All Content - Scrollable */}
            <div
                ref={scrollRef}
                className="w-full"
            >
                {/* Sticky Header */}
                <StockHeader
                    ticker={stock.ticker}
                    currentPrice={financials.currentPrice || stock.current_price}
                    entryPrice={stock.entry_price}
                    exitPrice={stock.exit_price}
                    exitDate={stock.exit_date}
                    isSticky={isSticky}
                    isExpanded={isExpanded}
                    onClose={onClose}
                    onToggleExpand={onToggleExpand}
                />

                {/* Investment Thesis Section */}
                <div className="px-6 py-4 border-b border-white/5">
                    <Card variant="glass" padding="md">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                                <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2">
                                    Investment Thesis
                                </h3>
                                <p className="text-slate-300 text-sm leading-relaxed italic">
                                    "{stock.thesis || 'No thesis provided for this recommendation.'}"
                                </p>

                                {/* Thesis Images */}
                                {stock.images && stock.images.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                                        {stock.images.map((img: string, idx: number) => (
                                            <a
                                                key={idx}
                                                href={img}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="aspect-video rounded-lg overflow-hidden border border-white/10 
                                                         hover:border-indigo-500/50 transition-all hover:scale-[1.02]"
                                            >
                                                <img
                                                    src={img}
                                                    alt={`Thesis attachment ${idx + 1}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Custom Return Display */}
                            {customReturn !== null && (
                                <div className="text-right flex-shrink-0">
                                    <span className="text-xs text-slate-400 block mb-1">Period Return</span>
                                    <span className={`text-2xl font-bold font-mono ${customReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {customReturn > 0 ? '+' : ''}{customReturn.toFixed(2)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Price Target Timeline Section */}
                <div className="px-6 py-4 border-b border-white/5">
                    <PriceTargetTimeline ticker={stock.ticker} />
                </div>

                {/* Sticky Tabs */}
                <StockTabs
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    isSticky={isSticky}
                />

                {/* Loading Indicator for Financials */}
                {financialsLoading && (
                    <div className="px-6 py-2">
                        <div className="flex items-center gap-2 text-sm text-indigo-400 bg-indigo-500/10 
                                      px-4 py-2 rounded-lg border border-indigo-500/20">
                            <Loader className="w-4 h-4 animate-spin" />
                            <span>Loading financial data...</span>
                        </div>
                    </div>
                )}

                {/* Tab Content */}
                <div className="px-6 py-6">
                    {/* Charts Tab */}
                    {activeTab === 'chart' && (
                        <ChartsSection
                            stockTicker={stock.ticker}
                            externalData={data}
                            startDate={startDate}
                            endDate={endDate}
                            onDateRangeChange={handleDateRangeChange}
                        />
                    )}

                    {/* Summary Tab */}
                    {activeTab === 'summary' && (
                        <SummarySection
                            ticker={stock.ticker}
                            financials={financials}
                            quarterly={data.quarterly}
                            isLoading={financialsLoading}
                            analystNotes={stock.thesis}
                        />
                    )}

                    {/* Financials Tab */}
                    {activeTab === 'financials' && (
                        <FinancialsSection
                            incomeStatement={data.incomeStatement}
                            balanceSheet={data.balanceSheet}
                            cashFlow={data.cashFlow}
                            isLoading={financialsLoading}
                        />
                    )}

                    {/* AI Insights Tab */}
                    {activeTab === 'ai' && (
                        <AIInsightsSection stockTicker={stock.ticker} />
                    )}

                    {/* News Tab */}
                    {activeTab === 'news' && (
                        <div className="max-w-4xl mx-auto">
                            {/* Podcast Player Modal */}
                            {podcastData && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                                    <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                                        <PodcastPlayer
                                            podcastTitle={podcastData.podcastTitle}
                                            script={podcastData.script}
                                            audioBase64={podcastData.audioBase64}
                                            keyPoints={podcastData.keyPoints}
                                            duration={podcastData.duration}
                                            ticker={podcastData.ticker || stock.ticker}
                                            companyName={podcastData.companyName || companyName}
                                            podcastType={podcastData.podcastType || "single-stock"}
                                            onClose={() => {
                                                setPodcastData(null);
                                                // Also clear PodcastList's internal state if it exists
                                                window.dispatchEvent(new Event('podcast-close'));
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Saved Podcasts Section */}
                            {session?.user?.id && (
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-lg font-semibold text-white">Saved Podcasts</h3>
                                        <button
                                            onClick={() => setShowSavedPodcasts(!showSavedPodcasts)}
                                            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                                        >
                                            {showSavedPodcasts ? 'Hide' : 'Show'} Saved
                                        </button>
                                    </div>
                                    {showSavedPodcasts && (
                                        <div className="mb-6">
                                            <PodcastList
                                                userId={session.user.id}
                                                ticker={stock.ticker}
                                                podcastType="single-stock"
                                                onPodcastSelect={(podcast) => setPodcastData(podcast)}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {newsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-center">
                                        <Loader className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
                                        <p className="text-slate-400">Loading news for {stock.ticker}...</p>
                                    </div>
                                </div>
                            ) : data.news && data.news.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-bold text-white">Latest News</h3>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm text-slate-400">{data.news.length} articles</span>
                                            <button 
                                                onClick={handleGeneratePodcast}
                                                disabled={podcastLoading || newsLoading}
                                                className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 
                                                         text-white rounded-lg transition-colors flex items-center gap-2
                                                         disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Generate Podcast"
                                            >
                                                {podcastLoading ? (
                                                    <>
                                                        <Loader className="w-3 h-3 animate-spin" />
                                                        <span>Generating...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Mic className="w-3 h-3" />
                                                        <span>Generate Podcast</span>
                                                    </>
                                                )}
                                            </button>
                                            <button 
                                                onClick={fetchNews}
                                                className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
                                                disabled={newsLoading}
                                            >
                                                Refresh
                                            </button>
                                        </div>
                                    </div>
                                    {data.news.map((article: any) => (
                                        <NewsCard key={article.id || article.headline} article={article} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Newspaper className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                    <p className="text-slate-400 mb-2">No news articles available for {stock.ticker}</p>
                                    <p className="text-xs text-slate-500 mb-4">News will be fetched from multiple sources and summarized with AI.</p>
                                    <button 
                                        onClick={fetchNews}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                                        disabled={newsLoading}
                                    >
                                        {newsLoading ? 'Loading...' : 'Load News'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Bottom Spacing for scroll */}
                    <div className="h-32" />
                </div>
            </div>
        </div>
    );
}

export default StockDetailPanel;

