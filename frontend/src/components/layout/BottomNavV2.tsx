/**
 * Bottom Navigation V2 Component
 * 
 * Mobile-first bottom navigation bar.
 * Features:
 * - Primary navigation items (Dashboard, Ideas, Performance, Profile)
 * - Active state indicators
 * - Safe area padding for iOS
 */

import { Link, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { LayoutDashboard, Lightbulb, Trophy, User } from 'lucide-react';
import clsx from 'clsx';
import { bottomNav } from '../../design-tokens';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  matchPath?: string;
}

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  // TODO: Uncomment when /ideas route is created in Phase 4
  // { to: '/ideas', icon: Lightbulb, label: 'Ideas', matchPath: '/ideas' },
  { to: '/leaderboard', icon: Trophy, label: 'Performance', matchPath: '/leaderboard' },
  { to: '/profile', icon: User, label: 'Profile', matchPath: '/profile' },
];

export function BottomNavV2() {
  const location = useLocation();
  const { user } = useUser();

  const isActive = (item: NavItem) => {
    if (item.matchPath) {
      return location.pathname.startsWith(item.matchPath);
    }
    if (item.to === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(item.to);
  };

  // Don't show on desktop
  if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
    return null;
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)] border-t border-[var(--border-color)] flex items-center justify-around shadow-lg"
      style={{
        height: `${bottomNav.mobileHeight}px`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);

        return (
          <Link
            key={item.to}
            to={item.to}
            className={clsx(
              'flex flex-col items-center justify-center gap-1 flex-1 h-full min-h-[44px] transition-colors relative',
              active
                ? 'text-indigo-400'
                : 'text-[var(--text-secondary)]'
            )}
          >
            <Icon className={clsx('w-5 h-5', active && 'text-indigo-400')} />
            <span className="text-[10px] font-medium">{item.label}</span>
            {active && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-indigo-400 rounded-t-full" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

