/**
 * Ticker List Sidebar Component
 * 
 * Secondary sidebar showing list of tickers for the selected view mode.
 * Displays tickers with their current prices and returns.
 * 
 * Only shown when UI_V3 feature flag is enabled and a view mode is selected.
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
import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TickerItem {
  id: string;
  ticker: string;
  companyName?: string;
  entryPrice: number;
  currentPrice?: number;
  return?: number;
  action?: string;
  status?: string;
}

interface TickerListSidebarProps {
  viewMode: 'active' | 'watchlist' | 'history';
  tickers: TickerItem[];
  selectedTickerId?: string;
  onSelectTicker: (ticker: TickerItem) => void;
  isLoading?: boolean;
}

export function TickerListSidebar({
  viewMode,
  tickers,
  selectedTickerId,
  onSelectTicker,
  isLoading = false,
}: TickerListSidebarProps) {
  const getViewModeLabel = () => {
    switch (viewMode) {
      case 'active':
        return 'Active Recommendations';
      case 'watchlist':
        return 'Watchlist';
      case 'history':
        return 'History';
      default:
        return 'My Ideas';
    }
  };

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">
              {getViewModeLabel()}
            </span>
            <span className="text-xs text-muted-foreground">
              {tickers.length} {tickers.length === 1 ? 'ticker' : 'tickers'}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {isLoading ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                Loading tickers...
              </div>
            ) : tickers.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No tickers found
              </div>
            ) : (
              <SidebarMenu>
                {tickers.map((ticker) => {
                  const isSelected = selectedTickerId === ticker.id;
                  const returnValue = ticker.return ?? 0;
                  const isPositive = returnValue >= 0;
                  
                  return (
                    <SidebarMenuItem key={ticker.id}>
                      <SidebarMenuButton
                        onClick={() => onSelectTicker(ticker)}
                        isActive={isSelected}
                        className={cn(
                          'w-full justify-start h-auto py-3 px-3'
                        )}
                      >
                        <div className="flex flex-col gap-1.5 w-full">
                          {/* Ticker and Company Name */}
                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-semibold">
                                {ticker.ticker}
                              </span>
                              {ticker.companyName && (
                                <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                                  {ticker.companyName}
                                </span>
                              )}
                            </div>
                            <ChevronRight className={cn(
                              "w-4 h-4 text-muted-foreground transition-transform",
                              isSelected && "text-sidebar-accent-foreground"
                            )} />
                          </div>
                          
                          {/* Price and Return Info */}
                          <div className="flex items-center justify-between w-full text-xs">
                            <div className="flex items-center gap-2">
                              {ticker.action && (
                                <span className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                  ticker.action === 'BUY' 
                                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                                )}>
                                  {ticker.action}
                                </span>
                              )}
                              <span className="text-muted-foreground">
                                {ticker.ticker.includes('.NS') ? '₹' : '$'}{ticker.entryPrice?.toFixed(2) || 'N/A'}
                              </span>
                            </div>
                            {ticker.currentPrice !== undefined && ticker.return !== undefined && (
                              <div className={cn(
                                "flex items-center gap-1 font-medium",
                                isPositive ? "text-green-400" : "text-red-400"
                              )}>
                                {isPositive ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : (
                                  <TrendingDown className="w-3 h-3" />
                                )}
                                <span>
                                  {isPositive ? '+' : ''}{returnValue.toFixed(2)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

