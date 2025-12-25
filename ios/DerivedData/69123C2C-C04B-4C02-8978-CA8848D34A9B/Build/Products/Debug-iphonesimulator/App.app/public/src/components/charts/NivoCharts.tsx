import React from 'react';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { ResponsiveRadar } from '@nivo/radar';
import { ResponsiveTreeMap } from '@nivo/treemap';
import { ResponsiveSunburst } from '@nivo/sunburst';
import { ResponsiveSankey } from '@nivo/sankey';
import { ResponsiveCalendar } from '@nivo/calendar';
import { ResponsiveSwarmPlot } from '@nivo/swarmplot';
import { ResponsiveHeatMap } from '@nivo/heatmap';
import { ResponsiveBump, ResponsiveAreaBump } from '@nivo/bump';
import { ResponsiveStream } from '@nivo/stream';
// Note: Violin omitted as it's often custom or not in core Nivo stable

interface NivoChartProps {
    type: string;
    data: any;
    options?: any;
}

export const NivoChart: React.FC<NivoChartProps> = ({ type, data, options }) => {
    const theme = {
        background: "transparent",
        textColor: "#94a3b8",
        fontSize: 11,
        axis: {
            domain: {
                line: {
                    stroke: "#334155",
                    strokeWidth: 1
                }
            },
            legend: {
                text: {
                    fontSize: 12,
                    fill: "#94a3b8"
                }
            },
            ticks: {
                line: {
                    stroke: "#334155",
                    strokeWidth: 1
                },
                text: {
                    fontSize: 11,
                    fill: "#94a3b8"
                }
            }
        },
        grid: {
            line: {
                stroke: "#334155",
                strokeWidth: 1
            }
        },
        tooltip: {
            container: {
                background: "#1e293b",
                color: "#f1f5f9",
                fontSize: 12,
                borderRadius: 4,
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
            }
        }
    };

    // Common props
    const commonProps = {
        theme,
        animate: true,
        margin: { top: 20, right: 20, bottom: 40, left: 40 },
        ...options
    };

    if (type.includes('Line') || type.includes('Price Trend') || type.includes('EPS') || type.includes('Target') || type.includes('Ratio') || type.includes('Short Interest') || type.includes('Borrow Fee') || type.includes('Institutional') || type.includes('Cash Flow Trend') || type.includes('Timeline')) {
        // Nivo Line expects [{ id: 'series', data: [{x, y}, ...] }]
        let chartData = data;
        if (Array.isArray(data) && !data[0]?.id && data[0]?.date) {
            let yKey = 'close';
            if (type.includes('EPS')) yKey = 'eps';
            if (type.includes('Target')) yKey = 'analyst_target_price'; // Need logic for 2 lines
            if (type.includes('Ratio')) yKey = 'pe_ratio';
            if (type.includes('Short')) yKey = 'short_interest_percent';
            if (type.includes('Borrow')) yKey = 'borrow_fee_rate';
            if (type.includes('Institutional')) yKey = 'institutional_ownership';
            if (type.includes('Cash Flow')) yKey = 'free_cash_flow';
            if (type.includes('Comparison')) yKey = 'price_change_percent';
            if (type.includes('Revenue Trend')) yKey = 'revenue_quarterly';
            if (type.includes('Expense')) {
                // Multi line for expense
                return <ResponsiveLine
                    data={[
                        { id: 'COGS', data: data.map((d: any) => ({ x: d.dateStr, y: d.cogs })) },
                        { id: 'R&D', data: data.map((d: any) => ({ x: d.dateStr, y: d.rnd })) },
                        { id: 'SG&A', data: data.map((d: any) => ({ x: d.dateStr, y: d.sga })) }
                    ]}
                    {...commonProps}
                    enableGridX={false} enablePoints={false} useMesh={true} xScale={{ type: 'point' }} yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
                />;
            }
            if (type.includes('Target')) {
                return <ResponsiveLine
                    data={[
                        { id: 'Price', data: data.map((d: any) => ({ x: d.dateStr, y: d.close })) },
                        { id: 'Target', data: data.map((d: any) => ({ x: d.dateStr, y: d.close * 1.2 })) } // Mock target
                    ]}
                    {...commonProps}
                    enableGridX={false} enablePoints={false} useMesh={true} xScale={{ type: 'point' }} yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
                />;
            }

            chartData = [{
                id: "Value",
                data: data.map((d: any) => ({ x: d.dateStr || d.date, y: d[yKey] || d.close }))
            }];
        }

        return <ResponsiveLine data={chartData} {...commonProps}
            enableGridX={false}
            enablePoints={false}
            useMesh={true}
            xScale={{ type: 'point' }}
            yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        />;
    }

    if (type.includes('Bar') || type.includes('Margin') || type.includes('Debt') || type.includes('Earnings Surprise') || type.includes('Dividend')) {
        let keys = ['revenue', 'profit'];
        let indexBy = 'id';
        if (type.includes('Margin')) keys = ['gross_margin', 'operating_margin', 'net_margin'];
        if (type.includes('Debt')) keys = ['debt', 'equity'];
        if (type.includes('Earnings Surprise')) keys = ['actual_eps', 'estimated_eps'];
        if (type.includes('Dividend')) keys = ['dividend'];

        return <ResponsiveBar data={data} keys={keys} indexBy={indexBy} groupMode={type.includes('Margin') || type.includes('Debt') || type.includes('Surprise') ? "grouped" : "stacked"} {...commonProps} />;
    }

    if (type.includes('Pie') || type.includes('Allocation') || type.includes('R&D')) {
        return <ResponsivePie data={data} {...commonProps} activeOuterRadiusOffset={8} />;
    }

    if (type.includes('Radar')) {
        let keys = ['Stock', 'Sector', 'Market'];
        if (type.includes('Risk')) keys = ['Stock', 'Sector']; // Risk radar might not have Market
        return <ResponsiveRadar data={data} keys={keys} indexBy="metric" {...commonProps} />;
    }

    if (type.includes('Treemap')) {
        return <ResponsiveTreeMap data={data} identity="name" value="loc" {...commonProps} labelSkipSize={12} />;
    }

    if (type.includes('Sunburst') || type.includes('Segment')) {
        return <ResponsiveSunburst data={data} identity="name" value="loc" {...commonProps} />;
    }

    if (type.includes('Sankey')) {
        return <ResponsiveSankey data={data} {...commonProps} />;
    }

    if (type.includes('Area Bump')) {
        // Data shape for bump: [{ id: 'Series 1', data: [{x: 2000, y: 1}, ...] }]
        // Reuse line transform if needed
        let chartData = data;
        if (Array.isArray(data) && !data[0]?.id && data[0]?.date) {
            chartData = [{
                id: "Rank",
                data: data.map((d: any) => ({ x: d.dateStr, y: Math.floor(d.close % 10) + 1 }))
            }];
        }
        return <ResponsiveAreaBump data={chartData} {...commonProps} />;
    }

    if (type.includes('Bump')) {
        let chartData = data;
        if (Array.isArray(data) && !data[0]?.id && data[0]?.date) {
            chartData = [{
                id: "Rank",
                data: data.map((d: any) => ({ x: d.dateStr, y: Math.floor(d.close % 10) + 1 }))
            }];
        }
        return <ResponsiveBump data={chartData} {...commonProps} />;
    }

    if (type.includes('Calendar')) {
        // Calendar expects [{ value: 100, day: '2025-01-01' }]
        let chartData = data;
        if (Array.isArray(data) && data[0]?.dateStr) {
            chartData = data.map((d: any) => ({ day: d.dateStr, value: d.volume }));
        }
        const from = chartData[0]?.day || '2024-01-01';
        const to = chartData[chartData.length - 1]?.day || '2024-12-31';
        return <ResponsiveCalendar data={chartData} from={from} to={to} {...commonProps} />;
    }

    if (type.includes('Swarm')) {
        // Swarm expects [{ id: '1', group: 'A', value: 12 }]
        let chartData = data;
        if (Array.isArray(data) && data[0]?.dateStr) {
            chartData = data.map((d: any, i: number) => ({ id: `${i}`, group: 'Price', value: d.price_change_percent || d.close }));
        }
        return <ResponsiveSwarmPlot data={chartData} groups={['Price']} value="value" {...commonProps} />;
    }

    if (type.includes('Heatmap') || type.includes('Correlation')) {
        // Heatmap expects [{ id: 'Country', data: [{x, y}, ...] }]
        let chartData = data;
        if (!chartData || (Array.isArray(chartData) && chartData[0]?.date)) {
            // Fallback already handled in generator, but check structure
            // If array of time series, ignore or map?
            // Generator should provide correct shape for 'Correlation'
            chartData = [
                { id: "A", data: [{ x: "A", y: 1 }, { x: "B", y: 0.8 }, { x: "C", y: 0.3 }] },
                { id: "B", data: [{ x: "A", y: 0.8 }, { x: "B", y: 1 }, { x: "C", y: 0.5 }] },
                { id: "C", data: [{ x: "A", y: 0.3 }, { x: "B", y: 0.5 }, { x: "C", y: 1 }] },
            ];
        }
        return <ResponsiveHeatMap data={chartData} {...commonProps} />;
    }

    if (type.includes('Stream')) {
        // Stream expects [{ "Raoul": 100, "Josiane": 20 }, ...]
        let chartData = data;
        if (Array.isArray(data) && data[0]?.date) {
            chartData = data.map((d: any) => ({
                "Buys": Math.abs(d.open),
                "Sells": Math.abs(d.close * 0.8)
            }));
        }
        return <ResponsiveStream data={chartData} keys={['Buys', 'Sells']} {...commonProps} />;
    }

    if (type.includes('Global') || type.includes('Choropleth')) {
        // Requires GeoJSON features, often complex to setup without map file
        // We will just render a placeholder or if data is simple
        return <div className="flex items-center justify-center h-full text-gray-500">Geographic data visualization requires map files.</div>;
    }

    if (type.includes('Violin') || type.includes('Prediction')) {
        // Violin not standard in all Nivo versions or requires specific setup
        return <div className="flex items-center justify-center h-full text-gray-500">Analyst Prediction Distribution (Violin)</div>;
    }

    return <div className="text-red-400 p-4">Chart type {type} not implemented yet</div>;
};
