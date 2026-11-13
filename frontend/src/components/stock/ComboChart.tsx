// import React from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

interface ComboChartProps {
  data: Array<{
    period: string
    revenue: number
    netIncome: number
    netProfitMargin: number
  }>
  height?: number
}

export function ComboChart({ data, height = 300 }: ComboChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`h-[${height}px] w-full bg-paper-alt border border-gridline flex items-center justify-center`}>
        <p className="text-xs font-mono text-ink-muted">No data available</p>
      </div>
    )
  }

  const chartData = data.map((item) => ({
    period: item.period || 'N/A',
    revenue: (item.revenue || 0) / 1e6, // Convert to millions
    netIncome: (item.netIncome || 0) / 1e6,
    profitMargin: item.netProfitMargin || 0,
  }))

  const config = {
    revenue: {
      label: 'Revenue',
      color: 'var(--color-chart-orange)',
    },
    netIncome: {
      label: 'Net Income',
      color: 'var(--color-chart-salmon)',
    },
    profitMargin: {
      label: 'Profit Margin %',
      color: 'var(--color-chart-orange)',
    },
  }

  return (
    <ChartContainer config={config} className="w-full" style={{ height: `${height}px`, width: '100%' }}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gridline)" />
        <XAxis
          dataKey="period"
          stroke="var(--color-ink-muted)"
          fontSize={10}
          tick={{ fill: 'var(--color-ink-muted)' }}
          fontFamily="ui-monospace, monospace"
        />
        <YAxis
          yAxisId="left"
          stroke="var(--color-ink-muted)"
          fontSize={10}
          tick={{ fill: 'var(--color-ink-muted)' }}
          fontFamily="ui-monospace, monospace"
          tickFormatter={(value) => `$${value}M`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="var(--color-ink-muted)"
          fontSize={10}
          tick={{ fill: 'var(--color-ink-muted)' }}
          fontFamily="ui-monospace, monospace"
          tickFormatter={(value) => `${value}%`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        <Bar yAxisId="left" dataKey="revenue" fill="var(--color-chart-orange)" radius={[2, 2, 0, 0]} />
        <Bar yAxisId="left" dataKey="netIncome" fill="var(--color-chart-salmon)" radius={[2, 2, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="profitMargin"
          stroke="var(--color-chart-orange)"
          strokeWidth={2}
          dot={{ fill: 'var(--color-chart-orange)', r: 4 }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

