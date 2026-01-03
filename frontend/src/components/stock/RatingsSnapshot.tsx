import React from 'react'
import { RadarChart } from './RadarChart'

interface RatingsSnapshotProps {
  ratings?: {
    dcf?: number
    roe?: number
    roa?: number
    debtToEquity?: number
    pe?: number
    pb?: number
    overall?: number
  }
}

export function RatingsSnapshot({ ratings }: RatingsSnapshotProps) {
  const radarData = [
    { name: 'DCF', value: ratings?.dcf || 0 },
    { name: 'ROE', value: ratings?.roe || 0 },
    { name: 'ROA', value: ratings?.roa || 0 },
    { name: 'Debt/Equity', value: ratings?.debtToEquity || 0 },
    { name: 'P/E', value: ratings?.pe || 0 },
    { name: 'P/B', value: ratings?.pb || 0 },
  ]

  const ratingItems = [
    { label: 'Discounted Cash Flow', value: ratings?.dcf || 0 },
    { label: 'Return On Equity', value: ratings?.roe || 0 },
    { label: 'Return On Assets', value: ratings?.roa || 0 },
    { label: 'Debt To Equity', value: ratings?.debtToEquity || 0 },
    { label: 'Price To Earnings', value: ratings?.pe || 0 },
    { label: 'Price To Book', value: ratings?.pb || 0 },
    { label: 'Overall Score', value: ratings?.overall || 0, isTotal: true },
  ]

  return (
    <div className="bg-[#F7F2E6] border border-[#D7D0C2] p-5">
      <h3 className="text-sm font-mono font-bold text-[#1C1B17] mb-4">Ratings Snapshot</h3>
      <div className="grid grid-cols-2 gap-4">
        {/* Radar chart */}
        <div className="col-span-1">
          <RadarChart data={radarData} />
        </div>
        {/* Ratings list */}
        <div className="col-span-1 space-y-2">
          {ratingItems.map((item) => (
            <div
              key={item.label}
              className={`flex justify-between items-center ${
                item.isTotal ? 'border-t border-[#D7D0C2] pt-2 mt-2' : ''
              }`}
            >
              <span className={`text-xs font-mono ${
                item.isTotal ? 'font-bold text-[#1C1B17]' : 'text-[#6F6A60]'
              }`}>
                {item.label}
              </span>
              <span className={`text-xs font-mono tabular-nums font-semibold ${
                item.isTotal ? 'text-[#1C1B17]' : 'text-[#1C1B17]'
              }`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

