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
      <div className="h-[400px] w-full bg-[#FBF7ED] border border-[#E3DDCF] flex items-center justify-center">
        <p className="text-sm font-mono text-[#6F6A60]">No chart data available</p>
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
      color: '#1C1B17',
    },
    volume: {
      label: 'Volume',
      color: '#6F6A60',
    },
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-[#FBF7ED] border border-[#D7D0C2] rounded px-3 py-2 shadow-md">
          <p className="text-xs font-mono text-[#1C1B17] mb-1">{data.fullDate}</p>
          <p className="text-xs font-mono text-[#1C1B17]">
            Price: <span className="font-semibold">${data.price?.toFixed(2) || 'N/A'}</span>
          </p>
          <p className="text-xs font-mono text-[#6F6A60]">
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
        <CartesianGrid strokeDasharray="3 3" stroke="#E3DDCF" />
        <XAxis
          dataKey="date"
          stroke="#6F6A60"
          fontSize={11}
          tick={{ fill: '#6F6A60' }}
          fontFamily="ui-monospace, monospace"
          angle={timeframe === '1D' ? -45 : 0}
          textAnchor={timeframe === '1D' ? 'end' : 'middle'}
          height={timeframe === '1D' ? 60 : 30}
        />
        {/* Primary Y-axis for Price */}
        <YAxis
          yAxisId="price"
          stroke="#6F6A60"
          fontSize={11}
          tick={{ fill: '#6F6A60' }}
          fontFamily="ui-monospace, monospace"
          tickFormatter={(value) => `$${value.toFixed(0)}`}
          orientation="left"
        />
        {/* Secondary Y-axis for Volume */}
        <YAxis
          yAxisId="volume"
          stroke="#6F6A60"
          fontSize={10}
          tick={{ fill: '#6F6A60' }}
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
          fill="#6F6A60"
          opacity={0.3}
          radius={[2, 2, 0, 0]}
        />
        {/* Price line on primary axis */}
        <Line
          yAxisId="price"
          type="monotone"
          dataKey="price"
          stroke="#1C1B17"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}

