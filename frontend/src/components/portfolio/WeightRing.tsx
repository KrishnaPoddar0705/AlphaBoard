import React from 'react';

interface WeightRingProps {
    weight: number;
    size?: number;
    strokeWidth?: number;
    showLabel?: boolean;
}

export const WeightRing: React.FC<WeightRingProps> = ({
    weight,
    size = 40,
    strokeWidth = 4,
    showLabel = true
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (weight / 100) * circumference;

    // Color based on weight
    const getColor = (w: number) => {
        if (w >= 30) return '#ef4444'; // Red for high concentration
        if (w >= 15) return '#f59e0b'; // Yellow for medium-high
        if (w >= 5) return '#10b981'; // Green for medium
        return '#3b82f6'; // Blue for low
    };

    const color = getColor(weight);

    return (
        <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
            <svg
                width={size}
                height={size}
                className="transform -rotate-90"
            >
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-300"
                    style={{
                        filter: `drop-shadow(0 0 4px ${color}40)`
                    }}
                />
            </svg>
            {showLabel && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-white" style={{ fontSize: size * 0.25 }}>
                        {weight.toFixed(0)}%
                    </span>
                </div>
            )}
        </div>
    );
};

