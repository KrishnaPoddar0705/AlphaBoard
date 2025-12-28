import React, { useEffect, useState, useCallback, useRef } from 'react';
import { X, RefreshCw, Save, Edit3 } from 'lucide-react';
import { WeightSliderRow } from './WeightSliderRow';
import { PerformancePreviewV2 } from './PerformancePreviewV2';
import { saveWeights, getWeights, rebalancePortfolioWeights } from '../../lib/edgeFunctions';
import { supabase } from '../../lib/supabase';

interface PortfolioWeightPanelV2Props {
    userId: string;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

interface Weight {
    ticker: string;
    weight: number;
}

export const PortfolioWeightPanelV2: React.FC<PortfolioWeightPanelV2Props> = ({ 
    userId, 
    isOpen, 
    onClose, 
    onUpdate 
}) => {
    const [weights, setWeights] = useState<Weight[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isManualMode, setIsManualMode] = useState(false);
    const [manualWeights, setManualWeights] = useState<Record<string, string>>({});
    const [refreshKey, setRefreshKey] = useState(0);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchWeights = useCallback(async () => {
        try {
            setLoading(true);
            
            // Fetch weights from Edge Function
            const { weights: fetchedWeights } = await getWeights(userId);
            
            // Always fetch current recommendations to check for new stocks
            const { data: recs } = await supabase
                .from('recommendations')
                .select('ticker')
                .eq('user_id', userId)
                .eq('status', 'OPEN');
            
            if (recs && recs.length > 0) {
                // Get unique tickers from recommendations
                const uniqueTickers = Array.from(new Set(recs.map(r => r.ticker)));
                
                if (fetchedWeights && fetchedWeights.length > 0) {
                    // Weights exist - check for new stocks
                    const existingTickers = new Set(fetchedWeights.map(w => w.ticker));
                    const newTickers = uniqueTickers.filter(t => !existingTickers.has(t));
                    
                    if (newTickers.length > 0) {
                        // New stocks found - add them with equal weight distribution
                        console.log('New stocks detected:', newTickers);
                        
                        // Calculate equal weight for all stocks (existing + new)
                        const allTickers = [...fetchedWeights.map(w => w.ticker), ...newTickers];
                        const equalWeight = 100 / allTickers.length;
                        
                        const updatedWeights = allTickers.map(ticker => ({
                            ticker,
                            weight: parseFloat(equalWeight.toFixed(2))
                        }));
                        
                        // Auto-save updated weights
                        try {
                            await saveWeights(userId, updatedWeights);
                            console.log('✓ Added new stocks and auto-saved equal weights');
                            setWeights(updatedWeights);
                            
                            const manual: Record<string, string> = {};
                            updatedWeights.forEach(w => {
                                manual[w.ticker] = w.weight.toFixed(2);
                            });
                            setManualWeights(manual);
                        } catch (saveError) {
                            console.error('Failed to auto-save updated weights:', saveError);
                            // Still show the updated weights even if save fails
                            setWeights(updatedWeights);
                            const manual: Record<string, string> = {};
                            updatedWeights.forEach(w => {
                                manual[w.ticker] = w.weight.toFixed(2);
                            });
                            setManualWeights(manual);
                        }
                    } else {
                        // No new stocks - use existing weights
                        setWeights(fetchedWeights);
                        
                        const manual: Record<string, string> = {};
                        fetchedWeights.forEach(w => {
                            manual[w.ticker] = w.weight.toFixed(2);
                        });
                        setManualWeights(manual);
                    }
                } else {
                    // No weights saved - fetch from recommendations and initialize
                    const equalWeight = 100 / uniqueTickers.length;
                    
                    const initialWeights = uniqueTickers.map(ticker => ({
                        ticker,
                        weight: parseFloat(equalWeight.toFixed(2))
                    }));
                    
                    setWeights(initialWeights);
                    
                    const manual: Record<string, string> = {};
                    initialWeights.forEach(w => {
                        manual[w.ticker] = w.weight.toFixed(2);
                    });
                    setManualWeights(manual);
                    
                    // AUTO-SAVE default equal weights so performance can be calculated
                    console.log('Auto-saving default equal weights for', uniqueTickers.length, 'positions');
                    try {
                        await saveWeights(userId, initialWeights);
                        console.log('✓ Default weights auto-saved successfully');
                    } catch (saveError) {
                        console.error('Failed to auto-save default weights:', saveError);
                    }
                }
            } else {
                // No recommendations - use fetched weights or empty
                if (fetchedWeights && fetchedWeights.length > 0) {
                    setWeights(fetchedWeights);
                    const manual: Record<string, string> = {};
                    fetchedWeights.forEach(w => {
                        manual[w.ticker] = w.weight.toFixed(2);
                    });
                    setManualWeights(manual);
                } else {
                    setWeights([]);
                    setManualWeights({});
                }
            }
        } catch (error) {
            console.error('Error fetching weights:', error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (isOpen) {
            fetchWeights();
        }
    }, [isOpen, userId, fetchWeights]);

    // Listen for recommendation updates to refresh weights
    useEffect(() => {
        const handleRecommendationUpdate = () => {
            if (isOpen) {
                // Small delay to ensure database is updated
                setTimeout(() => {
                    fetchWeights();
                }, 500);
            }
        };

        // Listen for custom event when recommendations are updated
        window.addEventListener('recommendations-updated', handleRecommendationUpdate);
        
        return () => {
            window.removeEventListener('recommendations-updated', handleRecommendationUpdate);
        };
    }, [isOpen, fetchWeights]);

    const toggleManualMode = () => {
        if (!isManualMode) {
            // Sync manual weights with current weights
            const manual: Record<string, string> = {};
            weights.forEach(w => {
                manual[w.ticker] = w.weight.toFixed(2);
            });
            setManualWeights(manual);
        }
        setIsManualMode(!isManualMode);
    };

    const handleManualWeightChange = (ticker: string, value: string) => {
        setManualWeights(prev => ({ ...prev, [ticker]: value }));
    };

    const getManualTotalWeight = () => {
        return Object.values(manualWeights).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    };

    const handleWeightChange = useCallback(async (ticker: string, newWeight: number) => {
        const clampedWeight = Math.max(0, Math.min(100, newWeight));
        
        // Debounce rebalance API call
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Optimistically update UI
        setWeights(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(w => w.ticker === ticker);
            if (idx !== -1) {
                updated[idx] = { ...updated[idx], weight: clampedWeight };
            }
            return updated;
        });

        debounceTimerRef.current = setTimeout(async () => {
            try {
                // Call rebalance Edge Function
                const { rebalancedWeights } = await rebalancePortfolioWeights(
                    weights,
                    ticker,
                    clampedWeight
                );
                
                setWeights(rebalancedWeights);
                
                // Refresh performance preview
                setTimeout(() => {
                    setRefreshKey(prev => prev + 1);
                }, 500);
            } catch (error) {
                console.error('Error rebalancing weights:', error);
            }
        }, 800);
    }, [weights]);

    const handleSave = async () => {
        try {
            setSaving(true);
            
            let weightsToSave: Weight[];
            
            if (isManualMode) {
                // Use manual input values
                weightsToSave = Object.entries(manualWeights).map(([ticker, weight]) => ({
                    ticker,
                    weight: parseFloat(weight) || 0
                }));
            } else {
                // Use current slider values
                weightsToSave = weights;
            }

            // Validate total
            const total = weightsToSave.reduce((sum, w) => sum + w.weight, 0);
            
            if (Math.abs(total - 100) > 0.1) {
                // Normalize to 100%
                const scale = 100 / total;
                weightsToSave = weightsToSave.map(w => ({
                    ticker: w.ticker,
                    weight: parseFloat((w.weight * scale).toFixed(2))
                }));
            }

            console.log('Saving weights:', weightsToSave);
            
            // Save via Edge Function
            await saveWeights(userId, weightsToSave);
            
            // Update local state
            setWeights(weightsToSave);
            
            // Exit manual mode
            setIsManualMode(false);
            
            // Refresh performance preview
            setRefreshKey(prev => prev + 1);
            
            onUpdate();
            
            alert('Weights saved successfully!');
        } catch (error) {
            console.error('Error saving weights:', error);
            alert(`Failed to save weights: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    const getTotalWeight = () => {
        return weights.reduce((sum, w) => sum + w.weight, 0);
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
                ) : weights.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                        No positions found. Add recommendations first.
                    </div>
                ) : isManualMode ? (
                    /* Manual Input Mode */
                    <div className="space-y-2">
                        {weights.map((w, index) => (
                            <div key={`${w.ticker}-${index}`} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-white">{w.ticker}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={manualWeights[w.ticker] || ''}
                                        onChange={(e) => handleManualWeightChange(w.ticker, e.target.value)}
                                        className="w-20 px-2 py-1 text-sm text-white bg-slate-800 border border-white/20 rounded focus:outline-none focus:border-indigo-500"
                                    />
                                    <span className="text-sm text-gray-400">%</span>
                                </div>
                            </div>
                        ))}
                        <div className="mt-3 p-3 rounded-lg bg-slate-800/50 border border-white/10">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400">Total Weight:</span>
                                <span className={`text-sm font-semibold ${
                                    Math.abs(getManualTotalWeight() - 100) < 0.01 ? 'text-emerald-400' : 'text-yellow-400'
                                }`}>
                                    {getManualTotalWeight().toFixed(2)}%
                                </span>
                            </div>
                            {Math.abs(getManualTotalWeight() - 100) > 0.01 && (
                                <div className="text-xs text-yellow-400 mt-1">
                                    Weights will be normalized to 100% on save
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Slider Mode */
                    <div className="space-y-3">
                        {weights.map((w, index) => (
                            <WeightSliderRow
                                key={`${w.ticker}-${index}`}
                                ticker={w.ticker}
                                weight={w.weight}
                                positionValue={0} // Not needed for this view
                                onWeightChange={(newWeight) => handleWeightChange(w.ticker, newWeight)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-slate-900/95 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-400">Total Weight</span>
                    <span className={`text-sm font-semibold ${weightError ? 'text-yellow-400' : 'text-white'}`}>
                        {isManualMode ? getManualTotalWeight().toFixed(2) : totalWeight.toFixed(2)}%
                    </span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchWeights}
                        className="flex-1 px-3 py-2 text-sm font-medium text-gray-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Reload
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
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

