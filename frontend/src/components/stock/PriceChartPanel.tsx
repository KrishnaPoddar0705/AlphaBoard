// import React from 'react'
import { PriceChart } from './PriceChart'

interface PriceChartPanelProps {
  ticker: string
  timeframe: string
  chartData?: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>
}

export function PriceChartPanel({ ticker: _ticker, timeframe, chartData }: PriceChartPanelProps) {
  return (
    <div className="bg-[#F7F2E6] border border-[#D7D0C2] p-5 w-full">
      <h2 className="text-base font-mono font-bold text-[#1C1B17] mb-4">Price Chart</h2>
      <div className="w-full min-w-[200px] min-h-[400px]">
        {chartData && chartData.length > 0 ? (
          <PriceChart data={chartData} timeframe={timeframe} />
        ) : (
          <div className="h-[400px] w-full bg-[#FBF7ED] border border-[#E3DDCF] flex items-center justify-center">
            <p className="text-sm font-mono text-[#6F6A60]">Loading chart data...</p>
          </div>
        )}
      </div>
    </div>
  )
}

