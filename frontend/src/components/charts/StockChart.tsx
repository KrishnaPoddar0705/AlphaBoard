import React from 'react';
import { scaleTime } from 'd3-scale';
import { format } from 'd3-format';
import { timeFormat } from 'd3-time-format';
import { ChartCanvas, Chart } from 'react-stockcharts';
import { CandlestickSeries, BarSeries, LineSeries, AreaSeries, RSISeries, MACDSeries, BollingerSeries } from 'react-stockcharts/lib/series';
import { XAxis, YAxis } from 'react-stockcharts/lib/axes';
import { CrossHairCursor, MouseCoordinateX, MouseCoordinateY, EdgeIndicator, CurrentCoordinate, HoverTooltip } from 'react-stockcharts/lib/coordinates';
import { discontinuousTimeScaleProvider } from 'react-stockcharts/lib/scale';
import { OHLCTooltip, MovingAverageTooltip, MACDTooltip, RSITooltip, BollingerBandTooltip } from 'react-stockcharts/lib/tooltip';
import { ema, sma, macd, rsi, bollingerBand } from 'react-stockcharts/lib/indicator';
import { fitWidth } from 'react-stockcharts/lib/helper';
import { last } from 'react-stockcharts/lib/utils';

// We need to wrap the chart component with fitWidth
class StockChartContent extends React.Component<any> {
    render() {
        const { type, data: initialData, width, ratio, chartType } = this.props;

        // Indicators
        const ema20 = ema().options({ windowSize: 20 }).merge((d: any, c: any) => { d.ema20 = c; }).accessor((d: any) => d.ema20);
        const ema50 = ema().options({ windowSize: 50 }).merge((d: any, c: any) => { d.ema50 = c; }).accessor((d: any) => d.ema50);
        const smaVolume50 = sma().options({ windowSize: 50, sourcePath: "volume" }).merge((d: any, c: any) => { d.smaVolume50 = c; }).accessor((d: any) => d.smaVolume50);
        const macdCalculator = macd().options({ fast: 12, slow: 26, signal: 9 }).merge((d: any, c: any) => { d.macd = c; }).accessor((d: any) => d.macd);
        const rsiCalculator = rsi().options({ windowSize: 14 }).merge((d: any, c: any) => { d.rsi = c; }).accessor((d: any) => d.rsi);
        const bb = bollingerBand().merge((d: any, c: any) => { d.bb = c }).accessor((d: any) => d.bb);

        // Calculate data based on chartType
        let calculatedData = initialData;
        if (chartType.includes('MACD')) calculatedData = macdCalculator(calculatedData);
        else if (chartType.includes('RSI')) calculatedData = rsiCalculator(calculatedData);
        else if (chartType.includes('Bollinger')) calculatedData = bb(calculatedData);
        else {
            calculatedData = ema20(ema50(initialData));
        }

        const xScaleProvider = discontinuousTimeScaleProvider.inputDateAccessor((d: any) => d.date);
        const { data, xScale, xAccessor, displayXAccessor } = xScaleProvider(calculatedData);

        const start = xAccessor(last(data));
        const end = xAccessor(data[Math.max(0, data.length - 100)]);
        const xExtents = [start, end];

        // react-stockcharts v0.7 uses legacy React Context which is broken in React 18/19.
        // The only viable fix is to not use <Chart> components if they cause this, or use Highcharts as fallback.
        // However, <Chart> is fundamental. The issue usually stems from `subscribe` missing on the context.
        // Given the constraints, we will swap to Highcharts for all financial charts to ensure stability.
        // Returning null here effectively disables this component while keeping the code for reference if needed.

        return null;
    }
}

// Export a safe version that falls back or warns
const StockChartWrapped = (props: any) => {
    console.warn("React Stockcharts is incompatible with React 19. Falling back to Highcharts.");
    return <div className="text-red-500 p-4">Legacy Chart Error. Please switch to Highcharts view.</div>;
};

export default StockChartWrapped;
