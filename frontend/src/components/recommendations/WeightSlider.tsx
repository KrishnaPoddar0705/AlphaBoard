import React, { useState, useCallback, useEffect } from 'react';
import { GripVertical } from 'lucide-react';

interface WeightSliderProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    label?: string;
    showValue?: boolean;
}

export const WeightSlider: React.FC<WeightSliderProps> = ({
    value,
    onChange,
    min = 0,
    max = 100,
    step = 0.1,
    disabled = false,
    label,
    showValue = true
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (disabled) return;
        setIsDragging(true);
        handleMove(e);
    }, [disabled]);

    const handleMove = useCallback((e: MouseEvent | React.MouseEvent | TouchEvent | React.TouchEvent) => {
        if (disabled) return;
        
        const slider = (e.currentTarget as HTMLElement).closest('.weight-slider-container');
        if (!slider) return;

        const rect = slider.getBoundingClientRect();
        let x = 0;
        if ('clientX' in e) {
            x = e.clientX;
        } else if ('touches' in e && e.touches && e.touches.length > 0) {
            x = e.touches[0].clientX;
        }
        const percentage = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
        const newValue = min + (max - min) * percentage;
        const steppedValue = Math.round(newValue / step) * step;
        const clampedValue = Math.max(min, Math.min(max, steppedValue));

        setLocalValue(clampedValue);
        onChange(clampedValue);
    }, [min, max, step, onChange, disabled]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            handleMove(e);
        }
    }, [isDragging, handleMove]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleMouseMove as any);
            document.addEventListener('touchend', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                document.removeEventListener('touchmove', handleMouseMove as any);
                document.removeEventListener('touchend', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const percentage = ((localValue - min) / (max - min)) * 100;

    return (
        <div className="weight-slider-container w-full">
            {label && (
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">{label}</span>
                    {showValue && (
                        <span className="text-sm font-semibold text-white">
                            {localValue.toFixed(1)}%
                        </span>
                    )}
                </div>
            )}
            <div className="relative h-8 w-full">
                {/* Track */}
                <div className="absolute inset-0 bg-white/5 rounded-full overflow-hidden">
                    {/* Filled portion */}
                    <div
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-200"
                        style={{ width: `${percentage}%` }}
                    />
                    {/* Glow effect */}
                    <div
                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-400/50 to-purple-400/50 blur-sm rounded-full transition-all duration-200"
                        style={{ width: `${percentage}%` }}
                    />
                </div>

                {/* Handle */}
                <div
                    className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow-lg cursor-grab active:cursor-grabbing transition-all duration-200 flex items-center justify-center ${
                        isDragging ? 'scale-110 ring-4 ring-indigo-500/30' : 'hover:scale-105'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ left: `calc(${percentage}% - 12px)` }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleMouseDown as any}
                >
                    <GripVertical className="w-3 h-3 text-gray-600" />
                </div>
            </div>
        </div>
    );
};

