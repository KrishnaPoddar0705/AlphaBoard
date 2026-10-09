import { svanRatingOf } from '@/lib/commandCenter/constants'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

interface Props {
  event: Pick<ActivityFeedRow, 'svan_view' | 'svan_rating'>
  className?: string
}

/**
 * The desk's own opinion on an entry, shown above the key takeaways: what the analyst
 * makes of it, tinted by where they stand -- red for strong sell through green for
 * strong buy. Renders nothing when neither a view nor a rating was recorded.
 */
export default function SvanView({ event, className = '' }: Props) {
  const rating = svanRatingOf(event.svan_rating)
  if (!event.svan_view && !rating) return null
  const color = rating?.color ?? '#8B857A'

  return (
    <div
      className={`rounded-lg border-l-4 px-3 py-2 ${className}`}
      style={{ borderColor: color, backgroundColor: `${color}14` }}
    >
      <p className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color }}>
        Svan View
        {rating && (
          <span className="rounded px-1.5 py-0.5 text-[#F7F2E6]" style={{ backgroundColor: color }}>
            {rating.label}
          </span>
        )}
      </p>
      {event.svan_view && (
        <p className="mt-1 whitespace-pre-wrap font-mono text-xs leading-relaxed text-[#1C1B17]">{event.svan_view}</p>
      )}
    </div>
  )
}
