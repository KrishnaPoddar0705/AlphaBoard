/**
 * Stock Panel Drawer Component
 * 
 * Mobile drawer wrapper for EnhancedStockPanel.
 * Slides in from the left side on mobile devices.
 */

import { Drawer } from '../ui-v2/Drawer';
import { EnhancedStockPanel } from './EnhancedStockPanel';

interface StockPanelDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations: any[];
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
  viewMode: 'active' | 'watchlist' | 'history';
  onViewModeChange: (mode: 'active' | 'watchlist' | 'history') => void;
  onRefresh: () => void;
}

export function StockPanelDrawer({
  isOpen,
  onClose,
  recommendations,
  selectedTicker,
  onSelectTicker,
  viewMode,
  onViewModeChange,
  onRefresh,
}: StockPanelDrawerProps) {
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="My Stocks"
      side="left"
      size="lg"
      className="bg-[var(--paper-bg)] border-[var(--paper-border)] text-[var(--paper-ink)]"
    >
      <div className="h-full">
        <EnhancedStockPanel
          recommendations={recommendations}
          selectedTicker={selectedTicker}
          onSelectTicker={onSelectTicker}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          onRefresh={onRefresh}
          className="h-full border-0 rounded-none"
        />
      </div>
    </Drawer>
  );
}

