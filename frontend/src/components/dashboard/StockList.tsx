/**
 * Stock List Component
 * 
 * Middle column showing list of stocks with prices and daily changes.
 * Matches the design from the reference image.
 */

import { Card } from '../ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StockItem {
  id: string;
  ticker: string;
  companyName: string;
  currentPrice: number;
  dailyChange: number;
  dailyChangePercent: number;
}

interface StockListProps {
  stocks: StockItem[];
  selectedTicker?: string;
  onSelectStock: (stock: StockItem) => void;
  isLoading?: boolean;
}

export function StockList({
  stocks,
  selectedTicker,
  onSelectStock,
  isLoading = false,
}: StockListProps) {
  if (isLoading) {
    return (
      <div className="w-80 border-r p-4 space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-3 bg-muted rounded w-1/2 mb-2" />
            <div className="h-6 bg-muted rounded w-1/3" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="w-80 border-r overflow-y-auto">
      <div className="p-4 space-y-3">
        {stocks.map((stock) => {
          const isSelected = selectedTicker === stock.ticker;
          const isPositive = stock.dailyChangePercent >= 0;

          return (
            <Card
              key={stock.id}
              className={cn(
                "p-4 cursor-pointer transition-all hover:shadow-md",
                isSelected && "border-primary shadow-md"
              )}
              onClick={() => onSelectStock(stock)}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">{stock.ticker}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {stock.companyName}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">
                    {stock.currentPrice.toFixed(2)}
                  </span>
                  <div className={cn(
                    "flex items-center gap-1 text-sm font-medium",
                    isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {isPositive ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span>
                      {isPositive ? '+' : ''}{stock.dailyChangePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

