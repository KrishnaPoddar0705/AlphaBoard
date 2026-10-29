import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import toast from 'react-hot-toast'
import { useBoard } from '@/hooks/commandCenter/useBoards'
import type { Board, BoardCard, ConnectorId, DocNode, SourceItem } from '@/lib/commandCenter/boardTypes'
import type { CoverageBoardRow } from '@/lib/commandCenter/types'
import { docToMarkdown, countWords } from '@/lib/commandCenter/docToMarkdown'
import { upgradeDoc } from '@/lib/commandCenter/sourceBlock'
import { formatItemDate } from '@/lib/commandCenter/boardFormat'
import { pullKey } from '@/lib/commandCenter/boardSources'
import DocEditor from './editor/DocEditor'
import BoardCanvas from './canvas/BoardCanvas'
import ConnectorRail from './connectors/ConnectorRail'
import GhostCursor from './connectors/GhostCursor'
import { useConnectorPull } from './connectors/useConnectorPull'
import BoardHeader from './BoardHeader'
import PublishToLogDialog from './PublishToLogDialog'
import { useAutosave, readLocalDraft } from './useAutosave'
import { useCanvasLayout } from './useCanvasLayout'
import { exportNoteAsPdf } from './exportPdf'

interface Props {
  boardId: string
  coverage: CoverageBoardRow | undefined
  folderName: string | null
  compact: boolean
  onOpenTree?: () => void
}

/** Loads a note, then hands it to the editor surface keyed by id so each note starts clean. */
export default function NoteWorkspace(props: Props) {
  const { data: board, isPending, error } = useBoard(props.boardId)
  if (isPending) {
    return (
      <div className="tb-canvas flex h-full flex-1 justify-center px-6 py-6">
        <div className="tb-sheet h-[70vh] w-full max-w-[760px] p-12" aria-busy>
          <div className="tb-shimmer h-9 w-2/3 rounded" />
          <div className="tb-shimmer mt-8 h-3 w-full rounded" />
          <div className="tb-shimmer mt-3 h-3 w-11/12 rounded" />
          <div className="tb-shimmer mt-3 h-3 w-4/5 rounded" />
        </div>
      </div>
    )
  }
  if (error || !board) {
    return (
      <div className="tb-canvas flex h-full flex-1 items-center justify-center p-6 font-mono text-xs text-[#6F6A60]">
        {error instanceof Error ? error.message : 'This note was deleted. Pick another from the list.'}
      </div>
    )
  }
  return <LoadedNote key={board.id} board={board} {...props} />
}

