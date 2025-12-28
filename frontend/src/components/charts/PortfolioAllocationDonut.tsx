import React, { useState } from 'react';
import { ResponsivePie } from '@nivo/pie';

interface PortfolioAllocationDonutProps {
    data: Array<{ ticker: string; buyCount: number; sellCount: number }>;
    height?: number;
}

export const PortfolioAllocationDonut: React.FC<PortfolioAllocationDonutProps> = ({ data, height = 200 }) => {
    const [hoveredId, setHoveredId] = useState<string | null>(null);
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
        <div style={{ height, width: '100%', overflow: 'visible', position: 'relative' }}>
            <ResponsivePie
                data={chartData}
                margin={{ top: 40, right: 120, bottom: 40, left: 120 }}
                innerRadius={0.5}
                padAngle={1}
                cornerRadius={4}
                activeOuterRadiusOffset={8}
                colors={colors}
                borderWidth={1}
                borderColor={{
                    from: 'color',
                    modifiers: [['darker', 0.2]]
                }}
                arcLinkLabelsSkipAngle={360}
                arcLinkLabel={(d: any) => {
                    // Only show label for hovered segment
                    return hoveredId === d.id ? d.label : '';
                }}
                arcLinkLabelsTextColor="rgba(255, 255, 255, 0.9)"
                arcLinkLabelsThickness={2}
                arcLinkLabelsColor={{ from: 'color' }}
                arcLabelsSkipAngle={360}
                enableArcLabels={false}
                arcLabelsTextColor={{
                    from: 'color',
                    modifiers: [['darker', 2]]
                }}
                arcLabelsRadiusOffset={0.6}
                // Adjust link labels to show all
                arcLinkLabelsOffset={2}
                arcLinkLabelsDiagonalLength={16}
                arcLinkLabelsStraightLength={12}
                arcLinkLabelsTextOffset={4}
                onMouseEnter={(datum) => setHoveredId(datum.id as string)}
                onMouseLeave={() => setHoveredId(null)}
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

