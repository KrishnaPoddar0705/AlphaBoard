/**
 * Collapsible Stock Panel Component
 * 
 * Wrapper around EnhancedStockPanel with collapse/expand functionality.
 * Used in desktop sidebar view.
 */

import { ChevronUp, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { EnhancedStockPanel } from './EnhancedStockPanel';

interface CollapsibleStockPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  recommendations: any[];
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
  viewMode: 'active' | 'watchlist' | 'history';
  onViewModeChange: (mode: 'active' | 'watchlist' | 'history') => void;
  onRefresh: () => void;
}

export function CollapsibleStockPanel({
  isOpen,
  onToggle,
  recommendations,
  selectedTicker,
  onSelectTicker,
  viewMode,
  onViewModeChange,
  onRefresh,
}: CollapsibleStockPanelProps) {
  return (
    <div className="border-t border-[var(--paper-border)]">
      {/* Toggle Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--paper-bg)] transition-colors text-left"
      >
        <span className="text-xs font-semibold text-[var(--paper-muted)] uppercase tracking-wider">
          My Stocks
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-[var(--paper-muted)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--paper-muted)]" />
        )}
      </button>

      {/* Collapsible Content */}
      <div
        className={clsx(
          'overflow-hidden transition-all duration-300 ease-in-out',
          isOpen ? 'max-h-[calc(100vh-300px)] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        {isOpen && (
          <div className="px-2 pb-2">
            <EnhancedStockPanel
              recommendations={recommendations}
              selectedTicker={selectedTicker}
              onSelectTicker={onSelectTicker}
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              onRefresh={onRefresh}
              className="h-full border-0 rounded-none bg-transparent"
            />
          </div>
        )}
      </div>
    </div>
  );
}

