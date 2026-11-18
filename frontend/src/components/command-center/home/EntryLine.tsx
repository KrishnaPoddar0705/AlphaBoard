import type { ReactNode } from 'react'
import { MessageSquare, Paperclip } from 'lucide-react'
import { SIGNAL, eventTypeOf, svanRatingOf } from '@/lib/commandCenter/constants'
import { ownerName, relativeTime } from '@/lib/commandCenter/home'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'
import MetWith from '../shared/MetWith'
import { useMetWith } from '@/hooks/commandCenter/eventContactsContext'

interface Props {
  row: ActivityFeedRow
  now: Date
  onOpen: (row: ActivityFeedRow) => void
  /** Replaces the thesis glyph, e.g. "?" for a pushed entry. */
  glyph?: ReactNode
  /** A line under the title: the question asked, why it is stale, and so on. */
  detail?: ReactNode
  cta?: string
}

/**
 * One entry as a dense terminal line: signal, ticker, what happened, who, when.
 * Clicking anywhere on it opens the full entry.
 *
 * A Svan-rated entry is colour-coded the way "What changed" is: a left edge and a faint
 * wash in the rating's colour (red for strong sell through green for strong buy) and the
 * rating as a tag on the right. Unrated entries keep a plain line.
 */
export default function EntryLine({ row, now, onOpen, glyph, detail, cta }: Props) {
  const signal = row.thesis_impact ? SIGNAL[row.thesis_impact] : null
  const met = useMetWith(row.event_id)
  const type = eventTypeOf(row.kind, row.subtype)
  const rating = svanRatingOf(row.svan_rating)

  return (
    <li className="border-b border-[#E3DDCF] last:border-b-0">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(row)}
        onKeyDown={(e) => { if (e.key === 'Enter') onOpen(row) }}
        className={[
          'flex cursor-pointer gap-2 border-l-4 px-3 py-2 transition-[background-color,filter] focus:outline-none',
          rating ? 'hover:brightness-95 focus-visible:brightness-95' : 'border-transparent hover:bg-[rgba(28,27,23,0.04)] focus:bg-[rgba(28,27,23,0.06)]',
        ].join(' ')}
        style={rating ? { borderColor: rating.color, backgroundColor: `${rating.color}14` } : undefined}
      >
        <span className="w-3 shrink-0 pt-0.5 text-center font-mono text-xs" style={{ color: signal?.color ?? '#8B857A' }}>
          {glyph ?? signal?.glyph ?? '·'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 font-mono text-xs font-semibold text-[#1C1B17]">{row.ticker}</span>
            <span className="truncate font-mono text-xs text-[#1C1B17]">{row.title}</span>
          </div>
          {detail && <div className="mt-0.5 font-mono text-[11px] text-[#6F6A60]">{detail}</div>}
          <MetWith contacts={met.contacts} count={row.contact_count} loading={met.loading} className="mt-0.5 max-w-full" />
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-[#8B857A]">
            <span>{type.label}</span>
            <span>{ownerName(row)}</span>
            <span>{relativeTime(row.created_at, now)}</span>
            {row.attachment_count > 0 && (
              <span className="inline-flex items-center gap-0.5"><Paperclip className="h-2.5 w-2.5" />{row.attachment_count}</span>
            )}
            {(row.comment_count ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" />{row.comment_count}</span>
            )}
            {cta && <span className="text-[#1C1B17] underline-offset-2 hover:underline">→ {cta}</span>}
          </div>
        </div>
        {rating && (
          <span
            className="h-fit shrink-0 self-start rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#F7F2E6]"
            style={{ backgroundColor: rating.color }}
          >
            {rating.label}
          </span>
        )}
      </div>
    </li>
  )
}
