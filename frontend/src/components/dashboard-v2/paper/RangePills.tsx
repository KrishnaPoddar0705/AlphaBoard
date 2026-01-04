/**
 * RangePills Component
 * 
 * Compact pill buttons for selecting time ranges (1D, 1W, 1M, etc.).
 */

// import React from 'react';
import clsx from 'clsx';

export type RangeOption = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | '10Y' | 'All';

interface RangePillsProps {
  value: RangeOption;
  onChange: (range: RangeOption) => void;
  options?: RangeOption[];
  className?: string;
}

const defaultOptions: RangeOption[] = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y', '10Y', 'All'];

export function RangePills({
  value,
  onChange,
  options = defaultOptions,
  className = '',
}: RangePillsProps) {
  return (
    <div className={clsx('flex flex-wrap gap-1.5', className)}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={clsx(
            'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
            value === option
              ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
              : 'bg-transparent text-[var(--paper-muted)] border border-[var(--paper-rule)] hover:border-[var(--paper-ink)] hover:text-[var(--paper-ink)]'
          )}
          style={{ borderRadius: 'var(--paper-radius-md)' }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

