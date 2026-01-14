/**
 * StatRow Component
 * 
 * Two-column row displaying a label (left) and value (right).
 * Includes optional hairline divider below.
 */

import React from 'react';
import clsx from 'clsx';
import { HairlineDivider } from './HairlineDivider';

interface StatRowProps {
  label: string;
  value: string | React.ReactNode;
  className?: string;
  showDivider?: boolean;
  labelClassName?: string;
  valueClassName?: string;
}

export function StatRow({
  label,
  value,
  className = '',
  showDivider = true,
  labelClassName = '',
  valueClassName = '',
}: StatRowProps) {
  return (
    <>
      <div className={clsx('flex items-center justify-between py-2', className)}>
        <span
          className={clsx(
            'text-xs uppercase tracking-wide text-[var(--paper-muted)]',
            labelClassName
          )}
        >
          {label}
        </span>
        <span
          className={clsx(
            'text-sm font-medium text-[var(--paper-ink)]',
            valueClassName
          )}
        >
          {value}
        </span>
      </div>
      {showDivider && <HairlineDivider />}
    </>
  );
}



