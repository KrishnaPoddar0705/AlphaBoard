import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnalystPerformance, getRollingPortfolioReturns } from '../lib/api';
import { MonthlyReturnsHeatmap } from '../components/charts/MonthlyReturnsHeatmap';
import { DailyReturnsCalendar } from '../components/charts/DailyReturnsCalendar';
import { WeeklyReturnsChart } from '../components/charts/WeeklyReturnsChart';
import { IdeasAddedChart } from '../components/charts/IdeasAddedChart';
import { PortfolioAllocationDonut } from '../components/charts/PortfolioAllocationDonut';
import { ArrowLeft, TrendingUp, BarChart2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getReturnFromCacheOrCalculate } from '../lib/returnsCache';
import { getSupabaseUserIdForClerkUser } from '../lib/clerkSupabaseSync';

export default function AnalystPerformance() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [performanceData, setPerformanceData] = useState<any>(null);
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [portfolioReturns, setPortfolioReturns] = useState<Array<{ week: string; date?: string; return: number; cumulativeReturn?: number; count?: number }>>([]);
    const [portfolioReturnsPeriod, setPortfolioReturnsPeriod] = useState<'day' | 'week' | 'month'>('day');
    const [portfolioReturnsLoading, setPortfolioReturnsLoading] = useState(false);
    const [ideasAddedPeriod, setIdeasAddedPeriod] = useState<'day' | 'week' | 'month'>('week');
    const [returnsMatrixPeriod, setReturnsMatrixPeriod] = useState<'day' | 'week' | 'month'>('day');

    // Refs to prevent concurrent calls
    const fetchingRecommendations = useRef(false);
    const fetchingPortfolioReturns = useRef(false);
    const fetchingData = useRef(false);

    const fetchRecommendations = useCallback(async () => {
        if (!id || fetchingRecommendations.current) return;
        fetchingRecommendations.current = true;
        try {
            // Convert Clerk user ID to Supabase UUID if needed
            let supabaseUserId = id;

            // Check if id is a Clerk user ID (starts with 'user_')
            if (id.startsWith('user_')) {
                const mappedId = await getSupabaseUserIdForClerkUser(id);
                if (!mappedId) {
                    console.error('Could not find Supabase UUID for Clerk user ID:', id);
                    setRecommendations([]);
                    return;
                }
                supabaseUserId = mappedId;
            }

            const { data, error } = await supabase
                .from('recommendations')
                .select('*')
                .eq('user_id', supabaseUserId)
                .order('entry_date', { ascending: false });
            if (error) throw error;
            setRecommendations(data || []);
        } catch (err) {
            console.error('Error fetching recommendations:', err);
            setRecommendations([]);
        } finally {
            fetchingRecommendations.current = false;
        }
    }, [id]);

    const fetchPortfolioReturns = useCallback(async () => {
        if (!id || fetchingPortfolioReturns.current) return;
        fetchingPortfolioReturns.current = true;
        setPortfolioReturnsLoading(true);
        try {
            const rangeMap: Record<'day' | 'week' | 'month', 'DAY' | 'WEEK' | 'MONTH'> = {
                'day': 'DAY',
                'week': 'WEEK',
                'month': 'MONTH'
            };
            const range = rangeMap[portfolioReturnsPeriod];

            // Convert Clerk user ID to Supabase UUID if needed (backend handles this, but ensure we pass the right format)
            let userId = id;
            if (id.startsWith('user_')) {
                // Backend will handle conversion, but we can pass Clerk ID directly
                userId = id;
            }

            const data = await getRollingPortfolioReturns(userId, range);

            if (data && data.error) {
                console.error('Portfolio returns API error:', data.error);
                setPortfolioReturns([]);
                return;
            }

            if (data && data.points && Array.isArray(data.points) && data.points.length > 0) {
                // Transform API response to chart format (values are already in percentage from backend)
                const transformed = data.points.map((point: any, index: number) => {
                    try {
                        const date = new Date(point.date);
                        let label = '';

                        if (portfolioReturnsPeriod === 'day') {
                            label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        } else if (portfolioReturnsPeriod === 'week') {
                            // For weekly, show week start date
                            label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        } else {
                            // For monthly, show month and year
                            label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                        }

                        return {
                            week: label,
                            date: date.toISOString().split('T')[0], // Store ISO date string for calendar
                            return: typeof point.value === 'number' ? point.value : 0, // Already in percentage from backend
                            cumulativeReturn: (data.cumulative && data.cumulative[index] && typeof data.cumulative[index].value === 'number')
                                ? data.cumulative[index].value
                                : 0, // Already in percentage from backend
                            count: point.active_count || 0
                        };
                    } catch (e) {
                        console.error('Error transforming point:', point, e);
                        return null;
                    }
                }).filter((item: any) => item !== null);

                if (transformed.length > 0) {
                    setPortfolioReturns(transformed);
                } else {
                    console.warn('No valid transformed data');
                    setPortfolioReturns([]);
                }
            } else {
                console.warn('No portfolio returns data or empty points array:', data);
                setPortfolioReturns([]);
            }
        } catch (error) {
            console.error('Error fetching portfolio returns:', error);
            setPortfolioReturns([]);
        } finally {
            setPortfolioReturnsLoading(false);
            fetchingPortfolioReturns.current = false;
        }
    }, [id, portfolioReturnsPeriod]);

    const fetchData = useCallback(async () => {
        if (!id || fetchingData.current) return;
        fetchingData.current = true;
        try {
            setLoading(true);
            const perf = await getAnalystPerformance(id!);
            setPerformanceData(perf);
        } catch (error) {
            console.error('Error fetching performance data:', error);
        } finally {
            setLoading(false);
            fetchingData.current = false;
        }
    }, [id]);

    useEffect(() => {
        if (id) {
            fetchData();
            fetchRecommendations();
        }
    }, [id, fetchData, fetchRecommendations]);

    useEffect(() => {
        if (id) {
            fetchPortfolioReturns();
        }
    }, [id, portfolioReturnsPeriod, fetchPortfolioReturns]);

    const metrics = performanceData?.summary_metrics || {};

    // Calculate ideas added data
    const ideasAddedData = useMemo(() => {
        if (!recommendations || recommendations.length === 0) return [];

        const now = new Date();
        const periods: Array<{ period: string; openRecommendations: number; watchlist: number; closed: number }> = [];
        const count = ideasAddedPeriod === 'day' ? 30 : ideasAddedPeriod === 'week' ? 8 : 6;

        for (let i = count - 1; i >= 0; i--) {
            let periodStart: Date;
            let periodEnd: Date;
            let periodLabel: string;

            if (ideasAddedPeriod === 'day') {
                periodStart = new Date(now);
                periodStart.setDate(now.getDate() - i);
                periodStart.setHours(0, 0, 0, 0);
                periodEnd = new Date(periodStart);
                periodEnd.setHours(23, 59, 59, 999);
                periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else if (ideasAddedPeriod === 'week') {
                periodStart = new Date(now);
                periodStart.setDate(now.getDate() - (now.getDay() + i * 7));
                periodStart.setHours(0, 0, 0, 0);
                periodEnd = new Date(periodStart);
                periodEnd.setDate(periodStart.getDate() + 6);
                periodEnd.setHours(23, 59, 59, 999);
                periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } else {
                periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
                periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
                periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            }

            const addedInPeriod = recommendations.filter(rec => {
                if (!rec.entry_date) return false;
                const entryDate = new Date(rec.entry_date);
                return entryDate >= periodStart && entryDate <= periodEnd;
            });

            const openRecommendationsCount = addedInPeriod.filter(r => r.status === 'OPEN').length;
            const watchlistCount = addedInPeriod.filter(r => r.status === 'WATCHLIST').length;

            const closedInPeriod = recommendations.filter(rec => {
                if (!rec.exit_date || rec.status !== 'CLOSED') return false;
                const exitDate = new Date(rec.exit_date);
                return exitDate >= periodStart && exitDate <= periodEnd;
            });
            const closedCount = closedInPeriod.length;

            periods.push({
                period: periodLabel,
                openRecommendations: openRecommendationsCount,
                watchlist: watchlistCount,
                closed: closedCount
            });
        }

        return periods;
    }, [recommendations, ideasAddedPeriod]);

    // Calculate portfolio allocation
    const portfolioAllocation = useMemo(() => {
        if (!recommendations || recommendations.length === 0) return [];

        const allocationMap: Record<string, { buyCount: number; sellCount: number }> = {};

        recommendations
            .filter(rec => rec.status === 'OPEN')
            .forEach(rec => {
                if (!allocationMap[rec.ticker]) {
                    allocationMap[rec.ticker] = { buyCount: 0, sellCount: 0 };
                }

                if (rec.action === 'BUY') {
                    allocationMap[rec.ticker].buyCount += 1;
                } else if (rec.action === 'SELL') {
                    allocationMap[rec.ticker].sellCount += 1;
                }
            });

        return Object.entries(allocationMap)
            .filter(([_, data]) => data.buyCount > 0 || data.sellCount > 0)
            .map(([ticker, data]) => ({
                ticker,
                buyCount: data.buyCount,
                sellCount: data.sellCount
            }));
    }, [recommendations]);

    // Calculate latest cumulative return
    const latestCumulativeReturn = useMemo(() => {
        if (portfolioReturns.length === 0) return 0;
        const lastPoint = portfolioReturns[portfolioReturns.length - 1];
        return lastPoint.cumulativeReturn ?? 0;
    }, [portfolioReturns]);

    // Calculate win rate, profitable weeks, and total trades
    const calculatedMetrics = useMemo(() => {
        const activeRecs = recommendations.filter(r => r.status === 'OPEN' || r.status === 'CLOSED');
        const closedRecs = recommendations.filter(r => r.status === 'CLOSED');

        // Win rate: percentage of closed positions with positive returns
        let winRate = 0;
        if (closedRecs.length > 0) {
            const wins = closedRecs.filter(rec => {
                const entry = rec.entry_price || 0;
                const exit = rec.exit_price || entry;
                if (entry <= 0) return false;
                const ret = getReturnFromCacheOrCalculate(rec.ticker, entry, exit, rec.action || 'BUY');
                return ret > 0;
            }).length;
            winRate = (wins / closedRecs.length) * 100;
        }

        // Profitable weeks: percentage of weeks with positive returns
        let profitableWeeks = 0;
        if (portfolioReturns.length > 0) {
            const profitableCount = portfolioReturns.filter(r => r.return > 0).length;
            profitableWeeks = (profitableCount / portfolioReturns.length) * 100;
        }

        // Total trades: count of all recommendations (excluding watchlist)
        const totalTrades = activeRecs.length;

        return { winRate, profitableWeeks, totalTrades };
    }, [recommendations, portfolioReturns]);

    // Create calendar data for daily returns
    // Missing values are treated as 0, but 0 values are filtered out in the calendar component to show as blank
    const calendarData = useMemo(() => {
        if (!portfolioReturns || portfolioReturns.length === 0 || returnsMatrixPeriod !== 'day') return [];
        
        return portfolioReturns
            .filter(point => point.date) // Only include points with date
            .map(point => ({
                day: point.date!,
                value: point.return ?? 0 // Ensure missing values are 0
            }));
    }, [portfolioReturns, returnsMatrixPeriod]);

    // Create returns matrix heatmap data based on selected period
    const returnsMatrixData = useMemo(() => {
        if (!portfolioReturns || portfolioReturns.length === 0) return [];

        // For daily view, use calendar instead of matrix
        if (returnsMatrixPeriod === 'day') {
            return [];
        }

        // For monthly view, group by year-month
        if (returnsMatrixPeriod === 'month') {
            const matrixData: Array<{ year: number; month: number; return_pct: number }> = [];
            const returnsByMonth: Record<string, number[]> = {};

            portfolioReturns.forEach(point => {
                // Parse date from week label (e.g., "Dec 1" or "Dec 2024")
                const dateStr = point.week;
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) {
                    // Try parsing as month-year format
                    const parts = dateStr.split(' ');
                    if (parts.length === 2) {
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const monthIdx = monthNames.indexOf(parts[0]);
                        if (monthIdx >= 0) {
                            const year = parseInt(parts[1]);
                            const key = `${year}-${monthIdx + 1}`;
                            if (!returnsByMonth[key]) {
                                returnsByMonth[key] = [];
                            }
                            returnsByMonth[key].push(point.return);
                        }
                    }
                } else {
                    const year = date.getFullYear();
                    const month = date.getMonth() + 1;
                    const key = `${year}-${month}`;
                    if (!returnsByMonth[key]) {
                        returnsByMonth[key] = [];
                    }
                    returnsByMonth[key].push(point.return);
                }
            });

            Object.entries(returnsByMonth).forEach(([key, returns]) => {
                const [year, month] = key.split('-').map(Number);
                const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
                matrixData.push({
                    year,
                    month,
                    return_pct: avgReturn
                });
            });

            return matrixData;
        }

        // For weekly, group by month and calculate appropriately
        const matrixData: Array<{ year: number; month: number; return_pct: number }> = [];
        const returnsByMonth: Record<string, number[]> = {};

        portfolioReturns.forEach(point => {
            // Try to parse the date from the week label
            const now = new Date();
            const dateStr = point.week;
            // Try to extract month from label like "Dec 1" or "Dec 2024"
            const parts = dateStr.split(' ');
            if (parts.length >= 1) {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthIdx = monthNames.indexOf(parts[0]);
                if (monthIdx >= 0) {
                    const year = parts.length > 1 && parts[1].length === 4
                        ? parseInt(parts[1])
                        : now.getFullYear();
                    const key = `${year}-${monthIdx + 1}`;
                    if (!returnsByMonth[key]) {
                        returnsByMonth[key] = [];
                    }
                    returnsByMonth[key].push(point.return);
                }
            }
        });

        Object.entries(returnsByMonth).forEach(([key, returns]) => {
            const [year, month] = key.split('-').map(Number);
            // For weekly returns, average them
            const monthlyReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
            
            matrixData.push({
                year,
                month,
                return_pct: monthlyReturn
            });
        });

        return matrixData;
    }, [portfolioReturns, returnsMatrixPeriod]);

    // Early return AFTER all hooks (React rules: hooks must be called in same order on every render)
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-gray-400">Loading performance data...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                            <BarChart2 className="w-8 h-8" />
                            Performance Analytics
                        </h1>
                        <p className="text-gray-400 mt-1">Detailed portfolio performance metrics</p>
                    </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="text-xs text-gray-400 uppercase mb-1">Total Return</div>
                        <div className={`text-2xl font-bold ${latestCumulativeReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {latestCumulativeReturn >= 0 ? '+' : ''}{latestCumulativeReturn.toFixed(2)}%
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="text-xs text-gray-400 uppercase mb-1">Alpha</div>
                        <div className={`text-2xl font-bold ${metrics.alpha_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {metrics.alpha_pct?.toFixed(2) || '0.00'}%
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="text-xs text-gray-400 uppercase mb-1">Sharpe Ratio</div>
                        <div className="text-2xl font-bold text-white">
                            {metrics.sharpe_ratio?.toFixed(2) || '0.00'}
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="text-xs text-gray-400 uppercase mb-1">Max Drawdown</div>
                        <div className="text-2xl font-bold text-rose-400">
                            {metrics.max_drawdown_pct?.toFixed(2) || '0.00'}%
                        </div>
                    </div>
                </div>

                {/* Portfolio Returns Chart */}
                <div className="bg-white/5 rounded-lg p-6 border border-white/10 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Portfolio Returns
                        </h3>
                        <select
                            value={portfolioReturnsPeriod}
                            onChange={(e) => setPortfolioReturnsPeriod(e.target.value as 'day' | 'week' | 'month')}
                            className="text-sm text-gray-400 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                        >
                            <option value="day">Day</option>
                            <option value="week">Week</option>
                            <option value="month">Month</option>
                        </select>
                    </div>
                    {portfolioReturnsLoading ? (
                        <div className="flex items-center justify-center h-[300px] text-gray-400">
                            Loading...
                        </div>
                    ) : portfolioReturns.length > 0 ? (
                        <WeeklyReturnsChart data={portfolioReturns} height={300} />
                    ) : (
                        <div className="flex items-center justify-center h-[300px] text-gray-400">
                            No data available
                        </div>
                    )}
                </div>

                {/* Ideas Added Chart */}
                {ideasAddedData.length > 0 && (
                    <div className="bg-white/5 rounded-lg p-6 border border-white/10 mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">Ideas Added</h3>
                            <select
                                value={ideasAddedPeriod}
                                onChange={(e) => setIdeasAddedPeriod(e.target.value as 'day' | 'week' | 'month')}
                                className="text-sm text-gray-400 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                            >
                                <option value="day">Day</option>
                                <option value="week">Week</option>
                                <option value="month">Month</option>
                            </select>
                        </div>
                        <IdeasAddedChart data={ideasAddedData} height={300} periodType={ideasAddedPeriod} />
                    </div>
                )}

                {/* Portfolio Allocation Chart */}
                {portfolioAllocation.length > 0 && (
                    <div className="bg-white/5 rounded-lg p-6 border border-white/10 mb-6 overflow-visible">
                        <h3 className="text-lg font-semibold text-white mb-4">Portfolio Allocation</h3>
                        <div className="h-[300px] -mx-2 overflow-visible">
                            <PortfolioAllocationDonut data={portfolioAllocation} height={300} />
                        </div>
                    </div>
                )}

                {/* Returns Matrix - Heatmap */}
                <div className="bg-white/5 rounded-lg p-6 border border-white/10 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">Returns Matrix</h3>
                        <select
                            value={returnsMatrixPeriod}
                            onChange={(e) => setReturnsMatrixPeriod(e.target.value as 'day' | 'week' | 'month')}
                            className="text-sm text-gray-400 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                        >
                            <option value="day">Day</option>
                            <option value="week">Week</option>
                            <option value="month">Month</option>
                        </select>
                    </div>
                    {returnsMatrixPeriod === 'day' ? (
                        calendarData.length > 0 ? (
                            <DailyReturnsCalendar data={calendarData} />
                        ) : (
                            <div className="text-gray-400 text-center py-8">No daily returns data available</div>
                        )
                    ) : returnsMatrixData.length > 0 ? (
                        <MonthlyReturnsHeatmap data={returnsMatrixData} />
                    ) : (
                        <div className="text-gray-400 text-center py-8">No returns matrix data available</div>
                    )}
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="text-xs text-gray-400 uppercase mb-1">Win Rate</div>
                        <div className="text-2xl font-bold text-white">
                            {calculatedMetrics.winRate.toFixed(1)}%
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="text-xs text-gray-400 uppercase mb-1">Profitable Weeks</div>
                        <div className="text-2xl font-bold text-white">
                            {calculatedMetrics.profitableWeeks.toFixed(1)}%
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="text-xs text-gray-400 uppercase mb-1">Total Trades</div>
                        <div className="text-2xl font-bold text-white">
                            {calculatedMetrics.totalTrades}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

