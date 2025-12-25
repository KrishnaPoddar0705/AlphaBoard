/**
 * SummarySection Component
 * 
 * Displays key metrics and quarterly trends including:
 * - Market Cap, P/E, ROCE, ROE cards
 * - Quarterly financial trends table
 * - Visual indicators for positive/negative values
 * 
 * @component
 */

import React from 'react';
import { TrendingUp, TrendingDown, PieChart, BarChart3, Target, Percent } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { InvestmentThesisCard } from './InvestmentThesisCard';

interface SummarySectionProps {
    ticker: string;
    financials: {
        marketCap?: number;
        pe?: number;
        roce?: number;
        roe?: number;
    };
    quarterly: any[];
    isLoading?: boolean;
    analystNotes?: string;
}

export function SummarySection({
    ticker,
    financials,
    quarterly,
    isLoading = false,
    analystNotes,
}: SummarySectionProps) {
    if (isLoading) {
        return <SummarySkeleton />;
    }

    return (
        <div className="space-y-6">
            {/* AI Investment Thesis Card */}
            <InvestmentThesisCard ticker={ticker} analystNotes={analystNotes} />
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    label="Market Cap"
                    value={financials.marketCap ? `₹${(financials.marketCap / 10000000).toFixed(0)} Cr` : 'N/A'}
                    icon={<BarChart3 className="w-5 h-5" />}
                    color="indigo"
                />
                <MetricCard
                    label="Stock P/E"
                    value={financials.pe?.toFixed(2) || 'N/A'}
                    icon={<Target className="w-5 h-5" />}
                    color="blue"
                />
                <MetricCard
                    label="ROCE"
                    value={financials.roce ? `${(financials.roce * 100).toFixed(1)}%` : 'N/A'}
                    icon={<Percent className="w-5 h-5" />}
                    color="emerald"
                    trend={financials.roce && financials.roce > 0.15 ? 'up' : undefined}
                />
                <MetricCard
                    label="ROE"
                    value={financials.roe ? `${(financials.roe * 100).toFixed(1)}%` : 'N/A'}
                    icon={<Percent className="w-5 h-5" />}
                    color="purple"
                    trend={financials.roe && financials.roe > 0.15 ? 'up' : undefined}
                />
            </div>

            {/* Quarterly Trend */}
            <Card variant="default">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                            <PieChart className="w-5 h-5" />
                        </div>
                        <CardTitle size="lg">Quarterly Trend</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    {quarterly && quarterly.length > 0 ? (
                        <div className="overflow-x-auto -mx-4 px-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border-color)]">
                                        <th className="py-3 px-4 text-left text-[var(--text-secondary)] font-medium">Period</th>
                                        <th className="py-3 px-4 text-right text-[var(--text-secondary)] font-medium">Revenue</th>
                                        <th className="py-3 px-4 text-right text-[var(--text-secondary)] font-medium">Profit</th>
                                        <th className="py-3 px-4 text-right text-[var(--text-secondary)] font-medium">Growth</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    {quarterly.map((q: any, i: number) => {
                                        // Calculate QoQ growth if we have previous quarter
                                        const prevQuarter = quarterly[i + 1];
                                        const growth = prevQuarter 
                                            ? ((q.profit - prevQuarter.profit) / Math.abs(prevQuarter.profit)) * 100
                                            : null;
                                        
                                        return (
                                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                                <td className="py-3 px-4 text-[var(--text-primary)] font-medium">{q.year}</td>
                                                <td className="py-3 px-4 text-right text-[var(--text-primary)] font-mono">
                                                    ₹{(q.revenue / 10000000).toFixed(0)} Cr
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <span className={`font-mono ${q.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        ₹{(q.profit / 10000000).toFixed(0)} Cr
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    {growth !== null ? (
                                                        <span className={`inline-flex items-center gap-1 text-sm ${growth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                            {Math.abs(growth).toFixed(1)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-[var(--text-tertiary)]">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-8 text-center">
                            <p className="text-[var(--text-tertiary)] italic">No quarterly data available</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * Individual Metric Card
 */
interface MetricCardProps {
    label: string;
    value: string;
    icon: React.ReactNode;
    color: 'indigo' | 'blue' | 'emerald' | 'purple' | 'amber';
    trend?: 'up' | 'down';
}

const colorClasses = {
    indigo: 'bg-indigo-500/10 text-indigo-400',
    blue: 'bg-blue-500/10 text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    purple: 'bg-purple-500/10 text-purple-400',
    amber: 'bg-amber-500/10 text-amber-400',
};

function MetricCard({ label, value, icon, color, trend }: MetricCardProps) {
    return (
        <Card variant="glass" hover className="relative overflow-hidden">
            {/* Background Gradient */}
            <div className={`absolute inset-0 opacity-5 ${colorClasses[color].replace('/10', '/20')}`} />
            
            <div className="relative">
                <div className="flex items-start justify-between mb-3">
                    <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                        {icon}
                    </div>
                    {trend && (
                        <span className={trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}>
                            {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        </span>
                    )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-1">{label}</p>
                <p className="text-xl font-bold text-[var(--text-primary)] font-mono truncate">{value}</p>
            </div>
        </Card>
    );
}

/**
 * Loading Skeleton
 */
function SummarySkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} variant="glass">
                        <div className="space-y-3">
                            <Skeleton variant="circular" width={40} height={40} />
                            <Skeleton width={60} height={12} />
                            <Skeleton width={80} height={24} />
                        </div>
                    </Card>
                ))}
            </div>
            <Card variant="default">
                <CardHeader>
                    <Skeleton width={180} height={24} />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} height={40} />
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default SummarySection;

