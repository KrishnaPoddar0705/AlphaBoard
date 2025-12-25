import React from 'react';
import { ResponsivePie } from '@nivo/pie';

interface PortfolioAllocationPieProps {
    data: Array<{ ticker: string; weight_pct: number; value: number }>;
    height?: number;
}

export const PortfolioAllocationPie: React.FC<PortfolioAllocationPieProps> = ({ data, height = 400 }) => {
    const chartData = data.map(item => ({
        id: item.ticker,
        label: item.ticker,
        value: item.weight_pct
    }));

    const colors = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];

    return (
        <div style={{ height, width: '100%' }}>
            <ResponsivePie
                data={chartData}
                margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
                innerRadius={0.5}
                padAngle={0.7}
                cornerRadius={3}
                activeOuterRadiusOffset={8}
                colors={colors}
                borderWidth={1}
                borderColor={{
                    from: 'color',
                    modifiers: [['darker', 0.2]]
                }}
                arcLinkLabelsSkipAngle={10}
                arcLinkLabelsTextColor="rgba(255, 255, 255, 0.7)"
                arcLinkLabelsThickness={2}
                arcLinkLabelsColor={{ from: 'color' }}
                arcLabelsSkipAngle={10}
                arcLabelsTextColor={{
                    from: 'color',
                    modifiers: [['darker', 2]]
                }}
                tooltip={({ datum }) => (
                    <div style={{
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        borderRadius: '4px',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <strong>{datum.label}</strong>: {datum.value.toFixed(2)}%
                    </div>
                )}
                theme={{
                    labels: {
                        text: {
                            fill: 'rgba(255, 255, 255, 0.9)',
                            fontSize: 12
                        }
                    }
                }}
            />
        </div>
    );
};

