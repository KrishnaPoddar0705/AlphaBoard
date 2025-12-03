/**
 * PriceTargetTimeline Component
 * 
 * Displays a timeline of price targets for a user+ticker combination.
 * Shows target prices, creation dates, and optional time horizons.
 * 
 * @component
 */

import { useState, useEffect } from 'react';
import { Target, Calendar, Clock, Plus } from 'lucide-react';
import { Card } from '../ui/Card';
import { getPriceTargets, createPriceTarget } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { AddPriceTargetModal } from './AddPriceTargetModal';

interface PriceTarget {
    id: string;
    user_id: string;
    ticker: string;
    target_price: number;
    created_at: string;
    target_date: string | null;
}

interface PriceTargetTimelineProps {
    ticker: string;
    userId?: string; // Optional - if not provided, uses current user
}

export function PriceTargetTimeline({ ticker, userId }: PriceTargetTimelineProps) {
    const { session } = useAuth();
    const [priceTargets, setPriceTargets] = useState<PriceTarget[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    
    const effectiveUserId = userId || session?.user?.id;

    useEffect(() => {
        if (effectiveUserId && ticker) {
            fetchPriceTargets();
        }
    }, [effectiveUserId, ticker]);

    const fetchPriceTargets = async () => {
        if (!effectiveUserId) return;
        
        try {
            setLoading(true);
            const targets = await getPriceTargets(ticker, effectiveUserId);
            setPriceTargets(targets || []);
        } catch (error) {
            console.error('Error fetching price targets:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTarget = async (targetPrice: number, targetDate: string | null) => {
        if (!effectiveUserId) return;
        
        try {
            await createPriceTarget(ticker, targetPrice, targetDate, effectiveUserId);
            await fetchPriceTargets();
            setShowAddModal(false);
        } catch (error) {
            console.error('Error creating price target:', error);
            throw error;
        }
    };

    const calculateTimeRemaining = (targetDate: string | null): string | null => {
        if (!targetDate) return null;
        
        const target = new Date(targetDate);
        const now = new Date();
        const diffMs = target.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            return 'Overdue';
        } else if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return '1 day remaining';
        } else {
            return `${diffDays} days remaining`;
        }
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
    };

    if (!effectiveUserId) {
        return null;
    }

    return (
        <div className="mb-6">
            <Card variant="glass" padding="md">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                            Price Target Timeline
                        </h3>
                    </div>
                    {!userId && ( // Only show add button for current user
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add Target
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="text-center py-6 text-gray-400 text-sm">Loading price targets...</div>
                ) : priceTargets.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm italic">
                        No price targets set yet.
                        {!userId && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="ml-2 text-indigo-400 hover:text-indigo-300 underline"
                            >
                                Add one
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {priceTargets.map((target, index) => {
                            const timeRemaining = calculateTimeRemaining(target.target_date);
                            const isLatest = index === priceTargets.length - 1;
                            
                            return (
                                <div
                                    key={target.id}
                                    className={`relative pl-6 pb-4 ${
                                        index < priceTargets.length - 1 ? 'border-l-2 border-white/10' : ''
                                    }`}
                                >
                                    {/* Timeline dot */}
                                    <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-slate-900 -translate-x-[7px]" />
                                    
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-bold text-white">
                                                    ₹{target.target_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                                {isLatest && timeRemaining && (
                                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                                        timeRemaining === 'Overdue' 
                                                            ? 'bg-red-500/20 text-red-300' 
                                                            : 'bg-emerald-500/20 text-emerald-300'
                                                    }`}>
                                                        {timeRemaining}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 text-xs text-gray-400">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span>Set on {formatDate(target.created_at)}</span>
                                            </div>
                                            {target.target_date && (
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span>Target: {formatDate(target.target_date)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {showAddModal && (
                <AddPriceTargetModal
                    ticker={ticker}
                    onClose={() => setShowAddModal(false)}
                    onSubmit={handleAddTarget}
                />
            )}
        </div>
    );
}

