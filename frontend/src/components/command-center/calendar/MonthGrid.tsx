import { monthGrid, bucketByDay, WEEKDAY_LABELS, type WeekStart }
  from '@/lib/commandCenter/calendar'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

interface Props {
  month: Date
  rows: ActivityFeedRow[]
  selected: string | null
  onSelect: (day: string) => void
  weekStart?: WeekStart
}

export default function MonthGrid({ month, rows, selected, onSelect, weekStart = 1 }: Props) {
  const cells = monthGrid(month, weekStart)
  const byDay = bucketByDay(rows)

  return (
    <div className="overflow-hidden rounded-xl border border-border-editorial bg-paper-light">
      <div className="grid grid-cols-7 border-b border-gridline">
        {WEEKDAY_LABELS[weekStart].map((d) => (
          <div key={d} className="px-2 py-1.5 text-center font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const events = byDay.get(cell.day) ?? []
          const isSelected = selected === cell.day
          return (
            <button
              key={cell.day}
              type="button"
              onClick={() => onSelect(cell.day)}
              className={[
                'relative flex min-h-[64px] flex-col gap-1 border-b border-r border-gridline p-1.5 text-left transition-colors sm:min-h-[88px]',
                cell.inMonth ? 'bg-paper-light' : 'bg-paper',
                isSelected ? 'ring-2 ring-inset ring-ink' : 'hover:bg-[rgba(28,27,23,0.04)]',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px]',
                  cell.isToday ? 'bg-ink text-paper-light' : '',
                  cell.inMonth ? 'text-ink' : 'text-ink-faint',
                ].join(' ')}
              >
                {Number(cell.day.slice(-2))}
              </span>

              {/* Dots on mobile, titles once there is room. Scheduled entries render
                  hollow so a plan never reads as something that happened. */}
              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {events.slice(0, 4).map((e) => (
                  <span
                    key={e.event_id}
                    className={`h-1.5 w-1.5 rounded-full ${
                      e.is_scheduled ? 'border border-chart-orange' : 'bg-ink'
                    }`}
                  />
                ))}
              </span>

              <span className="hidden flex-col gap-0.5 sm:flex">
                {events.slice(0, 2).map((e) => (
                  <span
                    key={e.event_id}
                    className={[
                      'truncate rounded px-1 py-px font-mono text-[10px]',
                      e.is_scheduled
                        ? 'border border-dashed border-chart-orange text-chart-orange'
                        : 'bg-gridline text-ink',
                    ].join(' ')}
                  >
                    {e.ticker}
                  </span>
                ))}
                {events.length > 2 && (
                  <span className="font-mono text-[10px] text-ink-muted">
                    +{events.length - 2} more
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
