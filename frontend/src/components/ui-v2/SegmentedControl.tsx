/**
 * Segmented Control Component
 * 
 * Tab/segmented control for switching between views.
 * Features:
 * - Multiple options
 * - Active state indication
 * - Mobile-friendly touch targets
 * - Icon support
 */

import React from 'react';
import clsx from 'clsx';
import { radius } from '../../design-tokens';

interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  size = 'md',
  fullWidth = false,
}: SegmentedControlProps<T>) {
  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
  };

  return (
    <div
      className={clsx(
        'inline-flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-1',
        fullWidth && 'w-full',
        className
      )}
      style={{ borderRadius: radius.lg }}
      role="tablist"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={clsx(
              'flex items-center gap-2 font-medium transition-all duration-200 rounded-md',
              sizeClasses[size],
              isActive
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--list-item-hover)]',
              fullWidth && 'flex-1 justify-center'
            )}
            role="tab"
            aria-selected={isActive}
            style={{ borderRadius: radius.md }}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span
                className={clsx(
                  'px-1.5 py-0.5 rounded text-xs font-bold',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)]'
                )}
              >
                {option.count > 99 ? '99+' : option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}



