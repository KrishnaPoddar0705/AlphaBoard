/**
 * HairlineDivider Component
 * 
 * Thin 1px horizontal divider rule matching paper theme.
 */

import React from 'react';
import clsx from 'clsx';

interface HairlineDividerProps {
  className?: string;
  light?: boolean;
  vertical?: boolean;
}

export function HairlineDivider({
  className = '',
  light = false,
  vertical = false,
}: HairlineDividerProps) {
  return (
    <div
      className={clsx(
        vertical ? 'w-px' : 'h-px',
        light ? 'bg-[var(--paper-rule-light)]' : 'bg-[var(--paper-rule)]',
        className
      )}
    />
  );
}

