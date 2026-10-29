import { Link } from 'react-router-dom'
import { Maximize2, PenLine } from 'lucide-react'
import CellActions from './CellActions'
import { isBoardEntry } from '@/lib/commandCenter/boardFormat'
import { useBoardTree } from '@/hooks/commandCenter/useBoards'
import type { BoardSummary } from '@/lib/commandCenter/boardTypes'
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
  /** Stock rows: the viewer's unpublished Thinking Board drafts for this stock are listed too. */
  coverageId?: string
}

/**
 * Source documents as research artifacts: one row per entry that carries files -- what
 * kind of source it is, a concise title and its date. The type icon says what it is, so
 * no PDF icon is repeated per row; a count appears only when an entry holds several.
 * File names load when the pop view opens.
 */
export default function SourceDocsCell({ entries, showTicker = false, onOpen, coverageId }: Props) {
  // Drafts are private to the viewer (RLS), so these are only ever their own boards.
  // Published boards already arrive as entries, tagged by their board marker.
  const { data: tree } = useBoardTree()
  const drafts = coverageId
    ? (tree?.boards ?? []).filter((b) => b.coverage_id === coverageId && !b.published_event_id)
    : []
  if (entries.length === 0 && drafts.length === 0) return <span className={`${type.monoFaint} opacity-50`}>—</span>
  const shownDrafts = drafts.slice(0, SHOWN)
  const shownEntries = entries.slice(0, Math.max(0, SHOWN - shownDrafts.length))
  const more = entries.length + drafts.length - shownDrafts.length - shownEntries.length

  return (
    <div className="relative">
      <CellActions>
        <CellActions.Button label="Open source documents" onClick={() => onOpen()}><Maximize2 className="size-3" /></CellActions.Button>
      </CellActions>
      <ul className="-mx-1.5 space-y-px">
        {shownDrafts.map((b) => <DraftRow key={b.id} board={b} />)}
        {shownEntries.map((e) => <DocRow key={e.event_id} entry={e} showTicker={showTicker} onOpen={onOpen} />)}
      </ul>
      {more > 0 && (
        <button type="button" onClick={() => onOpen()} className={`${type.help} mt-0.5 rounded-(--mx-radius-sm) hover:text-(--mx-text)`}>
          +{more} more
        </button>
      )}
    </div>
  )
}

/** An unpublished board: opens the board itself, since it has no log entry yet. */
function DraftRow({ board }: { board: BoardSummary }) {
  return (
    <li>
      <Link
        to={`/command-center?view=thinking&note=${board.id}`}
        title={`Thinking Board draft · ${board.title}`}
        className="flex h-6 w-full min-w-0 items-center gap-2 rounded-(--mx-radius-sm) px-1.5 text-left transition-colors hover:bg-(--mx-hover)"
      >
        <PenLine className="size-3.5 shrink-0 text-(--mx-text-3)" aria-label="Thinking Board" />
        <span className={`${type.body} min-w-0 flex-1 truncate`}>{board.title}</span>
        <span className={`${type.monoFaint} shrink-0`}>Draft</span>
      </Link>
    </li>
  )
}

export function DocRow({ entry, showTicker, onOpen }: {
  entry: ActivityFeedRow; showTicker: boolean; onOpen: (eventId?: string) => void
}) {
  const kind = eventTypeOf(entry.kind, entry.subtype)
  const fromBoard = isBoardEntry(entry.kta)
  // A board note reads as what it is -- a written research note -- not as its log kind.
  const Icon = fromBoard ? PenLine : kind.icon
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(entry.event_id)}
        title={fromBoard
          ? `Thinking Board note · ${entry.title}`
          : `${kind.label} · ${entry.title} · ${entry.attachment_count} file${entry.attachment_count === 1 ? '' : 's'}`}
        className="flex h-6 w-full min-w-0 items-center gap-2 rounded-(--mx-radius-sm) px-1.5 text-left transition-colors hover:bg-(--mx-hover)"
      >
        <Icon className="size-3.5 shrink-0 text-(--mx-text-3)" aria-label={kind.label} />
        <span className={`${type.body} min-w-0 flex-1 truncate`}>
          {showTicker && <span className="font-mono text-[11px] text-(--mx-text-2)">{entry.ticker} </span>}
          {fromBoard || !entry.period_label ? entry.title : `${kind.label} ${entry.period_label}`}
        </span>
        {entry.attachment_count > 1 && <span className={type.monoFaint}>×{entry.attachment_count}</span>}
        <span className={`${type.monoFaint} shrink-0`}>{formatDayShort(entry.event_date)}</span>
      </button>
    </li>
  )
}
