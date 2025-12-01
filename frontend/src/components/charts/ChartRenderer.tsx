import React, { useMemo, useState } from 'react';
import chartConfig from '../../data/charts.json';
import { generateChartData } from '../../lib/chartDataHelper';
import { NivoChart } from './NivoCharts';
import { HighchartsChart } from './HighchartsWrapper';
import StockChart from './StockChart';

interface ChartRendererProps {
    chartId: number;
    stockTicker: string;
    height?: number | string;
    technicalType?: 'line' | 'candlestick';
    externalData?: any;
    customDateRange?: { start: string; end: string };
}

const ChartRenderer: React.FC<ChartRendererProps> = ({ chartId, stockTicker, height = 400, technicalType = 'line', externalData, customDateRange }) => {
    const [error, setError] = useState<string | null>(null);

    const chartDef = useMemo(() => {
        return chartConfig.charts.find(c => c.id === chartId);
    }, [chartId]);

    const data = useMemo(() => {
        if (!chartDef) return [];
        // Pass externalData (real data) to the helper
        return generateChartData(chartId, chartDef.chartType, chartDef.dataShown, externalData);
    }, [chartId, chartDef, externalData]);

    if (!chartDef) return <div className="text-red-500">Chart definition not found</div>;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4 bg-red-900/20 border border-red-900 rounded">
                <p className="text-red-400 mb-2">Failed to render chart: {chartDef.chartType}</p>
                <p className="text-xs text-red-300/50">{error}</p>
                <button onClick={() => setError(null)} className="mt-2 text-xs text-blue-400 hover:underline">Retry</button>
            </div>
        );
    }

    const renderChart = () => {
        try {
            const chartHeight = typeof height === 'number' ? height : 550;
            
            // Force fallback to Highcharts for 'react-stockcharts' types due to React 19 incompatibility
            if (chartDef.library === 'react-stockcharts' || chartDef.library === 'highcharts') {
                // Ensure data is valid before rendering chart
                if (!data || data.length === 0) return <div className="flex items-center justify-center h-[400px] text-gray-500">No data available</div>;

                return (
                    <div style={{ minHeight: chartHeight, width: '100%' }}>
                        <HighchartsChart
                            type={chartDef.chartType}
                            data={data}
                            options={chartDef.recommendedOptions}
                            technicalType={technicalType}
                            customDateRange={customDateRange}
                        />
                    </div>
                );
            }

            if (chartDef.library.startsWith('nivo')) {
                return (
                    <div style={{ height: chartHeight, width: '100%' }}>
                        <NivoChart type={chartDef.chartType} data={data} options={chartDef.recommendedOptions} />
                    </div>
                );
            }

            // Default to Highcharts for anything else
            return (
                <div style={{ minHeight: chartHeight, width: '100%' }}>
                    <HighchartsChart type={chartDef.chartType} data={data} options={chartDef.recommendedOptions} />
                </div>
            );
        } catch (err: any) {
            console.error("Chart render error", err);
            setError(err.message);
            return null;
        }
    };

    return (
        <div className="w-full flex flex-col bg-[#0f172a] rounded-lg border border-white/5">
            {/* Chart Header - Fixed */}
            <div className="p-3 sm:p-4 border-b border-white/10 flex justify-between items-center bg-[#1e293b] flex-shrink-0">
                <div>
                    <h3 className="text-white font-bold flex items-center gap-2 text-sm sm:text-base">
                        {chartDef.chartType}
                        <span className="text-[10px] sm:text-xs font-normal text-gray-400 bg-white/10 px-1.5 sm:px-2 py-0.5 rounded">
                            {chartDef.library}
                        </span>
                    </h3>
                    <p className="text-[10px] sm:text-xs text-gray-400 mt-1">{chartDef.uxNotes}</p>
                </div>
            </div>
            {/* Chart Content - Scrollable */}
            <div className="bg-[#0f172a] p-2 sm:p-4 overflow-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {renderChart()}
            </div>
        </div>
    );
};

export default ChartRenderer;
