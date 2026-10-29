import { forwardRef, type ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import { MousePointerClick } from 'lucide-react'
import type { BoardCard, SourceItem } from '@/lib/commandCenter/boardTypes'
import ConnectorCard, { PendingCard } from '../connectors/ConnectorCard'
import type { PendingPull } from '../connectors/useConnectorPull'
import { CARD_WIDTH, PAGE_WIDTH, type CanvasLayout } from '../useCanvasLayout'

interface Props {
  layout: CanvasLayout
  cards: BoardCard[]
  pending: PendingPull[]
  onCardChange: (card: BoardCard) => void
  onCardRemove: (id: string) => void
  onCardInsert: (card: BoardCard) => void
  onItemInsert: (card: BoardCard, item: SourceItem) => void
  onRetry: (id: string) => void
  onDismiss: (id: string) => void
  /** A card being pointed at because it was asked for again. */
  flashId: string | null
  onCardRefresh: (card: BoardCard) => void
  /** The document sheet. */
  children: ReactNode
}

/**
 * The desk: a dotted paper canvas with the page locked in the centre and pulled data
 * floating in the gutters. The page never moves; cards come and go around it. Narrow
 * canvases trade the gutters for a swipeable strip of cards above the page.
 */
const BoardCanvas = forwardRef<HTMLDivElement, Props>(function BoardCanvas(
  { layout, cards, pending, onCardChange, onCardRemove, onCardInsert, onItemInsert, onRetry, onDismiss,
    flashId, onCardRefresh, children },
  ref,
) {
  const renderPending = (p: PendingPull) => (
    <PendingCard key={p.id} pull={p} flash={flashId === p.id} onRetry={() => onRetry(p.id)} onDismiss={() => onDismiss(p.id)} />
  )
  const renderCard = (c: BoardCard) => (
    <ConnectorCard key={c.id} card={c} canSwapSide={layout === 'double'}
      flash={flashId === c.id} refreshing={pending.some((p) => p.replaceId === c.id)}
      onRefresh={() => onCardRefresh(c)}
      onChange={onCardChange} onRemove={() => onCardRemove(c.id)}
      onInsert={() => onCardInsert(c)} onInsertItem={(item) => onItemInsert(c, item)} />
  )

  const column = (list: BoardCard[], withPending: boolean, hint: boolean) => (
    <aside style={{ width: CARD_WIDTH }}
      className="sticky top-0 flex max-h-[calc(100dvh-15rem)] flex-none flex-col gap-3 self-start overflow-y-auto pb-6 [scrollbar-width:thin]">
      {withPending && pending.filter((p) => !p.replaceId).map(renderPending)}
      <AnimatePresence initial={false}>{list.map(renderCard)}</AnimatePresence>
      {hint && !list.length && !(withPending && pending.some((p) => !p.replaceId)) && (
        <div className="tb-data mt-10 flex flex-col items-center gap-2 px-6 text-center text-[11px] leading-relaxed text-[#8B857A]">
          <MousePointerClick className="h-4 w-4" />
          Pull financials, concalls or filings from the rail. They land here, ready to drop into the note.
        </div>
      )}
    </aside>
  )

  const left = cards.filter((c) => c.side === 'left')
  const right = cards.filter((c) => c.side !== 'left')

  return (
    <div ref={ref} className="tb-canvas relative h-full min-w-0 flex-1 overflow-y-auto">
      {layout === 'stack' ? (
        <div className="flex flex-col gap-4 px-3 py-4 sm:px-6">
          {(pending.some((p) => !p.replaceId) || cards.length > 0) && (
            <div className="-mx-3 flex snap-x items-start gap-3 overflow-x-auto px-3 pb-1 sm:-mx-6 sm:px-6">
              {[...pending.filter((p) => !p.replaceId).map(renderPending), ...cards.map(renderCard)].map((el, i) => (
                <div key={i} className="w-[min(320px,86vw)] flex-none snap-start">{el}</div>
              ))}
            </div>
          )}
          <div className="mx-auto w-full" style={{ maxWidth: PAGE_WIDTH }}>{children}</div>
        </div>
      ) : (
        <div className="flex min-h-full justify-center gap-10 px-6 py-6">
          {layout === 'double' && column(left, false, false)}
          <div className="w-full min-w-0" style={{ maxWidth: PAGE_WIDTH }}>{children}</div>
          {column(layout === 'double' ? right : cards, true, true)}
        </div>
      )}
    </div>
  )
})

export default BoardCanvas
