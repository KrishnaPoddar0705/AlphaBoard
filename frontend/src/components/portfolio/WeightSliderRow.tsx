import React, { useState } from 'react';
import { WeightRing } from './WeightRing';
import { WeightSlider } from '../recommendations/WeightSlider';

interface WeightSliderRowProps {
    ticker: string;
    weight: number;
    positionValue: number;
    onWeightChange: (newWeight: number) => void;
    disabled?: boolean;
}

export const WeightSliderRow: React.FC<WeightSliderRowProps> = ({
    ticker,
    weight,
    positionValue,
    onWeightChange,
    disabled = false
}) => {
    const [localWeight, setLocalWeight] = useState(weight);
    const [isEditing, setIsEditing] = useState(false);

    React.useEffect(() => {
        setLocalWeight(weight);
    }, [weight]);

    const handleSliderChange = (newWeight: number) => {
        const clampedWeight = Math.max(0, Math.min(100, newWeight));
        setLocalWeight(clampedWeight);
        onWeightChange(clampedWeight);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value) || 0;
        const clampedValue = Math.max(0, Math.min(100, value));
        setLocalWeight(clampedValue);
    };

    const handleInputBlur = () => {
        setIsEditing(false);
        onWeightChange(localWeight);
    };

    return (
        <div className="group p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/30 transition-all duration-200">
            <div className="flex items-center gap-4 mb-3">
                {/* Weight Ring */}
                <WeightRing weight={localWeight} size={48} />

                {/* Ticker and Value */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-sm">{ticker}</span>
                        <span className="text-xs text-gray-400">
                            ₹{(positionValue / 1000).toFixed(1)}K
                        </span>
                    </div>
                </div>

                {/* Weight Input */}
                <div className="w-20">
                    {isEditing ? (
                        <input
                            type="number"
                            value={localWeight.toFixed(1)}
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleInputBlur();
                                }
                            }}
                            min="0"
                            max="100"
                            step="0.1"
                            className="w-full px-2 py-1 bg-white/10 border border-indigo-500/50 rounded text-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            autoFocus
                        />
                    ) : (
                        <button
                            onClick={() => !disabled && setIsEditing(true)}
                            className="w-full px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white text-sm text-right transition-colors"
                            disabled={disabled}
                        >
                            {localWeight.toFixed(1)}%
                        </button>
                    )}
                </div>
            </div>

            {/* Slider */}
            <WeightSlider
                value={localWeight}
                onChange={handleSliderChange}
                min={0}
                max={100}
                step={0.1}
                disabled={disabled}
                showValue={false}
            />
        </div>
    );
};

