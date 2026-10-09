import { SVAN_RATINGS, svanRatingOf } from '@/lib/commandCenter/constants'
import type { SvanRating } from '@/lib/commandCenter/types'

export interface SvanValues {
  rating: SvanRating | null
  view: string
}

interface Props {
  values: SvanValues
  onChange: (next: SvanValues) => void
}

/**
 * The analyst's own opinion, asked for just above the key takeaways: a five-step meter
 * from strong sell to strong buy, and a line or two on why. The box takes the colour of
 * the rating so the stance is visible before a word is read.
 */
export default function SvanViewField({ values, onChange }: Props) {
  const color = svanRatingOf(values.rating)?.color

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-wider text-[#6F6A60]">Svan View</span>
      <div className="grid grid-cols-5 overflow-hidden rounded-lg border border-[#D7D0C2]" role="group" aria-label="Svan rating">
        {SVAN_RATINGS.map((r, i) => {
          const on = values.rating === r.value
          return (
            <button
              key={r.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...values, rating: on ? null : r.value })}
              className={`px-1 py-1.5 font-mono text-[10px] leading-tight transition-colors sm:text-[11px] ${i ? 'border-l border-[#D7D0C2]' : ''} ${on ? 'text-[#F7F2E6]' : 'bg-[#FBF7ED] hover:bg-[rgba(28,27,23,0.04)]'}`}
              style={on ? { backgroundColor: r.color } : { color: r.color }}
            >
              {r.label}
            </button>
          )
        })}
      </div>
      <textarea
        value={values.view}
        onChange={(e) => onChange({ ...values, view: e.target.value })}
        rows={3}
        placeholder="Your view: what do you make of this, and where do you stand on the stock?"
        className="w-full rounded-lg border bg-[#FBF7ED] px-2.5 py-2 font-mono text-sm text-[#1C1B17] placeholder:text-[#8B857A] focus:outline-none"
        style={{ borderColor: color ?? '#D7D0C2', borderLeftWidth: color ? 4 : 1 }}
      />
    </div>
  )
}
