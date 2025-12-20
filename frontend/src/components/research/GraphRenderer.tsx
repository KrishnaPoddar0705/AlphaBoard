import { LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface GraphData {
  type: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  xAxis?: string;
  yAxis?: string;
  data?: Array<{
    [key: string]: string | number;
  }>;
  series?: Array<{
    name: string;
    data: number[];
  }>;
}

interface GraphRendererProps {
  graph: GraphData;
}

const COLORS = [
  'rgb(99, 102, 241)',  // indigo-500
  'rgb(59, 130, 246)',  // blue-500
  'rgb(16, 185, 129)',  // emerald-500
  'rgb(245, 158, 11)',  // amber-500
  'rgb(239, 68, 68)',   // red-500
  'rgb(168, 85, 247)',  // purple-500
  'rgb(236, 72, 153)',  // pink-500
];

export default function GraphRenderer({ graph }: GraphRendererProps) {
  const renderChart = () => {
    // Prepare data for charts
    let chartData: any[] = [];
    
    if (graph.series && graph.series.length > 0) {
      // For series-based charts (multiple lines/bars)
      const maxLength = Math.max(...graph.series.map(s => s.data.length));
      chartData = Array.from({ length: maxLength }, (_, i) => {
        const point: any = { index: i };
        graph.series!.forEach((series) => {
          point[series.name] = series.data[i] ?? null;
        });
        return point;
      });
    } else if (graph.data && graph.data.length > 0) {
      // For data-based charts
      chartData = graph.data;
    } else {
      return <div className="text-center py-8 text-[var(--text-secondary)]">No data available for chart</div>;
    }

    const commonProps = {
      data: chartData,
      margin: { top: 20, right: 30, left: 20, bottom: 20 },
    };

    switch (graph.type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis 
                dataKey={graph.xAxis || "x"} 
                stroke="var(--text-secondary)"
                tick={{ fill: 'var(--text-secondary)' }}
              />
              <YAxis 
                stroke="var(--text-secondary)"
                tick={{ fill: 'var(--text-secondary)' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  color: 'var(--text-primary)',
                }}
              />
              <Legend />
              {graph.series?.map((series, idx) => (
                <Line
                  key={series.name}
                  type="monotone"
                  dataKey={series.name}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: COLORS[idx % COLORS.length], r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis 
                dataKey={graph.xAxis || "x"} 
                stroke="var(--text-secondary)"
                tick={{ fill: 'var(--text-secondary)' }}
              />
              <YAxis 
                stroke="var(--text-secondary)"
                tick={{ fill: 'var(--text-secondary)' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  color: 'var(--text-primary)',
                }}
              />
              <Legend />
              {graph.series?.map((series, idx) => (
                <Bar
                  key={series.name}
                  dataKey={series.name}
                  fill={COLORS[idx % COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis 
                dataKey={graph.xAxis || "x"} 
                stroke="var(--text-secondary)"
                tick={{ fill: 'var(--text-secondary)' }}
              />
              <YAxis 
                stroke="var(--text-secondary)"
                tick={{ fill: 'var(--text-secondary)' }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  color: 'var(--text-primary)',
                }}
              />
              <Legend />
              {graph.series?.map((series, idx) => (
                <Area
                  key={series.name}
                  type="monotone"
                  dataKey={series.name}
                  stackId="1"
                  stroke={COLORS[idx % COLORS.length]}
                  fill={COLORS[idx % COLORS.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        // For pie charts, expect data with name/value pairs
        const pieData = graph.data?.map((item, idx) => ({
          name: item.name || item.x || `Item ${idx + 1}`,
          value: Number(item.value || item.y || item[Object.keys(item).find(k => k !== 'name' && k !== 'x') || 'value'] || 0),
        })) || [];
        
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  color: 'var(--text-primary)',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <div className="text-center py-8 text-[var(--text-secondary)]">Unsupported chart type: {graph.type}</div>;
    }
  };

  return (
    <div className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-6 my-6">
      <h4 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{graph.title}</h4>
      {renderChart()}
      {(graph.xAxis || graph.yAxis) && (
        <div className="mt-4 flex gap-4 text-xs text-[var(--text-secondary)]">
          {graph.xAxis && <span>X-axis: {graph.xAxis}</span>}
          {graph.yAxis && <span>Y-axis: {graph.yAxis}</span>}
        </div>
      )}
    </div>
  );
}

