/**
 * FinancialsSection Component
 * 
 * Displays financial data in elegant tables including:
 * - Income Statement
 * - Balance Sheet  
 * - Cash Flow Statement
 * 
 * Features:
 * - Responsive tables with horizontal scroll
 * - Color-coded positive/negative values
 * - Loading states
 * 
 * @component
 */

import { TrendingUp, TrendingDown, FileSpreadsheet, Wallet, Banknote } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';

interface FinancialsSectionProps {
    incomeStatement: any[];
    balanceSheet: any[];
    cashFlow: any[];
    isLoading?: boolean;
}

export function FinancialsSection({
    incomeStatement,
    balanceSheet,
    cashFlow,
    isLoading = false,
}: FinancialsSectionProps) {
    if (isLoading) {
        return <FinancialsSkeleton />;
    }

    return (
        <div className="space-y-6">
            {/* Income Statement */}
            <Card variant="default">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <CardTitle size="lg">Income Statement (Annual)</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    {incomeStatement && incomeStatement.length > 0 ? (
                        <div className="overflow-x-auto -mx-4 px-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="py-3 px-4 text-left text-slate-400 font-medium">Year</th>
                                        <th className="py-3 px-4 text-right text-slate-400 font-medium">Revenue</th>
                                        <th className="py-3 px-4 text-right text-slate-400 font-medium">Net Profit</th>
                                        <th className="py-3 px-4 text-right text-slate-400 font-medium">Margin</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {incomeStatement.map((item: any, i: number) => {
                                        const margin = item.netProfit / item.revenue * 100;
                                        return (
                                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                                <td className="py-3 px-4 text-white font-medium">{item.year}</td>
                                                <td className="py-3 px-4 text-right text-white font-mono">
                                                    ₹{(item.revenue / 10000000).toFixed(0)} Cr
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <span className={`font-mono ${item.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        ₹{(item.netProfit / 10000000).toFixed(0)} Cr
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <span className={`inline-flex items-center gap-1 ${margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {margin >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                        {isNaN(margin) ? 'N/A' : `${margin.toFixed(1)}%`}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState message="No income statement data available" />
                    )}
                </CardContent>
            </Card>

            {/* Balance Sheet */}
            <Card variant="default">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                            <Wallet className="w-5 h-5" />
                        </div>
                        <CardTitle size="lg">Balance Sheet</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    {balanceSheet && balanceSheet.length > 0 ? (
                        <div className="overflow-x-auto -mx-4 px-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="py-3 px-4 text-left text-slate-400 font-medium">Year</th>
                                        <th className="py-3 px-4 text-right text-slate-400 font-medium">Total Assets</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {balanceSheet.map((b: any, i: number) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            <td className="py-3 px-4 text-white font-medium">{b.year}</td>
                                            <td className="py-3 px-4 text-right text-white font-mono">
                                                ₹{(b.assets / 10000000).toFixed(0)} Cr
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState message="No balance sheet data available" />
                    )}
                </CardContent>
            </Card>

            {/* Cash Flow */}
            <Card variant="default">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                            <Banknote className="w-5 h-5" />
                        </div>
                        <CardTitle size="lg">Cash Flow Statement</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    {cashFlow && cashFlow.length > 0 ? (
                        <div className="overflow-x-auto -mx-4 px-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="py-3 px-4 text-left text-slate-400 font-medium">Year</th>
                                        <th className="py-3 px-4 text-right text-slate-400 font-medium">Operating Cash Flow</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {cashFlow.map((c: any, i: number) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            <td className="py-3 px-4 text-white font-medium">{c.year}</td>
                                            <td className="py-3 px-4 text-right">
                                                <span className={`font-mono ${c.operating >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    ₹{(c.operating / 10000000).toFixed(0)} Cr
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState message="No cash flow data available" />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/**
 * Empty State Component
 */
function EmptyState({ message }: { message: string }) {
    return (
        <div className="py-8 text-center">
            <p className="text-slate-500 italic">{message}</p>
        </div>
    );
}

/**
 * Loading Skeleton for Financials
 */
function FinancialsSkeleton() {
    return (
        <div className="space-y-6">
            {[1, 2, 3].map((i) => (
                <Card key={i} variant="default">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <Skeleton variant="circular" width={40} height={40} />
                            <Skeleton width={200} height={24} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map((j) => (
                                <Skeleton key={j} height={40} />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export default FinancialsSection;

