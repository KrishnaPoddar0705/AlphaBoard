import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { EVENT_TYPES, PRIMARY_EVENT_TYPE_IDS, type EventTypeOption }
  from '@/lib/commandCenter/constants'

interface Props {
  value: EventTypeOption | null
  onChange: (type: EventTypeOption) => void
}

/**
 * Big tiles, not a dropdown.
 *
 * An analyst thinks "I just did a plant visit", not "kind = management_meeting,
 * subtype = plant_visit". The six things people log most sit above the fold; the rest
 * are one tap away, so the common path never pays for the rare one.
 */
export default function EventTypePicker({ value, onChange }: Props) {
  const [showAll, setShowAll] = useState(false)
  const primary = EVENT_TYPES.filter((t) => PRIMARY_EVENT_TYPE_IDS.includes(t.id))
  const rest = EVENT_TYPES.filter((t) => !PRIMARY_EVENT_TYPE_IDS.includes(t.id))
  const shown = showAll ? [...primary, ...rest] : primary

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-3">
        {shown.map((t) => {
          const Icon = t.icon
          const active = value?.id === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t)}
              aria-pressed={active}
              className={[
                'flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 transition-colors',
                active
                  ? 'border-[#1C1B17] bg-[#1C1B17] text-[#F7F2E6]'
                  : 'border-[#D7D0C2] bg-[#FBF7ED] text-[#1C1B17] hover:border-[#8B857A] hover:bg-[rgba(28,27,23,0.04)]',
              ].join(' ')}
            >
              <Icon className="h-5 w-5" />
              <span className="text-center font-mono text-[11px] leading-tight">{t.label}</span>
            </button>
          )
        })}
      </div>

      {!showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="inline-flex items-center gap-1 self-start font-mono text-[11px] text-[#6F6A60] hover:text-[#1C1B17]"
        >
          <ChevronDown className="h-3 w-3" /> More types
        </button>
      )}
    </div>
  )
}
