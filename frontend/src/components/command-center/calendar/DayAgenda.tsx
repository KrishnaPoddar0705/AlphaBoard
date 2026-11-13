import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import EventKindBadge from '../shared/EventKindBadge'
import EmptyState from '../shared/EmptyState'
import { RowsSkeleton } from '../shared/Skeleton'
import { formatDay } from '@/lib/commandCenter/format'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

interface Props {
  day: string
  rows: ActivityFeedRow[]
  /** The month's events have not arrived: "nothing on this day" would be a guess. */
  loading?: boolean
}

export default function DayAgenda({ day, rows, loading }: Props) {
  return (
    <div className="rounded-xl border border-border-editorial bg-paper-light">
      <header className="border-b border-gridline px-4 py-2.5">
        <h3 className="font-mono text-xs text-ink">{formatDay(day)}</h3>
      </header>

      {loading ? (
        <div className="px-4"><RowsSkeleton rows={3} /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Nothing on this day" />
      ) : (
        <ul className="divide-y divide-gridline">
          {rows.map((e) => (
            <li key={e.event_id}>
              <Link
                to={`/command-center/stock/${encodeURIComponent(e.ticker)}`}
                className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-[rgba(28,27,23,0.04)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <EventKindBadge kind={e.kind} subtype={e.subtype} scheduled={e.is_scheduled} />
                  <span className="font-mono text-[11px] text-ink-muted">{e.ticker}</span>
                  {e.is_scheduled && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-chart-orange">
                      upcoming
                    </span>
                  )}
                </div>
                <p className="font-mono text-sm text-ink">{e.title}</p>
                {e.analyst_username && (
                  <p className="font-mono text-[11px] text-ink-muted">{e.analyst_username}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
