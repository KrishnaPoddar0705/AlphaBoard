/**
 * IncomeStatementBlock Component
 * 
 * Income statement table with Quarterly/Annually toggle and mini chart.
 */

// import React from 'react';
import { PaperCard } from '../paper/PaperCard';
import { SectionHeader } from '../paper/SectionHeader';
// import { HairlineDivider } from '../paper/HairlineDivider'; // Unused
import clsx from 'clsx';

interface IncomeStatementItem {
  period: string;
  revenue?: number;
  operatingExpense?: number;
  netIncome?: number;
  netProfitMargin?: number;
  eps?: number;
  ebitda?: number;
}

interface IncomeStatementBlockProps {
  data: IncomeStatementItem[];
  period: 'quarterly' | 'annually';
  onPeriodChange: (period: 'quarterly' | 'annually') => void;
  ticker?: string;
  isLoading?: boolean;
}

function formatCurrency(value: number | undefined, ticker?: string): string {
  if (value === undefined || value === null) return '—';
  const symbol = ticker && (ticker.includes('.NS') || ticker.includes('.BO')) ? '₹' : '$';
  if (value >= 1e9) {
    return `${symbol}${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `${symbol}${(value / 1e6).toFixed(2)}M`;
  }
  return `${symbol}${value.toFixed(2)}`;
}

function formatPercent(value: number | undefined): string {
  if (value === undefined || value === null) return '—';
  return `${value.toFixed(2)}%`;
}

export function IncomeStatementBlock({
  data,
  period,
  onPeriodChange,
  ticker,
  isLoading = false,
}: IncomeStatementBlockProps) {
  if (isLoading) {
    return (
      <PaperCard padding="lg">
        <div className="flex items-center justify-center h-64 text-[var(--paper-muted)] text-sm">
          Loading...
        </div>
      </PaperCard>
    );
  }

  if (!data || data.length === 0) {
    return (
      <PaperCard padding="lg">
        <SectionHeader
          title="Income Statement"
          toggleOptions={[
            { label: 'Quarterly', value: 'quarterly' },
            { label: 'Annually', value: 'annually' },
          ]}
          toggleValue={period}
          onToggleChange={(value) => onPeriodChange(value as 'quarterly' | 'annually')}
        />
        <div className="py-8 text-center">
          <p className="text-sm text-[var(--paper-muted)] mb-2">
            No income statement data available
          </p>
          <button className="text-xs text-[var(--paper-link)] hover:underline">
            Connect fundamentals data
          </button>
        </div>
      </PaperCard>
    );
  }

  return (
    <PaperCard padding="lg">
      <SectionHeader
        title="Income Statement"
        toggleOptions={[
          { label: 'Quarterly', value: 'quarterly' },
          { label: 'Annually', value: 'annually' },
        ]}
        toggleValue={period}
        onToggleChange={(value) => onPeriodChange(value as 'quarterly' | 'annually')}
      />

      {/* Table */}
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--paper-rule)]">
              <th className="py-2 px-3 text-left text-xs uppercase tracking-wide text-[var(--paper-muted)] font-medium">
                Period
              </th>
              <th className="py-2 px-3 text-right text-xs uppercase tracking-wide text-[var(--paper-muted)] font-medium">
                Revenue
              </th>
              <th className="py-2 px-3 text-right text-xs uppercase tracking-wide text-[var(--paper-muted)] font-medium">
                OpEx
              </th>
              <th className="py-2 px-3 text-right text-xs uppercase tracking-wide text-[var(--paper-muted)] font-medium">
                Net Income
              </th>
              <th className="py-2 px-3 text-right text-xs uppercase tracking-wide text-[var(--paper-muted)] font-medium">
                Margin
              </th>
              <th className="py-2 px-3 text-right text-xs uppercase tracking-wide text-[var(--paper-muted)] font-medium">
                EPS
              </th>
              <th className="py-2 px-3 text-right text-xs uppercase tracking-wide text-[var(--paper-muted)] font-medium">
                EBITDA
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => {
              const isPositive = item.netIncome !== undefined && item.netIncome >= 0;
              const marginColor = item.netProfitMargin !== undefined && item.netProfitMargin >= 0
                ? 'text-[var(--pos-green)]'
                : 'text-[var(--neg-red)]';
              
              return (
                <tr key={index} className="border-b border-[var(--paper-rule-light)]">
                  <td className="py-2 px-3 text-[var(--paper-ink)] font-medium">
                    {item.period}
                  </td>
                  <td className="py-2 px-3 text-right text-[var(--paper-ink)]">
                    {formatCurrency(item.revenue, ticker)}
                  </td>
                  <td className="py-2 px-3 text-right text-[var(--paper-ink)]">
                    {formatCurrency(item.operatingExpense, ticker)}
                  </td>
                  <td className={clsx('py-2 px-3 text-right', isPositive ? 'text-[var(--pos-green)]' : 'text-[var(--neg-red)]')}>
                    {formatCurrency(item.netIncome, ticker)}
                  </td>
                  <td className={clsx('py-2 px-3 text-right', marginColor)}>
                    {formatPercent(item.netProfitMargin)}
                  </td>
                  <td className="py-2 px-3 text-right text-[var(--paper-ink)]">
                    {item.eps !== undefined ? formatCurrency(item.eps, ticker) : '—'}
                  </td>
                  <td className="py-2 px-3 text-right text-[var(--paper-ink)]">
                    {formatCurrency(item.ebitda, ticker)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mini Chart Placeholder */}
      <div className="mt-6 h-32 border-t border-[var(--paper-rule)] pt-4">
        <p className="text-xs text-[var(--paper-muted)] text-center">
          Revenue & Profit Margin Chart (to be implemented)
        </p>
      </div>
    </PaperCard>
  );
}

