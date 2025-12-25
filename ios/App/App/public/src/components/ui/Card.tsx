/**
 * Card Component
 * 
 * A reusable card component with glassmorphic styling,
 * soft shadows, and hover effects for the premium UI.
 * 
 * Variants:
 * - default: Standard card with subtle border
 * - elevated: Card with more prominent shadow
 * - glass: Glassmorphic effect with blur
 * - outlined: Border-only style
 */

import React from 'react';

interface CardProps {
    children: React.ReactNode;
    variant?: 'default' | 'elevated' | 'glass' | 'outlined';
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hover?: boolean;
    onClick?: () => void;
}

const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
};

const variantClasses = {
    default: 'bg-slate-800/50 border border-white/5 shadow-lg',
    elevated: 'bg-slate-800/70 border border-white/10 shadow-xl shadow-black/20',
    glass: 'bg-slate-800/30 backdrop-blur-xl border border-white/10 shadow-lg',
    outlined: 'bg-transparent border border-white/10',
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
    const hoverClasses = hover 
        ? 'hover:border-indigo-500/30 hover:shadow-indigo-500/10 hover:shadow-xl cursor-pointer' 
        : '';

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${hoverClasses} ${className}`}
            onClick={onClick}
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
        <div className={`${borderBottom ? 'border-b border-white/5 pb-4 mb-4' : ''} ${className}`}>
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
        <h3 className={`text-white ${titleSizes[size]} ${className}`}>
            {children}
        </h3>
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

export default Card;

