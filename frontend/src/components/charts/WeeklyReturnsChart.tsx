import React from 'react';
import { ResponsiveBar } from '@nivo/bar';

interface WeeklyReturnsChartProps {
    data: Array<{ week: string; return: number; cumulativeReturn?: number; count?: number }>;
    height?: number;
}

export const WeeklyReturnsChart: React.FC<WeeklyReturnsChartProps> = ({ data, height = 200 }) => {

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                No data available
            </div>
        );
    }

    const chartData = data.map(item => ({
        week: item.week,
        return: item.return,
        cumulativeReturn: item.cumulativeReturn ?? 0,
        count: item.count ?? 0
    }));

    // Prepare line data for cumulative returns
    const lineData = data
        .filter(item => item.cumulativeReturn !== undefined)
        .map((item) => ({
            x: item.week,
            y: item.cumulativeReturn || 0
        }));

    // Find max absolute value for symmetric scale (consider both period and cumulative)
    const maxAbsValue = Math.max(
        ...chartData.map(d => Math.abs(d.return)),
        ...lineData.map(d => Math.abs(d.y)),
        1
    );

    return (
        <div
            style={{ height, width: '100%', position: 'relative' }}
        >
            {/* Bar Chart - Period Returns */}
            <ResponsiveBar
                data={chartData}
                keys={['return']}
                indexBy="week"
                margin={{ top: 10, right: 10, bottom: 60, left: 40 }}
                padding={0.3}
                valueScale={{ type: 'linear', min: -maxAbsValue * 1.1, max: maxAbsValue * 1.1 }}
                indexScale={{ type: 'band', round: true }}
                layers={['grid', 'axes', 'bars', 'markers', 'legends', (props: any) => {
                    // Custom layer to draw cumulative line overlay - always visible
                    if (lineData.length === 0) return null;

                    const { xScale, yScale, bars } = props;
                    if (!xScale || !yScale || !bars || bars.length === 0) return null;

                    // Calculate line points
                    const points = lineData.map((point, index) => {
                        const bar = bars[index];
                        if (!bar) return null;

                        // Use bar's x position (center of bar)
                        const x = bar.x + bar.width / 2;
                        const y = yScale(point.y);

                        return { x, y };
                    }).filter(p => p !== null) as Array<{ x: number; y: number }>;

                    if (points.length < 2) return null;

                    // Draw line path with smooth curve
                    let path = `M ${points[0].x} ${points[0].y}`;
                    for (let i = 1; i < points.length; i++) {
                        const prev = points[i - 1];
                        const curr = points[i];
                        // Use smooth curve (quadratic bezier)
                        const cpX = (prev.x + curr.x) / 2;
                        const cpY = (prev.y + curr.y) / 2;
                        path += ` Q ${cpX} ${prev.y}, ${cpX} ${cpY} T ${curr.x} ${curr.y}`;
                    }

                    return (
                        <g key="cumulative-line" style={{ transition: 'opacity 0.2s ease-in-out' }}>
                            <path
                                d={path}
                                fill="none"
                                stroke="#6366f1"
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                opacity={0.9}
                            />
                            {points.map((point, index) => (
                                <circle
                                    key={index}
                                    cx={point.x}
                                    cy={point.y}
                                    r={4}
                                    fill="#6366f1"
                                    stroke="#ffffff"
                                    strokeWidth={2}
                                    opacity={0.9}
                                />
                            ))}
                        </g>
                    );
                }]}
                colors={(bar) => {
                    const returnValue = typeof bar.data.return === 'number' ? bar.data.return : 0;
                    return returnValue >= 0 ? '#10b981' : '#ef4444';
                }}
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
                    legend: '',
                    legendPosition: 'middle',
                    legendOffset: -35,
                    format: (value) => {
                        if (Math.abs(value) < 0.01) return '0%';
                        return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
                    }
                }}
                labelSkipWidth={12}
                labelSkipHeight={12}
                enableLabel={false}
                labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                tooltip={({ value, indexValue, data }) => {
                    const item = data as any;
                    const numValue = typeof value === 'number' ? value : 0;
                    const formattedValue = numValue.toFixed(2);
                    const cumulativeValue = item.cumulativeReturn !== undefined && typeof item.cumulativeReturn === 'number'
                        ? (item.cumulativeReturn >= 0 ? '+' : '') + item.cumulativeReturn.toFixed(2)
                        : null;
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
                            <div style={{ color: numValue >= 0 ? '#10b981' : '#ef4444', marginBottom: '4px' }}>
                                Period: {numValue >= 0 ? '+' : ''}{formattedValue}%
                            </div>
                            {cumulativeValue !== null && (
                                <div style={{ color: '#6366f1', marginBottom: item.count ? '4px' : '0' }}>
                                    Cumulative: {cumulativeValue}%
                                </div>
                            )}
                            {item.count !== undefined && (
                                <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '11px', marginTop: '4px' }}>
                                    {item.count} {item.count === 1 ? 'recommendation' : 'recommendations'} added
                                </div>
                            )}
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

