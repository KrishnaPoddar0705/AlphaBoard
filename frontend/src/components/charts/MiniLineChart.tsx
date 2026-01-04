import React, { useMemo } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

interface MiniLineChartProps {
  data: Array<{ timestamp: number; price: number }>
  isPositive: boolean
  height?: number
}

export const MiniLineChart: React.FC<MiniLineChartProps> = ({
  data,
  isPositive,
  height = 80,
}) => {
  const chartOptions = useMemo(() => {
    if (!data || data.length === 0) {
      return null
    }

    const lineColor = isPositive ? '#2F8F5B' : '#B23B2A'
    const fillColor = isPositive ? 'rgba(47, 143, 91, 0.1)' : 'rgba(178, 59, 42, 0.1)'

    return {
      chart: {
        type: 'area',
        height,
        backgroundColor: 'transparent',
        margin: [0, 0, 0, 0],
        spacing: [0, 0, 0, 0],
      },
      title: {
        text: undefined,
      },
      credits: {
        enabled: false,
      },
      legend: {
        enabled: false,
      },
      xAxis: {
        visible: false,
        labels: {
          enabled: false,
        },
        lineWidth: 0,
        tickLength: 0,
      },
      yAxis: {
        visible: false,
        labels: {
          enabled: false,
        },
        title: {
          text: undefined,
        },
        gridLineWidth: 0,
      },
      tooltip: {
        enabled: false,
      },
      plotOptions: {
        area: {
          lineWidth: 2,
          marker: {
            enabled: false,
            radius: 0,
          },
          fillColor: fillColor,
          color: lineColor,
          threshold: null,
        },
      },
      series: [
        {
          type: 'area',
          data: data.map((d) => [d.timestamp, d.price]),
          enableMouseTracking: false,
        },
      ],
    } as Highcharts.Options
  }, [data, isPositive, height])

  if (!chartOptions || !data || data.length === 0) {
    return (
      <div
        className="w-full rounded-lg flex items-center justify-center border border-[#E3DDCF] bg-[#FBF7ED]"
        style={{ height }}
      >
        <div className="text-[#6F6A60] text-xs">No data</div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <HighchartsReact highcharts={Highcharts} options={chartOptions} />
    </div>
  )
}

