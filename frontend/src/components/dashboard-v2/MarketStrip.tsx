/**
 * Market Strip Component
 * 
 * Horizontal scrolling strip of market tiles.
 * Features:
 * - Quick market overview
 * - Horizontal scroll on mobile
 * - Click to view details
 */

import React from 'react';
import { Card } from '../ui-v2/Card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';

interface MarketTile {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface MarketStripProps {
  tiles?: MarketTile[];
  loading?: boolean;
  onTileClick?: (tile: MarketTile) => void;
}

// Mock market data for now - can be replaced with real data
const MOCK_MARKET_TILES: MarketTile[] = [
  { symbol: '^NSEI', name: 'Nifty 50', price: 21500, change: 150, changePercent: 0.7 },
  { symbol: '^BSESN', name: 'Sensex', price: 71500, change: 500, changePercent: 0.7 },
  { symbol: 'RELIANCE.NS', name: 'Reliance', price: 2450, change: -25, changePercent: -1.0 },
  { symbol: 'TCS.NS', name: 'TCS', price: 3850, change: 50, changePercent: 1.3 },
];

export function MarketStrip({
  tiles = MOCK_MARKET_TILES,
  loading = false,
  onTileClick,
}: MarketStripProps) {
  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-shrink-0 w-32 h-24 bg-[var(--card-bg)] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
      {tiles.map((tile) => {
        const isPositive = tile.changePercent >= 0;

        return (
          <Card
            key={tile.symbol}
            variant="outlined"
            padding="md"
            hover
            onClick={() => onTileClick?.(tile)}
            className="flex-shrink-0 w-32 cursor-pointer"
          >
            <div className="space-y-2">
              <div>
                <div className="text-xs font-medium text-[var(--text-secondary)] truncate">
                  {tile.name}
                </div>
                <div className="text-xs text-[var(--text-tertiary)] font-mono">
                  {tile.symbol}
                </div>
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                  ₹{tile.price.toLocaleString()}
                </div>
                <div className={clsx(
                  'text-xs font-medium flex items-center gap-1',
                  isPositive ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span className="tabular-nums">
                    {isPositive ? '+' : ''}{tile.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

