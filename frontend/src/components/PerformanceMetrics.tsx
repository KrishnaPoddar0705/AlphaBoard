import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAnalystPerformance, getPortfolioAllocation } from '../lib/api';
import { YearlyBarChart } from './charts/YearlyBarChart';
import { MonthlyReturnsHeatmap } from './charts/MonthlyReturnsHeatmap';
import { PortfolioAllocationPie } from './charts/PortfolioAllocationPie';
import { PnLDistribution } from './charts/PnLDistribution';
import { TrendingUp, TrendingDown, Award, Target, AlertTriangle } from 'lucide-react';

interface PerformanceMetricsProps {
    userId?: string;
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ userId }) => {
    const { session } = useAuth();
    const [loading, setLoading] = useState(true);
    const [performanceData, setPerformanceData] = useState<any>(null);
    const [allocationData, setAllocationData] = useState<any[]>([]);

    const targetUserId = userId || session?.user?.id;

    useEffect(() => {
        if (targetUserId) {
            fetchPerformanceData();
        }
    }, [targetUserId]);

    const fetchPerformanceData = async () => {
        try {
            setLoading(true);
            const [perf, allocation] = await Promise.all([
                getAnalystPerformance(targetUserId!),
                getPortfolioAllocation(targetUserId!)
            ]);
            setPerformanceData(perf);
            setAllocationData(allocation.allocation || []);
        } catch (error) {
            console.error('Error fetching performance data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-400">Loading performance metrics...</div>
            </div>
        );
    }

    if (!performanceData) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-400">No performance data available</div>
            </div>
        );
    }

    const metrics = performanceData.summary_metrics || {};

    return (
        <div className="space-y-6 p-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-xs text-gray-400 uppercase mb-1">Total Return</div>
                    <div className={`text-2xl font-bold flex items-center gap-2 ${metrics.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {metrics.total_return_pct >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        {metrics.total_return_pct?.toFixed(2) || '0.00'}%
                    </div>
                </div>

                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-xs text-gray-400 uppercase mb-1">Alpha</div>
                    <div className={`text-2xl font-bold flex items-center gap-2 ${metrics.alpha_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {metrics.alpha_pct >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                        {metrics.alpha_pct?.toFixed(2) || '0.00'}%
                    </div>
                </div>

                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-xs text-gray-400 uppercase mb-1">Sharpe Ratio</div>
                    <div className="text-2xl font-bold text-white flex items-center gap-2">
                        <Award className="w-5 h-5 text-yellow-400" />
                        {metrics.sharpe_ratio?.toFixed(2) || '0.00'}
                    </div>
                </div>

                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-xs text-gray-400 uppercase mb-1">Win Rate</div>
                    <div className="text-2xl font-bold text-white flex items-center gap-2">
                        <Target className="w-5 h-5 text-blue-400" />
                        {metrics.win_rate?.toFixed(1) || '0.0'}%
                    </div>
                </div>

                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="text-xs text-gray-400 uppercase mb-1">Risk Score</div>
                    <div className="text-2xl font-bold text-white flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-400" />
                        {metrics.avg_risk_score?.toFixed(1) || '0.0'}
                    </div>
                </div>
            </div>

            {/* Yearly Performance Chart */}
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">Yearly Performance</h3>
                {performanceData.yearly_returns && performanceData.yearly_returns.length > 0 ? (
                    <YearlyBarChart data={performanceData.yearly_returns} />
                ) : (
                    <div className="text-gray-400 text-center py-8">No yearly data available</div>
                )}
            </div>

            {/* Monthly Returns Heatmap */}
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4">Monthly Returns</h3>
                {performanceData.monthly_returns && performanceData.monthly_returns.length > 0 ? (
                    <MonthlyReturnsHeatmap data={performanceData.monthly_returns} />
                ) : (
                    <div className="text-gray-400 text-center py-8">No monthly data available</div>
                )}
            </div>

            {/* Portfolio Allocation and PnL Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">Portfolio Allocation</h3>
                    {allocationData.length > 0 ? (
                        <PortfolioAllocationPie data={allocationData} />
                    ) : (
                        <div className="text-gray-400 text-center py-8">No allocation data available</div>
                    )}
                </div>

                <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">P&L Distribution</h3>
                    {performanceData.best_trades && performanceData.best_trades.length > 0 ? (
                        <PnLDistribution trades={performanceData.best_trades.concat(performanceData.worst_trades || [])} />
                    ) : (
                        <div className="text-gray-400 text-center py-8">No trade data available</div>
                    )}
                </div>
            </div>

            {/* Best and Worst Trades */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">Top Gainers</h3>
                    {performanceData.best_trades && performanceData.best_trades.length > 0 ? (
                        <div className="space-y-2">
                            {performanceData.best_trades.slice(0, 5).map((trade: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded border border-white/5">
                                    <div>
                                        <div className="font-medium text-white">{trade.ticker}</div>
                                        <div className="text-xs text-gray-400">{trade.entry_date ? new Date(trade.entry_date).toLocaleDateString() : ''}</div>
                                    </div>
                                    <div className={`font-bold ${trade.return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {trade.return_pct >= 0 ? '+' : ''}{trade.return_pct?.toFixed(2)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-gray-400 text-center py-8">No trades available</div>
                    )}
                </div>

                <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">Top Losers</h3>
                    {performanceData.worst_trades && performanceData.worst_trades.length > 0 ? (
                        <div className="space-y-2">
                            {performanceData.worst_trades.slice(0, 5).map((trade: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded border border-white/5">
                                    <div>
                                        <div className="font-medium text-white">{trade.ticker}</div>
                                        <div className="text-xs text-gray-400">{trade.entry_date ? new Date(trade.entry_date).toLocaleDateString() : ''}</div>
                                    </div>
                                    <div className={`font-bold ${trade.return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {trade.return_pct >= 0 ? '+' : ''}{trade.return_pct?.toFixed(2)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-gray-400 text-center py-8">No trades available</div>
                    )}
                </div>
            </div>
        </div>
    );
};

