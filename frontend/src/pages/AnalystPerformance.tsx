import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAnalystPerformance, getMonthlyMatrix, getPortfolioAllocation } from '../lib/api';
import { PerformanceMetricsV2 } from '../components/PerformanceMetricsV2';
import { YearlyBarChart } from '../components/charts/YearlyBarChart';
import { MonthlyReturnsHeatmap } from '../components/charts/MonthlyReturnsHeatmap';
import { PortfolioAllocationPie } from '../components/charts/PortfolioAllocationPie';
import { RollingSharpeChart } from '../components/charts/RollingSharpeChart';
import { ArrowLeft, TrendingUp, BarChart2 } from 'lucide-react';

export default function AnalystPerformance() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [performanceData, setPerformanceData] = useState<any>(null);
    const [monthlyMatrix, setMonthlyMatrix] = useState<any[]>([]);
    const [allocationData, setAllocationData] = useState<any[]>([]);

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [perf, monthly, allocation] = await Promise.all([
                getAnalystPerformance(id!),
                getMonthlyMatrix(id!),
                getPortfolioAllocation(id!)
            ]);
            setPerformanceData(perf);
            setMonthlyMatrix(monthly.monthly_returns || []);
            setAllocationData(allocation.allocation || []);
        } catch (error) {
            console.error('Error fetching performance data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-gray-400">Loading performance data...</div>
            </div>
        );
    }

    const metrics = performanceData?.summary_metrics || {};

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
                        <div className={`text-2xl font-bold ${metrics.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {metrics.total_return_pct?.toFixed(2) || '0.00'}%
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

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Yearly Returns
                        </h3>
                        {performanceData?.yearly_returns && performanceData.yearly_returns.length > 0 ? (
                            <YearlyBarChart data={performanceData.yearly_returns} height={300} />
                        ) : (
                            <div className="text-gray-400 text-center py-8">No yearly data available</div>
                        )}
                    </div>

                    <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                        <h3 className="text-lg font-semibold text-white mb-4">Portfolio Allocation</h3>
                        {allocationData.length > 0 ? (
                            <PortfolioAllocationPie data={allocationData} height={300} />
                        ) : (
                            <div className="text-gray-400 text-center py-8">No allocation data available</div>
                        )}
                    </div>
                </div>

                {/* Monthly Returns Matrix */}
                <div className="bg-white/5 rounded-lg p-6 border border-white/10 mb-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Monthly Returns Matrix</h3>
                    {monthlyMatrix.length > 0 ? (
                        <MonthlyReturnsHeatmap data={monthlyMatrix} />
                    ) : (
                        <div className="text-gray-400 text-center py-8">No monthly data available</div>
                    )}
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="text-xs text-gray-400 uppercase mb-1">Win Rate</div>
                        <div className="text-2xl font-bold text-white">
                            {metrics.win_rate?.toFixed(1) || '0.0'}%
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="text-xs text-gray-400 uppercase mb-1">Profitable Weeks</div>
                        <div className="text-2xl font-bold text-white">
                            {metrics.profitable_weeks_pct?.toFixed(1) || '0.0'}%
                        </div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                        <div className="text-xs text-gray-400 uppercase mb-1">Total Trades</div>
                        <div className="text-2xl font-bold text-white">
                            {metrics.total_trades || 0}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

