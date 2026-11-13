import { Check, Clock, Plus } from 'lucide-react'
import { formatDayShort } from '@/lib/commandCenter/format'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

/** `next` is the period in progress with nothing booked yet: tapping it schedules one. */
export type CellState = 'logged' | 'upcoming' | 'next' | 'empty'

interface Props {
  label: string
  state: CellState
  event?: ActivityFeedRow
  onClick: () => void
}

const STYLE: Record<CellState, string> = {
  logged: 'border-positive bg-positive text-paper-light hover:bg-[#287A4E]',
  upcoming: 'border-dashed border-chart-orange bg-[rgba(208,96,48,0.06)] text-[#B04E22] hover:bg-[rgba(208,96,48,0.12)]',
  next: 'border-dashed border-[#B8B0A0] bg-transparent text-ink-muted hover:border-ink hover:text-ink',
  empty: 'border-border-editorial bg-paper-alt text-ink-faint hover:border-ink-faint hover:text-ink',
}

/** One period in the tracker: green once logged, dashed while booked, a "+" when missing. */
export default function PeriodCell({ label, state, event, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={event ? event.title : state === 'next' ? `Schedule ${label}` : `Log ${label}`}
      className={`group flex h-12 flex-col items-center justify-center gap-1 rounded-lg border px-1 transition-colors ${STYLE[state]}`}
    >
      <span className="font-mono text-[10px] leading-none">{label}</span>
      {state === 'logged' && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
      {state === 'upcoming' && (
        <span className="inline-flex items-center gap-0.5 font-mono text-[10px] leading-none">
          <Clock className="h-3 w-3" />
          {formatDayShort(event?.event_date)}
        </span>
      )}
      {state === 'next' && <span className="font-mono text-[9px] uppercase leading-none tracking-wider">schedule</span>}
      {state === 'empty' && (
        <>
          <span className="font-mono text-xs leading-none group-hover:hidden">·</span>
          <Plus className="hidden h-3.5 w-3.5 group-hover:block" />
        </>
      )}
    </button>
  )
}
