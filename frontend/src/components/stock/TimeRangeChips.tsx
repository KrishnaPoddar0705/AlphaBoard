// import React from 'react'
import { Button } from '@/components/ui/button'

interface TimeRangeChipsProps {
  value: string
  onChange: (value: string) => void
}

const timeRanges = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1YR', '5YR', '10YR', 'ALL']

export function TimeRangeChips({ value, onChange }: TimeRangeChipsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {timeRanges.map((range) => (
        <Button
          key={range}
          variant={value === range ? 'default' : 'outline'}
          onClick={() => onChange(range)}
          className={`font-mono text-xs px-3 py-1.5 h-auto ${
            value === range
              ? 'bg-[#1C1B17] text-[#F7F2E6] border-[#1C1B17] hover:bg-[#1C1B17]/90'
              : 'bg-transparent border-[#D7D0C2] text-[#1C1B17] hover:bg-[#F7F2E6]'
          }`}
        >
          {range}
        </Button>
      ))}
    </div>
  )
}

