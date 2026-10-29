import type { ChartPlan } from '@/lib/commandCenter/boardFormat'
import { SERIES_COLORS } from '@/lib/commandCenter/boardFormat'
import TrendChart from './TrendChart'

/**
 * A Thinking Board chart inside a published log entry. Loaded lazily by ThesisMarkdown,
 * so entries without a chart never download the charting code for it. Colours are the
 * board's palette on purpose: the same series reads the same on the board and the log.
 */
export default function PublishedChart({ plan }: { plan: ChartPlan }) {
  return (
    <figure className="my-3 rounded-lg border border-current/15 bg-[#FFFDF7] px-3 pb-2 pt-3">
      <TrendChart plan={plan} height={210} maxTicks={8} />
      <figcaption className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-[#6F6A60]">
        {plan.series.map((s, i) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: SERIES_COLORS[i] }} />{s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
