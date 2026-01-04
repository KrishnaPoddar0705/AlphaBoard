/**
 * Top Bar V2 Component
 * 
 * Top navigation bar for desktop view.
 * Features:
 * - Search bar
 * - Alerts dropdown
 * - User menu
 * - Organization switcher (if applicable)
 */

import { useUser } from '@clerk/clerk-react';
import { Search, LogOut, User as UserIcon } from 'lucide-react';
import { useState } from 'react';
import AlertsDropdown from '../AlertsDropdown';
// import clsx from 'clsx'; // Unused

interface TopBarV2Props {
  organization?: { id: string; name: string; role: string } | null;
  onLogout?: () => void;
}

export function TopBarV2({ organization, onLogout }: TopBarV2Props) {
  const { user } = useUser();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <header className="h-16 bg-[var(--paper-bg-alt)] border-b border-[var(--paper-border)] flex items-center justify-between px-6 sticky top-0 z-30 rounded-b-lg" style={{ borderRadius: '0 0 var(--paper-radius-lg) var(--paper-radius-lg)' }}>
      {/* Search Bar */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--paper-subtle)]" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 bg-[var(--paper-bg)] border border-[var(--paper-border)] rounded-lg text-sm text-[var(--paper-ink)] placeholder-[var(--paper-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--paper-ink)]/20 focus:border-[var(--paper-ink)] transition-all"
            style={{ borderRadius: 'var(--paper-radius-lg)' }}
          />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Alerts */}
        {user && <AlertsDropdown />}

        {/* User Menu */}
        {user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--paper-bg)] transition-colors"
              style={{ borderRadius: 'var(--paper-radius-lg)' }}
            >
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName || 'User'}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
              )}
              <span className="hidden md:block text-sm font-medium text-[var(--paper-ink)]">
                {user.fullName || user.emailAddresses[0]?.emailAddress}
              </span>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-[var(--paper-bg)] border border-[var(--paper-border)] rounded-lg shadow-xl z-50 py-1" style={{ borderRadius: 'var(--paper-radius-lg)' }}>
                  <div className="px-4 py-2 border-b border-[var(--paper-border)]">
                    <p className="text-sm font-medium text-[var(--paper-ink)]">
                      {user.fullName || 'User'}
                    </p>
                    <p className="text-xs text-[var(--paper-subtle)] truncate">
                      {user.emailAddresses[0]?.emailAddress}
                    </p>
                  </div>
                  {organization && (
                    <div className="px-4 py-2 border-b border-[var(--paper-border)]">
                      <p className="text-xs text-[var(--paper-subtle)] uppercase tracking-wider mb-1">
                        Organization
                      </p>
                      <p className="text-sm text-[var(--paper-ink)]">{organization.name}</p>
                    </div>
                  )}
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[var(--paper-muted)] hover:bg-[var(--paper-bg-alt)] hover:text-[var(--paper-ink)] transition-colors rounded-md"
                    style={{ borderRadius: 'var(--paper-radius-md)' }}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

