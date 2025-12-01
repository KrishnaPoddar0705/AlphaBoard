import React, { useEffect, useState } from 'react';
import { getPortfolioBalance } from '../lib/api';
import { Wallet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface PortfolioBalanceProps {
    userId: string;
}

interface BalanceData {
    initial_balance: number;
    current_balance: number;
    available_cash: number;
    total_invested: number;
}

export const PortfolioBalance: React.FC<PortfolioBalanceProps> = ({ userId }) => {
    const [balance, setBalance] = useState<BalanceData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBalance();
    }, [userId]);

    const fetchBalance = async () => {
        try {
            setLoading(true);
            const data = await getPortfolioBalance(userId);
            setBalance(data);
        } catch (error) {
            console.error('Error fetching portfolio balance:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-4 border border-white/10 animate-pulse">
                        <div className="h-4 bg-white/10 rounded w-1/2 mb-2"></div>
                        <div className="h-8 bg-white/10 rounded w-3/4"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (!balance) {
        return null;
    }

    const totalReturn = balance.total_invested > 0 
        ? ((balance.current_balance - balance.initial_balance) / balance.initial_balance) * 100
        : 0;
    const isPositive = totalReturn >= 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Initial Balance */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Initial Balance</span>
                    <Wallet className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                    ₹{(balance.initial_balance / 1000).toFixed(0)}K
                </div>
            </div>

            {/* Available Cash */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Available Cash</span>
                    <DollarSign className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                    ₹{(balance.available_cash / 1000).toFixed(0)}K
                </div>
            </div>

            {/* Total Invested */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Total Invested</span>
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-2xl font-bold text-white">
                    ₹{(balance.total_invested / 1000).toFixed(0)}K
                </div>
            </div>

            {/* Current Value & Return */}
            <div className={`bg-gradient-to-br rounded-lg p-4 border ${
                isPositive 
                    ? 'from-emerald-900/30 to-emerald-800/20 border-emerald-500/30' 
                    : 'from-rose-900/30 to-rose-800/20 border-rose-500/30'
            }`}>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Current Value</span>
                    {isPositive ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                    ) : (
                        <TrendingDown className="w-4 h-4 text-rose-400" />
                    )}
                </div>
                <div className={`text-2xl font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ₹{(balance.current_balance / 1000).toFixed(0)}K
                </div>
                <div className={`text-sm mt-1 ${isPositive ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {isPositive ? '+' : ''}{totalReturn.toFixed(2)}%
                </div>
            </div>
        </div>
    );
};

