/**
 * App Shell V2 Component
 * 
 * Main application shell with sidebar, top bar, and mobile navigation.
 * Features:
 * - Desktop: Sidebar + Top Bar layout
 * - Mobile: Bottom Nav + FAB Menu
 * - Responsive design
 * - Feature flag controlled
 */

import { Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useUser, useClerk } from '@clerk/clerk-react';
import { supabase } from '../../lib/supabase';
import { SidebarV2 } from './SidebarV2';
import { TopBarV2 } from './TopBarV2';
import { BottomNavV2 } from './BottomNavV2';
import { MobileMenuV2 } from './MobileMenuV2';
import { topBar, bottomNav } from '../../design-tokens';
import { getPrice } from '../../lib/api';
import { getCachedPrice, setCachedPrice, isPriceCacheValid, clearExpiredPrices } from '../../lib/priceCache';
import { safeWarn } from '../../lib/logger';
import { StockPanelProvider, useStockPanel } from '../../contexts/StockPanelContext';

function AppShellV2Content() {
  const { session, loading: authLoading } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const location = useLocation();
  const [organization, setOrganization] = useState<{ id: string; name: string; role: string } | null>(null);
  const [_loadingOrg, setLoadingOrg] = useState(true);
  
  // Stock panel state from context
  const {
    recommendations,
    setRecommendations,
    selectedTicker,
    setSelectedTicker,
    viewMode,
    setViewMode,
    refreshRecommendations: _refreshRecommendations,
    setRefreshCallback,
  } = useStockPanel();
  
  const isDashboardActive = location.pathname === '/';

  const fetchOrganization = useCallback(async () => {
    if (!user?.id) {
      setOrganization(null);
      setLoadingOrg(false);
      return;
    }

    try {
      setLoadingOrg(true);

      const { data: { session: supabaseSession } } = await supabase.auth.getSession();
      const supabaseUserId = supabaseSession?.user?.id;

      if (!supabaseUserId) {
        setTimeout(() => {
          if (user?.id) {
            fetchOrganization();
          }
        }, 1000);
        return;
      }

      const { data: mapping } = await supabase
        .from('clerk_user_mapping')
        .select('clerk_user_id')
        .eq('supabase_user_id', supabaseUserId)
        .maybeSingle();

      if (!mapping || mapping.clerk_user_id !== user.id) {
        setOrganization(null);
        setLoadingOrg(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_organization_membership')
        .select('organization_id, role, organizations(id, name)')
        .eq('user_id', supabaseUserId)
        .maybeSingle();

      if (!error && data) {
        const org = data.organizations as any;
        setOrganization({
          id: data.organization_id,
          name: org?.name || 'Unknown',
          role: data.role,
        });
      } else {
        setOrganization(null);
      }
    } catch (err) {
      setOrganization(null);
    } finally {
      setLoadingOrg(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      if (authSession?.user?.id && user?.id) {
        fetchOrganization();
      }
    });

    return () => subscription.unsubscribe();
  }, [user?.id, fetchOrganization]);

  useEffect(() => {
    if (user?.id && !authLoading && session?.user?.id) {
      fetchOrganization();
    } else if (!user?.id) {
      setOrganization(null);
      setLoadingOrg(false);
    }
  }, [user?.id, authLoading, session?.user?.id, fetchOrganization]);

  // Fetch recommendations (only when Dashboard is active)
  const fetchRecommendations = useCallback(async () => {
    if (!session?.user || !isDashboardActive) return [];
    try {
      const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', session.user.id)
        .order('entry_date', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      safeWarn('Could not fetch recommendations', err);
      return [];
    }
  }, [session?.user, isDashboardActive]);

  // Update prices for recommendations
  const updatePricesForRecommendations = useCallback(async (currentRecs: any[]) => {
    if (currentRecs.length === 0) return currentRecs;

    const uniqueTickers = Array.from(new Set(
      currentRecs.filter(r => r.status === 'OPEN' || r.status === 'WATCHLIST').map(r => r.ticker)
    ));

    // Apply cached prices first
    const cachedUpdates: Record<string, number> = {};
    for (const symbol of uniqueTickers) {
      const cachedPrice = getCachedPrice(symbol);
      if (cachedPrice !== null) {
        cachedUpdates[symbol] = cachedPrice;
      }
    }

    let updatedRecs = currentRecs.map(rec => {
      if (rec.ticker in cachedUpdates && (rec.status === 'OPEN' || rec.status === 'WATCHLIST')) {
        return {
          ...rec,
          current_price: cachedUpdates[rec.ticker],
          last_updated: new Date().toISOString()
        };
      }
      return rec;
    });

    // Fetch prices for expired/missing cache
    const tickersToFetch = uniqueTickers.filter(symbol => !isPriceCacheValid(symbol));

    const pricePromises = tickersToFetch.map(async (symbol) => {
      try {
        const priceData = await getPrice(symbol);
        return { symbol, price: priceData.price };
      } catch (e) {
        safeWarn(`Failed to update price for ${symbol}`, e);
        return null;
      }
    });

    const priceResults = await Promise.all(pricePromises);
    const finalUpdates: Record<string, number> = {};
    priceResults.forEach(result => {
      if (result) {
        setCachedPrice(result.symbol, result.price);
        finalUpdates[result.symbol] = result.price;
      }
    });

    if (Object.keys(finalUpdates).length > 0) {
      updatedRecs = updatedRecs.map(rec => {
        if (rec.ticker in finalUpdates && (rec.status === 'OPEN' || rec.status === 'WATCHLIST')) {
          return {
            ...rec,
            current_price: finalUpdates[rec.ticker],
            last_updated: new Date().toISOString()
          };
        }
        return rec;
      });
    }

    return updatedRecs;
  }, []);

  // Load recommendations when Dashboard becomes active
  useEffect(() => {
    if (isDashboardActive && session?.user) {
      clearExpiredPrices();
      const loadRecommendations = async () => {
        const recs = await fetchRecommendations();
        const recsWithPrices = await updatePricesForRecommendations(recs);
        setRecommendations(recsWithPrices);
        
        // Select first active stock, or first watchlist item, or first recommendation
        const activeStock = recsWithPrices.find((r: any) => r.status === 'OPEN');
        const watchlistStock = recsWithPrices.find((r: any) => r.status === 'WATCHLIST');
        const firstStock = recsWithPrices[0];
        
        const tickerToSelect = activeStock?.ticker || watchlistStock?.ticker || firstStock?.ticker;
        if (tickerToSelect && !selectedTicker) {
          setSelectedTicker(tickerToSelect);
        }
      };
      loadRecommendations();
    }
  }, [isDashboardActive, session?.user, fetchRecommendations, updatePricesForRecommendations, selectedTicker]);

  const handleRefresh = useCallback(async () => {
    if (!isDashboardActive) return;
    const recs = await fetchRecommendations();
    const recsWithPrices = await updatePricesForRecommendations(recs);
    setRecommendations(recsWithPrices);
  }, [isDashboardActive, fetchRecommendations, updatePricesForRecommendations, setRecommendations]);

  // Register refresh callback with context
  useEffect(() => {
    if (isDashboardActive) {
      setRefreshCallback(handleRefresh);
    }
  }, [isDashboardActive, handleRefresh, setRefreshCallback]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();

      const supabaseKeys = Object.keys(localStorage).filter(key =>
        key.includes('supabase') || key.includes('sb-') || key.startsWith('sb_')
      );
      supabaseKeys.forEach(key => localStorage.removeItem(key));

      const supabaseSessionKeys = Object.keys(sessionStorage).filter(key =>
        key.includes('supabase') || key.includes('sb-') || key.startsWith('sb_')
      );
      supabaseSessionKeys.forEach(key => sessionStorage.removeItem(key));

      setOrganization(null);
      setRecommendations([]);
      setSelectedTicker(null);
      await signOut();
    } catch (error) {
      await signOut();
    }
  };

  return (
    <div className="min-h-screen paper-theme-active bg-[var(--paper-bg)] flex flex-col">
      {/* Desktop Layout */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <SidebarV2
          organization={organization}
          onLogout={handleLogout}
          recommendations={isDashboardActive ? recommendations : []}
          selectedTicker={isDashboardActive ? selectedTicker : null}
          onSelectTicker={isDashboardActive ? setSelectedTicker : undefined}
          viewMode={viewMode}
          onViewModeChange={isDashboardActive ? setViewMode : undefined}
          onRefresh={isDashboardActive ? handleRefresh : undefined}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--paper-bg)]">
          {/* Top Bar */}
          <TopBarV2 organization={organization} onLogout={handleLogout} />

          {/* Page Content */}
          <main
            className="flex-1 overflow-y-auto bg-[var(--paper-bg)]"
            style={{ paddingTop: `${topBar.height}px` }}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden flex flex-col flex-1 bg-[var(--paper-bg)]">
        {/* Top Bar (Mobile) */}
        <TopBarV2 organization={organization} onLogout={handleLogout} />

        {/* Page Content */}
        <main
          className="flex-1 overflow-y-auto pb-20 bg-[var(--paper-bg)]"
          style={{
            paddingTop: `${topBar.mobileHeight}px`,
            paddingBottom: `calc(${bottomNav.mobileHeight}px + env(safe-area-inset-bottom))`,
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Outlet />
          </div>
        </main>

        {/* Bottom Navigation */}
        <BottomNavV2 />

        {/* FAB Menu */}
        <MobileMenuV2 organization={organization} />
      </div>
    </div>
  );
}

export function AppShellV2() {
  return (
    <StockPanelProvider>
      <AppShellV2Content />
    </StockPanelProvider>
  );
}

