/**
 * IrrTargetTimeline Component
 *
 * Displays a timeline of IRR targets for a user+ticker combination. Each entry is
 * an expected annualised IRR paired with the horizon bucket it applies over.
 *
 * Rows created before the IRR migration carry an absolute target_price instead and
 * are rendered as legacy entries — the underlying table is append-only, so that
 * history is never rewritten.
 *
 * @component
 */

import { useState, useEffect } from 'react';
import { Target, Calendar, Clock, Plus } from 'lucide-react';
import { Card, CardContent } from '../ui/card-new';
import { getIrrTargets, createIrrTarget, type IrrTargetRecord } from '../../lib/api';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../../lib/supabase';
import { AddIrrTargetModal } from './AddIrrTargetModal';
import { getCurrencySymbol } from '../../lib/utils';
import { formatIrr, timeframeFromMonths, type IrrTimeframe } from '../../lib/irrTargets';

interface IrrTargetTimelineProps {
    ticker: string;
    userId?: string; // Optional - if not provided, uses current user
}

/**
 * A horizon bucket is a range, not a date. The deadline that matters for
 * "is this still live?" is the far end of the bucket, measured from when the
 * analyst published the target.
 */
function bucketDeadline(createdAt: string, endMonths: number): Date {
    const deadline = new Date(createdAt);
    deadline.setMonth(deadline.getMonth() + endMonths);
    return deadline;
}

export function IrrTargetTimeline({ ticker, userId }: IrrTargetTimelineProps) {
    const { user } = useUser();
    const [irrTargets, setIrrTargets] = useState<IrrTargetRecord[]>([]);
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
            fetchIrrTargets();
        }
    }, [effectiveUserId, ticker]);

    const fetchIrrTargets = async () => {
        if (!effectiveUserId) return;

        try {
            setLoading(true);
            const targets = await getIrrTargets(ticker, effectiveUserId);
            setIrrTargets(targets || []);
        } catch (error) {
        } finally {
            setLoading(false);
        }
    };

    const handleAddTarget = async (targetIrr: number, timeframe: IrrTimeframe) => {
        if (!effectiveUserId) return;

        try {
            await createIrrTarget(ticker, targetIrr, timeframe, effectiveUserId);
            await fetchIrrTargets();
            setShowAddModal(false);
        } catch (error) {
            throw error;
        }
    };

    const calculateTimeRemaining = (deadline: Date | null): string | null => {
        if (!deadline) return null;

        const now = new Date();
        const diffMs = deadline.getTime() - now.getTime();
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

    const formatDate = (dateString: string | Date): string => {
        const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
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
                            IRR Target Timeline
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
                    <div className="text-center py-6 text-[#6F6A60] font-mono text-sm">Loading IRR targets...</div>
                ) : irrTargets.length === 0 ? (
                    <div className="text-center py-6 text-[#6F6A60] font-mono text-sm italic">
                        No IRR targets set yet.
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
                        {irrTargets.map((target, index) => {
                            const timeframe = timeframeFromMonths(
                                target.timeframe_start_months,
                                target.timeframe_end_months
                            );
                            const isLegacyPriceTarget = target.target_irr === null || target.target_irr === undefined;

                            // IRR rows derive their deadline from the bucket; legacy rows
                            // carry an explicit target_date.
                            const deadline = timeframe
                                ? bucketDeadline(target.created_at, timeframe.endMonths)
                                : target.target_date
                                    ? new Date(target.target_date)
                                    : null;
                            const timeRemaining = calculateTimeRemaining(deadline);
                            const isLatest = index === irrTargets.length - 1;

                            return (
                                <div
                                    key={target.id}
                                    className={`relative pl-6 pb-4 ${
                                        index < irrTargets.length - 1 ? 'border-l-2 border-[#D7D0C2]' : ''
                                    }`}
                                >
                                    {/* Timeline dot */}
                                    <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-[#1C1B17] border-2 border-[#F7F2E6] -translate-x-[7px]" />

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {isLegacyPriceTarget ? (
                                                    <>
                                                        <span className="text-lg font-mono font-bold text-[#1C1B17] tabular-nums">
                                                            {getCurrencySymbol(ticker)}{(target.target_price ?? 0).toLocaleString(ticker.includes('.NS') || ticker.includes('.BO') ? 'en-IN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                        <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#D7D0C2] text-[#6F6A60]">
                                                            Price target
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="text-lg font-mono font-bold text-[#1C1B17] tabular-nums">
                                                            {formatIrr(target.target_irr)} IRR
                                                        </span>
                                                        {timeframe && (
                                                            <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#1C1B17]/10 text-[#1C1B17]">
                                                                {timeframe.label}
                                                            </span>
                                                        )}
                                                    </>
                                                )}
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

                                        <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[#6F6A60]">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span>Set on {formatDate(target.created_at)}</span>
                                            </div>
                                            {deadline && (
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span>
                                                        {isLegacyPriceTarget ? 'Target' : 'By'}: {formatDate(deadline)}
                                                    </span>
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
                <AddIrrTargetModal
                    ticker={ticker}
                    onClose={() => setShowAddModal(false)}
                    onSubmit={handleAddTarget}
                />
            )}
        </div>
    );
}
