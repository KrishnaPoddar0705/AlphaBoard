/**
 * Section Header Component
 * 
 * Consistent section headers with title, description, and actions.
 * Features:
 * - Title and optional description
 * - Action buttons/links
 * - Responsive typography
 */

import React from 'react';
import clsx from 'clsx';

interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const titleSizes = {
  sm: 'text-base font-semibold',
  md: 'text-lg font-bold',
  lg: 'text-xl font-bold',
};

const descriptionSizes = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export function SectionHeader({
  title,
  description,
  actions,
  className = '',
  size = 'md',
}: SectionHeaderProps) {
  return (
    <div className={clsx('flex items-start justify-between gap-4 mb-6', className)}>
      <div className="flex-1">
        <h2 className={clsx('text-[var(--text-primary)] mb-1', titleSizes[size])}>
          {title}
        </h2>
        {description && (
          <p className={clsx('text-[var(--text-secondary)]', descriptionSizes[size])}>
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}



