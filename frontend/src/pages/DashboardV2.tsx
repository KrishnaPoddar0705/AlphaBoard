/**
 * Dashboard V2 Page - Paper Theme Tear Sheet
 * 
 * Duolingo-style financial tear sheet with warm paper background.
 * Features:
 * - Price chart panel with range selector
 * - Key stats column
 * - Company about panel
 * - Income statement table
 * - Balance sheet table
 * - Company details card
 * 
 * All functionality preserved from DashboardNew, only presentation changed.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
  getStockSummary,
  getStockHistory,
  getIncomeStatement,
  getBalanceSheet,
  getQuarterly,
  getPrice,
} from '../lib/api';
import { safeLog, safeWarn, safeError } from '../lib/logger';
import { getCachedPrice, setCachedPrice, isPriceCacheValid, clearExpiredPrices } from '../lib/priceCache';

// Tear Sheet Components
import { PriceChartPanel } from '../components/dashboard-v2/tearsheet/PriceChartPanel';
import { KeyStatsColumn } from '../components/dashboard-v2/tearsheet/KeyStatsColumn';
import { AboutPanel } from '../components/dashboard-v2/tearsheet/AboutPanel';
import { IncomeStatementBlock } from '../components/dashboard-v2/tearsheet/IncomeStatementBlock';
import { BalanceStatementBlock } from '../components/dashboard-v2/tearsheet/BalanceStatementBlock';
import { CompanyDetailsCard } from '../components/dashboard-v2/tearsheet/CompanyDetailsCard';
import { RangePills, type RangeOption } from '../components/dashboard-v2/paper/RangePills';
import { StockPanelSlideOut } from '../components/dashboard-v2/StockPanelSlideOut';
import { useUIV2 } from '../hooks/useFeatureFlag';
import { useStockPanel } from '../contexts/StockPanelContext';
import { List } from 'lucide-react';

export default function DashboardV2() {
  const { session } = useAuth();
  const [uiV2Enabled] = useUIV2();

  // Stock panel state from context
  const {
    recommendations,
    selectedTicker,
    setSelectedTicker,
    viewMode,
    setViewMode,
    refreshRecommendations,
  } = useStockPanel();

  // Stock panel slide-out state - auto-open when Dashboard loads
  const [isStockPanelOpen, setIsStockPanelOpen] = useState(true);

  // Stock data state
  const [stockSummary, setStockSummary] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [incomeStatement, setIncomeStatement] = useState<any[]>([]);
  const [balanceSheet, setBalanceSheet] = useState<any[]>([]);
  const [quarterlyData, setQuarterlyData] = useState<any[]>([]);

  // UI state
  const [range, setRange] = useState<RangeOption>('1M');
  const [incomePeriod, setIncomePeriod] = useState<'quarterly' | 'annually'>('quarterly');
  const [balancePeriod, setBalancePeriod] = useState<'quarterly' | 'annually'>('quarterly');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [isLoadingFinancials, setIsLoadingFinancials] = useState(false);

  // Note: Recommendations are now managed by AppShellV2 via context

  // Apply paper theme to body when UI_V2 is enabled
  useEffect(() => {
    if (uiV2Enabled) {
      document.body.classList.add('paper-theme-active');
      return () => {
        document.body.classList.remove('paper-theme-active');
      };
    }
  }, [uiV2Enabled]);

  // Note: Recommendations and price updates are now managed by AppShellV2

  // Fetch stock summary
  useEffect(() => {
    if (!selectedTicker) return;

    const fetchSummary = async () => {
      setIsLoading(true);
      try {
        const summary = await getStockSummary(selectedTicker);
        setStockSummary(summary);
      } catch (err) {
        safeError('Failed to fetch stock summary', err);
        setStockSummary(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [selectedTicker]);

  // Fetch chart data
  useEffect(() => {
    if (!selectedTicker) return;

    const fetchChart = async () => {
      setIsLoadingChart(true);
      try {
        const history = await getStockHistory(selectedTicker);
        // Transform to chart format if needed
        if (Array.isArray(history)) {
          setChartData(history);
        } else if (history?.data) {
          setChartData(history.data);
        } else {
          setChartData([]);
        }
      } catch (err) {
        safeWarn('Failed to fetch chart data', err);
        setChartData([]);
      } finally {
        setIsLoadingChart(false);
      }
    };

    fetchChart();
  }, [selectedTicker, range]);

  // Fetch financials
  useEffect(() => {
    if (!selectedTicker) return;

    const fetchFinancials = async () => {
      setIsLoadingFinancials(true);
      try {
        const [income, balance, quarterly] = await Promise.all([
          getIncomeStatement(selectedTicker).catch(() => []),
          getBalanceSheet(selectedTicker).catch(() => []),
          getQuarterly(selectedTicker).catch(() => []),
        ]);

        // Transform income statement data
        if (Array.isArray(income)) {
          const transformed = income.map((item: any) => ({
            period: item.period || item.year || item.date || 'N/A',
            revenue: item.revenue || item.totalRevenue,
            operatingExpense: item.operatingExpense || item.totalOperatingExpenses,
            netIncome: item.netIncome || item.netProfit,
            netProfitMargin: item.netProfitMargin || (item.netIncome && item.revenue ? (item.netIncome / item.revenue) * 100 : undefined),
            eps: item.eps || item.earningsPerShare,
            ebitda: item.ebitda || item.ebitdaValue,
          }));
          setIncomeStatement(transformed);
        } else {
          setIncomeStatement([]);
        }

        // Transform balance sheet data
        if (Array.isArray(balance)) {
          const transformed = balance.map((item: any) => ({
            period: item.period || item.year || item.date || 'N/A',
            cashAndShortTerm: item.cashAndShortTerm || item.cash || item.cashAndCashEquivalents,
            totalAssets: item.totalAssets || item.assets,
            totalLiabilities: item.totalLiabilities || item.liabilities,
            totalEquity: item.totalEquity || item.equity,
          }));
          setBalanceSheet(transformed);
        } else {
          setBalanceSheet([]);
        }

        // Store quarterly data
        if (Array.isArray(quarterly)) {
          setQuarterlyData(quarterly);
        }
      } catch (err) {
        safeError('Failed to fetch financials', err);
        setIncomeStatement([]);
        setBalanceSheet([]);
      } finally {
        setIsLoadingFinancials(false);
      }
    };

    fetchFinancials();
  }, [selectedTicker]);

  // Handle add to watchlist
  const handleAddToWatchlist = useCallback(async () => {
    if (!selectedTicker || !session?.user) return;

    try {
      const { error } = await supabase.from('recommendations').insert({
        user_id: session.user.id,
        ticker: selectedTicker,
        action: 'WATCH',
        status: 'WATCHLIST',
        entry_date: new Date().toISOString(),
      });

      if (error) throw error;
      
      // Refresh recommendations via context
      await refreshRecommendations();
    } catch (err) {
      safeError('Failed to add to watchlist', err);
    }
  }, [selectedTicker, session?.user, refreshRecommendations]);

  // Handle close idea (SELL/BUY position)
  const handleCloseIdea = useCallback(async (rec: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Close position in ${rec.ticker}?`)) return;

    const exitPrice = rec.current_price || rec.entry_price;
    const ret = rec.entry_price > 0
      ? ((exitPrice - rec.entry_price) / rec.entry_price * 100) * (rec.action === 'SELL' ? -1 : 1)
      : 0;

    try {
      await supabase
        .from('recommendations')
        .update({
          status: 'CLOSED',
          exit_price: exitPrice,
          exit_date: new Date().toISOString(),
          final_return_pct: ret,
        })
        .eq('id', rec.id);

      await refreshRecommendations();
    } catch (err) {
      safeError('Failed to close idea', err);
    }
  }, [refreshRecommendations]);

  // Handle promote watchlist (convert to BUY/SELL)
  const handlePromoteWatchlist = useCallback(async (rec: any, actionType: 'BUY' | 'SELL', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session?.user) return;

    try {
      const entryPrice = rec.current_price || 0;
      await supabase
        .from('recommendations')
        .update({
          status: 'OPEN',
          action: actionType,
          entry_price: entryPrice,
          entry_date: new Date().toISOString(),
        })
        .eq('id', rec.id);

      await refreshRecommendations();
    } catch (err) {
      safeError('Failed to promote watchlist', err);
    }
  }, [session?.user, refreshRecommendations]);

  // Company names state
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});

  // Fetch company names for displayed recommendations
  useEffect(() => {
    const fetchCompanyNames = async () => {
      const displayedRecs = recommendations.filter(rec => {
        if (viewMode === 'active') return rec.status === 'OPEN';
        if (viewMode === 'watchlist') return rec.status === 'WATCHLIST';
        if (viewMode === 'history') return rec.status === 'CLOSED';
        return false;
      });

      const tickersToFetch = displayedRecs
        .map(rec => rec.ticker)
        .filter(ticker => !companyNames[ticker]);

      if (tickersToFetch.length === 0) return;

      const namePromises = tickersToFetch.map(async (ticker) => {
        try {
          const summary = await getStockSummary(ticker);
          return { ticker, name: summary?.companyName || null };
        } catch (error) {
          safeWarn(`Failed to fetch company name for ${ticker}:`, error);
          return { ticker, name: null };
        }
      });

      const results = await Promise.all(namePromises);
      const newNames: Record<string, string> = {};

      results.forEach(({ ticker, name }) => {
        if (name) {
          newNames[ticker] = name;
        }
      });

      if (Object.keys(newNames).length > 0) {
        setCompanyNames(prev => ({ ...prev, ...newNames }));
      }
    };

    if (recommendations.length > 0) {
      fetchCompanyNames();
    }
  }, [recommendations, viewMode, companyNames]);

  const handleNewIdea = useCallback(() => {
    // This would open a modal - for now just log
    console.log('New idea clicked');
  }, []);(async (rec: any, actionType: 'BUY' | 'SELL', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session?.user) return;

    const entryPrice = rec.current_price || 0;
    
    try {
      // Update the watchlist item to become an active recommendation
      await supabase
        .from('recommendations')
        .update({
          action: actionType,
          status: 'OPEN',
          entry_price: entryPrice,
          entry_date: new Date().toISOString(),
        })
        .eq('id', rec.id);

      await refreshRecommendations();
    } catch (err) {
      safeError('Failed to promote watchlist', err);
    }
  }, [session?.user, refreshRecommendations]);

  // Calculate price change
  const priceChange = stockSummary?.currentPrice && stockSummary?.previousClose
    ? stockSummary.currentPrice - stockSummary.previousClose
    : undefined;
  const priceChangePercent = stockSummary?.currentPrice && stockSummary?.previousClose
    ? ((priceChange! / stockSummary.previousClose) * 100)
    : undefined;

  // Map stock summary to key stats
  const keyStats = {
    marketCap: stockSummary?.marketCap,
    high52W: stockSummary?.fiftyTwoWeekHigh,
    low52W: stockSummary?.fiftyTwoWeekLow,
    dividendYield: stockSummary?.dividendYield,
    pe: stockSummary?.pe,
    volume: stockSummary?.volume,
    outstandingShares: stockSummary?.sharesOutstanding,
  };

  // Company details
  const companyDetails = {
    ceo: stockSummary?.ceo,
    industry: stockSummary?.industry,
    sector: stockSummary?.sector,
    ipoDate: stockSummary?.ipoDate,
    employees: stockSummary?.fullTimeEmployees,
  };

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center paper-theme">
        <p className="text-[var(--paper-ink)]">Please log in</p>
      </div>
    );
  }

  // If no stock selected, show empty state
  if (!selectedTicker) {
    return (
      <div className="min-h-screen paper-theme p-8">
        <div className="max-w-4xl mx-auto text-center py-16">
          <h1 className="text-2xl font-bold text-[var(--paper-ink)] mb-4">
            No Stock Selected
          </h1>
          <p className="text-[var(--paper-muted)] mb-6">
            Add a stock to your portfolio or watchlist to view its tear sheet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen paper-theme-active p-4 md:p-6 lg:p-8">
      {/* Button to open stock panel */}
      <div className="mb-4">
        <button
          onClick={() => setIsStockPanelOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--paper-ink)] text-[var(--paper-bg)] rounded-lg hover:opacity-90 transition-opacity"
          style={{ borderRadius: 'var(--paper-radius-lg)' }}
        >
          <List className="w-5 h-5" />
          <span className="font-medium">My Stocks</span>
        </button>
      </div>

      <div className="max-w-[1600px] mx-auto">
        {/* Main Content: Tear Sheet (Full Width) */}
        <div className="space-y-6">
            {/* Top Section: 3-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
              {/* Price Chart Panel - Left (50%) */}
              <div className="lg:col-span-7">
                <PriceChartPanel
                  ticker={selectedTicker}
                  companyName={stockSummary?.companyName}
                  exchange={stockSummary?.exchange}
                  currentPrice={stockSummary?.currentPrice}
                  priceChange={priceChange}
                  priceChangePercent={priceChangePercent}
                  onAddToWatchlist={handleAddToWatchlist}
                  chartData={chartData}
                  range={range}
                  onRangeChange={setRange}
                  isLoading={isLoadingChart}
                />
              </div>

              {/* Key Stats Column - Middle (25%) */}
              <div className="lg:col-span-5">
                <KeyStatsColumn stats={keyStats} ticker={selectedTicker || undefined} />
              </div>
      </div>

            {/* Second Row: About Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
              <div className="lg:col-span-12">
                <AboutPanel
                  companyName={stockSummary?.companyName || selectedTicker}
                  website={stockSummary?.website}
                  description={stockSummary?.description || stockSummary?.longDescription}
                />
              </div>
            </div>

            {/* Third Section: Income Statement + Company Details */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
              {/* Income Statement - Left (60%) */}
              <div className="lg:col-span-7">
                <IncomeStatementBlock
                  data={incomePeriod === 'quarterly' && quarterlyData.length > 0
                    ? quarterlyData.map((q: any) => ({
                        period: q.period || q.date || 'N/A',
                        revenue: q.revenue,
                        operatingExpense: q.operatingExpense,
                        netIncome: q.netIncome,
                        netProfitMargin: q.netProfitMargin,
                        eps: q.eps,
                        ebitda: q.ebitda,
                      }))
                    : incomeStatement}
                  period={incomePeriod}
                  onPeriodChange={setIncomePeriod}
                  ticker={selectedTicker || undefined}
                  isLoading={isLoadingFinancials}
                />
              </div>

              {/* Company Details Card - Right (40%) */}
              <div className="lg:col-span-5">
                <CompanyDetailsCard details={companyDetails} />
              </div>
      </div>

            {/* Fourth Section: Balance Statement */}
            <div className="grid grid-cols-1">
              <BalanceStatementBlock
                data={balancePeriod === 'quarterly' && quarterlyData.length > 0
                  ? quarterlyData.map((q: any) => ({
                      period: q.period || q.date || 'N/A',
                      cashAndShortTerm: q.cash,
                      totalAssets: q.totalAssets,
                      totalLiabilities: q.totalLiabilities,
                      totalEquity: q.totalEquity,
                    }))
                  : balanceSheet}
                period={balancePeriod}
                onPeriodChange={setBalancePeriod}
                ticker={selectedTicker || undefined}
                isLoading={isLoadingFinancials}
              />
            </div>
        </div>
      </div>

      {/* Stock Panel Slide-Out */}
      <StockPanelSlideOut
        isOpen={isStockPanelOpen}
        onClose={() => setIsStockPanelOpen(false)}
        recommendations={recommendations}
        selectedTicker={selectedTicker}
        onSelectTicker={(ticker) => {
          setSelectedTicker(ticker);
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={refreshRecommendations}
        onCloseIdea={handleCloseIdea}
        onPromoteWatchlist={handlePromoteWatchlist}
        companyNames={companyNames}
        sidebarWidth={256}
      />
    </div>
  );
}
