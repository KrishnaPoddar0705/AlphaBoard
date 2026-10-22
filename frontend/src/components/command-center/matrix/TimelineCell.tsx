import { useState } from 'react'
import { Maximize2, Plus } from 'lucide-react'
import EntryTimeline from './EntryTimeline'
import CellActions from './CellActions'
import { CELL_LIMIT, type MatrixDensity } from '@/lib/commandCenter/matrix'
import { formatDayShort, relativeDays } from '@/lib/commandCenter/format'
import { svanRatingOf } from '@/lib/commandCenter/constants'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'
import { type } from './styles'

interface Props {
  entries: ActivityFeedRow[] | undefined
  label: string
  density: MatrixDensity
  showTicker: boolean
  /** Opens the pop view on this cell, optionally on one entry. */
  onOpen: (eventId?: string) => void
  onAdd: () => void
}

/**
 * One activity cell. What matters first: the next scheduled event (the only accented
 * line), then the latest logged work. Older entries fold behind "+N earlier", which
 * expands in place; "Open" and "Log" appear on hover.
 */
export default function TimelineCell({ entries, label, density, showTicker, onOpen, onAdd }: Props) {
  const [all, setAll] = useState(false)
  const list = entries ?? []
  const logged = list.filter((e) => !e.is_scheduled)
  const next = list.filter((e) => e.is_scheduled).at(-1)
  const limit = all ? logged.length : CELL_LIMIT[density]
  const earlier = logged.length - Math.min(limit, logged.length)

  const actions = (
    <CellActions>
      {list.length > 0 && (
        <CellActions.Button label={`Open ${label}`} onClick={() => onOpen()}><Maximize2 className="size-3" /></CellActions.Button>
      )}
      <CellActions.Button label={`Log ${label}`} onClick={onAdd}><Plus className="size-3" /></CellActions.Button>
    </CellActions>
  )

  if (list.length === 0) {
    return <div className="relative min-h-6 py-0.5">{actions}<span className={`${type.monoFaint} opacity-50`}>—</span></div>
  }

  if (density === 'compact') {
    return (
      <div className="relative">
        {actions}
        <button type="button" onClick={() => onOpen()}
          className="flex w-full items-center gap-2 rounded-(--mx-radius-sm) py-0.5 text-left">
          <span className="flex shrink-0 items-center gap-[3px]">
            {logged.slice(0, 6).reverse().map((e) => (
              <span key={e.event_id} className="size-[6px] rounded-full"
                style={{ backgroundColor: svanRatingOf(e.svan_rating)?.color ?? 'var(--mx-text-2)' }} />
            ))}
            {next && <span className="size-[6px] rounded-full ring-1 ring-(--mx-accent) ring-inset" />}
          </span>
          <span className={`${type.mono} truncate`}>
            {logged.length > 0 && <>{logged.length} · {relativeDays(logged[0].event_date)}</>}
            {next && <span className="text-(--mx-accent)">{logged.length > 0 && ' · '}next {formatDayShort(next.event_date)}</span>}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="relative space-y-1">
      {actions}
      {next && (
        <button type="button" onClick={() => onOpen(next.event_id)} title={next.title}
          className="flex w-full min-w-0 items-baseline gap-2 rounded-(--mx-radius-sm) bg-(--mx-accent-soft) px-1.5 py-0.5 text-left">
          <span className="shrink-0 text-[10.5px] font-medium text-(--mx-accent)">Next</span>
          <span className={`${type.body} min-w-0 flex-1 truncate`}>{showTicker ? next.ticker : (next.period_label ?? next.title)}</span>
          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-(--mx-accent)">{formatDayShort(next.event_date)}</span>
        </button>
      )}
      {logged.length > 0 && (
        <div className={next ? 'px-1.5' : ''}>
          <EntryTimeline logged={logged.slice(0, limit)} detailed={density === 'expanded'}
            showTicker={showTicker} onOpenEntry={(e) => onOpen(e.event_id)} />
        </div>
      )}
      {(earlier > 0 || all) && logged.length > CELL_LIMIT[density] && (
        <button type="button" onClick={() => setAll((v) => !v)}
          className={`${type.help} ms-4 rounded-(--mx-radius-sm) hover:text-(--mx-text)`}>
          {all ? 'Show less' : `+${earlier} earlier`}
        </button>
      )}
    </div>
  )
}
