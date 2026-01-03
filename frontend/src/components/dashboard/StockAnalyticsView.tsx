/**
 * Stock Analytics View Component
 * 
 * Central column showing stock analytics matching the reference image:
 * - Header with ticker, timestamp, and "Add to Watchlist" button
 * - 4 Key Metrics Cards (Current Price, Volume, Market Cap, Analyst Rating)
 * - Price Chart with timeframe selectors
 * - Key Financials table
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { getStockSummary, getStockHistory } from '../../lib/api';
import { ChartsSection } from '../stock/ChartsSection';
import { cn } from '@/lib/utils';

interface StockAnalyticsViewProps {
  stock: any;
  onAddToWatchlist?: () => void;
}

export function StockAnalyticsView({ stock, onAddToWatchlist }: StockAnalyticsViewProps) {
  const [summary, setSummary] = useState<any>(null);
  const [priceData, setPriceData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('1M');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
      if (!stock?.ticker) return;
      setLoading(true);
      try {
        const [summaryData, historyData] = await Promise.all([
          getStockSummary(stock.ticker),
          getStockHistory(stock.ticker),
        ]);
        setSummary(summaryData);
        setPriceData(historyData);
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Error fetching stock data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stock?.ticker]);

  const currentPrice = stock.current_price || summary?.currentPrice || stock.entry_price || 0;
  const priceChange = summary?.priceChange || 0;
  const priceChangePercent = summary?.priceChangePercent || ((currentPrice - stock.entry_price) / stock.entry_price) * 100;
  const isPositive = priceChangePercent >= 0;
  const currencySymbol = stock.ticker?.includes('.NS') ? '₹' : '$';

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }) + ' EST';
  };

  const formatMarketCap = (value?: number) => {
    if (!value) return 'N/A';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toFixed(2)}`;
  };

  const formatVolume = (value?: number) => {
    if (!value) return 'N/A';
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    return value.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          <div className="h-16 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-32 bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      {/* Header */}
      <div className="border-b p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            {stock.ticker} Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {formatTime(lastUpdated)}
          </p>
        </div>
        <Button onClick={onAddToWatchlist} variant="default" className="gap-2">
          <Plus className="w-4 h-4" />
          Add to Watchlist
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-4 gap-4">
          {/* Current Price Card */}
          <Card className="py-4">
            <CardHeader className="pb-3 px-6">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                Current Price
                {isPositive ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600" />
                )}
                <span className={cn(
                  "text-xs",
                  isPositive ? "text-green-600" : "text-red-600"
                )}>
                  {isPositive ? '+' : ''}{priceChangePercent.toFixed(2)}%
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6">
              <div className="text-2xl font-bold mb-2">
                {currencySymbol}{currentPrice.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                High: {currencySymbol}{summary?.high?.toFixed(2) || 'N/A'} | Low: {currencySymbol}{summary?.low?.toFixed(2) || 'N/A'}
              </div>
            </CardContent>
          </Card>

          {/* Volume Card */}
          <Card className="py-4">
            <CardHeader className="pb-3 px-6">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                Volume
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-xs text-red-600">-5.1%</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6">
              <div className="text-2xl font-bold mb-2">
                {formatVolume(summary?.volume)}
              </div>
              <div className="text-xs text-muted-foreground">
                Avg. 3-mo: {formatVolume(summary?.avgVolume)}
              </div>
            </CardContent>
          </Card>

          {/* Market Cap Card */}
          <Card className="py-4">
            <CardHeader className="pb-3 px-6">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Market Cap
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6">
              <div className="text-2xl font-bold mb-2">
                {formatMarketCap(summary?.marketCap)}
              </div>
              <div className="text-xs text-muted-foreground">
                P/E Ratio: {summary?.pe?.toFixed(1) || 'N/A'}x
              </div>
            </CardContent>
          </Card>

          {/* Analyst Rating Card */}
          <Card className="py-4">
            <CardHeader className="pb-3 px-6">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Analyst Rating
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6">
              <div className="text-2xl font-bold mb-2">
                <Badge variant="default" className="text-base px-3 py-1">
                  {stock.action || 'BUY'}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Target Price: {currencySymbol}{stock.price_target || summary?.targetPrice || 'N/A'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Price Chart Section */}
        <Card className="py-6">
          <CardHeader className="px-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">
                  {stock.ticker} Price Chart
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Past 1 Month Performance
                </p>
              </div>
              <Tabs value={timeframe} onValueChange={setTimeframe}>
                <TabsList>
                  <TabsTrigger value="1D">1D</TabsTrigger>
                  <TabsTrigger value="1W">1W</TabsTrigger>
                  <TabsTrigger value="1M">1M</TabsTrigger>
                  <TabsTrigger value="1Y">1Y</TabsTrigger>
                  <TabsTrigger value="ALL">ALL</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="px-6">
            <ChartsSection
              stockTicker={stock.ticker}
              externalData={priceData}
              isLoading={loading}
            />
          </CardContent>
        </Card>

        {/* Key Financials Section */}
        <Card className="py-6">
          <CardHeader className="px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Key Financials</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">METRIC</th>
                    <th className="text-right py-2 font-medium">VALUE</th>
                    <th className="text-right py-2 font-medium">YOY CHANGE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-3">Revenue (TTM)</td>
                    <td className="text-right font-semibold">
                      {formatMarketCap(summary?.revenue)}
                    </td>
                    <td className={cn(
                      "text-right",
                      summary?.revenueGrowth && summary.revenueGrowth > 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {summary?.revenueGrowth ? `+${summary.revenueGrowth.toFixed(1)}%` : 'N/A'}
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-3">Net Income (TTM)</td>
                    <td className="text-right font-semibold">
                      {formatMarketCap(summary?.netIncome)}
                    </td>
                    <td className={cn(
                      "text-right",
                      summary?.netIncomeGrowth && summary.netIncomeGrowth > 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {summary?.netIncomeGrowth ? `+${summary.netIncomeGrowth.toFixed(1)}%` : 'N/A'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

