import { useMemo } from 'react'
import { ResponsiveCalendar } from '@nivo/calendar'
import { useActivityCounts } from '@/hooks/commandCenter/useActivityFeed'
import { addDays, today } from '@/lib/commandCenter/format'
import { Bone } from '../shared/Skeleton'
import { useSkinColors } from '@/hooks/useSkinColors'

/**
 * Entries per day over the last year -- the "day to day basis" view.
 *
 * Uses @nivo/calendar, already a dependency for the returns heatmap, so this costs no
 * new package.
 */
export default function AnalystHeatmap({ analystId }: { analystId?: string | null }) {
  const sc = useSkinColors()
  const from = useMemo(() => addDays(today(), -364), [])
  const to = useMemo(() => today(), [])
  const { data = [], isPending } = useActivityCounts(from, to, analystId)

  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="rounded-xl border border-border-editorial bg-paper-light p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
          Entries logged
        </h3>
        {isPending
          ? <Bone className="h-3 w-24" />
          : <span className="font-mono text-[11px] text-ink-muted">{total} in the last year</span>}
      </div>
      {/* Fixed height: ResponsiveCalendar measures its parent and renders nothing in a
          zero-height box. Scrolls horizontally on a phone rather than squashing. */}
      <div className="h-[150px] min-w-[640px] overflow-x-auto">
        {isPending ? <Bone className="h-full w-full" /> : <ResponsiveCalendar
          data={data}
          from={from}
          to={to}
          emptyColor={sc.grid}
          colors={['#CFE3D6', '#8FC4A6', '#5AA57B', '#2F8F5B']}
          margin={{ top: 8, right: 8, bottom: 8, left: 24 }}
          yearSpacing={24}
          monthBorderColor={sc.page}
          dayBorderWidth={2}
          dayBorderColor={sc.surface}
          theme={{ text: { fontFamily: sc.fontFamily, fontSize: 10, fill: sc.inkMuted } }}
        />}
      </div>
    </div>
  )
}
