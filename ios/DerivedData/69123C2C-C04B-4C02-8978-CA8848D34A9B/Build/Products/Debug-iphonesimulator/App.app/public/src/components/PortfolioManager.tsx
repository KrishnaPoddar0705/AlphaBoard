import React, { useEffect, useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { getPortfolioBalance, updatePortfolioWeights } from '../lib/api';
import { supabase } from '../lib/supabase';

interface PortfolioManagerProps {
    userId: string;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

interface Position {
    id: string;
    ticker: string;
    entry_price: number;
    current_price: number;
    weight_pct: number | null;
    invested_amount: number;
    position_size: number | null;
}

export const PortfolioManager: React.FC<PortfolioManagerProps> = ({ userId, isOpen, onClose, onUpdate }) => {
    const [positions, setPositions] = useState<Position[]>([]);
    const [weights, setWeights] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [balance, setBalance] = useState<any>(null);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, userId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const balanceData = await getPortfolioBalance(userId);
            setBalance(balanceData);
            
            // Fetch recommendations from Supabase
            const { data: recs, error } = await supabase
                .from('recommendations')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'OPEN')
                .order('entry_date', { ascending: false });
            
            if (error) throw error;
            
            const openPositions = recs || [];
            setPositions(openPositions);
            
            const initialWeights: Record<string, number> = {};
            openPositions.forEach((pos: any) => {
                initialWeights[pos.id] = pos.weight_pct || (100 / openPositions.length);
            });
            setWeights(initialWeights);
        } catch (err) {
            console.error('Error fetching portfolio data:', err);
            setError('Failed to load portfolio data');
        } finally {
            setLoading(false);
        }
    };

    const handleWeightChange = (positionId: string, newWeight: number) => {
        const updatedWeights = { ...weights, [positionId]: newWeight };
        setWeights(updatedWeights);
        setError(null);
    };

    const getTotalWeight = () => {
        return Object.values(weights).reduce((sum, w) => sum + (w || 0), 0);
    };

    const handleSave = async () => {
        const totalWeight = getTotalWeight();
        
        if (Math.abs(totalWeight - 100) > 0.01) {
            setError(`Portfolio weights must sum to 100%. Current total: ${totalWeight.toFixed(2)}%`);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            
            await updatePortfolioWeights(userId, weights);
            
            onUpdate();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to update portfolio weights');
        } finally {
            setLoading(false);
        }
    };

    const calculatePositionValue = (pos: Position) => {
        if (!pos.entry_price || pos.entry_price <= 0) return 0;
        return pos.invested_amount * (pos.current_price / pos.entry_price);
    };

    const calculatePnL = (pos: Position) => {
        const currentValue = calculatePositionValue(pos);
        return currentValue - pos.invested_amount;
    };

    if (!isOpen) return null;

    const totalWeight = getTotalWeight();
    const weightError = Math.abs(totalWeight - 100) > 0.01;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-800 rounded-lg border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div>
                        <h2 className="text-xl font-bold text-white">Manage Portfolio</h2>
                        <p className="text-sm text-gray-400 mt-1">Adjust weights to rebalance your portfolio</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Balance Summary */}
                {balance && (
                    <div className="px-6 py-4 bg-slate-900/50 border-b border-white/10">
                        <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-gray-400">Available Cash:</span>
                                <span className="text-white font-semibold ml-2">₹{(balance.available_cash / 1000).toFixed(0)}K</span>
                            </div>
                            <div>
                                <span className="text-gray-400">Total Invested:</span>
                                <span className="text-white font-semibold ml-2">₹{(balance.total_invested / 1000).toFixed(0)}K</span>
                            </div>
                            <div>
                                <span className="text-gray-400">Current Value:</span>
                                <span className="text-white font-semibold ml-2">₹{(balance.current_balance / 1000).toFixed(0)}K</span>
                            </div>
                            <div>
                                <span className="text-gray-400">Total Weight:</span>
                                <span className={`font-semibold ml-2 ${weightError ? 'text-yellow-400' : 'text-white'}`}>
                                    {totalWeight.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {/* Positions Table */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading && positions.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">Loading...</div>
                    ) : positions.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">No open positions</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Ticker</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Entry Price</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Current Price</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Weight (%)</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Invested</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Current Value</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">P&L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {positions.map((pos) => {
                                        const currentValue = calculatePositionValue(pos);
                                        const pnl = calculatePnL(pos);
                                        const pnlPct = pos.invested_amount > 0 ? (pnl / pos.invested_amount) * 100 : 0;
                                        
                                        return (
                                            <tr key={pos.id} className="border-b border-white/5 hover:bg-white/5">
                                                <td className="py-3 px-4">
                                                    <span className="font-semibold text-white">{pos.ticker}</span>
                                                </td>
                                                <td className="py-3 px-4 text-right text-gray-300">
                                                    ₹{pos.entry_price.toFixed(2)}
                                                </td>
                                                <td className="py-3 px-4 text-right text-gray-300">
                                                    ₹{pos.current_price.toFixed(2)}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        value={weights[pos.id] || 0}
                                                        onChange={(e) => handleWeightChange(pos.id, parseFloat(e.target.value) || 0)}
                                                        className="w-24 px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                                    />
                                                </td>
                                                <td className="py-3 px-4 text-right text-gray-300">
                                                    ₹{(pos.invested_amount / 1000).toFixed(1)}K
                                                </td>
                                                <td className="py-3 px-4 text-right text-gray-300">
                                                    ₹{(currentValue / 1000).toFixed(1)}K
                                                </td>
                                                <td className={`py-3 px-4 text-right font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {pnl >= 0 ? '+' : ''}₹{(pnl / 1000).toFixed(1)}K ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-white/10">
                    <div className="text-sm text-gray-400">
                        {weightError && (
                            <span className="text-yellow-400 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                Weights must sum to 100%
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-300 bg-transparent border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || weightError}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

