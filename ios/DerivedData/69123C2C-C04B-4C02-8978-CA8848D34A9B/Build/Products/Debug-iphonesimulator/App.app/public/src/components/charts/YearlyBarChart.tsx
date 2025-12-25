import React from 'react';
import { ResponsiveBar } from '@nivo/bar';

interface YearlyBarChartProps {
    data: Array<{ year: number; return_pct: number }>;
    height?: number;
}

export const YearlyBarChart: React.FC<YearlyBarChartProps> = ({ data, height = 400 }) => {
    const chartData = data.map(item => ({
        year: item.year.toString(),
        return: item.return_pct
    }));

    return (
        <div style={{ height, width: '100%' }}>
            <ResponsiveBar
                data={chartData}
                keys={['return']}
                indexBy="year"
                margin={{ top: 50, right: 50, bottom: 50, left: 60 }}
                padding={0.3}
                valueScale={{ type: 'linear' }}
                indexScale={{ type: 'band', round: true }}
                colors={(bar) => {
                    return bar.data.return >= 0 ? '#10b981' : '#ef4444';
                }}
                borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: 'Year',
                    legendPosition: 'middle',
                    legendOffset: 46
                }}
                axisLeft={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 0,
                    legend: 'Return (%)',
                    legendPosition: 'middle',
                    legendOffset: -50
                }}
                labelSkipWidth={12}
                labelSkipHeight={12}
                labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                tooltip={({ value, indexValue }) => (
                    <div style={{
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        borderRadius: '4px',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <strong>{indexValue}</strong>: {value?.toFixed(2)}%
                    </div>
                )}
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
                                stroke: 'rgba(255, 255, 255, 0.3)',
                                strokeWidth: 1
                            },
                            text: {
                                fill: 'rgba(255, 255, 255, 0.7)',
                                fontSize: 12
                            }
                        },
                        legend: {
                            text: {
                                fill: 'rgba(255, 255, 255, 0.7)',
                                fontSize: 14
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

