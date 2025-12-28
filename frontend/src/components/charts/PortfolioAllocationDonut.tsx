import React from 'react';
import { ResponsivePie } from '@nivo/pie';

interface PortfolioAllocationDonutProps {
    data: Array<{ ticker: string; buyCount: number; sellCount: number }>;
    height?: number;
}

export const PortfolioAllocationDonut: React.FC<PortfolioAllocationDonutProps> = ({ data, height = 200 }) => {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
                No data available
            </div>
        );
    }

    // Helper function to trim .NS from ticker
    const trimTicker = (ticker: string) => ticker.replace(/\.NS$/, '').replace(/\.INVO$/, '');

    const chartData = data.map(item => ({
        id: item.ticker,
        label: trimTicker(item.ticker),
        value: item.buyCount + item.sellCount,
        buyCount: item.buyCount,
        sellCount: item.sellCount
    }));

    // Color palette for different stocks
    const colors = [
        '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b',
        '#10b981', '#06b6d4', '#3b82f6', '#a855f7', '#ef4444'
    ];

    return (
        <div style={{ height, width: '100%', overflow: 'hidden' }}>
            <ResponsivePie
                data={chartData}
                margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                innerRadius={0.5}
                padAngle={2}
                cornerRadius={4}
                activeOuterRadiusOffset={8}
                colors={colors}
                borderWidth={1}
                borderColor={{
                    from: 'color',
                    modifiers: [['darker', 0.2]]
                }}
                arcLinkLabelsSkipAngle={10}
                arcLinkLabelsTextColor="rgba(255, 255, 255, 0.6)"
                arcLinkLabelsThickness={2}
                arcLinkLabelsColor={{ from: 'color' }}
                arcLabelsSkipAngle={10}
                enableArcLabels={false}
                arcLabelsTextColor={{
                    from: 'color',
                    modifiers: [['darker', 2]]
                }}
                // Prevent overflow by adjusting link labels
                arcLinkLabelsOffset={-5}
                arcLinkLabelsDiagonalLength={8}
                arcLinkLabelsStraightLength={8}
                tooltip={({ datum }) => {
                    const buyCount = datum.data.buyCount || 0;
                    const sellCount = datum.data.sellCount || 0;
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
                            <div style={{ marginBottom: '6px' }}>
                                <strong>{datum.label}</strong>
                            </div>
                            <div style={{ color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.6' }}>
                                <div>BUY: {buyCount} {buyCount === 1 ? 'time' : 'times'}</div>
                                <div>SELL: {sellCount} {sellCount === 1 ? 'time' : 'times'}</div>
                            </div>
                        </div>
                    );
                }}
                animate={true}
                motionConfig="gentle"
                theme={{
                    labels: {
                        text: {
                            fill: 'rgba(255, 255, 255, 0.7)',
                            fontSize: 11
                        }
                    }
                }}
            />
        </div>
    );
};

