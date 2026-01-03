/**
 * SectionHeader Component
 * 
 * Section title with optional toggle pills (e.g., Quarterly/Annually).
 */

import React from 'react';
import clsx from 'clsx';

interface SectionHeaderProps {
  title: string;
  toggleOptions?: { label: string; value: string }[];
  toggleValue?: string;
  onToggleChange?: (value: string) => void;
  className?: string;
}

export function SectionHeader({
  title,
  toggleOptions,
  toggleValue,
  onToggleChange,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={clsx('flex items-center justify-between mb-4', className)}>
      <h2 className="text-lg font-bold text-[var(--paper-ink)]">{title}</h2>
      {toggleOptions && toggleValue && onToggleChange && (
        <div className="flex gap-1">
          {toggleOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onToggleChange(option.value)}
              className={clsx(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                toggleValue === option.value
                  ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                  : 'bg-transparent text-[var(--paper-muted)] border border-[var(--paper-rule)] hover:border-[var(--paper-ink)] hover:text-[var(--paper-ink)]'
              )}
              style={{ borderRadius: 'var(--paper-radius-md)' }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

