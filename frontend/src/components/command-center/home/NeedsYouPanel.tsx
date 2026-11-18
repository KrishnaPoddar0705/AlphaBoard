import { useState, type ReactNode } from 'react'
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
 * Exceptions only: entries an analyst deliberately pushed to the viewer, and the
 * viewer's own pushes nobody has answered. Routine logged work never lands here -- escalation is opt-in.
 * A pushed entry is answered by replying in its comments, which also clears it.
 */
export default function NeedsYouPanel({
  needs, waitingOnPm, isManager, now, onOpen, className,
}: Props) {
  const total = needs.total + waitingOnPm.length

  return (
    <TerminalPanel code="ATTN" title="Needs your attention" count={total} alert className={className} id="cc-needs">
      {total === 0 ? (
        <PanelEmpty>
          {isManager
            ? 'Nothing waiting: nothing pushed to you.'
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
        </>
      )}
    </TerminalPanel>
  )
}
