/**
 * Drawer Component
 * 
 * Bottom sheet/drawer for mobile, side drawer for desktop.
 * Features:
 * - Slide-up animation (mobile)
 * - Slide-in animation (desktop)
 * - Backdrop overlay
 * - Close on backdrop click
 * - Keyboard escape support
 */

import React, { useEffect } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { radius } from '../../design-tokens';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: 'left' | 'right' | 'bottom';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  showCloseButton?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full',
};

const mobileSizeClasses = {
  sm: 'h-1/3',
  md: 'h-1/2',
  lg: 'h-2/3',
  xl: 'h-4/5',
  full: 'h-full',
};

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  side = 'bottom',
  size = 'md',
  className = '',
  showCloseButton = true,
}: DrawerProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
  const isBottom = side === 'bottom' || (isMobile && side !== 'left' && side !== 'right');

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fadeIn"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={clsx(
          'fixed z-50 bg-[var(--paper-bg)] border border-[var(--paper-border)] shadow-2xl',
          isBottom
            ? clsx(
                'bottom-0 left-0 right-0 animate-slideInUp',
                mobileSizeClasses[size],
                'rounded-t-2xl'
              )
            : clsx(
                side === 'left' 
                  ? 'left-0 top-0 bottom-0 animate-slideInLeft'
                  : 'right-0 top-0 bottom-0 animate-slideInRight',
                sizeClasses[size],
                'h-full'
              ),
          className
        )}
        style={{
          borderRadius: isBottom ? `${radius['2xl']} ${radius['2xl']} 0 0` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--paper-border)]">
            {title && (
              <h2 className="text-lg font-bold text-[var(--paper-ink)]">{title}</h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-lg hover:bg-[var(--paper-bg-alt)] transition-colors text-[var(--paper-muted)] hover:text-[var(--paper-ink)]"
                aria-label="Close drawer"
                style={{ borderRadius: 'var(--paper-radius-lg)' }}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto h-full" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
          {children}
        </div>
      </div>
    </>
  );
}

