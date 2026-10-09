import { MessageSquare, Paperclip } from 'lucide-react'
import TerminalPanel, { PanelEmpty } from './TerminalPanel'
import { eventTypeOf, svanRatingOf } from '@/lib/commandCenter/constants'
import { ownerName, relativeTime, type ChangeItem } from '@/lib/commandCenter/home'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

interface Props {
  items: ChangeItem[]
  now: Date
  onOpen: (row: ActivityFeedRow) => void
  className?: string
}

/** Shown for an entry that moved the thesis but carries no Svan rating. */
const UNRATED = '#8B857A'

/**
 * The last week's logs that carry a stance, one line each: the stock, what was logged,
 * who logged it, and its files and comments. The line takes the colour of the Svan
 * rating -- red for strong sell through green for strong buy. Opening it shows the rest.
 */
export default function WhatChangedPanel({ items, now, onOpen, className }: Props) {
  return (
    <TerminalPanel code="CHG" title="What changed · 7d" count={items.length} className={className}>
      {items.length === 0 ? (
        <PanelEmpty>
          No entries with a Svan rating or a thesis move in the last 7 days.
        </PanelEmpty>
      ) : (
        <ul>
          {items.map(({ row }) => {
            const rating = svanRatingOf(row.svan_rating)
            const color = rating?.color ?? UNRATED
            return (
              <li key={row.event_id} className="border-b border-[#E3DDCF] last:border-b-0">
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  className="flex w-full items-center gap-2 border-l-4 px-3 py-2 text-left font-mono text-[11px] transition-colors hover:brightness-95 focus:outline-none focus-visible:brightness-95"
                  style={{ borderColor: color, backgroundColor: `${color}14` }}
                >
                  <span className="shrink-0 text-xs font-semibold text-[#1C1B17]">{row.ticker}</span>
                  <span className="min-w-0 flex-1 truncate text-[#1C1B17]">
                    {eventTypeOf(row.kind, row.subtype).label}
                    <span className="text-[#6F6A60]"> · {ownerName(row)} · {relativeTime(row.created_at, now)}</span>
                  </span>
                  {row.attachment_count > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-[#6F6A60]">
                      <Paperclip className="h-3 w-3" />{row.attachment_count}
                    </span>
                  )}
                  {(row.comment_count ?? 0) > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-[#6F6A60]">
                      <MessageSquare className="h-3 w-3" />{row.comment_count}
                    </span>
                  )}
                  {rating && (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#F7F2E6]" style={{ backgroundColor: color }}>
                      {rating.label}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </TerminalPanel>
  )
}
