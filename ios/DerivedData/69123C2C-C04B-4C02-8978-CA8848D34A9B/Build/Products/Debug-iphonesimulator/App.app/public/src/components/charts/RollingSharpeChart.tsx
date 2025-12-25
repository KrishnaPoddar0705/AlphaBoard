import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RollingSharpeChartProps {
    data: Array<{ date: string; sharpe: number }>;
    height?: number;
}

export const RollingSharpeChart: React.FC<RollingSharpeChartProps> = ({ data, height = 400 }) => {
    return (
        <div style={{ height, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                    <XAxis
                        dataKey="date"
                        stroke="rgba(255, 255, 255, 0.7)"
                        style={{ fontSize: '12px' }}
                    />
                    <YAxis
                        stroke="rgba(255, 255, 255, 0.7)"
                        style={{ fontSize: '12px' }}
                        label={{ value: 'Sharpe Ratio', angle: -90, position: 'insideLeft', style: { fill: 'rgba(255, 255, 255, 0.7)' } }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            color: 'white'
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="sharpe"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', r: 3 }}
                        activeDot={{ r: 5 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

