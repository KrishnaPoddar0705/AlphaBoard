import React from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { useSkinColors } from '@/hooks/useSkinColors'

interface IdeasAddedChartProps {
    data: Array<{ period: string; openRecommendations: number; watchlist: number; closed: number }>;
    height?: number;
    periodType?: 'day' | 'week' | 'month';
}

export const IdeasAddedChart: React.FC<IdeasAddedChartProps> = ({
    data,
    height = 200,
    periodType: _periodType = 'week'
}) => {
    const sc = useSkinColors()
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                No data available
            </div>
        );
    }

    const chartData = data.map(item => ({
        period: item.period,
        'Recommendations': item.openRecommendations,
        Watchlist: item.watchlist,
        Closed: item.closed || 0
    }));

    const maxValue = Math.max(
        ...chartData.map(d => d['Recommendations'] + d.Watchlist + d.Closed),
        1
    );

    return (
        <div style={{ height, width: '100%' }}>
            <ResponsiveBar
                data={chartData}
                keys={['Recommendations', 'Watchlist', 'Closed']}
                indexBy="period"
                margin={{ top: 50, right: 10, bottom: 60, left: 50 }}
                padding={0.3}
                valueScale={{ type: 'linear', min: 0, max: maxValue * 1.1 }}
                indexScale={{ type: 'band', round: true }}
                colors={['#10b981', '#3b82f6', '#eab308']}
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
                        background: sc.surface, // card bg
                        color: sc.ink, // ink text
                        borderRadius: '8px',
                        border: `1px solid ${sc.border}`, // border
                        fontSize: '12px',
                        fontWeight: '500',
                        fontFamily: sc.fontFamily
                    }}>
                        <div style={{ marginBottom: '4px', color: sc.ink }}>
                            <strong>{indexValue}</strong>
                        </div>
                        <div style={{
                            color: id === 'Recommendations' ? sc.positive : id === 'Watchlist' ? sc.ink : sc.inkMuted
                        }}>
                            {id}: {value}
                        </div>
                    </div>
                )}
                legends={[
                    {
                        dataFrom: 'keys',
                        anchor: 'top',
                        direction: 'row',
                        justify: false,
                        translateX: 0,
                        translateY: -40,
                        itemsSpacing: 20,
                        itemWidth: 140,
                        itemHeight: 20,
                        itemDirection: 'left-to-right',
                        itemOpacity: 1,
                        symbolSize: 16,
                        symbolShape: 'square',
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
                                stroke: sc.border, // border
                                strokeWidth: 1
                            }
                        },
                        ticks: {
                            line: {
                                stroke: sc.grid, // gridlines
                                strokeWidth: 1
                            },
                            text: {
                                fill: sc.inkMuted, // muted
                                fontSize: 11,
                                fontFamily: sc.fontFamily
                            }
                        }
                    },
                    grid: {
                        line: {
                            stroke: sc.grid, // gridlines
                            strokeWidth: 1
                        }
                    },
                    legends: {
                        text: {
                            fill: sc.ink, // ink text
                            fontSize: 12,
                            fontWeight: 500,
                            fontFamily: sc.fontFamily
                        }
                    }
                }}
            />
        </div>
    );
};

