import { SIGNAL, eventTypeOf } from '@/lib/commandCenter/constants'
import { ownerName, relativeTime } from '@/lib/commandCenter/home'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

interface Props {
  rows: ActivityFeedRow[]
  now: Date
  onOpen: (row: ActivityFeedRow) => void
}

/**
 * A scrolling tape of the latest logged entries. The list is rendered twice so the loop
 * is seamless; motion stops on hover and for anyone who prefers reduced motion.
 */
export default function TickerTape({ rows, now, onOpen }: Props) {
  if (rows.length === 0) return null
  const duration = Math.max(30, rows.length * 6)

  const items = (copy: number) => rows.map((r) => {
    const s = r.thesis_impact ? SIGNAL[r.thesis_impact] : null
    return (
      <button
        key={`${copy}-${r.event_id}`}
        type="button"
        tabIndex={copy === 0 ? 0 : -1}
        aria-hidden={copy === 1}
        onClick={() => onOpen(r)}
        className="inline-flex shrink-0 items-center gap-1.5 px-4 font-mono text-[11px] text-[#F1EEE0] hover:text-white"
      >
        <span className="font-semibold">{r.ticker}</span>
        <span style={{ color: s?.color ?? '#8B857A' }}>{s?.glyph ?? '·'}</span>
        <span className="text-[#CFC8B8]">{eventTypeOf(r.kind, r.subtype).label}</span>
        <span className="text-[#8B857A]">{ownerName(r)} · {relativeTime(r.created_at, now)}</span>
      </button>
    )
  })

  return (
    <div className="cc-tape group relative overflow-hidden rounded-md border border-[#1C1B17] bg-[#1C1B17] py-1.5">
      <style>{`
        @keyframes cc-tape { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .cc-tape-track { animation: cc-tape ${duration}s linear infinite; }
        .cc-tape:hover .cc-tape-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .cc-tape-track { animation: none; } }
      `}</style>
      <div className="cc-tape-track flex w-max">
        {items(0)}
        {items(1)}
      </div>
    </div>
  )
}
