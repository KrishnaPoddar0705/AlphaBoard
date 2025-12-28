import React from 'react';
import { ResponsiveBar } from '@nivo/bar';

interface IdeasAddedChartProps {
    data: Array<{ period: string; recommendations: number; watchlist: number }>;
    height?: number;
    periodType?: 'day' | 'week' | 'month';
}

export const IdeasAddedChart: React.FC<IdeasAddedChartProps> = ({
    data,
    height = 200,
    periodType: _periodType = 'week'
}) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                No data available
            </div>
        );
    }

    const chartData = data.map(item => ({
        period: item.period,
        Recommendations: item.recommendations,
        Watchlist: item.watchlist
    }));

    const maxValue = Math.max(
        ...chartData.map(d => d.Recommendations + d.Watchlist),
        1
    );

    return (
        <div style={{ height, width: '100%' }}>
            <ResponsiveBar
                data={chartData}
                keys={['Recommendations', 'Watchlist']}
                indexBy="period"
                margin={{ top: 10, right: 10, bottom: 60, left: 50 }}
                padding={0.3}
                valueScale={{ type: 'linear', min: 0, max: maxValue * 1.1 }}
                indexScale={{ type: 'band', round: true }}
                colors={['#6366f1', '#8b5cf6']}
                borderColor={{ from: 'color', modifiers: [['darker', 1.2]] }}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                    tickSize: 0,
                    tickPadding: 8,
                    tickRotation: -45,
                    legend: '',
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
                    legend: 'Count',
                    legendPosition: 'middle',
                    legendOffset: -40
                }}
                labelSkipWidth={12}
                labelSkipHeight={12}
                enableLabel={false}
                tooltip={({ id, value, indexValue }) => (
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
                        <div style={{ color: id === 'Recommendations' ? '#6366f1' : '#8b5cf6' }}>
                            {id}: {value}
                        </div>
                    </div>
                )}
                legends={[
                    {
                        dataFrom: 'keys',
                        anchor: 'top-right',
                        direction: 'row',
                        justify: false,
                        translateX: 0,
                        translateY: -20,
                        itemsSpacing: 10,
                        itemWidth: 100,
                        itemHeight: 20,
                        itemDirection: 'left-to-right',
                        itemOpacity: 0.85,
                        symbolSize: 12,
                        effects: [
                            {
                                on: 'hover',
                                style: {
                                    itemOpacity: 1
                                }
                            }
                        ]
                    }
                ]}
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
                    },
                    legends: {
                        text: {
                            fill: 'rgba(255, 255, 255, 0.7)',
                            fontSize: 11
                        }
                    }
                }}
            />
        </div>
    );
};

