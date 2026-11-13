// import React from 'react'
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'

interface PriceChartProps {
  data: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>
  timeframe: string
  height?: number
}

export function PriceChart({ data, timeframe, height: _height = 400 }: PriceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] w-full bg-paper-alt border border-gridline flex items-center justify-center">
        <p className="text-sm font-mono text-ink-muted">No chart data available</p>
      </div>
    )
  }

  // Transform data for chart
  const chartData = data.map((item) => {
    const date = new Date(item.date)
    const isIntraday = timeframe === '1D'
    const dateLabel = isIntraday 
      ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    return {
      date: dateLabel,
      fullDate: item.date,
      price: item.close,
      volume: item.volume,
    }
  })

  const config = {
    price: {
      label: 'Price',
      color: 'var(--color-ink)',
    },
    volume: {
      label: 'Volume',
      color: 'var(--color-ink-muted)',
    },
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-paper-alt border border-border-editorial rounded px-3 py-2 shadow-md">
          <p className="text-xs font-mono text-ink mb-1">{data.fullDate}</p>
          <p className="text-xs font-mono text-ink">
            Price: <span className="font-semibold">${data.price?.toFixed(2) || 'N/A'}</span>
          </p>
          <p className="text-xs font-mono text-ink-muted">
            Volume: <span className="font-semibold">{(data.volume / 1e6).toFixed(2)}M</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <ChartContainer config={config} className="h-[400px] w-full" style={{ height: '400px', width: '100%' }}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gridline)" />
        <XAxis
          dataKey="date"
          stroke="var(--color-ink-muted)"
          fontSize={11}
          tick={{ fill: 'var(--color-ink-muted)' }}
          fontFamily="ui-monospace, monospace"
          angle={timeframe === '1D' ? -45 : 0}
          textAnchor={timeframe === '1D' ? 'end' : 'middle'}
          height={timeframe === '1D' ? 60 : 30}
        />
        {/* Primary Y-axis for Price */}
        <YAxis
          yAxisId="price"
          stroke="var(--color-ink-muted)"
          fontSize={11}
          tick={{ fill: 'var(--color-ink-muted)' }}
          fontFamily="ui-monospace, monospace"
          tickFormatter={(value) => `$${value.toFixed(0)}`}
          orientation="left"
        />
        {/* Secondary Y-axis for Volume */}
        <YAxis
          yAxisId="volume"
          stroke="var(--color-ink-muted)"
          fontSize={10}
          tick={{ fill: 'var(--color-ink-muted)' }}
          fontFamily="ui-monospace, monospace"
          tickFormatter={(value) => `${(value / 1e6).toFixed(0)}M`}
          orientation="right"
          width={60}
        />
        <ChartTooltip content={<CustomTooltip />} />
        {/* Volume bars with 30% opacity on secondary axis */}
        <Bar
          yAxisId="volume"
          dataKey="volume"
          fill="var(--color-ink-muted)"
          opacity={0.3}
          radius={[2, 2, 0, 0]}
        />
        {/* Price line on primary axis */}
        <Line
          yAxisId="price"
          type="monotone"
          dataKey="price"
          stroke="var(--color-ink)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

