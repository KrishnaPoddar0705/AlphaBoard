import React from 'react';
import { ResponsiveBar } from '@nivo/bar';

interface MonthlyPnLChartProps {
    data: Array<{ month: string; return: number }>;
    height?: number;
}

export const MonthlyPnLChart: React.FC<MonthlyPnLChartProps> = ({ data, height = 200 }) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                No data available
            </div>
        );
    }

    const chartData = data.map(item => ({
        month: item.month,
        return: item.return
    }));

    // Find max absolute value for symmetric scale
    const maxAbsValue = Math.max(
        ...chartData.map(d => Math.abs(d.return)),
        1
    );

    return (
        <div style={{ height, width: '100%' }}>
            <ResponsiveBar
                data={chartData}
                keys={['return']}
                indexBy="month"
                margin={{ top: 10, right: 10, bottom: 60, left: 60 }}
                padding={0.3}
                valueScale={{ type: 'linear', min: -maxAbsValue * 1.1, max: maxAbsValue * 1.1 }}
                indexScale={{ type: 'band', round: true }}
                colors={(bar) => {
                    return bar.data.return >= 0 ? '#10b981' : '#ef4444';
                }}
                borderColor={{ from: 'color', modifiers: [['darker', 1.2]] }}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                    tickSize: 0,
                    tickPadding: 8,
                    tickRotation: -45,
                    legend: 'Month',
                    legendPosition: 'middle',
                    legendOffset: 50,
                    format: (value) => {
                        // Truncate long labels to prevent overflow
                        const str = String(value);
                        return str.length > 10 ? str.substring(0, 10) + '...' : str;
                    }
                }}
                axisLeft={{
                    tickSize: 0,
                    tickPadding: 8,
                    tickRotation: 0,
                    legend: 'Return %',
                    legendPosition: 'middle',
                    legendOffset: -50,
                    format: (value) => {
                        if (Math.abs(value) < 0.01) return '0%';
                        return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
                    }
                }}
                labelSkipWidth={12}
                labelSkipHeight={12}
                enableLabel={false}
                labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                tooltip={({ value, indexValue }) => {
                    const formattedValue = typeof value === 'number' ? value.toFixed(2) : '0.00';
                    return (
                        <div style={{
                            padding: '8px 12px',
                            background: 'rgba(15, 23, 42, 0.95)',
                            color: 'white',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            fontSize: '12px',
                            fontWeight: '500'
                        }}>
                            <div style={{ marginBottom: '4px' }}>
                                <strong>{indexValue}</strong>
                            </div>
                            <div style={{ color: value >= 0 ? '#10b981' : '#ef4444' }}>
                                Return: {value >= 0 ? '+' : ''}{formattedValue}%
                            </div>
                        </div>
                    );
                }}
                animate={true}
                motionConfig="gentle"
                theme={{
                    axis: {
                        domain: {
                            line: {
                                stroke: 'rgba(255, 255, 255, 0.1)',
                                strokeWidth: 1
                            }
                        },
                        ticks: {
                            line: {
                                stroke: 'rgba(255, 255, 255, 0.2)',
                                strokeWidth: 1
                            },
                            text: {
                                fill: 'rgba(255, 255, 255, 0.6)',
                                fontSize: 11
                            }
                        }
                    },
                    grid: {
                        line: {
                            stroke: 'rgba(255, 255, 255, 0.05)',
                            strokeWidth: 1
                        }
                    }
                }}
            />
        </div>
    );
};

