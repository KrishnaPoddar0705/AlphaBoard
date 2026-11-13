import { EVENT_TYPES } from '@/lib/commandCenter/constants'
import type { LensFilters } from '@/lib/commandCenter/home'

export type Lens = 'stock' | 'analyst'

interface Option { value: string; label: string }

interface Props {
  /** Only managers can switch lens; everyone else reads by stock. */
  canToggleLens: boolean
  lens: Lens
  onLens: (lens: Lens) => void
  filters: LensFilters
  onFilters: (patch: Partial<LensFilters>) => void
  analysts: Option[]
  sectors: string[]
  stocks: Option[]
}

const seg = (on: boolean) => [
  'px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors board:rounded-md board:border-0 board:px-3 board:text-sm',
  on ? 'bg-ink text-paper board:bg-none board:bg-paper-light board:font-medium board:text-ink board:shadow-card' : 'bg-paper-alt text-ink hover:bg-paper board:bg-transparent board:text-ink-muted board:hover:text-ink',
].join(' ')

const select = (on: boolean) => [
  'min-w-0 flex-1 basis-[calc(50%-0.25rem)] rounded-md border bg-paper-alt px-2 py-1 font-mono text-[11px] text-ink focus:outline-none sm:max-w-[12rem] sm:flex-none sm:basis-auto board:h-8 board:rounded-lg board:bg-paper-light board:px-2.5 board:text-sm board:shadow-card board:transition-colors board:hover:border-border-strong board:focus-visible:ring-2 board:focus-visible:ring-brand-500/30',
  on ? 'border-ink' : 'border-border-editorial',
].join(' ')

/**
 * Sits directly above the table it controls: whether to read the desk by stock or by
 * analyst, and which analyst, sector, stock and kind of activity to narrow it to.
 * The filters apply to the table only -- the panels above it keep the whole scope.
 */
export default function LensBar({
  canToggleLens, lens, onLens, filters, onFilters, analysts, sectors, stocks,
}: Props) {
  const active = !!(filters.analystId || filters.sector || filters.coverageId || filters.typeId)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canToggleLens && (
        <div className="inline-flex overflow-hidden rounded-md border border-ink board:gap-0.5 board:rounded-2lg board:border-0 board:bg-[var(--board-segment-track)] board:p-1" role="group" aria-label="View by">
          <button type="button" className={seg(lens === 'stock')} onClick={() => onLens('stock')} aria-pressed={lens === 'stock'}>
            By stock
          </button>
          <button type="button" className={`${seg(lens === 'analyst')} border-l border-ink board:border-l-0`} onClick={() => onLens('analyst')} aria-pressed={lens === 'analyst'}>
            By analyst
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 sm:basis-auto">
        <select
          aria-label="Analyst" className={select(!!filters.analystId)}
          value={filters.analystId ?? ''} onChange={(e) => onFilters({ analystId: e.target.value || null })}
        >
          <option value="">All analysts</option>
          {analysts.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>

        <select
          aria-label="Stock sector" className={select(!!filters.sector)}
          value={filters.sector ?? ''}
          // The stock list follows the sector, so a stock from another sector is dropped.
          onChange={(e) => onFilters({ sector: e.target.value || null, coverageId: null })}
        >
          <option value="">All sectors</option>
          {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          aria-label="Stock" className={select(!!filters.coverageId)}
          value={filters.coverageId ?? ''} onChange={(e) => onFilters({ coverageId: e.target.value || null })}
        >
          <option value="">All stocks</option>
          {stocks.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <select
          aria-label="Activity type" className={select(!!filters.typeId)}
          value={filters.typeId ?? ''} onChange={(e) => onFilters({ typeId: e.target.value || null })}
        >
          <option value="">All activity</option>
          {EVENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>

        {active && (
          <button
            type="button"
            onClick={() => onFilters({ analystId: null, sector: null, coverageId: null, typeId: null })}
            className="font-mono text-[11px] text-ink-muted underline-offset-2 hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
