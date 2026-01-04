/**
 * PaperCard Component
 * 
 * Flat card component with subtle border and no shadow.
 * Matches the editorial paper aesthetic.
 */

import React from 'react';
import clsx from 'clsx';

interface PaperCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function PaperCard({
  children,
  className = '',
  padding = 'md',
  border = true,
}: PaperCardProps) {
  return (
    <div
      className={clsx(
        'bg-[var(--paper-bg)] rounded-lg',
        border && 'border border-[var(--paper-border)]',
        padding !== 'none' && paddingClasses[padding],
        className
      )}
      style={{ borderRadius: 'var(--paper-radius-lg)' }}
    >
      {children}
    </div>
  );
}

