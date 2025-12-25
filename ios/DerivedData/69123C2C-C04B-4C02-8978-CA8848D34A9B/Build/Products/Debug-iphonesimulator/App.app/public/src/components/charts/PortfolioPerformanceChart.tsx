import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface PortfolioPerformanceChartProps {
    data: Array<{ date: string; value: number }>;
    height?: number;
}

export const PortfolioPerformanceChart: React.FC<PortfolioPerformanceChartProps> = ({ data, height = 300 }) => {
    if (!data || data.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
                No data available
            </div>
        );
    }

    return (
        <div className="w-full">
            <h3 className="text-sm font-semibold text-white mb-3">Portfolio Performance</h3>
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                        dataKey="date"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        axisLine={{ stroke: '#374151' }}
                        tickLine={{ stroke: '#374151' }}
                    />
                    <YAxis
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        axisLine={{ stroke: '#374151' }}
                        tickLine={{ stroke: '#374151' }}
                        tickFormatter={(value) => `${value.toFixed(0)}%`}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                        formatter={(value: number) => [`${value.toFixed(2)}%`, 'Return']}
                        labelStyle={{ color: '#fff' }}
                    />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#60a5fa' }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