function LoadedNote({ board, coverage, folderName, compact, onOpenTree }: Props & { board: Board }) {
  // A crash between keystroke and save leaves a newer local copy; prefer it.
  // Older notes hold locked data blocks; upgradeDoc turns them into editable source blocks.
  const initial = useMemo(() => {
    const merged = { ...board, ...(readLocalDraft(board.id, board.updated_at) ?? {}) }
    return { ...merged, doc: upgradeDoc(merged.doc) }
  }, [board])
  const [title, setTitle] = useState(initial.title)
  const [cards, setCards] = useState<BoardCard[]>(initial.cards ?? [])
  const [doc, setDoc] = useState<DocNode>(initial.doc)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [published, setPublished] = useState({ id: board.published_event_id, at: board.last_published_at })
  const [quarter, setQuarter] = useState('')
  const canvasRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const layout = useCanvasLayout(canvasRef)
  const { status, schedule, flush } = useAutosave(board.id)

  const ticker = coverage?.ticker ?? null

  const onDocChange = useCallback((next: DocNode) => {
    setDoc(next)
    schedule({ doc: next, doc_markdown: docToMarkdown(next) })
  }, [schedule])

  const updateCards = useCallback((fn: (prev: BoardCard[]) => BoardCard[]) => {
    setCards((prev) => {
      const next = fn(prev)
      schedule({ cards: next })
      return next
    })
  }, [schedule])

  // Points at a card that is already on the board: expands it, scrolls it into view and
  // briefly highlights it.
  const [flashId, setFlashId] = useState<string | null>(null)
  const reveal = useCallback((id: string) => {
    setCards((prev) => prev.some((c) => c.id === id && c.collapsed)
      ? prev.map((c) => (c.id === id ? { ...c, collapsed: false } : c)) : prev)
    setFlashId(id)
    window.setTimeout(() => setFlashId((f) => (f === id ? null : f)), 1600)
    requestAnimationFrame(() => {
      const el = [...document.querySelectorAll<HTMLElement>(`[data-card="${id}"]`)].find((n) => n.offsetParent !== null)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    })
  }, [])

  const insertBlock = useCallback((card: BoardCard, at?: number) => {
    if (!editor) return
    editor.chain().focus().insertConnectorBlock(card.payload, at).run()
  }, [editor])

  const { pending, pull, retry, dismiss, abortAll } = useConnectorPull({
    ticker,
    onResolved: (card, { insertAt, replaceId }) => {
      if (insertAt !== undefined) {
        insertBlock(card, insertAt)
        // Keep the snapshot on the canvas too, so pulling it again reuses it.
        updateCards((prev) => [{ ...card, side: 'right', collapsed: true }, ...prev])
        return
      }
      if (replaceId) {
        updateCards((prev) => prev.map((c) => (c.id === replaceId ? { ...card, side: c.side } : c)))
        reveal(replaceId)
        return
      }
      // In the two-gutter layout, new cards alternate sides so neither gutter overflows first.
      updateCards((prev) => {
        const left = prev.filter((c) => c.side === 'left').length
        const side = layout === 'double' && left < prev.length - left ? 'left' : 'right'
        return [{ ...card, side }, ...prev]
      })
    },
  })
  useEffect(() => abortAll, [abortAll])

  const onPull = useCallback((id: ConnectorId, origin: { x: number; y: number } | null, insertAt?: number) => {
    if (!ticker) { toast.error('This note is not linked to a stock.'); return }
    // Already on the board (or on its way) for this period: reuse it, don't spend a call.
    const key = pullKey(id, quarter || null)
    const have = cards.find((c) => pullKey(c.payload.connector, c.quarter) === key)
    if (have) {
      if (insertAt !== undefined) {
        insertBlock(have, insertAt)
        toast.success('Inserted the copy already on this board')
      } else {
        reveal(have.id)
      }
      return
    }
    const inFlight = pending.find((p) => p.status === 'loading' && pullKey(p.connector, p.quarter) === key)
    if (inFlight) { reveal(inFlight.id); return }
    pull(id, { origin, insertAt, quarter: quarter || null })
  }, [pull, ticker, quarter, cards, pending, insertBlock, reveal])

  const refreshCard = useCallback((card: BoardCard) => {
    pull(card.payload.connector, { quarter: card.quarter ?? null, replaceId: card.id })
  }, [pull])

  const onSlashPull = useCallback((id: ConnectorId, at: number) => {
    const caret = editor?.view.coordsAtPos(at)
    onPull(id, caret ? { x: caret.left, y: caret.top } : null, at)
  }, [editor, onPull])

  const citeItem = useCallback((card: BoardCard, item: SourceItem) => {
    if (!editor) return
    const meta = [formatItemDate(item.date), item.tag, card.payload.source].filter(Boolean).join(' / ')
    const titleText = { type: 'text', text: item.title, ...(item.url ? { marks: [{ type: 'link', attrs: { href: item.url } }] } : {}) }
    editor.chain().focus().insertContent([
      { type: 'blockquote', content: [
        { type: 'paragraph', content: [titleText] },
        ...(item.summary ? [{ type: 'paragraph', content: [{ type: 'text', text: item.summary }] }] : []),
        { type: 'paragraph', content: [{ type: 'text', text: meta, marks: [{ type: 'italic' }] }] },
      ] },
      { type: 'paragraph' },
    ]).run()
  }, [editor])

  const busy = useMemo(() => new Set(pending.filter((p) => p.status === 'loading').map((p) => p.connector)), [pending])
  const ghost = pending.find((p) => p.status === 'loading' && p.origin) ?? null
  const words = useMemo(() => countWords(doc), [doc])
  const blocks = useMemo(() => (doc.content ?? []).filter((n) => n.type === 'sourceBlock' || n.type === 'connectorBlock').length, [doc])

  const titleField = (
    <input className="tb-title" value={title} placeholder="Untitled note" maxLength={300} aria-label="Note title"
      onChange={(e) => { setTitle(e.target.value); schedule({ title: e.target.value.trim() || 'Untitled note' }) }}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); editor?.commands.focus('start') } }} />
  )

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <BoardHeader ticker={ticker ?? '—'} company={coverage?.company_name ?? null} folder={folderName}
        status={status} words={words} lastPublishedAt={published.at}
        onPublish={async () => { await flush(); setPublishOpen(true) }}
        onExport={() => {
          if (!sheetRef.current) return
          void flush()
          exportNoteAsPdf(sheetRef.current, {
            ticker: ticker ?? '', company: coverage?.company_name ?? null, title: title.trim() || 'Untitled note',
          })
        }}
        onRetrySave={() => void flush()} onOpenTree={onOpenTree} />

      <div className="flex min-h-0 flex-1">
        <BoardCanvas ref={canvasRef} layout={layout} cards={cards} pending={pending}
          onCardChange={(c) => updateCards((prev) => prev.map((x) => (x.id === c.id ? c : x)))}
          onCardRemove={(id) => updateCards((prev) => prev.filter((x) => x.id !== id))}
          onCardInsert={(c) => { insertBlock(c); toast.success('Added to the note') }}
          onItemInsert={citeItem} onRetry={retry} onDismiss={dismiss}
          flashId={flashId} onCardRefresh={refreshCard}>
          <div ref={sheetRef} className="tb-sheet">
            <DocEditor initialDoc={initial.doc} onChange={onDocChange} onPull={onSlashPull}
              onReady={setEditor} title={titleField} />
          </div>
        </BoardCanvas>

        {!compact && (
          <div className="tb-canvas flex min-h-0 flex-none flex-col border-l border-[#E3DDCF] py-3 pr-3">
            <ConnectorRail orientation="vertical" onPull={(id, o) => onPull(id, o)} busy={busy}
              quarter={quarter} onQuarter={setQuarter} disabled={!ticker} />
          </div>
        )}
      </div>

      {compact && (
        <div className="flex-none border-t border-[#DDD6C7] bg-[#F1EEE0] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <ConnectorRail orientation="horizontal" onPull={(id, o) => onPull(id, o)} busy={busy}
            quarter={quarter} onQuarter={setQuarter} disabled={!ticker} />
        </div>
      )}

      <GhostCursor pull={ghost} />

      {coverage && (
        <PublishToLogDialog open={publishOpen} onClose={() => setPublishOpen(false)}
          boardId={board.id} coverageId={coverage.id} ticker={coverage.ticker} noteTitle={title.trim() || 'Untitled note'}
          publishedEventId={published.id} getMarkdown={() => (editor ? docToMarkdown(editor.getJSON() as DocNode) : docToMarkdown(doc))}
          words={words} blocks={blocks}
          onPublished={(id) => setPublished({ id, at: new Date().toISOString() })} />
      )}
    </div>
  )
}
