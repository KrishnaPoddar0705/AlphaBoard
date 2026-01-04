// import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

interface VolumeChartProps {
  data: Array<{ date: string; volume: number }>
  height?: number
}

export function VolumeChart({ data, height = 150 }: VolumeChartProps) {
  if (!data || data.length === 0) {
    return null
  }

  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    volume: item.volume / 1e6, // Convert to millions
  }))

  const config = {
    volume: {
      label: 'Volume (M)',
      color: '#6F6A60',
    },
  }

  return (
    <ChartContainer config={config} className="w-full" style={{ height: `${height}px`, width: '100%' }}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E3DDCF" />
        <XAxis
          dataKey="date"
          stroke="#6F6A60"
          fontSize={10}
          tick={{ fill: '#6F6A60' }}
          fontFamily="ui-monospace, monospace"
        />
        <YAxis
          stroke="#6F6A60"
          fontSize={10}
          tick={{ fill: '#6F6A60' }}
          fontFamily="ui-monospace, monospace"
          tickFormatter={(value) => `${value}M`}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="volume" fill="#6F6A60" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

