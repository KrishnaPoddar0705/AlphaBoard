// import React from 'react'
import { PriceChart } from './PriceChart'

interface PriceChartPanelProps {
  ticker: string
  timeframe: string
  chartData?: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>
}

export function PriceChartPanel({ ticker: _ticker, timeframe, chartData }: PriceChartPanelProps) {
  return (
    <div className="bg-paper-light border border-border-editorial p-5 w-full">
      <h2 className="text-base font-mono font-bold text-ink mb-4">Price Chart</h2>
      <div className="w-full min-w-[200px] min-h-[400px]">
        {chartData && chartData.length > 0 ? (
          <PriceChart data={chartData} timeframe={timeframe} />
        ) : (
          <div className="h-[400px] w-full bg-paper-alt border border-gridline flex items-center justify-center">
            <p className="text-sm font-mono text-ink-muted">Loading chart data...</p>
          </div>
        )}
      </div>
    </div>
  )
}

