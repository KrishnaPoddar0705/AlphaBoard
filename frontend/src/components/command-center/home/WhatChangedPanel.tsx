import TerminalPanel, { PanelEmpty } from './TerminalPanel'
import EntryLine from './EntryLine'
import type { ChangeItem } from '@/lib/commandCenter/home'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

interface Props {
  items: ChangeItem[]
  now: Date
  onOpen: (row: ActivityFeedRow) => void
  className?: string
}

function firstLine(text: string | null): string | null {
  if (!text) return null
  const line = text.replace(/[#*_>`|-]/g, ' ').split('\n').map((l) => l.trim()).find(Boolean)
  return line ? (line.length > 110 ? `${line.slice(0, 110)}…` : line) : null
}

/** Entries from the last week that the analyst marked as moving the thesis. */
export default function WhatChangedPanel({ items, now, onOpen, className }: Props) {
  return (
    <TerminalPanel code="CHG" title="What changed · 7d" count={items.length} className={className}>
      {items.length === 0 ? (
        <PanelEmpty>
          No entries marked positive or negative for the thesis in the last 7 days.
        </PanelEmpty>
      ) : (
        <ul>
          {items.map(({ row }) => (
            <EntryLine
              key={row.event_id}
              row={row}
              now={now}
              onOpen={onOpen}
              detail={firstLine(row.kta)}
              cta="See why"
            />
          ))}
        </ul>
      )}
    </TerminalPanel>
  )
}
