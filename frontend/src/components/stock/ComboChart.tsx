import React from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts'
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
      <div className={`h-[${height}px] w-full bg-[#FBF7ED] border border-[#E3DDCF] flex items-center justify-center`}>
        <p className="text-xs font-mono text-[#6F6A60]">No data available</p>
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
      color: '#D06030',
    },
    netIncome: {
      label: 'Net Income',
      color: '#F09070',
    },
    profitMargin: {
      label: 'Profit Margin %',
      color: '#D06030',
    },
  }

  return (
    <ChartContainer config={config} className={`h-[${height}px] w-full`}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E3DDCF" />
        <XAxis
          dataKey="period"
          stroke="#6F6A60"
          fontSize={10}
          tick={{ fill: '#6F6A60' }}
          fontFamily="ui-monospace, monospace"
        />
        <YAxis
          yAxisId="left"
          stroke="#6F6A60"
          fontSize={10}
          tick={{ fill: '#6F6A60' }}
          fontFamily="ui-monospace, monospace"
          tickFormatter={(value) => `$${value}M`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#6F6A60"
          fontSize={10}
          tick={{ fill: '#6F6A60' }}
          fontFamily="ui-monospace, monospace"
          tickFormatter={(value) => `${value}%`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Legend />
        <Bar yAxisId="left" dataKey="revenue" fill="#D06030" radius={[2, 2, 0, 0]} />
        <Bar yAxisId="left" dataKey="netIncome" fill="#F09070" radius={[2, 2, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="profitMargin"
          stroke="#D06030"
          strokeWidth={2}
          dot={{ fill: '#D06030', r: 4 }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

