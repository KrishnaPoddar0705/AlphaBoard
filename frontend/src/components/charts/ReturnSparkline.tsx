import React from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

interface ReturnSparklineProps {
    data: Array<{ date: string; return: number }>;
    height?: number;
    isPositive?: boolean;
}

export const ReturnSparkline: React.FC<ReturnSparklineProps> = ({
    data,
    height = 40,
    isPositive = true
}) => {
    if (!data || data.length === 0) {
        return null;
    }

    const color = isPositive ? '#10b981' : '#ef4444';
    const strokeWidth = 2;

    return (
        <div style={{ height, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                    <Line
                        type="monotone"
                        dataKey="return"
                        stroke={color}
                        strokeWidth={strokeWidth}
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
                        formatter={(value: any) => [
                            `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`,
                            'Return'
                        ]}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

