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
import { Card, CardContent } from '../ui/card-new';
import { getPriceTargets, createPriceTarget } from '../../lib/api';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../../lib/supabase';
import { AddPriceTargetModal } from './AddPriceTargetModal';
import { getCurrencySymbol } from '../../lib/utils';

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
    const { user } = useUser();
    const [priceTargets, setPriceTargets] = useState<PriceTarget[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
    
    useEffect(() => {
        const getSupabaseUserId = async () => {
            if (userId) {
                setSupabaseUserId(userId);
            } else if (user) {
                const { data: mapping } = await supabase
                    .from('clerk_user_mapping')
                    .select('supabase_user_id')
                    .eq('clerk_user_id', user.id)
                    .maybeSingle();
                if (mapping) {
                    setSupabaseUserId(mapping.supabase_user_id);
                }
            }
        };
        getSupabaseUserId();
    }, [user, userId]);
    
    const effectiveUserId = userId || supabaseUserId;

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
            <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
                <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-[#1C1B17]" />
                        <h3 className="text-xs font-mono font-semibold text-[#1C1B17] uppercase tracking-wider">
                            Price Target Timeline
                        </h3>
                    </div>
                    {!userId && ( // Only show add button for current user
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium text-[#1C1B17] bg-[#FBF7ED] hover:bg-[#F7F2E6] border border-[#D7D0C2] rounded-lg transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add Target
                        </button>
                    )}
                    </div>

                    {loading ? (
                    <div className="text-center py-6 text-[#6F6A60] font-mono text-sm">Loading price targets...</div>
                ) : priceTargets.length === 0 ? (
                    <div className="text-center py-6 text-[#6F6A60] font-mono text-sm italic">
                        No price targets set yet.
                        {!userId && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="ml-2 text-[#2F8F5B] hover:text-[#1C1B17] underline"
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
                                        index < priceTargets.length - 1 ? 'border-l-2 border-[#D7D0C2]' : ''
                                    }`}
                                >
                                    {/* Timeline dot */}
                                    <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-[#1C1B17] border-2 border-[#F7F2E6] -translate-x-[7px]" />
                                    
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-mono font-bold text-[#1C1B17] tabular-nums">
                                                    {getCurrencySymbol(ticker)}{target.target_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                                {isLatest && timeRemaining && (
                                                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                                                        timeRemaining === 'Overdue' 
                                                            ? 'bg-[#B23B2A]/20 text-[#B23B2A]' 
                                                            : 'bg-[#2F8F5B]/20 text-[#2F8F5B]'
                                                    }`}>
                                                        {timeRemaining}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 text-xs font-mono text-[#6F6A60]">
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
                </CardContent>
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

