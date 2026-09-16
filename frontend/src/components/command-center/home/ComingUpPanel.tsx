import TerminalPanel, { PanelEmpty } from './TerminalPanel'
import { eventTypeOf } from '@/lib/commandCenter/constants'
import { formatDayShort } from '@/lib/commandCenter/format'
import { ownerName, type UpcomingItem } from '@/lib/commandCenter/home'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

interface Props {
  items: UpcomingItem[]
  onOpen: (row: ActivityFeedRow) => void
  className?: string
}

/** Scheduled entries for the next two weeks, as booked by the desk. */
export default function ComingUpPanel({ items, onOpen, className }: Props) {
  return (
    <TerminalPanel code="CAL" title="Coming up · 14d" count={items.length} className={className}>
      {items.length === 0 ? (
        <PanelEmpty>Nothing scheduled in the next 14 days. Book one with Log → Upcoming.</PanelEmpty>
      ) : (
        <ul>
          {items.map(({ row, when }) => (
            <li key={row.event_id} className="border-b border-[#E3DDCF] last:border-b-0">
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)] gap-2 px-3 py-1.5 text-left hover:bg-[rgba(28,27,23,0.04)]"
              >
                <span className={`font-mono text-[11px] tabular-nums ${when === 'Today' ? 'font-semibold text-[#B04E22]' : 'text-[#1C1B17]'}`}>
                  {when}
                  <span className="block text-[10px] font-normal text-[#8B857A]">{formatDayShort(row.event_date)}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs text-[#1C1B17]">
                    <span className="font-semibold">{row.ticker}</span> {eventTypeOf(row.kind, row.subtype).label}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-[#8B857A]">
                    {ownerName(row)}{row.title ? ` · ${row.title}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </TerminalPanel>
  )
}
