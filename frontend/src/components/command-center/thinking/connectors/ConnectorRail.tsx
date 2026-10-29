import type { ConnectorId } from '@/lib/commandCenter/boardTypes'
import { CONNECTORS, recentQuarters } from '@/lib/commandCenter/boardSources'

interface Props {
  onPull: (id: ConnectorId, origin: { x: number; y: number }) => void
  /** Connectors with a pull in flight, shown as busy. */
  busy: Set<ConnectorId>
  quarter: string
  onQuarter: (q: string) => void
  disabled?: boolean
  orientation: 'vertical' | 'horizontal'
}

const QUARTERS = recentQuarters()

/**
 * The data side of the board. Each button pulls one kind of verified data for the
 * note's stock into a card on the canvas. Vertical beside the canvas on desktop; a
 * scrolling dock along the bottom edge on a phone.
 */
export default function ConnectorRail({ onPull, busy, quarter, onQuarter, disabled, orientation }: Props) {
  const vertical = orientation === 'vertical'
  const fire = (id: ConnectorId, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    onPull(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
  }

  const quarterPicker = (
    <label className={vertical ? 'flex flex-col items-center gap-1 px-1 pb-2' : 'flex flex-none items-center gap-1 pr-2'}>
      <span className="tb-data text-[9.5px] text-[#8B857A]">Quarter</span>
      <select value={quarter} onChange={(e) => onQuarter(e.target.value)} disabled={disabled}
        className="tb-data w-[72px] cursor-pointer rounded-md border border-[#DDD6C7] bg-[#FBF7ED] px-1 py-0.5 text-[10.5px] text-[#1C1B17] focus:outline-none"
        title="Used by Concall and Quarterly results">
        <option value="">Latest</option>
        {QUARTERS.map((q) => <option key={q.key} value={q.key}>{q.label}</option>)}
      </select>
    </label>
  )

  return (
    <nav aria-label="Pull data"
      className={vertical
        ? 'tb-card flex max-h-full min-h-0 w-[86px] flex-col items-stretch gap-0.5 overflow-y-auto overscroll-contain px-1.5 py-2.5 [scrollbar-width:thin]'
        : 'tb-card flex items-center gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none]'}>
      {vertical && <p className="tb-data px-1 pb-1.5 text-center text-[9.5px] text-[#8B857A]">Pull data</p>}
      {quarterPicker}
      {CONNECTORS.map((c) => {
        const Icon = c.icon
        const isBusy = busy.has(c.id)
        return (
          <button key={c.id} type="button" disabled={disabled}
            onClick={(e) => fire(c.id, e.currentTarget)}
            title={`${c.label}: ${c.hint}`}
            className={[
              'group flex flex-none flex-col items-center gap-1 rounded-lg px-1 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              vertical ? '' : 'w-[70px]',
              isBusy ? 'bg-[#EFE9DA]' : 'hover:bg-[#EFE9DA]',
            ].join(' ')}>
            <span className={[
              'flex h-8 w-8 items-center justify-center rounded-lg border bg-[#FBF7ED] transition-colors',
              isBusy ? 'border-[#1C1B17]' : 'border-[#DDD6C7] group-hover:border-[#8B857A]',
            ].join(' ')}>
              <Icon className={['h-4 w-4 text-[#1C1B17]', isBusy ? 'animate-pulse' : ''].join(' ')} strokeWidth={1.7} />
            </span>
            <span className="tb-data text-center text-[9.5px] leading-tight text-[#3F3C35]">{c.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
