import React from 'react';
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

interface KPIMiniChartProps {
    data: Array<{ date: string; value: number }>;
    height?: number;
    color?: string;
    showArea?: boolean;
    label: string;
    value: number | string;
    trend?: 'up' | 'down' | 'neutral';
}

export const KPIMiniChart: React.FC<KPIMiniChartProps> = ({
    data,
    height = 60,
    color = '#6366f1',
    showArea = true,
    label,
    value,
    trend = 'neutral'
}) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] text-xs">
                <div className="text-lg font-bold text-[var(--text-primary)] mb-1">{value}</div>
                <div>{label}</div>
            </div>
        );
    }

    const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : color;

    return (
        <div className="flex flex-col h-full">
            <div className="mb-2">
                <div className="text-xs text-[var(--text-secondary)] mb-1">{label}</div>
                <div className={`text-lg font-bold ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-[var(--text-primary)]'}`}>
                    {value}
                </div>
            </div>
            <div style={{ height, width: '100%', flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                    {showArea ? (
                        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                            <defs>
                                <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={trendColor} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={trendColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={trendColor}
                                fill={`url(#gradient-${color})`}
                                strokeWidth={2}
                                isAnimationActive={true}
                                animationDuration={300}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '8px',
                                    padding: '6px 10px',
                                    fontSize: '11px'
                                }}
                                labelStyle={{ color: 'rgba(255, 255, 255, 0.8)' }}
                            />
                        </AreaChart>
                    ) : (
                        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={trendColor}
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={true}
                                animationDuration={300}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '8px',
                                    padding: '6px 10px',
                                    fontSize: '11px'
                                }}
                                labelStyle={{ color: 'rgba(255, 255, 255, 0.8)' }}
                            />
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

