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
    <div className="rounded-xl border border-[#D7D0C2] bg-[#F7F2E6]">
      <header className="border-b border-[#E3DDCF] px-4 py-2.5">
        <h3 className="font-mono text-xs text-[#1C1B17]">{formatDay(day)}</h3>
      </header>

      {loading ? (
        <div className="px-4"><RowsSkeleton rows={3} /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Nothing on this day" />
      ) : (
        <ul className="divide-y divide-[#E3DDCF]">
          {rows.map((e) => (
            <li key={e.event_id}>
              <Link
                to={`/command-center/stock/${encodeURIComponent(e.ticker)}`}
                className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-[rgba(28,27,23,0.04)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <EventKindBadge kind={e.kind} subtype={e.subtype} scheduled={e.is_scheduled} />
                  <span className="font-mono text-[11px] text-[#6F6A60]">{e.ticker}</span>
                  {e.is_scheduled && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#D06030]">
                      upcoming
                    </span>
                  )}
                </div>
                <p className="font-mono text-sm text-[#1C1B17]">{e.title}</p>
                {e.analyst_username && (
                  <p className="font-mono text-[11px] text-[#6F6A60]">{e.analyst_username}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
