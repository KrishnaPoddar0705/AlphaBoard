// import React from 'react'

interface CompanyFactsCardProps {
  industry?: string
  sector?: string
  ipoDate?: string
  ipoMethod?: string
  employees?: number
}

export function CompanyFactsCard({
  industry,
  sector,
  ipoDate,
  ipoMethod,
  employees,
}: CompanyFactsCardProps) {
  const facts = [
    { label: 'Industry', value: industry || 'N/A' },
    { label: 'Sector', value: sector || 'N/A' },
    { label: 'Went public', value: ipoDate || 'N/A' },
    { label: 'Method of going public', value: ipoMethod || 'N/A' },
    { label: 'Full time employees', value: employees ? employees.toLocaleString() : 'N/A' },
  ]

  return (
    <div className="bg-paper-light border border-border-editorial p-5">
      <h3 className="text-sm font-mono font-bold text-ink mb-4">Company Facts</h3>
      <div className="space-y-2">
        {facts.map((fact) => (
          <div key={fact.label} className="flex justify-between items-start">
            <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">
              {fact.label}
            </span>
            <span className="text-xs font-mono text-ink text-right ml-4">
              {fact.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

