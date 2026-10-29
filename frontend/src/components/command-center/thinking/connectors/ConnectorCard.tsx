import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { chartPlan } from '@/lib/commandCenter/boardFormat'
import { ArrowLeftRight, BarChart3, ChevronDown, CornerDownLeft, RotateCw, Table2, X } from 'lucide-react'
import type { BoardCard, SourceItem } from '@/lib/commandCenter/boardTypes'
import { CONNECTOR_BY_ID, SOURCE_LABELS } from '@/lib/commandCenter/boardSources'
import SourceView, { type SourceMode } from './SourceView'
import SourceBadge from './SourceBadge'
import type { PendingPull } from './useConnectorPull'

const iconBtn = 'flex h-6 w-6 items-center justify-center rounded-md text-[#8B857A] hover:bg-[#EFE9DA] hover:text-[#1C1B17]'

/** A pull still running, or one that failed. Same footprint as the card it becomes. */
const FLASH = 'ring-2 ring-[#2C4F7C] ring-offset-2 ring-offset-[#F1EEE0]'

export function PendingCard({ pull, onRetry, onDismiss, flash }: {
  pull: PendingPull; onRetry: () => void; onDismiss: () => void; flash?: boolean
}) {
  const def = CONNECTOR_BY_ID[pull.connector]
  const Icon = def.icon
  return (
    <div data-card={pull.id} className={['tb-card w-full p-3.5 transition-shadow', flash ? FLASH : ''].join(' ')}>
      <div className="flex items-center justify-between">
        <p className="tb-data flex items-center gap-1.5 text-[12px] font-medium text-[#1C1B17]">
          <Icon className="h-3.5 w-3.5 text-[#6F6A60]" />{def.label}
        </p>
        <button type="button" onClick={onDismiss} className={iconBtn} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button>
      </div>
      {pull.status === 'loading' ? (
        <>
          <p className="tb-data mt-1 text-[10.5px] text-[#8B857A]">
            Reading {def.sources.map((s) => SOURCE_LABELS[s]).join(', then ')}
          </p>
          <div className="mt-3 flex flex-col gap-1.5" aria-hidden>
            <div className="tb-shimmer h-[92px] rounded-md" />
            <div className="tb-shimmer h-2.5 w-4/5 rounded" />
            <div className="tb-shimmer h-2.5 w-3/5 rounded" />
          </div>
        </>
      ) : (
        <div className="mt-2">
          <p className="text-[12.5px] leading-snug text-[#B23B2A]">{pull.error}</p>
          <button type="button" onClick={onRetry}
            className="tb-data mt-2 inline-flex items-center gap-1 rounded-md border border-[#D7D0C2] px-2 py-1 text-[11px] text-[#1C1B17] hover:border-[#1C1B17]">
            <RotateCw className="h-3 w-3" /> Try again
          </button>
        </div>
      )}
    </div>
  )
}

interface Props {
  card: BoardCard
  canSwapSide: boolean
  onInsert: () => void
  onInsertItem: (item: SourceItem) => void
  onChange: (next: BoardCard) => void
  onRemove: () => void
  /** Re-pulls this card's data in place: the one deliberate way to spend a second call. */
  onRefresh: () => void
  refreshing: boolean
  flash: boolean
}

/** A pulled dataset floating beside the page, waiting to be used. */
export default function ConnectorCard({
  card, canSwapSide, onInsert, onInsertItem, onChange, onRemove, onRefresh, refreshing, flash,
}: Props) {
  const reduce = useReducedMotion()
  const { payload } = card
  const def = CONNECTOR_BY_ID[payload.connector]
  const Icon = def.icon
  const canChart = !!chartPlan(payload.table, payload.chart, 8)
  const [mode, setMode] = useState<SourceMode>(canChart ? 'chart' : 'table')

  return (
    <motion.div
      data-card={card.id}
      initial={reduce ? false : { opacity: 0, scale: 0.97, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      className={['tb-card w-full transition-shadow', flash ? FLASH : ''].join(' ')}
    >
      <div className="flex items-start justify-between gap-2 px-3.5 pb-2 pt-3">
        <button type="button" onClick={() => onChange({ ...card, collapsed: !card.collapsed })}
          className="min-w-0 text-left" aria-expanded={!card.collapsed}>
          <span className="tb-data flex items-center gap-1.5 text-[12px] font-medium text-[#1C1B17]">
            <Icon className="h-3.5 w-3.5 flex-none text-[#6F6A60]" />
            <span className="truncate">{payload.title}</span>
            <ChevronDown className={['h-3 w-3 flex-none text-[#8B857A] transition-transform',
              card.collapsed ? '-rotate-90' : ''].join(' ')} />
          </span>
          {payload.subtitle && <span className="tb-data mt-0.5 block truncate text-[10px] text-[#8B857A]">{payload.subtitle}</span>}
        </button>
        <div className="flex flex-none items-center">
          {canChart && !card.collapsed && (
            <button type="button" className={iconBtn} onClick={() => setMode(mode === 'chart' ? 'table' : 'chart')}
              aria-label={mode === 'chart' ? 'Show table' : 'Show chart'} title={mode === 'chart' ? 'Show table' : 'Show chart'}>
              {mode === 'chart' ? <Table2 className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
            </button>
          )}
          {canSwapSide && (
            <button type="button" className={iconBtn} title="Move to the other side" aria-label="Move to the other side"
              onClick={() => onChange({ ...card, side: card.side === 'left' ? 'right' : 'left' })}>
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" className={iconBtn} onClick={onRefresh} disabled={refreshing}
            aria-label="Pull fresh data" title="Pull fresh data (uses a new request)">
            <RotateCw className={['h-3.5 w-3.5', refreshing ? 'animate-spin' : ''].join(' ')} />
          </button>
          <button type="button" className={iconBtn} onClick={onRemove} aria-label="Remove card" title="Remove card">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Unmounted while collapsed, so the chart re-measures its real size on expand.
          (A framer `layout` animation here used to scale the card, and Nivo measured the
          scaled box -- that was the squashed chart after collapse/expand.) */}
      {!card.collapsed && (
        <div className="max-h-[420px] overflow-y-auto px-3.5 pb-1">
          <SourceView payload={payload} mode={canChart ? mode : 'table'} dense onInsertItem={onInsertItem} />
        </div>
      )}

      {/* The badge gives way (truncating its date) so the button never leaves the card. */}
      <div className="flex min-w-0 items-center justify-between gap-2 border-t border-[#E6E0D2] px-3.5 py-2">
        <span className="min-w-0 overflow-hidden"><SourceBadge payload={payload} /></span>
        <button type="button" onClick={onInsert} title="Insert in note"
          className="tb-data inline-flex flex-none items-center gap-1.5 rounded-md bg-[#1C1B17] px-2.5 py-1 text-[11px] text-[#F7F2E6] hover:bg-[#33312B]">
          <CornerDownLeft className="h-3 w-3" /> Insert
        </button>
      </div>
    </motion.div>
  )
}
