import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, RefreshCw, Save, Edit3 } from 'lucide-react';
import { WeightSliderRow } from './WeightSliderRow';
import { PerformancePreviewV2 } from './PerformancePreviewV2';
import { getPortfolioBalance, updatePortfolioWeights, rebalanceWeights } from '../../lib/api';
import { supabase } from '../../lib/supabase';

interface PortfolioWeightPanelProps {
    userId: string;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

interface Position {
    id: string;
    ticker: string;
    weight_pct: number | null;
    invested_amount: number;
    entry_price: number;
    current_price: number;
}

export const PortfolioWeightPanelV2: React.FC<PortfolioWeightPanelProps> = ({ userId, isOpen, onClose, onUpdate }) => {
    const [positions, setPositions] = useState<Position[]>([]);
    const [weights, setWeights] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [_balance, setBalance] = useState<any>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [isManualMode, setIsManualMode] = useState(false);
    const [manualWeights, setManualWeights] = useState<Record<string, string>>({});
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, userId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [balanceData, { data: recs }] = await Promise.all([
                getPortfolioBalance(userId),
                supabase
                    .from('recommendations')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('status', 'OPEN')
                    .order('entry_date', { ascending: false })
            ]);

            setBalance(balanceData);
            const openPositions = recs || [];

            // Keep each recommendation separate (don't aggregate by ticker)
            const positionsArray: Position[] = openPositions.map((pos: any) => ({
                id: pos.id,
                ticker: pos.ticker,
                weight_pct: parseFloat(pos.weight_pct || 0),
                invested_amount: parseFloat(pos.invested_amount || 0),
                entry_price: parseFloat(pos.entry_price || 0),
                current_price: parseFloat(pos.current_price || pos.entry_price || 0)
            }));

            // If no weights set, distribute equally
            const totalWeight = positionsArray.reduce((sum, p) => sum + (p.weight_pct || 0), 0);
            if (totalWeight === 0 && positionsArray.length > 0) {
                const equalWeight = 100 / positionsArray.length;
                positionsArray.forEach(p => p.weight_pct = equalWeight);
            }

            setPositions(positionsArray);

            // Use recommendation ID as key, not ticker
            const initialWeights: Record<string, number> = {};
            positionsArray.forEach((pos) => {
                initialWeights[pos.id] = pos.weight_pct || 0;
            });
            setWeights(initialWeights);

            // Initialize manual weights
            const initialManualWeights: Record<string, string> = {};
            positionsArray.forEach((pos) => {
                initialManualWeights[pos.id] = (pos.weight_pct || 0).toFixed(2);
            });
            setManualWeights(initialManualWeights);
        } catch (error) {
            console.error('Error fetching portfolio data:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleManualMode = () => {
        if (!isManualMode) {
            // Entering manual mode - sync manual weights with current weights
            const newManualWeights: Record<string, string> = {};
            positions.forEach(pos => {
                newManualWeights[pos.id] = (weights[pos.id] || 0).toFixed(2);
            });
            setManualWeights(newManualWeights);
        }
        setIsManualMode(!isManualMode);
    };

    const handleManualWeightChange = (recId: string, value: string) => {
        setManualWeights(prev => ({ ...prev, [recId]: value }));
    };

    const getManualTotalWeight = () => {
        return Object.values(manualWeights).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    };

    const handleWeightChange = useCallback(async (recId: string, newWeight: number) => {
        // Clamp weight to valid range
        const clampedWeight = Math.max(0, Math.min(100, newWeight));

        // Update local state immediately for responsive UI
        setWeights(prev => {
            const updated = { ...prev, [recId]: clampedWeight };

            // Auto-rebalance: proportionally adjust other weights
            const otherRecIds = Object.keys(updated).filter(id => id !== recId);
            const otherWeightsSum = otherRecIds.reduce((sum, id) => sum + (updated[id] || 0), 0);
            const remainingWeight = 100 - clampedWeight;

            if (otherWeightsSum > 0 && remainingWeight >= 0) {
                const scaleFactor = remainingWeight / otherWeightsSum;
                otherRecIds.forEach(id => {
                    updated[id] = (updated[id] || 0) * scaleFactor;
                });
            } else if (remainingWeight > 0 && otherRecIds.length > 0) {
                // Distribute remaining weight equally
                const equalWeight = remainingWeight / otherRecIds.length;
                otherRecIds.forEach(id => {
                    updated[id] = equalWeight;
                });
            }

            return updated;
        });

        // Debounce backend update to avoid too many API calls
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(async () => {
            try {
                const response = await rebalanceWeights({
                    user_id: userId,
                    target_recommendation_id: recId,
                    new_weight: clampedWeight
                });

                // Update weights from saved values returned by backend
                if (response.weights) {
                    setWeights(response.weights);
                }

                // Refresh performance preview after a short delay
                setTimeout(() => {
                    setRefreshKey(prev => prev + 1);
                }, 500);
            } catch (error) {
                console.error('Error rebalancing weights:', error);
            }
        }, 800); // Debounce for 800ms
    }, [userId]);

    const handleSave = async () => {
        try {
            setSaving(true);

            let weightUpdates: Record<string, number> = {};

            // If in manual mode, use manual inputs
            if (isManualMode) {
                positions.forEach(pos => {
                    const manualValue = manualWeights[pos.id];
                    const weight = manualValue ? parseFloat(manualValue) : (weights[pos.id] || 0);
                    weightUpdates[pos.id] = weight;
                });
            } else {
                // Use slider weights
                positions.forEach(pos => {
                    const currentWeight = weights[pos.id] !== undefined ? weights[pos.id] : (pos.weight_pct || 0);
                    weightUpdates[pos.id] = currentWeight;
                });
            }

            // Ensure weights sum to 100% before saving
            const totalWeight = Object.values(weightUpdates).reduce((sum, w) => sum + w, 0);
            if (Math.abs(totalWeight - 100) > 0.01 && totalWeight > 0) {
                // Normalize weights to sum to 100%
                const scale = 100 / totalWeight;
                Object.keys(weightUpdates).forEach(id => {
                    weightUpdates[id] = weightUpdates[id] * scale;
                });
            }

            console.log('Saving weights:', weightUpdates);
            const response = await updatePortfolioWeights(userId, weightUpdates);
            console.log('Save response:', response);

            // Wait for backend to process
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Refresh data to show updated returns
            await fetchData();

            // Force preview refresh
            setRefreshKey(prev => prev + 1);

            // Exit manual mode
            setIsManualMode(false);

            onUpdate();
        } catch (error) {
            console.error('Error saving weights:', error);
            alert('Failed to save weights. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const getTotalWeight = () => {
        // Sum weights by unique ticker (already aggregated)
        return Object.values(weights).reduce((sum, w) => sum + (w || 0), 0);
    };

    const calculatePositionValue = (pos: Position) => {
        return pos.invested_amount * (pos.current_price / pos.entry_price);
    };

    if (!isOpen) return null;

    const totalWeight = getTotalWeight();
    const weightError = Math.abs(totalWeight - 100) > 0.01;

    return (
        <div className="fixed inset-y-0 right-0 z-50 w-96 bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
                <h2 className="text-lg font-bold text-white">Portfolio Weights</h2>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Performance Preview */}
            <div className="p-4 border-b border-white/10 overflow-y-auto flex-shrink-0 max-h-[50vh]">
                <PerformancePreviewV2 userId={userId} refreshKey={refreshKey} />
            </div>

            {/* Mode Toggle */}
            <div className="px-4 py-2 border-b border-white/10">
                <button
                    onClick={toggleManualMode}
                    className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                    <Edit3 className="w-4 h-4" />
                    {isManualMode ? 'Switch to Sliders' : 'Manual Input Mode'}
                </button>
            </div>

            {/* Weight List */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
                {loading ? (
                    <div className="text-center text-gray-400 py-8">Loading...</div>
                ) : positions.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">No open positions</div>
                ) : isManualMode ? (
                    /* Manual Input Mode */
                    <div className="space-y-2">
                        {positions.map((pos) => (
                            <div key={pos.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-white">{pos.ticker}</div>
                                    <div className="text-xs text-gray-400">₹{calculatePositionValue(pos).toLocaleString()}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={manualWeights[pos.id] || ''}
                                        onChange={(e) => handleManualWeightChange(pos.id, e.target.value)}
                                        className="w-20 px-2 py-1 text-sm text-white bg-slate-800 border border-white/20 rounded focus:outline-none focus:border-indigo-500"
                                    />
                                    <span className="text-sm text-gray-400">%</span>
                                </div>
                            </div>
                        ))}
                        <div className="mt-3 p-3 rounded-lg bg-slate-800/50 border border-white/10">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400">Total Weight:</span>
                                <span className={`text-sm font-semibold ${Math.abs(getManualTotalWeight() - 100) < 0.01 ? 'text-emerald-400' : 'text-yellow-400'
                                    }`}>
                                    {getManualTotalWeight().toFixed(2)}%
                                </span>
                            </div>
                            {Math.abs(getManualTotalWeight() - 100) > 0.01 && (
                                <div className="text-xs text-yellow-400 mt-1">
                                    Weights should sum to 100%
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Slider Mode */
                    <div className="space-y-3">
                        {positions.map((pos) => {
                            const positionValue = calculatePositionValue(pos);
                            return (
                                <WeightSliderRow
                                    key={pos.id}
                                    ticker={pos.ticker}
                                    weight={weights[pos.id] || 0}
                                    positionValue={positionValue}
                                    onWeightChange={(newWeight) => handleWeightChange(pos.id, newWeight)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-slate-900/95 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-400">Total Weight</span>
                    <span className={`text-sm font-semibold ${weightError ? 'text-yellow-400' : 'text-white'}`}>
                        {totalWeight.toFixed(2)}%
                    </span>
                </div>
                {weightError && (
                    <div className="text-xs text-yellow-400 mb-2">
                        Weights must sum to 100% (currently {totalWeight.toFixed(2)}%)
                    </div>
                )}
                {!weightError && totalWeight > 0 && (
                    <div className="text-xs text-emerald-400 mb-2">
                        ✓ Weights sum to 100%
                    </div>
                )}
                <div className="flex gap-2">
                    <button
                        onClick={fetchData}
                        className="flex-1 px-3 py-2 text-sm font-medium text-gray-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Reset
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || weightError}
                        className="flex-1 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

