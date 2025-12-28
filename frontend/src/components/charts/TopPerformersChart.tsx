import React from 'react';
import { ResponsiveBar } from '@nivo/bar';

interface TopPerformersChartProps {
    data: Array<{ ticker: string; return: number; status?: string }>;
    height?: number;
}

export const TopPerformersChart: React.FC<TopPerformersChartProps> = ({ data, height = 200 }) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                No data available
            </div>
        );
    }

    // Helper function to trim .NS from ticker
    const trimTicker = (ticker: string) => ticker.replace(/\.NS$/, '').replace(/\.INVO$/, '');

    // Sort by return descending and take top 5
    const sortedData = [...data]
        .sort((a, b) => b.return - a.return)
        .slice(0, 5)
        .map(item => ({
            ticker: trimTicker(item.ticker),
            originalTicker: item.ticker,
            return: item.return,
            status: item.status || 'OPEN'
        }));

    const maxValue = Math.max(...sortedData.map(d => Math.abs(d.return)), 1);

    return (
        <div style={{ height, width: '100%' }}>
            <ResponsiveBar
                data={sortedData}
                keys={['return']}
                indexBy="ticker"
                margin={{ top: 10, right: 10, bottom: 60, left: 50 }}
                padding={0.4}
                valueScale={{ type: 'linear', min: 0, max: maxValue * 1.1 }}
                indexScale={{ type: 'band', round: true }}
                colors={(bar) => {
                    const status = (bar.data as any).status;
                    // Green for active (OPEN), blue for closed (CLOSED), red for negative returns
                    if (bar.data.return < 0) return '#ef4444';
                    return status === 'CLOSED' ? '#3b82f6' : '#10b981';
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
                    legendOffset: -40,
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
                    const formattedValue = typeof value === 'number' ? value.toFixed(2) : '0.00';
                    const status = (data as any).status || 'OPEN';
                    const statusColor = status === 'CLOSED' ? '#3b82f6' : (value >= 0 ? '#10b981' : '#ef4444');
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
                            <div style={{ color: statusColor, marginBottom: '2px' }}>
                                {value >= 0 ? '+' : ''}{formattedValue}%
                            </div>
                            <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '10px' }}>
                                {status === 'CLOSED' ? 'Closed' : 'Active'}
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

