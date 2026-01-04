// import React from 'react'
import { RadarChart as RechartsRadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

interface RadarChartProps {
  data: Array<{ name: string; value: number }>
  height?: number
}

export function RadarChart({ data, height = 200 }: RadarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full bg-[#FBF7ED] border border-[#E3DDCF] flex items-center justify-center" style={{ height: `${height}px` }}>
        <p className="text-xs font-mono text-[#6F6A60]">No data available</p>
      </div>
    )
  }

  const config = {
    value: {
      label: 'Rating',
      color: '#1C1B17',
    },
  }

  return (
    <ChartContainer config={config} className="w-full" style={{ height: `${height}px`, width: '100%' }}>
      <RechartsRadarChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <PolarGrid stroke="#E3DDCF" />
        <PolarAngleAxis
          dataKey="name"
          tick={{ fill: '#6F6A60', fontSize: 10 }}
          fontFamily="ui-monospace, monospace"
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 5]}
          tick={{ fill: '#6F6A60', fontSize: 10 }}
          fontFamily="ui-monospace, monospace"
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Radar
          name="Rating"
          dataKey="value"
          stroke="#1C1B17"
          fill="#1C1B17"
          fillOpacity={0.3}
          strokeWidth={1.5}
        />
      </RechartsRadarChart>
    </ChartContainer>
  )
}

