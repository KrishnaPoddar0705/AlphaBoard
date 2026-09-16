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
    <div className="overflow-hidden rounded-xl border border-[#D7D0C2] bg-[#F7F2E6]">
      <div className="grid grid-cols-7 border-b border-[#E3DDCF]">
        {WEEKDAY_LABELS[weekStart].map((d) => (
          <div key={d} className="px-2 py-1.5 text-center font-mono text-[10px] uppercase tracking-wider text-[#8B857A]">
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
                'relative flex min-h-[64px] flex-col gap-1 border-b border-r border-[#E3DDCF] p-1.5 text-left transition-colors sm:min-h-[88px]',
                cell.inMonth ? 'bg-[#F7F2E6]' : 'bg-[#F1EEE0]',
                isSelected ? 'ring-2 ring-inset ring-[#1C1B17]' : 'hover:bg-[rgba(28,27,23,0.04)]',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px]',
                  cell.isToday ? 'bg-[#1C1B17] text-[#F7F2E6]' : '',
                  cell.inMonth ? 'text-[#1C1B17]' : 'text-[#8B857A]',
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
                      e.is_scheduled ? 'border border-[#D06030]' : 'bg-[#1C1B17]'
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
                        ? 'border border-dashed border-[#D06030] text-[#D06030]'
                        : 'bg-[#E3DDCF] text-[#1C1B17]',
                    ].join(' ')}
                  >
                    {e.ticker}
                  </span>
                ))}
                {events.length > 2 && (
                  <span className="font-mono text-[10px] text-[#6F6A60]">
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
