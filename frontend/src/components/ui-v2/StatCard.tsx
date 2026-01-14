/**
 * Stat Card Component
 * 
 * Finance-native stat/metric card component.
 * Features:
 * - Value display with formatting
 * - Trend indicators (up/down)
 * - Labels and descriptions
 * - Sparkline support
 * - Responsive design
 */

import React from 'react';
import clsx from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from './Card';

interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  trend?: {
    value: number;
    label?: string;
  };
  icon?: React.ReactNode;
  sparkline?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'highlight';
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  description,
  trend,
  icon,
  sparkline,
  className = '',
  variant = 'default',
  onClick,
}: StatCardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      // Format numbers with commas and appropriate decimals
      if (Math.abs(val) >= 1000000) {
        return `₹${(val / 1000000).toFixed(2)}M`;
      }
      if (Math.abs(val) >= 1000) {
        return `₹${(val / 1000).toFixed(2)}K`;
      }
      return `₹${val.toFixed(2)}`;
    }
    return val;
  };

  const getTrendColor = (trendValue: number) => {
    if (trendValue > 0) return 'text-emerald-400';
    if (trendValue < 0) return 'text-red-400';
    return 'text-[var(--text-tertiary)]';
  };

  const getTrendIcon = (trendValue: number) => {
    if (trendValue > 0) return <TrendingUp className="w-4 h-4" />;
    if (trendValue < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  return (
    <Card
      variant={variant === 'highlight' ? 'elevated' : 'default'}
      padding="lg"
      hover={!!onClick}
      onClick={onClick}
      className={clsx(
        'relative overflow-hidden',
        variant === 'highlight' && 'border-indigo-500/30',
        className
      )}
    >
      {/* Icon */}
      {icon && (
        <div className="absolute top-4 right-4 opacity-10">
          {icon}
        </div>
      )}

      <CardContent className="relative">
        {/* Label */}
        <div className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
          {label}
        </div>

        {/* Value */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
            {formatValue(value)}
          </span>
          {trend && (
            <div className={clsx('flex items-center gap-1 text-sm font-medium', getTrendColor(trend.value))}>
              {getTrendIcon(trend.value)}
              <span className="tabular-nums">
                {Math.abs(trend.value).toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            {description}
          </p>
        )}

        {/* Trend Label */}
        {trend?.label && (
          <div className="text-xs text-[var(--text-tertiary)]">
            {trend.label}
          </div>
        )}

        {/* Sparkline */}
        {sparkline && (
          <div className="mt-3 h-12 -mx-4 -mb-4">
            {sparkline}
          </div>
        )}
      </CardContent>
    </Card>
  );
}



