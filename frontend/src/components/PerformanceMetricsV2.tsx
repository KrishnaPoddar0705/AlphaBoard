import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { calculatePortfolioReturns, getWeights } from '../lib/edgeFunctions';
import { PortfolioPerformanceChart } from './charts/PortfolioPerformanceChart';
import { TrendingUp, TrendingDown, Award, AlertTriangle, BarChart3 } from 'lucide-react';

interface PerformanceMetricsV2Props {
    userId?: string;
}

export const PerformanceMetricsV2: React.FC<PerformanceMetricsV2Props> = ({ userId }) => {
    const { session } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [performanceData, setPerformanceData] = useState<any>(null);
    const [weights, setWeights] = useState<any[]>([]);
    const [selectedPeriod, setSelectedPeriod] = useState<'1M' | '3M' | '6M' | '12M'>('12M');

    const targetUserId = userId || session?.user?.id;

    useEffect(() => {
        if (targetUserId) {
            fetchPerformanceData();
        }
    }, [targetUserId, selectedPeriod]);

    const fetchPerformanceData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Fetch weights and performance from Edge Functions
            const [weightsData, perfData] = await Promise.all([
                getWeights(targetUserId!),
                calculatePortfolioReturns(targetUserId!, selectedPeriod)
            ]);
            
            setWeights(weightsData.weights || []);
            setPerformanceData(perfData);
        } catch (err) {
            console.error('Error fetching performance data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load performance data');
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

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <AlertTriangle className="w-12 h-12 text-yellow-400" />
                <div className="text-gray-400">{error}</div>
                <button
                    onClick={fetchPerformanceData}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500"
                >
                    Retry
                </button>
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

    const currentReturn = (performanceData?.returns?.[selectedPeriod] || 0) * 100;

    return (
        <div className="space-y-6 p-6">
            {/* Period Selector */}
            <div className="flex gap-3 mb-6">
                {(['1M', '3M', '6M', '12M'] as const).map((period) => (
                    <button
                        key={period}
                        onClick={() => setSelectedPeriod(period)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            selectedPeriod === period
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        {period}
                    </button>
                ))}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-800/10 rounded-lg p-6 border border-emerald-500/30">
                    <div className="text-xs text-gray-400 uppercase mb-2">Total Return ({selectedPeriod})</div>
                    <div className={`text-3xl font-bold flex items-center gap-2 ${
                        currentReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                        {currentReturn >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                        {currentReturn >= 0 ? '+' : ''}{currentReturn.toFixed(2)}%
                    </div>
                </div>

                <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 rounded-lg p-6 border border-blue-500/30">
                    <div className="text-xs text-gray-400 uppercase mb-2">Sharpe Ratio ({selectedPeriod})</div>
                    <div className="text-3xl font-bold text-blue-400 flex items-center gap-2">
                        <Award className="w-6 h-6" />
                        {(performanceData?.sharpe || 0).toFixed(2)}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 rounded-lg p-6 border border-yellow-500/30">
                    <div className="text-xs text-gray-400 uppercase mb-2">Volatility ({selectedPeriod})</div>
                    <div className="text-3xl font-bold text-yellow-400 flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6" />
                        {((performanceData?.volatility || 0) * 100).toFixed(2)}%
                    </div>
                </div>

                <div className="bg-gradient-to-br from-rose-900/20 to-rose-800/10 rounded-lg p-6 border border-rose-500/30">
                    <div className="text-xs text-gray-400 uppercase mb-2">Max Drawdown ({selectedPeriod})</div>
                    <div className="text-3xl font-bold text-rose-400 flex items-center gap-2">
                        <TrendingDown className="w-6 h-6" />
                        -{((performanceData?.drawdown || 0) * 100).toFixed(2)}%
                    </div>
                </div>
            </div>

            {/* Portfolio Performance Chart */}
            <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Portfolio Performance ({selectedPeriod})
                </h3>
                {performanceData?.equityCurve && performanceData.equityCurve.length > 0 ? (
                    <PortfolioPerformanceChart
                        data={performanceData.equityCurve.map((point: any) => ({
                            date: point.date,
                            value: (point.value - 1) * 100 // Convert to percentage
                        }))}
                        height={400}
                    />
                ) : (
                    <div className="text-center text-gray-400 py-12">
                        No chart data available for this period
                    </div>
                )}
            </div>

            {/* Portfolio Allocation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">Portfolio Allocation</h3>
                    {weights && weights.length > 0 ? (
                        <div className="space-y-3">
                            {weights.map((w: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <span className="text-sm text-gray-300">{w.ticker}</span>
                                    <div className="flex items-center gap-3">
                                        <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-500"
                                                style={{ width: `${w.weight}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-medium text-white w-12 text-right">
                                            {w.weight.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 py-12">
                            No allocation data available
                        </div>
                    )}
                </div>

                <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                    <h3 className="text-lg font-semibold text-white mb-4">Period Returns</h3>
                    <div className="space-y-3">
                        {Object.entries(performanceData?.returns || {}).map(([period, value]: [string, any]) => (
                            <div key={period} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                <span className="text-sm text-gray-300">{period} Return</span>
                                <span className={`text-lg font-bold ${
                                    value >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}>
                                    {value >= 0 ? '+' : ''}{(value * 100).toFixed(2)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="text-xs text-gray-500 text-center">
                Last updated: {performanceData?.timestamp ? new Date(performanceData.timestamp).toLocaleString() : 'N/A'}
            </div>
        </div>
    );
};

