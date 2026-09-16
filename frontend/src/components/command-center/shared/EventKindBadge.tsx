import { eventTypeOf } from '@/lib/commandCenter/constants'
import type { EventKind, EventSubtype } from '@/lib/commandCenter/types'

interface Props {
  kind: EventKind
  subtype?: EventSubtype | null
  /** Scheduled entries render outlined, so a plan never reads as a logged fact. */
  scheduled?: boolean
  showLabel?: boolean
}

export default function EventKindBadge({ kind, subtype, scheduled, showLabel = true }: Props) {
  const type = eventTypeOf(kind, subtype)
  const Icon = type.icon
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[11px] whitespace-nowrap',
        scheduled
          ? 'border-dashed border-[#8B857A] text-[#6F6A60]'
          : 'border-[#D7D0C2] bg-[#F1EEE0] text-[#1C1B17]',
      ].join(' ')}
    >
      <Icon className="h-3 w-3" />
      {showLabel && type.label}
    </span>
  )
}
