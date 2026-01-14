/**
 * StatList Component
 * 
 * Vertical container for StatRow components.
 */

import React from 'react';
import clsx from 'clsx';

interface StatListProps {
  children: React.ReactNode;
  className?: string;
}

export function StatList({ children, className = '' }: StatListProps) {
  return (
    <div className={clsx('space-y-0', className)}>
      {children}
    </div>
  );
}



