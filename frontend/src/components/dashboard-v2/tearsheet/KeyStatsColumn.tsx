/**
 * KeyStatsColumn Component
 * 
 * Middle column displaying vertical list of key financial statistics.
 */

// import React from 'react';
import { PaperCard } from '../paper/PaperCard';
import { StatList } from '../paper/StatList';
import { StatRow } from '../paper/StatRow';

interface KeyStats {
  marketCap?: string | number;
  high52W?: number;
  low52W?: number;
  dividendYield?: number;
  pe?: number;
  volume?: number | string;
  outstandingShares?: number | string;
}

interface KeyStatsColumnProps {
  stats: KeyStats;
  ticker?: string;
  className?: string;
}

// Helper to determine currency symbol based on ticker
function getCurrencySymbol(ticker?: string): string {
  if (!ticker) return '$';
  if (ticker.includes('.NS') || ticker.includes('.BO')) {
    return '₹';
  }
  return '$';
}

function formatNumber(value: number | string | undefined, currencySymbol: string = '$'): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'string') return value;
  
  if (value >= 1e9) {
    return `${currencySymbol}${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `${currencySymbol}${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `${currencySymbol}${(value / 1e3).toFixed(2)}K`;
  }
  return `${currencySymbol}${value.toFixed(2)}`;
}

function formatPercent(value: number | undefined): string {
  if (value === undefined || value === null) return '—';
  return `${value.toFixed(2)}%`;
}

export function KeyStatsColumn({ stats, ticker, className = '' }: KeyStatsColumnProps) {
  const currencySymbol = getCurrencySymbol(ticker);
  return (
    <PaperCard padding="md" className={className}>
      <StatList>
        <StatRow
          label="Market Cap"
          value={typeof stats.marketCap === 'string' ? stats.marketCap : formatNumber(stats.marketCap, currencySymbol)}
        />
        <StatRow
          label="52W High"
          value={stats.high52W !== undefined ? `${currencySymbol}${stats.high52W.toFixed(2)}` : '—'}
        />
        <StatRow
          label="52W Low"
          value={stats.low52W !== undefined ? `${currencySymbol}${stats.low52W.toFixed(2)}` : '—'}
        />
        <StatRow
          label="Dividend Yield"
          value={formatPercent(stats.dividendYield)}
        />
        <StatRow
          label="P/E"
          value={stats.pe !== undefined ? stats.pe.toFixed(2) : '—'}
        />
        <StatRow
          label="Volume"
          value={typeof stats.volume === 'string' ? stats.volume : formatNumber(stats.volume, currencySymbol)}
        />
        <StatRow
          label="Outstanding Shares"
          value={typeof stats.outstandingShares === 'string' ? stats.outstandingShares : formatNumber(stats.outstandingShares, currencySymbol)}
          showDivider={false}
        />
      </StatList>
    </PaperCard>
  );
}

