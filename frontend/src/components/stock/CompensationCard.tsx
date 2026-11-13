// import React from 'react'

interface CompensationCardProps {
  year?: number
}

export function CompensationCard({ year = 2024 }: CompensationCardProps) {
  const compensation = [
    { label: 'Salary', value: '$750,000' },
    { label: 'Bonus', value: '$0' },
    { label: 'Stock Awards', value: '$0' },
    { label: 'Option Awards', value: '$0' },
    { label: 'Incentive Plan Pay', value: '$0' },
    { label: 'All Other Compensation', value: '$17,250' },
    { label: 'Outstanding Value', value: '$0' },
    { label: 'Total Compensation', value: '$767,250', isTotal: true },
  ]

  return (
    <div className="bg-paper-light border border-border-editorial p-5">
      <h3 className="text-sm font-mono font-bold text-ink mb-4">
        Compensation Summary (Year {year})
      </h3>
      <div className="space-y-2">
        {compensation.map((item) => (
          <div
            key={item.label}
            className={`flex justify-between items-center py-1 ${
              item.isTotal ? 'border-t border-border-editorial pt-2 mt-2' : ''
            }`}
          >
            <span className={`text-xs font-mono ${
              item.isTotal ? 'font-bold text-ink' : 'text-ink-muted'
            }`}>
              {item.label}
            </span>
            <span className={`text-xs font-mono tabular-nums ${
              item.isTotal ? 'font-bold text-ink' : 'text-ink'
            }`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

