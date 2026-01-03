/**
 * Mobile Menu V2 Component
 * 
 * Floating action button (FAB) menu for secondary navigation on mobile.
 * Features:
 * - FAB button that opens a menu
 * - Secondary navigation items (Research, Admin, Settings)
 * - Slide-up menu animation
 */

import { Link, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { Menu, X, FileText, Building2, Settings, XCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import clsx from 'clsx';

interface MobileMenuV2Props {
  organization?: { id: string; name: string; role: string } | null;
}

export function MobileMenuV2({ organization }: MobileMenuV2Props) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user } = useUser();

  const menuItems = [
    {
      to: '/research',
      icon: FileText,
      label: 'Institutional Memory',
      requiresOrg: true,
    },
    {
      to: '/organization/admin',
      icon: Building2,
      label: 'Admin Dashboard',
      requiresAdmin: true,
    },
    {
      to: '/settings/privacy',
      icon: Settings,
      label: 'Settings',
    },
  ].filter((item) => {
    if (item.requiresAdmin && organization?.role !== 'admin') return false;
    if (item.requiresOrg && !organization) return false;
    return true;
  });

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Don't show on desktop
  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
    return null;
  }

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'lg:hidden fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-all',
          'hover:bg-indigo-400 hover:shadow-xl hover:shadow-indigo-500/40',
          isOpen && 'bg-red-500 hover:bg-red-400'
        )}
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Menu className="w-6 h-6" />
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fadeIn"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menu */}
      <div
        className={clsx(
          'lg:hidden fixed bottom-20 right-4 z-50 w-64 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl shadow-2xl transition-all origin-bottom-right',
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        )}
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="p-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setIsOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                  'hover:bg-[var(--list-item-hover)]',
                  active
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

