import React from 'react'

interface KeyStatsPanelProps {
  marketCap?: number
  high52w?: number
  low52w?: number
  dividendYield?: number
  pe?: number
  volume?: number
  sharesOutstanding?: number
}

export function KeyStatsPanel({
  marketCap,
  high52w,
  low52w,
  dividendYield,
  pe,
  volume,
  sharesOutstanding,
}: KeyStatsPanelProps) {
  const stats = [
    { label: 'Market Cap', value: marketCap ? `$${(marketCap / 1e9).toFixed(2)}B` : 'N/A' },
    { label: '52w High', value: high52w ? `$${high52w.toFixed(2)}` : 'N/A' },
    { label: '52w Low', value: low52w ? `$${low52w.toFixed(2)}` : 'N/A' },
    { label: 'Dividend Yield', value: dividendYield ? `${dividendYield.toFixed(2)}%` : '0%' },
    { label: 'P/E', value: pe ? pe.toFixed(2) : 'N/A' },
    { label: 'Volume', value: volume ? `${(volume / 1e6).toFixed(2)}M` : 'N/A' },
    { label: 'Outstanding Shares', value: sharesOutstanding ? `${(sharesOutstanding / 1e6).toFixed(2)}M` : 'N/A' },
  ]

  return (
    <div className="bg-[#F7F2E6] border border-[#D7D0C2] p-5">
      <div className="space-y-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex justify-between items-start">
            <span className="text-xs font-mono text-[#6F6A60] uppercase tracking-wider">
              {stat.label}
            </span>
            <span className="text-sm font-mono font-semibold text-[#1C1B17] tabular-nums text-right ml-4">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

