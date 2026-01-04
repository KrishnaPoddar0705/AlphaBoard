/**
 * BalanceStatementBlock Component
 * 
 * Balance sheet table with Quarterly/Annually toggle.
 */

// import React from 'react';
import { PaperCard } from '../paper/PaperCard';
import { SectionHeader } from '../paper/SectionHeader';

interface BalanceSheetItem {
  period: string;
  cashAndShortTerm?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
}

interface BalanceStatementBlockProps {
  data: BalanceSheetItem[];
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

export function BalanceStatementBlock({
  data,
  period,
  onPeriodChange,
  ticker,
  isLoading = false,
}: BalanceStatementBlockProps) {
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
          title="Balance Statement"
          toggleOptions={[
            { label: 'Quarterly', value: 'quarterly' },
            { label: 'Annually', value: 'annually' },
          ]}
          toggleValue={period}
          onToggleChange={(value) => onPeriodChange(value as 'quarterly' | 'annually')}
        />
        <div className="py-8 text-center">
          <p className="text-sm text-[var(--paper-muted)] mb-2">
            No balance sheet data available
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
        title="Balance Statement"
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
                Cash & Short-term
              </th>
              <th className="py-2 px-3 text-right text-xs uppercase tracking-wide text-[var(--paper-muted)] font-medium">
                Total Assets
              </th>
              <th className="py-2 px-3 text-right text-xs uppercase tracking-wide text-[var(--paper-muted)] font-medium">
                Total Liabilities
              </th>
              <th className="py-2 px-3 text-right text-xs uppercase tracking-wide text-[var(--paper-muted)] font-medium">
                Total Equity
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="border-b border-[var(--paper-rule-light)]">
                <td className="py-2 px-3 text-[var(--paper-ink)] font-medium">
                  {item.period}
                </td>
                <td className="py-2 px-3 text-right text-[var(--paper-ink)]">
                  {formatCurrency(item.cashAndShortTerm, ticker)}
                </td>
                <td className="py-2 px-3 text-right text-[var(--paper-ink)]">
                  {formatCurrency(item.totalAssets, ticker)}
                </td>
                <td className="py-2 px-3 text-right text-[var(--paper-ink)]">
                  {formatCurrency(item.totalLiabilities, ticker)}
                </td>
                <td className="py-2 px-3 text-right text-[var(--paper-ink)]">
                  {formatCurrency(item.totalEquity, ticker)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PaperCard>
  );
}

