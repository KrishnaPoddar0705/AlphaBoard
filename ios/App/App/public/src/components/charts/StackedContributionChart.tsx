import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

interface ContributionData {
    ticker: string;
    invested_weight: number;
    current_weight: number;
    return: number;
}

interface StackedContributionChartProps {
    data: ContributionData[];
    height?: number;
}

export const StackedContributionChart: React.FC<StackedContributionChartProps> = ({ data, height = 200 }) => {
    // Sort by current weight
    const sortedData = [...data].sort((a, b) => b.current_weight - a.current_weight);

    return (
        <div className="w-full">
            <h3 className="text-sm font-semibold text-white mb-3">Contribution by Asset</h3>
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={sortedData.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                        type="number"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        axisLine={{ stroke: '#374151' }}
                        tickLine={{ stroke: '#374151' }}
                        tickFormatter={(value) => `${value.toFixed(0)}%`}
                    />
                    <YAxis
                        type="category"
                        dataKey="ticker"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        axisLine={{ stroke: '#374151' }}
                        tickLine={{ stroke: '#374151' }}
                        width={60}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#fff'
                        }}
                        formatter={(value: number, name: string) => {
                            if (name === 'invested_weight') return [`${value.toFixed(2)}%`, 'Invested Weight'];
                            if (name === 'current_weight') return [`${value.toFixed(2)}%`, 'Current Weight'];
                            return [`${value.toFixed(2)}%`, name];
                        }}
                    />
                    <Legend
                        wrapperStyle={{ color: '#fff', fontSize: '12px' }}
                        iconType="square"
                    />
                    <Bar dataKey="invested_weight" stackId="a" fill="#6366f1" name="Invested Weight" />
                    <Bar dataKey="current_weight" stackId="a" fill="#10b981" name="Current Weight" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

