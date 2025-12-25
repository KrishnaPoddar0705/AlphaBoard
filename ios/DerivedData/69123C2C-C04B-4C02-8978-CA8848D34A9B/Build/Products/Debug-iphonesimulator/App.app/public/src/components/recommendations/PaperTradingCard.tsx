import React from 'react';
import { Wallet, Coins, DollarSign } from 'lucide-react';

interface PaperTradingCardProps {
    weight: number;
    capital: number;
    entryPrice: number;
    positionValue: number;
    units: number;
}

export const PaperTradingCard: React.FC<PaperTradingCardProps> = ({
    weight,
    capital,
    entryPrice,
    positionValue,
    units
}) => {
    return (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">Paper Trading Position</span>
            </div>

            <div className="space-y-3">
                {/* Virtual Capital */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-400">Virtual Capital</span>
                    </div>
                    <span className="text-sm font-semibold text-white">
                        ₹{(capital / 1000).toFixed(0)}K
                    </span>
                </div>

                {/* Weight */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Portfolio Weight</span>
                    <span className="text-sm font-semibold text-indigo-400">
                        {weight.toFixed(2)}%
                    </span>
                </div>

                {/* Position Value */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-400">Position Value</span>
                    </div>
                    <span className="text-sm font-bold text-emerald-400">
                        ₹{(positionValue / 1000).toFixed(1)}K
                    </span>
                </div>

                {/* Units */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Number of Units</span>
                    <span className="text-sm font-semibold text-white">
                        {units.toFixed(0)} shares
                    </span>
                </div>

                {/* Entry Price */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Entry Price</span>
                    <span className="text-sm font-semibold text-gray-300">
                        ₹{entryPrice.toFixed(2)}
                    </span>
                </div>
            </div>
        </div>
    );
};

