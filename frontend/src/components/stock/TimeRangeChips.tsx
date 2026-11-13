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
              ? 'bg-ink text-paper-light border-ink hover:bg-ink/90'
              : 'bg-transparent border-border-editorial text-ink hover:bg-paper-light'
          }`}
        >
          {range}
        </Button>
      ))}
    </div>
  )
}

