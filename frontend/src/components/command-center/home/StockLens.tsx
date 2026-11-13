import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import TerminalPanel, { PanelEmpty } from './TerminalPanel'
import EntryLine from './EntryLine'
import { eventTypeOf } from '@/lib/commandCenter/constants'
import { ownerName, relativeTime, type StockLensRow } from '@/lib/commandCenter/home'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

interface Props {
  rows: StockLensRow[]
  /** The home window, to list each stock's new entries when a row is opened. */
  entries: ActivityFeedRow[]
  now: Date
  onOpen: (row: ActivityFeedRow) => void
  className?: string
}

const th = 'px-2 py-1 font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-ink-muted whitespace-nowrap'
const td = 'px-2 py-1.5 font-mono text-[11px] align-top'
const WEEK = 7 * 86_400_000

/** Every name in scope: what is new on it this week, and how stale the primary research is. */
export default function StockLens({ rows, entries, now, onOpen, className }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const withNews = rows.filter((r) => r.new7d > 0).length

  return (
    <TerminalPanel code="STK" title={`By stock · ${withNews} with new research`} count={rows.length} className={className}>
      {rows.length === 0 ? (
        <PanelEmpty>No covered stocks or logged entries match.</PanelEmpty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead className="sticky top-0 z-10 bg-paper">
              <tr>
                <th className={`${th} text-left`}>Stock</th>
                <th className={`${th} text-right`}>New 7d</th>
                <th className={`${th} text-left`}>Latest entry</th>
                <th className={`${th} text-right`}>Primary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const isOpen = open === s.coverageId
                const fresh = entries
                  .filter((e) => e.coverage_id === s.coverageId && !e.is_scheduled
                    && now.getTime() - new Date(e.created_at).getTime() <= WEEK)
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                return (
                  <Fragment key={s.coverageId}>
                    <tr
                      onClick={() => setOpen(isOpen ? null : s.coverageId)}
                      className={`cursor-pointer border-t border-gridline ${isOpen ? 'bg-paper' : 'hover:bg-[rgba(28,27,23,0.04)]'}`}
                    >
                      <td className={td}>
                        <span className="inline-flex items-center gap-1">
                          {s.new7d > 0
                            ? (isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)
                            : <span className="w-3" />}
                          <Link
                            to={`/command-center/stock/${encodeURIComponent(s.ticker)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-ink hover:underline"
                          >
                            {s.ticker}
                          </Link>
                        </span>
                        <span className="block pl-4 text-[10px] text-ink-faint">{s.leadAnalyst ?? 'No lead analyst'}</span>
                      </td>
                      <td className={`${td} text-right text-xs tabular-nums ${s.new7d > 0 ? 'font-semibold text-ink' : 'text-ink-faint'}`}>
                        {s.new7d}
                      </td>
                      <td className={`${td} max-w-[260px]`}>
                        {s.lastEntry ? (
                          <>
                            <span className="block truncate text-ink">{s.lastEntry.title}</span>
                            <span className="text-[10px] text-ink-faint">
                              {eventTypeOf(s.lastEntry.kind, s.lastEntry.subtype).label} · {ownerName(s.lastEntry)} · {relativeTime(s.lastEntry.created_at, now)}
                            </span>
                          </>
                        ) : <span className="text-ink-faint">Nothing in 35d</span>}
                      </td>
                      <td className={`${td} text-right tabular-nums`}>
                        {s.daysSincePrimary === undefined ? <span className="text-ink-faint">—</span>
                          : s.daysSincePrimary === null ? <span className="text-negative">never</span>
                          : <span className={s.daysSincePrimary > 30 ? 'text-negative' : 'text-ink'}>{s.daysSincePrimary}d</span>}
                      </td>
                    </tr>
                    {isOpen && fresh.length > 0 && (
                      <tr className="bg-paper-alt">
                        <td colSpan={4} className="border-t border-gridline p-0">
                          <ul className="ml-6 border-l-2 border-ink">
                            {fresh.map((e) => (
                              <EntryLine key={e.event_id} row={e} now={now} onOpen={onOpen} />
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </TerminalPanel>
  )
}
