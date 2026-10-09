import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import TerminalPanel, { PanelEmpty } from './TerminalPanel'
import EntryLine from './EntryLine'
import type { NeedsYou } from '@/lib/commandCenter/home'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

interface Props {
  needs: NeedsYou
  /** The viewer's own pushes nobody has replied to yet (shown to analysts). */
  waitingOnPm: ActivityFeedRow[]
  /** Admin or PM: the people entries get pushed to. */
  isManager: boolean
  staleDays: number
  now: Date
  onOpen: (row: ActivityFeedRow) => void
  className?: string
}

const SHOW = 4

function Group({ title, count, children }: { title: string; count: number; children: (limit: number) => ReactNode }) {
  const [all, setAll] = useState(false)
  if (count === 0) return null
  return (
    <div>
      <h3 className="flex items-center justify-between bg-[#F1EEE0] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#6F6A60]">
        {title}<span className="tabular-nums">{count}</span>
      </h3>
      <ul>{children(all ? count : SHOW)}</ul>
      {count > SHOW && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="w-full px-3 py-1 text-left font-mono text-[10px] text-[#6F6A60] hover:text-[#1C1B17]"
        >
          {all ? 'Show fewer' : `+${count - SHOW} more`}
        </button>
      )}
    </div>
  )
}

/**
 * Exceptions only: entries an analyst deliberately pushed to the viewer, the viewer's
 * own pushes nobody has answered, and covered names nobody has spoken to the company
 * about in a month. Routine logged work never lands here -- escalation is opt-in.
 * A pushed entry is answered by replying in its comments, which also clears it.
 */
export default function NeedsYouPanel({
  needs, waitingOnPm, isManager, staleDays, now, onOpen, className,
}: Props) {
  const total = needs.total + waitingOnPm.length

  return (
    <TerminalPanel code="ATTN" title="Needs your attention" count={total} alert className={className} id="cc-needs">
      {total === 0 ? (
        <PanelEmpty>
          {isManager
            ? 'Nothing waiting: nothing pushed to you, no stale names.'
            : 'Nothing waiting on you.'}
        </PanelEmpty>
      ) : (
        <>
          <Group title="Pushed to you" count={needs.requests.length}>
            {(limit) => needs.requests.slice(0, limit).map((row) => (
              <EntryLine
                key={row.event_id} row={row} now={now} onOpen={onOpen}
                glyph={<span className="text-[#D06030]">?</span>}
                detail={row.review_note ? `“${row.review_note}”` : 'Asked for your view'}
                cta="Reply"
              />
            ))}
          </Group>

          <Group title="Waiting on your PM" count={waitingOnPm.length}>
            {(limit) => waitingOnPm.slice(0, limit).map((row) => (
              <EntryLine
                key={row.event_id} row={row} now={now} onOpen={onOpen}
                glyph={<span className="text-[#D06030]">…</span>}
                detail={row.review_note ? `You asked: “${row.review_note}”` : 'Pushed, no reply yet'}
              />
            ))}
          </Group>

          <Group title={`No primary research > ${staleDays}d`} count={needs.stale.length}>
            {(limit) => needs.stale.slice(0, limit).map(({ coverage, days }) => (
              <li key={coverage.id} className="border-b border-[#E3DDCF] last:border-b-0">
                <Link
                  to={`/command-center/stock/${encodeURIComponent(coverage.ticker)}`}
                  className="flex items-baseline gap-2 px-3 py-2 hover:bg-[rgba(28,27,23,0.04)]"
                >
                  <span className="w-3 shrink-0 text-center font-mono text-xs text-[#B23B2A]">!</span>
                  <span className="shrink-0 font-mono text-xs font-semibold text-[#1C1B17]">{coverage.ticker}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#6F6A60]">
                    {days === null
                      ? 'No meeting, concall or AGM ever logged'
                      : `No meeting, concall or AGM in ${days}d`}
                    {coverage.lead_analyst_username ? ` · ${coverage.lead_analyst_username}` : ' · no lead analyst'}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-[#1C1B17]">→ Open</span>
                </Link>
              </li>
            ))}
          </Group>
        </>
      )}
    </TerminalPanel>
  )
}
