import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import TerminalPanel, { PanelEmpty } from './TerminalPanel'
import EntryLine from './EntryLine'
import { eventTypeOf } from '@/lib/commandCenter/constants'
import { formatDayShort } from '@/lib/commandCenter/format'
import { ownerOf, relativeTime, whenLabel, type AnalystLensRow } from '@/lib/commandCenter/home'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

interface Props {
  rows: AnalystLensRow[]
  entries: ActivityFeedRow[]
  now: Date
  onOpen: (row: ActivityFeedRow) => void
  onFocusPerson: (userId: string) => void
  className?: string
}

const th = 'px-2 py-1 font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-[#6F6A60] whitespace-nowrap'
const num = 'px-2 py-1.5 text-right font-mono text-xs tabular-nums align-top'

/** Each person in scope: output, breadth, and -- on opening -- their work and bookings. */
export default function AnalystLens({ rows, entries, now, onOpen, onFocusPerson, className }: Props) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <TerminalPanel code="ANL" title="By analyst · last 30d" count={rows.length} className={className}>
      {rows.length === 0 ? (
        <PanelEmpty>No one matches.</PanelEmpty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#F1EEE0]">
              <tr>
                <th className={`${th} text-left`}>Analyst</th>
                <th className={`${th} text-right`}>7d</th>
                <th className={`${th} text-right`}>30d</th>
                <th className={`${th} text-right`}>Stocks</th>
                <th className={`${th} text-left`}>Last entry</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const isOpen = open === a.userId
                const mine = isOpen ? entries.filter((e) => ownerOf(e) === a.userId) : []
                const logged = mine.filter((e) => !e.is_scheduled).sort((x, y) => y.created_at.localeCompare(x.created_at)).slice(0, 8)
                const booked = mine.filter((e) => e.is_scheduled).sort((x, y) => x.event_date.localeCompare(y.event_date))
                return (
                  <Fragment key={a.userId}>
                    <tr
                      onClick={() => setOpen(isOpen ? null : a.userId)}
                      className={`cursor-pointer border-t border-[#E3DDCF] ${isOpen ? 'bg-[#F1EEE0]' : 'hover:bg-[rgba(28,27,23,0.04)]'}`}
                    >
                      <td className="px-2 py-1.5 align-top font-mono text-xs text-[#1C1B17]">
                        <span className="inline-flex items-center gap-1">
                          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          <span className="font-semibold">{a.name}</span>
                          {a.role === 'portfolio_manager' && <span className="text-[9px] text-[#8B857A]">PM</span>}
                          {a.role === 'admin' && <span className="text-[9px] text-[#8B857A]">ADMIN</span>}
                        </span>
                      </td>
                      <td className={`${num} ${a.entries7d ? 'font-semibold text-[#1C1B17]' : 'text-[#8B857A]'}`}>{a.entries7d}</td>
                      <td className={num}>{a.entries30d}</td>
                      <td className={num}>{a.stocks30d}</td>
                      <td className="max-w-[220px] px-2 py-1.5 align-top font-mono text-[11px]">
                        {a.lastEntry ? (
                          <>
                            <span className="block truncate text-[#1C1B17]">
                              <span className="font-semibold">{a.lastEntry.ticker}</span> {eventTypeOf(a.lastEntry.kind, a.lastEntry.subtype).label}
                            </span>
                            <span className="text-[10px] text-[#8B857A]">{relativeTime(a.lastEntry.created_at, now)}</span>
                          </>
                        ) : <span className="text-[#8B857A]">Nothing logged</span>}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-[#FBF7ED]">
                        <td colSpan={5} className="border-t border-[#E3DDCF] p-0">
                          <div className="grid gap-0 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                            <div className="border-l-2 border-[#1C1B17] md:ml-6">
                              <p className="bg-[#F1EEE0] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#6F6A60]">Recent entries</p>
                              {logged.length === 0 ? (
                                <p className="px-3 py-2 font-mono text-[11px] text-[#8B857A]">Nothing logged in the last 35 days.</p>
                              ) : (
                                <ul>
                                  {logged.map((e) => (
                                    <EntryLine key={e.event_id} row={e} now={now} onOpen={onOpen} />
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div className="border-t border-[#E3DDCF] md:border-l md:border-t-0">
                              <p className="bg-[#F1EEE0] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#6F6A60]">Booked</p>
                              {booked.length === 0 ? (
                                <p className="px-3 py-2 font-mono text-[11px] text-[#8B857A]">Nothing scheduled.</p>
                              ) : (
                                <ul>
                                  {booked.map((e) => (
                                    <li key={e.event_id}>
                                      <button type="button" onClick={() => onOpen(e)} className="w-full px-3 py-1.5 text-left font-mono text-[11px] hover:bg-[rgba(28,27,23,0.04)]">
                                        <span className="text-[#B04E22]">{whenLabel(e.event_date, now)}</span>{' '}
                                        <span className="font-semibold text-[#1C1B17]">{e.ticker}</span>{' '}
                                        <span className="text-[#1C1B17]">{eventTypeOf(e.kind, e.subtype).label}</span>
                                        <span className="block text-[10px] text-[#8B857A]">{formatDayShort(e.event_date)}</span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <button
                                type="button"
                                onClick={() => onFocusPerson(a.userId)}
                                className="w-full border-t border-[#E3DDCF] px-3 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[#1C1B17] hover:bg-[#F1EEE0]"
                              >
                                → Focus the screen on {a.name}
                              </button>
                            </div>
                          </div>
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
