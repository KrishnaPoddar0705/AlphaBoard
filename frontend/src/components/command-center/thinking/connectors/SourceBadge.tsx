import { BadgeCheck } from 'lucide-react'
import type { SourcePayload } from '@/lib/commandCenter/boardTypes'
import { SOURCE_LABELS } from '@/lib/commandCenter/boardSources'
import { formatFetched, SOURCE_COLORS } from '@/lib/commandCenter/boardFormat'

/** Where a number came from and when -- the reason an analyst can paste it into a thesis. */
export default function SourceBadge({ payload }: { payload: SourcePayload }) {
  const color = SOURCE_COLORS[payload.source]
  return (
    <span className="tb-data inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-[1px] text-[10px]"
      style={{ color, borderColor: `${color}40`, background: `${color}0D` }}
      title={`Pulled from ${SOURCE_LABELS[payload.source]} on ${formatFetched(payload.fetched_at)}`}>
      <BadgeCheck className="h-3 w-3" />
      {SOURCE_LABELS[payload.source]}
      <span className="min-w-0 truncate text-[#8B857A]">{formatFetched(payload.fetched_at)}</span>
    </span>
  )
}
