import TerminalPanel, { PanelEmpty } from './TerminalPanel'
import { eventTypeOf } from '@/lib/commandCenter/constants'
import { relativeTime, whenLabel, type PersonNow } from '@/lib/commandCenter/home'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

interface Props {
  people: PersonNow[]
  now: Date
  selected: string | null
  onSelect: (userId: string | null) => void
  onOpen: (row: ActivityFeedRow) => void
  className?: string
}

const th = 'px-2 py-1 text-left font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-[#6F6A60]'

/**
 * Per person: the last thing they logged and the next thing they have booked. There is
 * no "working on" status because nobody enters one -- what is shown is what was logged.
 */
export default function TeamNowPanel({ people, now, selected, onSelect, onOpen, className }: Props) {
  return (
    <TerminalPanel code="TEAM" title="Team right now" count={people.length} className={className}>
      {people.length === 0 ? (
        <PanelEmpty>No one to show in this scope.</PanelEmpty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse">
            <thead className="bg-[#F1EEE0]">
              <tr>
                <th className={th}>Analyst</th>
                <th className={th}>Last logged</th>
                <th className={th}>Next</th>
                <th className={`${th} text-right`}>7d</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr
                  key={p.userId}
                  onClick={() => onSelect(selected === p.userId ? null : p.userId)}
                  className={[
                    'cursor-pointer border-t border-[#E3DDCF] align-top transition-colors',
                    selected === p.userId ? 'bg-[#F1EEE0]' : 'hover:bg-[rgba(28,27,23,0.04)]',
                  ].join(' ')}
                >
                  <td className="px-2 py-1.5 font-mono text-xs text-[#1C1B17]">
                    {p.name}
                    {p.role === 'portfolio_manager' && <span className="ml-1 text-[9px] text-[#8B857A]">PM</span>}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[11px]">
                    {p.lastEntry ? (
                      <Cell row={p.lastEntry} sub={relativeTime(p.lastEntry.created_at, now)} onOpen={onOpen} />
                    ) : (
                      <span className="text-[#8B857A]">Nothing logged</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[11px]">
                    {p.nextEvent ? (
                      <Cell row={p.nextEvent} sub={whenLabel(p.nextEvent.event_date, now)} onOpen={onOpen} upcoming />
                    ) : (
                      <span className="text-[#8B857A]">—</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-[#1C1B17]">
                    {p.entries7d}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TerminalPanel>
  )
}

function Cell({ row, sub, onOpen, upcoming }: {
  row: ActivityFeedRow; sub: string; onOpen: (r: ActivityFeedRow) => void; upcoming?: boolean
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(row) }}
      className="text-left hover:underline"
    >
      <span className="font-semibold text-[#1C1B17]">{row.ticker}</span>{' '}
      <span className="text-[#1C1B17]">{eventTypeOf(row.kind, row.subtype).label}</span>
      <span className={`block text-[10px] ${upcoming ? 'text-[#B04E22]' : 'text-[#8B857A]'}`}>{sub}</span>
    </button>
  )
}
