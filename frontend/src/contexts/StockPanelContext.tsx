/**
 * Stock Panel Context
 * 
 * Shares stock panel state between AppShellV2 and DashboardV2.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';

interface StockPanelContextType {
  recommendations: any[];
  setRecommendations: (recs: any[]) => void;
  selectedTicker: string | null;
  setSelectedTicker: (ticker: string | null) => void;
  viewMode: 'active' | 'watchlist' | 'history';
  setViewMode: (mode: 'active' | 'watchlist' | 'history') => void;
  refreshRecommendations: () => Promise<void>;
  setRefreshCallback: (callback: () => Promise<void>) => void;
}

const StockPanelContext = createContext<StockPanelContextType | undefined>(undefined);

export function StockPanelProvider({ children }: { children: ReactNode }) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'active' | 'watchlist' | 'history'>('active');
  const [refreshCallback, setRefreshCallback] = useState<(() => Promise<void>) | null>(null);

  const refreshRecommendations = async () => {
    if (refreshCallback) {
      await refreshCallback();
    }
  };

  return (
    <StockPanelContext.Provider
      value={{
        recommendations,
        setRecommendations,
        selectedTicker,
        setSelectedTicker,
        viewMode,
        setViewMode,
        refreshRecommendations,
        setRefreshCallback,
      }}
    >
      {children}
    </StockPanelContext.Provider>
  );
}

export function useStockPanel() {
  const context = useContext(StockPanelContext);
  if (context === undefined) {
    throw new Error('useStockPanel must be used within a StockPanelProvider');
  }
  return context;
}

