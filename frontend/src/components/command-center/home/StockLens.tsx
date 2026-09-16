import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import TerminalPanel, { PanelEmpty } from './TerminalPanel'
import EntryLine from './EntryLine'
import ReviewBar from '../review/ReviewBar'
import { SIGNAL, eventTypeOf } from '@/lib/commandCenter/constants'
import { ownerName, relativeTime, whenLabel, type StockLensRow } from '@/lib/commandCenter/home'
import type { ActivityFeedRow, EventReview } from '@/lib/commandCenter/types'

interface Props {
  rows: StockLensRow[]
  /** The home window, to list each stock's new entries when a row is opened. */
  entries: ActivityFeedRow[]
  reviewsFor: (eventId: string) => EventReview[]
  now: Date
  onOpen: (row: ActivityFeedRow) => void
  className?: string
}

const th = 'px-2 py-1 text-left font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-[#6F6A60] whitespace-nowrap'
const td = 'px-2 py-1.5 font-mono text-[11px] align-top'
const WEEK = 7 * 86_400_000

/** Every name in scope: what is new on it this week, its last signal, what is next. */
export default function StockLens({ rows, entries, reviewsFor, now, onOpen, className }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const withNews = rows.filter((r) => r.new7d > 0).length

  return (
    <TerminalPanel code="STK" title={`By stock · ${withNews} with new research`} count={rows.length} className={className}>
      {rows.length === 0 ? (
        <PanelEmpty>No covered stocks or logged entries in this scope.</PanelEmpty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#F1EEE0]">
              <tr>
                <th className={th}>Stock</th>
                <th className={`${th} text-right`}>New 7d</th>
                <th className={th}>Latest entry</th>
                <th className={th}>Signal</th>
                <th className={th}>Next</th>
                <th className={`${th} text-right`}>Primary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const isOpen = open === s.coverageId
                const signal = s.latestSignal ? SIGNAL[s.latestSignal] : null
                const fresh = entries
                  .filter((e) => e.coverage_id === s.coverageId && !e.is_scheduled
                    && now.getTime() - new Date(e.created_at).getTime() <= WEEK)
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                return (
                  <Fragment key={s.coverageId}>
                    <tr
                      onClick={() => setOpen(isOpen ? null : s.coverageId)}
                      className={`cursor-pointer border-t border-[#E3DDCF] ${isOpen ? 'bg-[#F1EEE0]' : 'hover:bg-[rgba(28,27,23,0.04)]'}`}
                    >
                      <td className={td}>
                        <span className="inline-flex items-center gap-1">
                          {s.new7d > 0
                            ? (isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)
                            : <span className="w-3" />}
                          <Link
                            to={`/command-center/stock/${encodeURIComponent(s.ticker)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-[#1C1B17] hover:underline"
                          >
                            {s.ticker}
                          </Link>
                        </span>
                        <span className="block pl-4 text-[10px] text-[#8B857A]">{s.leadAnalyst ?? 'No lead analyst'}</span>
                      </td>
                      <td className={`${td} text-right text-xs tabular-nums ${s.new7d > 0 ? 'font-semibold text-[#1C1B17]' : 'text-[#8B857A]'}`}>
                        {s.new7d}
                      </td>
                      <td className={`${td} max-w-[260px]`}>
                        {s.lastEntry ? (
                          <>
                            <span className="block truncate text-[#1C1B17]">{s.lastEntry.title}</span>
                            <span className="text-[10px] text-[#8B857A]">
                              {eventTypeOf(s.lastEntry.kind, s.lastEntry.subtype).label} · {ownerName(s.lastEntry)} · {relativeTime(s.lastEntry.created_at, now)}
                            </span>
                          </>
                        ) : <span className="text-[#8B857A]">Nothing in 35d</span>}
                      </td>
                      <td className={td} style={{ color: signal?.color ?? '#8B857A' }}>
                        {signal ? `${signal.glyph} ${s.latestSignal}` : '—'}
                      </td>
                      <td className={td}>
                        {s.nextEvent ? (
                          <>
                            <span className="text-[#B04E22]">{whenLabel(s.nextEvent.event_date, now)}</span>
                            <span className="block text-[10px] text-[#8B857A]">{eventTypeOf(s.nextEvent.kind, s.nextEvent.subtype).label}</span>
                          </>
                        ) : <span className="text-[#8B857A]">—</span>}
                      </td>
                      <td className={`${td} text-right tabular-nums`}>
                        {s.daysSincePrimary === undefined ? <span className="text-[#8B857A]">—</span>
                          : s.daysSincePrimary === null ? <span className="text-[#B23B2A]">never</span>
                          : <span className={s.daysSincePrimary > 30 ? 'text-[#B23B2A]' : 'text-[#1C1B17]'}>{s.daysSincePrimary}d</span>}
                      </td>
                    </tr>
                    {isOpen && fresh.length > 0 && (
                      <tr className="bg-[#FBF7ED]">
                        <td colSpan={6} className="border-t border-[#E3DDCF] p-0">
                          <ul className="ml-6 border-l-2 border-[#1C1B17]">
                            {fresh.map((e) => (
                              <EntryLine
                                key={e.event_id} row={e} now={now} onOpen={onOpen}
                                actions={<ReviewBar event={e} reviews={reviewsFor(e.event_id)} compact />}
                              />
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
