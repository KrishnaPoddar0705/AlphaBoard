/**
 * Skeleton Loading Components
 * 
 * Provides elegant loading states for various UI elements
 * with smooth shimmer animations.
 */

import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string | number;
    height?: string | number;
    animate?: boolean;
}

export function Skeleton({
    className = '',
    variant = 'rectangular',
    width,
    height,
    animate = true,
}: SkeletonProps) {
    const baseClasses = 'bg-slate-700/50 relative overflow-hidden';
    
    const variantClasses = {
        text: 'rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-lg',
    };

    const animationClass = animate 
        ? 'before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent'
        : '';

    const style: React.CSSProperties = {
        width: width || '100%',
        height: height || (variant === 'text' ? '1em' : '100%'),
    };

    return (
        <div 
            className={`${baseClasses} ${variantClasses[variant]} ${animationClass} ${className}`}
            style={style}
        />
    );
}

/**
 * Stock Detail Skeleton
 * Complete loading state for the stock detail panel
 */
export function StockDetailSkeleton() {
    return (
        <div className="p-6 space-y-6 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex justify-between items-start">
                <div className="space-y-3">
                    <Skeleton width={180} height={32} />
                    <div className="flex gap-3">
                        <Skeleton width={100} height={24} />
                        <Skeleton width={80} height={24} />
                    </div>
                </div>
                <Skeleton variant="circular" width={40} height={40} />
            </div>

            {/* Thesis Skeleton */}
            <div className="space-y-2">
                <Skeleton width={120} height={16} />
                <Skeleton height={60} />
            </div>

            {/* Tabs Skeleton */}
            <div className="flex gap-2">
                <Skeleton width={80} height={36} className="rounded-lg" />
                <Skeleton width={80} height={36} className="rounded-lg" />
                <Skeleton width={80} height={36} className="rounded-lg" />
            </div>

            {/* Chart Skeleton */}
            <Skeleton height={400} className="rounded-xl" />

            {/* Metrics Skeleton */}
            <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton width={60} height={12} />
                        <Skeleton width={80} height={24} />
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Idea List Item Skeleton
 */
export function IdeaListItemSkeleton() {
    return (
        <div className="p-4 flex items-center gap-4 border-b border-white/5">
            <div className="flex-1 space-y-2">
                <Skeleton width={100} height={18} />
                <Skeleton width={60} height={14} />
            </div>
            <Skeleton width={80} height={24} />
            <Skeleton width={60} height={24} />
        </div>
    );
}

/**
 * Chart Skeleton
 */
export function ChartSkeleton() {
    return (
        <div className="relative h-[400px] bg-slate-800/30 rounded-xl overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-slate-400">Loading chart data...</span>
                </div>
            </div>
            {/* Fake chart lines */}
            <div className="absolute bottom-0 left-0 right-0 h-32 opacity-20">
                <svg viewBox="0 0 400 100" className="w-full h-full" preserveAspectRatio="none">
                    <path
                        d="M0,50 Q50,30 100,45 T200,40 T300,55 T400,35"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-indigo-500"
                    />
                </svg>
            </div>
        </div>
    );
}

export default Skeleton;

