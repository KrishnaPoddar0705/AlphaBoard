/**
 * Card Component V2
 * 
 * Enhanced card component with finance-native styling.
 * Features:
 * - Multiple variants (default, elevated, glass, outlined)
 * - Responsive padding
 * - Hover effects
 * - Click handlers
 */

import React from 'react';
import clsx from 'clsx';
import { cardPadding, radius, shadows } from '../../design-tokens';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'glass' | 'outlined';
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
  onClick?: () => void;
}

const variantClasses = {
  default: 'bg-[var(--card-bg)] border border-[var(--border-color)]',
  elevated: 'bg-[var(--card-bg)] border border-[var(--border-color)] shadow-lg',
  glass: 'bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)]',
  outlined: 'bg-transparent border border-[var(--border-color)]',
};

export function Card({
  children,
  variant = 'default',
  className = '',
  padding = 'md',
  hover = false,
  onClick,
}: CardProps) {
  const baseClasses = 'rounded-xl transition-all duration-200';
  const hoverClasses = hover || onClick
    ? 'hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10 cursor-pointer'
    : '';

  return (
    <div
      className={clsx(
        baseClasses,
        variantClasses[variant],
        padding !== 'none' && cardPadding[padding],
        hoverClasses,
        className
      )}
      onClick={onClick}
      style={{ borderRadius: radius.lg }}
    >
      {children}
    </div>
  );
}

/**
 * Card Header Component
 */
interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
  borderBottom?: boolean;
}

export function CardHeader({ children, className = '', borderBottom = true }: CardHeaderProps) {
  return (
    <div
      className={clsx(
        'flex items-center justify-between',
        borderBottom && 'border-b border-[var(--border-color)] pb-4 mb-4',
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Card Title Component
 */
interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const titleSizes = {
  sm: 'text-sm font-semibold',
  md: 'text-base font-bold',
  lg: 'text-lg font-bold',
};

export function CardTitle({ children, className = '', size = 'md' }: CardTitleProps) {
  return (
    <h3 className={clsx('text-[var(--text-primary)]', titleSizes[size], className)}>
      {children}
    </h3>
  );
}

/**
 * Card Description Component
 */
interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function CardDescription({ children, className = '' }: CardDescriptionProps) {
  return (
    <p className={clsx('text-sm text-[var(--text-secondary)]', className)}>
      {children}
    </p>
  );
}

/**
 * Card Content Component
 */
interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={className}>{children}</div>;
}

/**
 * Card Footer Component
 */
interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
  borderTop?: boolean;
}

export function CardFooter({ children, className = '', borderTop = true }: CardFooterProps) {
  return (
    <div
      className={clsx(
        'flex items-center justify-between',
        borderTop && 'border-t border-[var(--border-color)] pt-4 mt-4',
        className
      )}
    >
      {children}
    </div>
  );
}

