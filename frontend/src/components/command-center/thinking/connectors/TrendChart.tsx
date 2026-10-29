import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'
import { formatCell, shortPeriod, SERIES_COLORS, type ChartPlan } from '@/lib/commandCenter/boardFormat'

const THEME = {
  text: { fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fill: '#6F6A60' },
  axis: { ticks: { line: { stroke: '#D7D0C2' }, text: { fill: '#8B857A', fontSize: 10 } } },
  grid: { line: { stroke: '#E3DDCF', strokeDasharray: '2 3' } },
  tooltip: { container: { fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, background: '#FBF7ED', color: '#1C1B17', borderRadius: 8, boxShadow: '0 8px 24px -12px rgba(28,27,23,.4)' } },
}

interface Props {
  plan: ChartPlan
  height?: number
  /** Most axis labels that fit without colliding; the rest are thinned out, newest kept. */
  maxTicks?: number
}

/** Every Nth period, always including the newest, so labels never overlap in a narrow card. */
function thinTicks(labels: string[], max: number): string[] {
  if (labels.length <= max) return labels
  const step = Math.ceil(labels.length / max)
  return labels.filter((_, i) => (labels.length - 1 - i) % step === 0)
}

/** Time on the x-axis, always: bars for amounts, a line for percentages. */
export default function TrendChart({ plan, height = 200, maxTicks = 8 }: Props) {
  const labels = plan.periods.map(shortPeriod)
  const ticks = thinTicks(labels, maxTicks)
  const yTick = (v: number | string) => (typeof v === 'number' ? formatCell(v) : v)

  if (plan.type === 'line') {
    const data = plan.series.map((s) => ({
      id: s.label,
      data: labels.map((x, i) => ({ x, y: s.values[i] })),
    }))
    return (
      <div style={{ height }} className="tb-data">
        <ResponsiveLine
          data={data}
          theme={THEME}
          colors={SERIES_COLORS}
          margin={{ top: 12, right: 28, bottom: 26, left: 44 }}
          yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
          axisBottom={{ tickSize: 0, tickPadding: 8, tickValues: ticks }}
          axisLeft={{ tickSize: 0, tickPadding: 6, tickValues: 4, format: yTick }}
          gridYValues={4}
          enableGridX={false}
          pointSize={5}
          pointBorderWidth={1.5}
          pointColor="#FBF7ED"
          pointBorderColor={{ from: 'seriesColor' }}
          lineWidth={1.75}
          curve="monotoneX"
          useMesh
          animate={false}
        />
      </div>
    )
  }

  const keys = plan.series.map((s) => s.label)
  const data = labels.map((period, i) => {
    const point: Record<string, string | number> = { period }
    plan.series.forEach((s) => { point[s.label] = s.values[i] ?? 0 })
    return point
  })
  return (
    <div style={{ height }} className="tb-data">
      <ResponsiveBar
        data={data}
        keys={keys}
        indexBy="period"
        groupMode="grouped"
        theme={THEME}
        colors={SERIES_COLORS}
        margin={{ top: 12, right: 8, bottom: 26, left: 52 }}
        padding={0.28}
        innerPadding={1.5}
        borderRadius={1.5}
        axisBottom={{ tickSize: 0, tickPadding: 8, tickValues: ticks }}
        axisLeft={{ tickSize: 0, tickPadding: 6, tickValues: 4, format: yTick }}
        gridYValues={4}
        enableLabel={false}
        valueFormat={(v) => formatCell(v)}
        animate={false}
      />
    </div>
  )
}
