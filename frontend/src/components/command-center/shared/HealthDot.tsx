import { healthBandFor, HEALTH_COLORS } from '@/lib/commandCenter/constants'
import { relativeDays } from '@/lib/commandCenter/format'

interface Props {
  daysSince: number | null
  lastInteractionOn: string | null
  withLabel?: boolean
}

const BAND_TEXT: Record<ReturnType<typeof healthBandFor>, string> = {
  fresh: 'Active',
  stale: 'Going quiet',
  cold: 'Needs attention',
  untouched: 'Nothing logged yet',
}

/**
 * Days since anyone last touched this name, colour-banded.
 *
 * This is the single most important number on the board: a red dot is a covered stock
 * nobody has engaged with in a quarter, which is exactly what an admin wants to spot
 * without asking anyone.
 */
export default function HealthDot({ daysSince, lastInteractionOn, withLabel = true }: Props) {
  const band = healthBandFor(daysSince)
  const { dot, text } = HEALTH_COLORS[band]
  return (
    <span className="inline-flex items-center gap-1.5" title={BAND_TEXT[band]}>
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: dot }}
        aria-hidden
      />
      {withLabel && (
        <span className="font-mono text-[11px]" style={{ color: text }}>
          {lastInteractionOn ? relativeDays(lastInteractionOn) : 'no activity'}
        </span>
      )}
    </span>
  )
}
