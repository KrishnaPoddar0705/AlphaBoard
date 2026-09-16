import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import HealthDot from '../shared/HealthDot'
import { formatDay } from '@/lib/commandCenter/format'
import type { CoverageBoardRow } from '@/lib/commandCenter/types'

interface Props {
  coverage: CoverageBoardRow
  onLog: () => void
}

export default function StockHeader({ coverage, onLog }: Props) {
  return (
    <header className="flex flex-col gap-3 border-b border-[#D7D0C2] pb-4">
      <Link
        to="/command-center"
        className="inline-flex w-fit items-center gap-1 font-mono text-[11px] text-[#6F6A60] hover:text-[#1C1B17]"
      >
        <ArrowLeft className="h-3 w-3" /> Coverage
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-mono text-lg font-semibold text-[#1C1B17]">
            {coverage.company_name || coverage.ticker}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-[#6F6A60]">
            <span>{coverage.ticker}</span>
            {coverage.sector && <span>· {coverage.sector}</span>}
            {coverage.lead_analyst_username && <span>· Lead: {coverage.lead_analyst_username}</span>}
            <HealthDot
              daysSince={coverage.days_since_interaction}
              lastInteractionOn={coverage.last_interaction_on}
            />
          </p>
          {coverage.next_scheduled_on && (
            <p className="mt-1 font-mono text-[11px] text-[#D06030]">
              Next: {coverage.next_scheduled_title} · {formatDay(coverage.next_scheduled_on)}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={`/stock/${encodeURIComponent(coverage.ticker)}`}>
              <BarChart3 className="h-3.5 w-3.5" /> Market data
            </Link>
          </Button>
          <Button size="sm" onClick={onLog}>
            <Plus className="h-3.5 w-3.5" /> Log
          </Button>
        </div>
      </div>
    </header>
  )
}
