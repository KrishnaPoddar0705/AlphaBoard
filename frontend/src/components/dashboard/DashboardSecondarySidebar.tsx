/**
 * Dashboard Secondary Sidebar Component
 * 
 * Secondary sidebar for Dashboard showing:
 * - Active Recommendations
 * - Watchlist
 * - History
 * 
 * Only shown when UI_V3 feature flag is enabled.
 */

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  // SidebarGroupLabel, // Unused
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '../ui/sidebar';
import { Activity, Eye, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardSecondarySidebarProps {
  viewMode: 'active' | 'watchlist' | 'history';
  onViewModeChange: (mode: 'active' | 'watchlist' | 'history') => void;
  activeCount?: number;
  watchlistCount?: number;
  historyCount?: number;
}

export function DashboardSecondarySidebar({
  viewMode,
  onViewModeChange,
  activeCount = 0,
  watchlistCount = 0,
  historyCount = 0,
}: DashboardSecondarySidebarProps) {
  return (
    <Sidebar collapsible="icon" side="right" className="border-l border-[var(--border-color)]">
      <SidebarHeader className="border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2 px-2 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-[var(--text-primary)]">My Ideas</span>
            <span className="text-xs text-[var(--text-secondary)]">Filter by status</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onViewModeChange('active')}
                  isActive={viewMode === 'active'}
                  className={cn(
                    'w-full justify-start',
                    viewMode === 'active' && 'bg-indigo-500/20 text-indigo-400'
                  )}
                >
                  <Activity className="w-4 h-4" />
                  <span>Active Recommendations</span>
                  {activeCount > 0 && (
                    <span className="ml-auto text-xs bg-indigo-500/30 px-2 py-0.5 rounded-full">
                      {activeCount}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onViewModeChange('watchlist')}
                  isActive={viewMode === 'watchlist'}
                  className={cn(
                    'w-full justify-start',
                    viewMode === 'watchlist' && 'bg-indigo-500/20 text-indigo-400'
                  )}
                >
                  <Eye className="w-4 h-4" />
                  <span>Watchlist</span>
                  {watchlistCount > 0 && (
                    <span className="ml-auto text-xs bg-indigo-500/30 px-2 py-0.5 rounded-full">
                      {watchlistCount}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onViewModeChange('history')}
                  isActive={viewMode === 'history'}
                  className={cn(
                    'w-full justify-start',
                    viewMode === 'history' && 'bg-indigo-500/20 text-indigo-400'
                  )}
                >
                  <Clock className="w-4 h-4" />
                  <span>History</span>
                  {historyCount > 0 && (
                    <span className="ml-auto text-xs bg-indigo-500/30 px-2 py-0.5 rounded-full">
                      {historyCount}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

