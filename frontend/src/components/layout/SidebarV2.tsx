/**
 * Sidebar V2 Component
 * 
 * Resizable sidebar navigation for desktop view.
 * Features:
 * - Drag-to-resize functionality
 * - Collapsible sections
 * - Active route highlighting
 * - User preferences persistence
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  Trophy,
  BarChart2,
  FileText,
  Building2,
  User,
  Settings,
  Users,
  ChevronRight,
  GripVertical,
} from 'lucide-react';
import { useResizableSidebar } from '../../hooks/useResizableSidebar';
import { sidebar } from '../../design-tokens';
import { StockPanelSlideOut } from '../dashboard-v2/StockPanelSlideOut';
import { List } from 'lucide-react';
import clsx from 'clsx';

interface NavItem {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  matchPath?: string;
  requiresOrg?: boolean;
  requiresAdmin?: boolean;
}

interface SidebarV2Props {
  organization?: { id: string; name: string; role: string } | null;
  onLogout?: () => void;
  // Stock panel props (optional, only when Dashboard is active)
  recommendations?: any[];
  selectedTicker?: string | null;
  onSelectTicker?: (ticker: string) => void;
  viewMode?: 'active' | 'watchlist' | 'history';
  onViewModeChange?: (mode: 'active' | 'watchlist' | 'history') => void;
  onRefresh?: () => void;
}

export function SidebarV2({
  organization,
  onLogout,
  recommendations = [],
  selectedTicker = null,
  onSelectTicker,
  viewMode = 'active',
  onViewModeChange,
  onRefresh,
}: SidebarV2Props) {
  const location = useLocation();
  const { user } = useUser();
  const { width, handleMouseDown, isResizing } = useResizableSidebar();
  const [isStockPanelOpen, setIsStockPanelOpen] = useState(false);

  const isActive = (path: string, matchPath?: string) => {
    if (matchPath) {
      return location.pathname.startsWith(matchPath);
    }
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const isDashboardActive = isActive('/');

  // Auto-open stock panel when Dashboard becomes active
  React.useEffect(() => {
    if (isDashboardActive && onSelectTicker && onViewModeChange && onRefresh) {
      setIsStockPanelOpen(true);
    }
  }, [isDashboardActive, onSelectTicker, onViewModeChange, onRefresh]);

  const navItems: NavItem[] = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/leaderboard', icon: Trophy, label: 'Performance Tracker' },
    {
      to: user?.id ? `/analyst/${user.id}/performance` : '/leaderboard',
      icon: BarChart2,
      label: 'My Performance',
      matchPath: '/analyst',
    },
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
  ];

  const filteredNavItems = navItems.filter((item) => {
    if (item.requiresAdmin && organization?.role !== 'admin') return false;
    if (item.requiresOrg && !organization) return false;
    return true;
  });

  return (
    <aside
      className="hidden lg:flex flex-col h-screen bg-[var(--paper-bg-alt)] border-r border-[var(--paper-border)] relative rounded-r-lg"
      style={{ width: `${width}px`, minWidth: `${sidebar.minWidth}px`, maxWidth: `${sidebar.maxWidth}px`, borderRadius: '0 var(--paper-radius-lg) var(--paper-radius-lg) 0' }}
    >
      {/* Logo/Brand */}
      <div className="h-16 flex items-center px-4 border-b border-[var(--paper-border)]">
        <h1 className="text-xl font-bold text-[var(--paper-ink)]">AlphaBoard</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin flex flex-col">
        <div className="px-2 space-y-1">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.matchPath);

            return (
              <React.Fragment key={item.to}>
                <Link
                  to={item.to}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    'hover:bg-[var(--paper-bg)]',
                    active
                      ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                      : 'text-[var(--paper-muted)] hover:text-[var(--paper-ink)]'
                  )}
                  style={{ borderRadius: 'var(--paper-radius-lg)' }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {active && <ChevronRight className="w-4 h-4 flex-shrink-0" />}
                </Link>
                
                {/* Stock Panel Button - Show below Dashboard when active */}
                {active && item.to === '/' && isDashboardActive && onSelectTicker && onViewModeChange && onRefresh && (
                  <button
                    onClick={() => setIsStockPanelOpen(true)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-1 hover:bg-[var(--paper-bg)] text-[var(--paper-muted)] hover:text-[var(--paper-ink)]"
                    style={{ borderRadius: 'var(--paper-radius-lg)' }}
                  >
                    <List className="w-5 h-5 flex-shrink-0" />
                    <span className="flex-1 truncate text-left">My Stocks</span>
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Organization Section */}
        {organization && (
          <div className="px-2 mt-6 pt-6 border-t border-[var(--paper-border)]">
            <div className="px-3 py-2 text-xs font-semibold text-[var(--paper-subtle)] uppercase tracking-wider">
              Organization
            </div>
            <div className="px-3 py-2 text-sm text-[var(--paper-muted)] truncate">
              {organization.name}
            </div>
          </div>
        )}

        {/* User Section */}
        <div className="px-2 mt-auto pt-6 border-t border-[var(--paper-border)]">
          <Link
            to="/profile"
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              'hover:bg-[var(--paper-bg)]',
              isActive('/profile')
                ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                : 'text-[var(--paper-muted)] hover:text-[var(--paper-ink)]'
            )}
            style={{ borderRadius: 'var(--paper-radius-lg)' }}
          >
            <User className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1 truncate">Profile</span>
          </Link>
          <Link
            to="/settings/privacy"
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-1',
              'hover:bg-[var(--paper-bg)]',
              isActive('/settings')
                ? 'bg-[var(--paper-ink)] text-[var(--paper-bg)]'
                : 'text-[var(--paper-muted)] hover:text-[var(--paper-ink)]'
            )}
            style={{ borderRadius: 'var(--paper-radius-lg)' }}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1 truncate">Settings</span>
          </Link>
        </div>
      </nav>

      {/* Resize Handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-500/50 transition-colors group"
        onMouseDown={handleMouseDown}
        style={{ opacity: isResizing ? 1 : 0 }}
      >
        <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-1 h-12 bg-indigo-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Stock Panel Slide-Out */}
      {isDashboardActive && onSelectTicker && onViewModeChange && onRefresh && (
        <StockPanelSlideOut
          isOpen={isStockPanelOpen}
          onClose={() => setIsStockPanelOpen(false)}
          recommendations={recommendations}
          selectedTicker={selectedTicker}
          onSelectTicker={onSelectTicker}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          onRefresh={onRefresh}
          sidebarWidth={width}
        />
      )}
    </aside>
  );
}

