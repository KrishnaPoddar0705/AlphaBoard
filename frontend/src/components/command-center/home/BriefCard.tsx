import { SVAN_RATINGS } from '@/lib/commandCenter/constants'
import type { Brief } from '@/lib/commandCenter/types'
import { briefDateLabel, durationLabel } from './briefFormat'

interface Props {
  brief: Brief
  selected: boolean
  onSelect: () => void
}

/**
 * One brief in the strip: when, how much happened, the headline, and the House View
 * mix as a thin bar. The weekly card is inked so it stands apart from the dailies.
 */
export default function BriefCard({ brief, selected, onSelect }: Props) {
  const weekly = brief.kind === 'weekly'
  const ratings = SVAN_RATINGS.map((r) => ({ ...r, n: brief.stats.by_rating?.[r.value] ?? 0 })).filter((r) => r.n > 0)
  const rated = ratings.reduce((sum, r) => sum + r.n, 0)
  const duration = durationLabel(brief.audio_seconds)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        'flex w-[220px] shrink-0 snap-start flex-col gap-1.5 rounded-md border px-3 py-2 text-left transition-colors',
        weekly ? 'border-[#1C1B17] bg-[#1C1B17] text-[#F1EEE0]' : 'border-[#D7D0C2] bg-[#FBF7ED] text-[#1C1B17] hover:border-[#1C1B17]',
        selected ? 'ring-2 ring-[#D06030] ring-offset-1 ring-offset-[#F1EEE0]' : '',
      ].join(' ')}
    >
      <span className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em]">
        <span className={weekly ? 'text-[#D06030]' : 'text-[#6F6A60]'}>
          {weekly ? 'Weekly' : 'Daily'} · {briefDateLabel(brief)}
        </span>
        {duration && <span aria-label={`Podcast, ${duration}`}>▶ {duration}</span>}
      </span>
      <span className="line-clamp-3 font-mono text-[11px] leading-snug">
        {brief.headline ?? brief.bullets[0] ?? 'Brief'}
      </span>
      <span className={`mt-auto font-mono text-[10px] tabular-nums ${weekly ? 'text-[#B8B2A4]' : 'text-[#6F6A60]'}`}>
        {brief.stats.entries} logs · {brief.stats.companies} cos · {brief.stats.analysts} analysts
      </span>
      {rated > 0 && (
        <span className="flex h-1 w-full overflow-hidden rounded-full" title="House View mix">
          {ratings.map((r) => (
            <span key={r.value} style={{ width: `${(r.n / rated) * 100}%`, backgroundColor: r.color }} />
          ))}
        </span>
      )}
    </button>
  )
}
