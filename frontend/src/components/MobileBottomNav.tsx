/**
 * MobileBottomNav Component
 * 
 * Sticky bottom navigation bar for mobile devices featuring:
 * - View mode switching (Active/Watchlist/History) on dashboard
 * - App navigation (Dashboard/Performance/Analyst/Profile) on other pages
 * - Fixed position at bottom
 * - Active state indicators
 * - Safe area padding for iOS
 * 
 * @component
 */

import { Link, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { LayoutDashboard, TrendingUp, Trophy, User, Activity, Eye, Clock } from 'lucide-react';

interface MobileBottomNavProps {
    viewMode?: 'active' | 'watchlist' | 'history';
    onViewModeChange?: (mode: 'active' | 'watchlist' | 'history') => void;
    counts?: {
        active: number;
        watchlist: number;
        history: number;
    };
}

export function MobileBottomNav({ viewMode, onViewModeChange, counts }: MobileBottomNavProps = {}) {
    const location = useLocation();
    const { user } = useUser();
    const isDashboard = location.pathname === '/';

    const isActive = (path: string) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    // Dashboard view mode tabs
    if (isDashboard && viewMode && onViewModeChange) {
        const viewModeItems = [
            { mode: 'active' as const, icon: Activity, label: 'Active', count: counts?.active || 0 },
            { mode: 'watchlist' as const, icon: Eye, label: 'Watchlist', count: counts?.watchlist || 0 },
            { mode: 'history' as const, icon: Clock, label: 'History', count: counts?.history || 0 },
        ];

        return (
            <nav
                className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)] border-t border-[var(--border-color)]
                           flex items-center justify-around h-16 shadow-lg"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                {viewModeItems.map((item) => {
                    const Icon = item.icon;
                    const active = viewMode === item.mode;

                    return (
                        <button
                            key={item.mode}
                            onClick={() => onViewModeChange(item.mode)}
                            className={`
                                relative flex flex-col items-center justify-center gap-1 flex-1 h-full
                                transition-colors min-h-[44px]
                                ${active
                                    ? 'text-indigo-400'
                                    : 'text-[var(--text-secondary)]'
                                }
                            `}
                        >
                            <div className="relative">
                                <Icon className={`w-5 h-5 ${active ? 'text-indigo-400' : ''}`} />
                                {item.count > 0 && (
                                    <span className={`
                                        absolute -top-1 -right-1 w-4 h-4 rounded-full text-[8px] font-bold
                                        flex items-center justify-center
                                        ${active
                                            ? 'bg-indigo-500 text-white'
                                            : 'bg-[var(--text-secondary)] text-[var(--bg-primary)]'
                                        }
                                    `}>
                                        {item.count > 99 ? '99+' : item.count}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] font-medium">{item.label}</span>
                            {active && (
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-indigo-400 rounded-t-full" />
                            )}
                        </button>
                    );
                })}
            </nav>
        );
    }

    // App navigation for other pages
    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard', matchPath: '/' },
        { to: '/leaderboard', icon: Trophy, label: 'Performance', matchPath: '/leaderboard' },
        { to: user?.id ? `/analyst/${user.id}/performance` : '/leaderboard', icon: TrendingUp, label: 'Analyst', matchPath: '/analyst' },
        { to: '/profile', icon: User, label: 'Profile', matchPath: '/profile' },
    ];

    return (
        <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--card-bg)] border-t border-[var(--border-color)]
                       flex items-center justify-around h-16 shadow-lg"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.matchPath || item.to);

                return (
                    <Link
                        key={item.to}
                        to={item.to}
                        className={`
                            relative flex flex-col items-center justify-center gap-1 flex-1 h-full
                            transition-colors min-h-[44px]
                            ${active
                                ? 'text-indigo-400'
                                : 'text-[var(--text-secondary)]'
                            }
                        `}
                    >
                        <Icon className={`w-5 h-5 ${active ? 'text-indigo-400' : ''}`} />
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

export default MobileBottomNav;

