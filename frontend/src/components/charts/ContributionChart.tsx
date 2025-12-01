import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ContributionData {
    ticker: string;
    weight: number;
    return: number;
    contribution: number;
}

interface ContributionChartProps {
    data: ContributionData[];
    height?: number;
}

export const ContributionChart: React.FC<ContributionChartProps> = ({ data, height = 200 }) => {
    // Sort by absolute contribution
    const sortedData = [...data].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

    const getColor = (contribution: number) => {
        if (contribution > 0) return '#10b981'; // Green for positive
        return '#ef4444'; // Red for negative
    };

    return (
        <div className="w-full">
            <h3 className="text-sm font-semibold text-white mb-3">Contribution by Asset</h3>
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={sortedData.slice(0, 10)} layout="vertical">
                    <XAxis
                        type="number"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        axisLine={{ stroke: '#374151' }}
                        tickLine={{ stroke: '#374151' }}
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
                        formatter={(value: number) => [`${value.toFixed(2)}%`, 'Contribution']}
                    />
                    <Bar dataKey="contribution" radius={[0, 4, 4, 0]}>
                        {sortedData.slice(0, 10).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getColor(entry.contribution)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

