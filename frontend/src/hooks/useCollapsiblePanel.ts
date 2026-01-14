/**
 * Collapsible Panel Hook
 * 
 * Manages collapse state with localStorage persistence.
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'alphaboard_stock_panel_collapsed';

export function useCollapsiblePanel(defaultCollapsed: boolean = false) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        return stored === 'true';
      }
    }
    return defaultCollapsed;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, isCollapsed.toString());
  }, [isCollapsed]);

  const toggleCollapse = () => {
    setIsCollapsed(prev => !prev);
  };

  const setCollapsed = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
  };

  return {
    isCollapsed,
    toggleCollapse,
    setCollapsed,
  };
}



