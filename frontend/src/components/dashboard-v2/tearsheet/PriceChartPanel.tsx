/**
 * PriceChartPanel Component
 * 
 * Left column panel displaying:
 * - Ticker header with price and change
 * - Add to Watchlist button
 * - Range pills for time selection
 * - Price chart
 */

// import React from 'react';
// import { Plus } from 'lucide-react'; // Unused
import { PaperCard } from '../paper/PaperCard';
import { RangePills, type RangeOption } from '../paper/RangePills';
import { PaperChart } from '../../charts/PaperChart';
import clsx from 'clsx';

// Helper to determine currency symbol based on ticker
function getCurrencySymbol(ticker: string): string {
  if (ticker.includes('.NS') || ticker.includes('.BO')) {
    return '₹';
  }
  return '$';
}

function formatCurrency(value: number, ticker: string = ''): string {
  const symbol = getCurrencySymbol(ticker);
  return `${symbol}${value.toFixed(2)}`;
}

interface PriceChartPanelProps {
  ticker: string;
  companyName?: string;
  exchange?: string;
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  onAddToWatchlist?: () => void;
  chartData?: any[];
  range: RangeOption;
  onRangeChange: (range: RangeOption) => void;
  isLoading?: boolean;
}

export function PriceChartPanel({
  ticker,
  companyName,
  exchange,
  currentPrice,
  priceChange,
  priceChangePercent,
  onAddToWatchlist,
  chartData = [],
  range,
  onRangeChange,
  isLoading = false,
}: PriceChartPanelProps) {
  const isPositive = priceChange !== undefined && priceChange >= 0;
  const changeColor = isPositive ? 'text-[var(--pos-green)]' : 'text-[var(--neg-red)]';

  return (
    <PaperCard padding="lg" className="space-y-4">
      {/* Header Row */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-[var(--paper-ink)]">{ticker}</h1>
            {onAddToWatchlist && (
              <button
                onClick={onAddToWatchlist}
                className="text-xs text-[var(--paper-link)] hover:text-[var(--paper-link-hover)] underline"
              >
                + Add to Watchlist
              </button>
            )}
          </div>
          {companyName && (
            <p className="text-sm text-[var(--paper-muted)]">
              {companyName}
              {exchange && ` • ${exchange}`}
            </p>
          )}
        </div>
        <div className="text-right">
          {currentPrice !== undefined && (
            <div className="text-2xl font-bold text-[var(--paper-ink)] mb-1">
              {formatCurrency(currentPrice, ticker)}
            </div>
          )}
          {priceChange !== undefined && priceChangePercent !== undefined && (
            <div className={clsx('text-sm font-medium', changeColor)}>
              {isPositive ? '+' : ''}
              {formatCurrency(priceChange, ticker)} ({isPositive ? '+' : ''}
              {priceChangePercent.toFixed(2)}%)
            </div>
          )}
        </div>
      </div>

      {/* Range Pills */}
      <RangePills value={range} onChange={onRangeChange} />

      {/* Chart Area */}
      <div className="h-[400px] -mx-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-[var(--paper-muted)] text-sm">
            Loading chart...
          </div>
        ) : chartData && chartData.length > 0 ? (
          <PaperChart
            chartId={1}
            stockTicker={ticker}
            height={400}
            technicalType="line"
            externalData={chartData}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--paper-muted)] text-sm">
            No chart data available
          </div>
        )}
      </div>
    </PaperCard>
  );
}

