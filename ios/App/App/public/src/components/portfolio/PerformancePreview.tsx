import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Award, AlertTriangle } from 'lucide-react';
import { getPortfolioPreview } from '../../lib/api';
import { StackedContributionChart } from '../charts/StackedContributionChart';
import { PortfolioPerformanceChart } from '../charts/PortfolioPerformanceChart';

interface PerformancePreviewProps {
    userId: string;
    refreshKey?: string | number;
}

interface PreviewData {
    expected_return: number;
    expected_volatility: number;
    expected_sharpe: number;
    max_drawdown: number;
    returns_1m?: number;
    returns_3m?: number;
    returns_6m?: number;
    returns_12m?: number;
    volatility_1m?: number;
    volatility_3m?: number;
    volatility_6m?: number;
    volatility_12m?: number;
    sharpe_1m?: number;
    sharpe_3m?: number;
    sharpe_6m?: number;
    sharpe_12m?: number;
    drawdown_1m?: number;
    drawdown_3m?: number;
    drawdown_6m?: number;
    drawdown_12m?: number;
    portfolio_performance?: Array<{ date: string; value: number }>;
    contribution: Array<{
        ticker: string;
        weight: number;
        return: number;
        contribution: number;
        invested_weight?: number;
        current_weight?: number;
    }>;
}

export const PerformancePreviewV2: React.FC<PerformancePreviewProps> = ({ userId, refreshKey }) => {
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<'1m' | '3m' | '6m' | '12m'>('12m');

    // Refresh when userId or refreshKey changes
    useEffect(() => {
        fetchPreview();
    }, [userId, refreshKey]);

    const fetchPreview = async () => {
        try {
            setLoading(true);
            const data = await getPortfolioPreview(userId);
            setPreviewData(data);
        } catch (error) {
            console.error('Error fetching portfolio preview:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/10 animate-pulse">
                        <div className="h-4 bg-white/10 rounded w-1/2 mb-2"></div>
                        <div className="h-6 bg-white/10 rounded w-3/4"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (!previewData) {
        return null;
    }

    // Get metrics for selected period
    const getPeriodReturn = () => {
        switch (selectedPeriod) {
            case '1m': return previewData.returns_1m || 0;
            case '3m': return previewData.returns_3m || 0;
            case '6m': return previewData.returns_6m || 0;
            case '12m': return previewData.returns_12m || 0;
            default: return 0;
        }
    };

    const getPeriodVolatility = () => {
        switch (selectedPeriod) {
            case '1m': return previewData.volatility_1m || previewData.expected_volatility;
            case '3m': return previewData.volatility_3m || previewData.expected_volatility;
            case '6m': return previewData.volatility_6m || previewData.expected_volatility;
            case '12m': return previewData.volatility_12m || previewData.expected_volatility;
            default: return previewData.expected_volatility;
        }
    };

    const getPeriodSharpe = () => {
        switch (selectedPeriod) {
            case '1m': return previewData.sharpe_1m || previewData.expected_sharpe;
            case '3m': return previewData.sharpe_3m || previewData.expected_sharpe;
            case '6m': return previewData.sharpe_6m || previewData.expected_sharpe;
            case '12m': return previewData.sharpe_12m || previewData.expected_sharpe;
            default: return previewData.expected_sharpe;
        }
    };

    const getPeriodDrawdown = () => {
        switch (selectedPeriod) {
            case '1m': return previewData.drawdown_1m || previewData.max_drawdown;
            case '3m': return previewData.drawdown_3m || previewData.max_drawdown;
            case '6m': return previewData.drawdown_6m || previewData.max_drawdown;
            case '12m': return previewData.drawdown_12m || previewData.max_drawdown;
            default: return previewData.max_drawdown;
        }
    };

    // Prepare contribution data with invested and current weights
    const contributionData = previewData.contribution.map(item => {
        const investedWeight = item.weight || 0;
        const currentWeight = investedWeight * (1 + (item.return || 0) / 100);
        return {
            ticker: item.ticker,
            invested_weight: investedWeight,
            current_weight: currentWeight,
            return: item.return || 0
        };
    });

    return (
        <div className="space-y-4 mb-6">
            {/* Period Selector */}
            <div className="flex gap-2 mb-3">
                {(['1m', '3m', '6m', '12m'] as const).map((period) => (
                    <button
                        key={period}
                        onClick={() => setSelectedPeriod(period)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${selectedPeriod === period
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        {period.toUpperCase()}
                    </button>
                ))}
            </div>

            {/* KPI Cards for Selected Period */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                {/* Return */}
                <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-800/10 rounded-lg p-3 border border-emerald-500/30">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-gray-400">Return ({selectedPeriod.toUpperCase()})</span>
                    </div>
                    <div className={`text-lg font-bold ${getPeriodReturn() >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                        {getPeriodReturn() >= 0 ? '+' : ''}{getPeriodReturn().toFixed(2)}%
                    </div>
                </div>

                {/* Volatility */}
                <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/10 rounded-lg p-3 border border-yellow-500/30">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs text-gray-400">Volatility ({selectedPeriod.toUpperCase()})</span>
                    </div>
                    <div className="text-lg font-bold text-yellow-400">
                        {getPeriodVolatility().toFixed(2)}%
                    </div>
                </div>

                {/* Sharpe */}
                <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 rounded-lg p-3 border border-blue-500/30">
                    <div className="flex items-center gap-2 mb-1">
                        <Award className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-gray-400">Sharpe ({selectedPeriod.toUpperCase()})</span>
                    </div>
                    <div className="text-lg font-bold text-blue-400">
                        {getPeriodSharpe().toFixed(2)}
                    </div>
                </div>

                {/* Max Drawdown */}
                <div className="bg-gradient-to-br from-rose-900/20 to-rose-800/10 rounded-lg p-3 border border-rose-500/30">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="w-4 h-4 text-rose-400" />
                        <span className="text-xs text-gray-400">Drawdown ({selectedPeriod.toUpperCase()})</span>
                    </div>
                    <div className="text-lg font-bold text-rose-400">
                        {getPeriodDrawdown().toFixed(2)}%
                    </div>
                </div>
            </div>

            {/* Portfolio Performance Chart */}
            {previewData.portfolio_performance && previewData.portfolio_performance.length > 0 && (
                <div className="bg-white/5 rounded-lg p-4 border border-white/10 mb-3">
                    <PortfolioPerformanceChart data={previewData.portfolio_performance} height={300} />
                </div>
            )}

            {/* Stacked Contribution Chart */}
            {contributionData && contributionData.length > 0 && (
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <StackedContributionChart data={contributionData} height={200} />
                </div>
            )}
        </div>
    );
};

