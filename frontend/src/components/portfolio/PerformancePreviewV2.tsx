import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Award, AlertTriangle } from 'lucide-react';
import { calculatePortfolioReturns } from '../../lib/edgeFunctions';
import { PortfolioPerformanceChart } from '../charts/PortfolioPerformanceChart';

interface PerformancePreviewV2Props {
    userId: string;
    refreshKey?: number;
}

interface PerformanceData {
    returns: {
        '1M': number;
        '3M': number;
        '6M': number;
        '12M': number;
    };
    volatility: number;
    sharpe: number;
    drawdown: number;
    equityCurve: Array<{ date: string; value: number }>;
}

export const PerformancePreviewV2: React.FC<PerformancePreviewV2Props> = ({ userId, refreshKey }) => {
    const [data, setData] = useState<PerformanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<'1M' | '3M' | '6M' | '12M'>('12M');

    useEffect(() => {
        fetchPerformance();
    }, [userId, refreshKey, selectedPeriod]);

    const fetchPerformance = async () => {
        try {
            setLoading(true);
            setError(null);

            // Call Edge Function with selected period - ALWAYS FRESH, NO CACHE
            const performanceData = await calculatePortfolioReturns(userId, selectedPeriod);
            setData(performanceData);
        } catch (err) {
            console.error('Error fetching performance:', err);
            const errorMsg = err instanceof Error ? err.message : 'Failed to calculate performance';

            // Handle specific "no weights" error gracefully
            if (errorMsg.includes('No portfolio weights found')) {
                setError('No portfolio weights saved yet. Please adjust weights and click "Save" in the weight panel.');
            } else if (errorMsg.includes('Failed to fetch')) {
                setError('Unable to fetch price data. Please check your internet connection or try again later.');
            } else {
                setError(errorMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/10 animate-pulse">
                        <div className="h-4 bg-white/10 rounded w-1/2 mb-2"></div>
                        <div className="h-6 bg-white/10 rounded w-3/4"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-900/20 p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-yellow-400 font-medium mb-1">Performance Not Available</p>
                        <p className="text-xs text-gray-400">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center text-gray-400 py-4 text-sm">
                No performance data available
            </div>
        );
    }

    // Validate data structure
    if (!data.returns || typeof data.returns !== 'object') {
        console.error('Invalid data structure:', data);
        return (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-900/20 p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-yellow-400 font-medium mb-1">Invalid Data</p>
                        <p className="text-xs text-gray-400">Performance data structure is invalid. Try refreshing.</p>
                    </div>
                </div>
            </div>
        );
    }

    const currentReturn = (data.returns[selectedPeriod] || 0) * 100; // Convert to percentage

    return (
        <div className="space-y-4">
            {/* Period Selector */}
            <div className="flex gap-2">
                {(['1M', '3M', '6M', '12M'] as const).map((period) => (
                    <button
                        key={period}
                        onClick={() => setSelectedPeriod(period)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${selectedPeriod === period
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        {period}
                    </button>
                ))}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3">
                {/* Return */}
                <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-800/10 rounded-lg p-3 border border-emerald-500/30">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-gray-400">Return ({selectedPeriod})</span>
                    </div>
                    <div className={`text-lg font-bold ${currentReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                        {currentReturn >= 0 ? '+' : ''}{currentReturn.toFixed(2)}%
                    </div>
                </div>

                {/* Volatility */}
                <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 rounded-lg p-3 border border-yellow-500/30">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs text-gray-400">Volatility ({selectedPeriod})</span>
                    </div>
                    <div className="text-lg font-bold text-yellow-400">
                        {((data.volatility || 0) * 100).toFixed(2)}%
                    </div>
                </div>

                {/* Sharpe */}
                <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 rounded-lg p-3 border border-blue-500/30">
                    <div className="flex items-center gap-2 mb-1">
                        <Award className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-gray-400">Sharpe ({selectedPeriod})</span>
                    </div>
                    <div className="text-lg font-bold text-blue-400">
                        {(data.sharpe || 0).toFixed(2)}
                    </div>
                </div>

                {/* Max Drawdown */}
                <div className="bg-gradient-to-br from-rose-900/20 to-rose-800/10 rounded-lg p-3 border border-rose-500/30">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="w-4 h-4 text-rose-400" />
                        <span className="text-xs text-gray-400">Drawdown ({selectedPeriod})</span>
                    </div>
                    <div className="text-lg font-bold text-rose-400">
                        -{((data.drawdown || 0) * 100).toFixed(2)}%
                    </div>
                </div>
            </div>

            {/* Equity Curve Chart */}
            {data.equityCurve && data.equityCurve.length > 0 && (
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <PortfolioPerformanceChart
                        data={data.equityCurve.map(point => ({
                            date: point.date,
                            value: (point.value - 1) * 100 // Convert to percentage return
                        }))}
                        height={200}
                    />
                </div>
            )}

            <div className="text-xs text-gray-500 text-center">
                Last updated: {new Date().toLocaleTimeString()}
            </div>
        </div>
    );
};

