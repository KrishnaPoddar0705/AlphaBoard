/**
 * ChartsSection Component
 * 
 * Displays technical and fundamental charts with:
 * - Clean toolbar with chart controls
 * - Dark-neutral chart background
 * - Responsive chart container
 * - Date range selector integration
 * 
 * @component
 */

import { useState } from 'react';
import { Calendar, Settings2, Download, Maximize2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { ChartSubTabs } from './StockTabs';
import ChartRenderer from '../charts/ChartRenderer';
import { ChartSkeleton } from '../ui/Skeleton';
import chartConfig from '../../data/charts.json';

interface ChartsSectionProps {
    stockTicker: string;
    externalData: any;
    isLoading?: boolean;
    startDate?: string;
    endDate?: string;
    onDateRangeChange?: (start: string, end: string) => void;
}

export function ChartsSection({
    stockTicker,
    externalData,
    isLoading = false,
    startDate,
    endDate,
    onDateRangeChange,
}: ChartsSectionProps) {
    const [activeCategory, setActiveCategory] = useState<'technical' | 'fundamental'>('technical');
    const [activeTechnicalType, setActiveTechnicalType] = useState<'line' | 'candlestick'>('line');
    const [activeChartId, setActiveChartId] = useState(1);

    // Get fundamental charts from config
    const fundamentalCharts = chartConfig.charts.filter(c => c.library.startsWith('nivo'));

    if (isLoading) {
        return <ChartSkeleton />;
    }

    return (
        <div className="space-y-4">
            {/* Chart Controls Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <ChartSubTabs
                    activeCategory={activeCategory}
                    activeTechnicalType={activeTechnicalType}
                    onCategoryChange={setActiveCategory}
                    onTechnicalTypeChange={setActiveTechnicalType}
                />

                {/* Right-side Toolbar */}
                <div className="flex items-center gap-2">
                    {/* Fundamental Chart Selector */}
                    {activeCategory === 'fundamental' && (
                        <select
                            value={activeChartId}
                            onChange={(e) => setActiveChartId(Number(e.target.value))}
                            className="px-3 py-2 text-sm bg-slate-800/50 border border-white/10 rounded-lg
                                     text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        >
                            {fundamentalCharts.map((c) => (
                                <option key={c.id} value={c.id} className="bg-slate-800">
                                    {c.chartType}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Toolbar Actions */}
                    <div className="flex items-center gap-1 p-1 bg-slate-800/50 rounded-lg border border-white/5">
                        <button
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title="Chart Settings"
                        >
                            <Settings2 className="w-4 h-4" />
                        </button>
                        <button
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title="Download Chart"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        <button
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title="Fullscreen"
                        >
                            <Maximize2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Date Range Selector */}
            {onDateRangeChange && (
                <Card variant="outlined" padding="sm">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-400">Date Range:</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => onDateRangeChange(e.target.value, endDate || '')}
                                className="px-3 py-1.5 text-sm bg-slate-800/50 border border-white/10 rounded-lg
                                         text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                            <span className="text-slate-500">to</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => onDateRangeChange(startDate || '', e.target.value)}
                                className="px-3 py-1.5 text-sm bg-slate-800/50 border border-white/10 rounded-lg
                                         text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>
                    </div>
                </Card>
            )}

            {/* Chart Container */}
            <Card variant="glass" padding="none" className="overflow-hidden">
                <div className="min-h-[500px]">
                    {activeCategory === 'technical' ? (
                        <ChartRenderer
                            chartId={1}
                            stockTicker={stockTicker}
                            height={500}
                            technicalType={activeTechnicalType}
                            externalData={externalData}
                            customDateRange={startDate && endDate ? { start: startDate, end: endDate } : undefined}
                        />
                    ) : (
                        <div className="p-4">
                            <ChartRenderer
                                chartId={activeChartId}
                                stockTicker={stockTicker}
                                height={450}
                                externalData={externalData}
                            />
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}

export default ChartsSection;

