import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PnLDistributionProps {
    trades: Array<{ ticker: string; return_pct: number; pnl: number }>;
    height?: number;
}

export const PnLDistribution: React.FC<PnLDistributionProps> = ({ trades, height = 400 }) => {
    // Create bins for P&L distribution
    const bins: Record<string, number> = {
        '<-20%': 0,
        '-20% to -10%': 0,
        '-10% to 0%': 0,
        '0% to 10%': 0,
        '10% to 20%': 0,
        '>20%': 0
    };

    trades.forEach(trade => {
        const ret = trade.return_pct;
        if (ret < -20) bins['<-20%']++;
        else if (ret < -10) bins['-20% to -10%']++;
        else if (ret < 0) bins['-10% to 0%']++;
        else if (ret < 10) bins['0% to 10%']++;
        else if (ret < 20) bins['10% to 20%']++;
        else bins['>20%']++;
    });

    const chartData = Object.entries(bins).map(([range, count]) => ({
        range,
        count
    }));

    return (
        <div style={{ height, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                    <XAxis
                        dataKey="range"
                        stroke="rgba(255, 255, 255, 0.7)"
                        style={{ fontSize: '12px' }}
                    />
                    <YAxis
                        stroke="rgba(255, 255, 255, 0.7)"
                        style={{ fontSize: '12px' }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            color: 'white'
                        }}
                    />
                    <Bar
                        dataKey="count"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

