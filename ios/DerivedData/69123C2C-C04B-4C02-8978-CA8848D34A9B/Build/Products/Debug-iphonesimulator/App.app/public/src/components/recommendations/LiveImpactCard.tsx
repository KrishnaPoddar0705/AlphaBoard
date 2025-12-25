import React from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Zap } from 'lucide-react';

interface LiveImpactCardProps {
    newWeight: number;
    oldWeight: number;
    positionValue: number;
    units: number;
    expectedVolatilityChange?: number;
    expectedSharpeChange?: number;
    entryPrice: number;
}

export const LiveImpactCard: React.FC<LiveImpactCardProps> = ({
    newWeight,
    oldWeight,
    positionValue,
    units,
    expectedVolatilityChange,
    expectedSharpeChange,
    entryPrice
}) => {
    const weightChange = newWeight - oldWeight;
    const isIncrease = weightChange > 0;

    return (
        <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 rounded-lg p-4 border border-indigo-500/30">
            <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-semibold text-white">Live Impact Preview</span>
            </div>

            <div className="space-y-3">
                {/* Weight Change */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Weight Change</span>
                    <div className={`flex items-center gap-1 text-sm font-semibold ${
                        isIncrease ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                        {isIncrease ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {isIncrease ? '+' : ''}{weightChange.toFixed(2)}%
                    </div>
                </div>

                {/* Position Value */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Position Value</span>
                    <span className="text-sm font-semibold text-white">
                        ₹{(positionValue / 1000).toFixed(1)}K
                    </span>
                </div>

                {/* Units */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Number of Units</span>
                    <span className="text-sm font-semibold text-white">
                        {units.toFixed(0)} @ ₹{entryPrice.toFixed(2)}
                    </span>
                </div>

                {/* Expected Volatility Change */}
                {expectedVolatilityChange !== undefined && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <span className="text-xs text-gray-400">Expected Volatility</span>
                        <div className={`flex items-center gap-1 text-sm font-semibold ${
                            expectedVolatilityChange > 0 ? 'text-yellow-400' : 'text-blue-400'
                        }`}>
                            {expectedVolatilityChange > 0 ? '+' : ''}{expectedVolatilityChange.toFixed(2)}%
                        </div>
                    </div>
                )}

                {/* Expected Sharpe Change */}
                {expectedSharpeChange !== undefined && (
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Expected Sharpe</span>
                        <div className={`flex items-center gap-1 text-sm font-semibold ${
                            expectedSharpeChange > 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                            {expectedSharpeChange > 0 ? '+' : ''}{expectedSharpeChange.toFixed(2)}
                        </div>
                    </div>
                )}

                {/* Warning if weight too high */}
                {newWeight > 50 && (
                    <div className="flex items-start gap-2 pt-2 border-t border-yellow-500/30 bg-yellow-500/10 rounded p-2">
                        <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-yellow-300">
                            High concentration risk: {newWeight.toFixed(1)}% in single position
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

