import { Maximize2 } from 'lucide-react'
import CellActions from './CellActions'
import { eventTypeOf } from '@/lib/commandCenter/constants'
import { formatDayShort } from '@/lib/commandCenter/format'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'
import { type } from './styles'

/** Documents shown before "+N more". */
const SHOWN = 2

interface Props {
  /** Entries with files, newest first. */
  entries: ActivityFeedRow[]
  /** Name the company on each row (By Analyst rows). */
  showTicker?: boolean
  /** Opens the pop view on the documents, optionally on one entry's files. */
  onOpen: (eventId?: string) => void
}

/**
 * Source documents as research artifacts: one row per entry that carries files -- what
 * kind of source it is, a concise title and its date. The type icon says what it is, so
 * no PDF icon is repeated per row; a count appears only when an entry holds several.
 * File names load when the pop view opens.
 */
export default function SourceDocsCell({ entries, showTicker = false, onOpen }: Props) {
  if (entries.length === 0) return <span className={`${type.monoFaint} opacity-50`}>—</span>
  const more = entries.length - SHOWN

  return (
    <div className="relative">
      <CellActions>
        <CellActions.Button label="Open source documents" onClick={() => onOpen()}><Maximize2 className="size-3" /></CellActions.Button>
      </CellActions>
      <ul className="-mx-1.5 space-y-px">
        {entries.slice(0, SHOWN).map((e) => <DocRow key={e.event_id} entry={e} showTicker={showTicker} onOpen={onOpen} />)}
      </ul>
      {more > 0 && (
        <button type="button" onClick={() => onOpen()} className={`${type.help} mt-0.5 rounded-(--mx-radius-sm) hover:text-(--mx-text)`}>
          +{more} more
        </button>
      )}
    </div>
  )
}

export function DocRow({ entry, showTicker, onOpen }: {
  entry: ActivityFeedRow; showTicker: boolean; onOpen: (eventId?: string) => void
}) {
  const kind = eventTypeOf(entry.kind, entry.subtype)
  const Icon = kind.icon
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(entry.event_id)}
        title={`${kind.label} · ${entry.title} · ${entry.attachment_count} file${entry.attachment_count === 1 ? '' : 's'}`}
        className="flex h-6 w-full min-w-0 items-center gap-2 rounded-(--mx-radius-sm) px-1.5 text-left transition-colors hover:bg-(--mx-hover)"
      >
        <Icon className="size-3.5 shrink-0 text-(--mx-text-3)" aria-label={kind.label} />
        <span className={`${type.body} min-w-0 flex-1 truncate`}>
          {showTicker && <span className="font-mono text-[11px] text-(--mx-text-2)">{entry.ticker} </span>}
          {entry.period_label ? `${kind.label} ${entry.period_label}` : entry.title}
        </span>
        {entry.attachment_count > 1 && <span className={type.monoFaint}>×{entry.attachment_count}</span>}
        <span className={`${type.monoFaint} shrink-0`}>{formatDayShort(entry.event_date)}</span>
      </button>
    </li>
  )
}
