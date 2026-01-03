"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card-new"
import { getAnalystPerformance, getRollingPortfolioReturns } from "@/lib/api"
import { useUser } from "@clerk/clerk-react"
import { supabase } from "@/lib/supabase"
import { WeeklyReturnsChart } from "@/components/charts/WeeklyReturnsChart"
import { IdeasAddedChart } from "@/components/charts/IdeasAddedChart"
import { PortfolioAllocationDonut } from "@/components/charts/PortfolioAllocationDonut"
import { DailyReturnsCalendar } from "@/components/charts/DailyReturnsCalendar"
import { MonthlyReturnsHeatmap } from "@/components/charts/MonthlyReturnsHeatmap"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getReturnFromCacheOrCalculate } from "@/lib/returnsCache"

export default function Performance() {
  const { user } = useUser()
  const [performance, setPerformance] = React.useState<any>(null)
  const [recommendations, setRecommendations] = React.useState<any[]>([])
  const [portfolioReturns, setPortfolioReturns] = React.useState<Array<{ week: string; date?: string; return: number; cumulativeReturn?: number; count?: number }>>([])
  const [loading, setLoading] = React.useState(true)
  const [portfolioReturnsPeriod, setPortfolioReturnsPeriod] = React.useState<'day' | 'week' | 'month'>('day')
  const [portfolioReturnsLoading, setPortfolioReturnsLoading] = React.useState(false)
  const [ideasAddedPeriod, setIdeasAddedPeriod] = React.useState<'day' | 'week' | 'month'>('week')
  const [returnsMatrixPeriod, setReturnsMatrixPeriod] = React.useState<'day' | 'week' | 'month'>('day')

  const fetchingRecommendations = React.useRef(false)
  const fetchingPortfolioReturns = React.useRef(false)

  React.useEffect(() => {
    if (user) {
      loadPerformance()
      fetchRecommendations()
    }
  }, [user])

  React.useEffect(() => {
    if (user) {
      fetchPortfolioReturns()
    }
  }, [user, portfolioReturnsPeriod])

  const loadPerformance = async () => {
    if (!user) return
    setLoading(true)
    try {
      // API accepts Clerk user ID directly (format: user_xxx)
      const data = await getAnalystPerformance(user.id)
      setPerformance(data)
    } catch (error) {
      console.error("Error loading performance:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecommendations = React.useCallback(async () => {
    if (!user || fetchingRecommendations.current) return
    fetchingRecommendations.current = true
    try {
      const { data: mapping } = await supabase
        .from("clerk_user_mapping")
        .select("supabase_user_id")
        .eq("clerk_user_id", user.id)
        .maybeSingle()

      if (mapping) {
        const { data, error } = await supabase
          .from('recommendations')
          .select('*')
          .eq('user_id', mapping.supabase_user_id)
          .order('entry_date', { ascending: false })
        if (error) throw error
        setRecommendations(data || [])
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err)
      setRecommendations([])
    } finally {
      fetchingRecommendations.current = false
    }
  }, [user])

  const fetchPortfolioReturns = React.useCallback(async () => {
    if (!user || fetchingPortfolioReturns.current) return
    fetchingPortfolioReturns.current = true
    setPortfolioReturnsLoading(true)
    try {
      const rangeMap: Record<'day' | 'week' | 'month', 'DAY' | 'WEEK' | 'MONTH'> = {
        'day': 'DAY',
        'week': 'WEEK',
        'month': 'MONTH'
      }
      const range = rangeMap[portfolioReturnsPeriod]

      // API accepts Clerk user ID directly (format: user_xxx)
      const data = await getRollingPortfolioReturns(user.id, range)

      if (data && data.error) {
        console.error('Portfolio returns API error:', data.error)
        setPortfolioReturns([])
        return
      }

      if (data && data.points && Array.isArray(data.points) && data.points.length > 0) {
        // Create a map of cumulative returns by date for quick lookup
        const cumulativeMap = new Map<string, number>()
        if (data.cumulative && Array.isArray(data.cumulative)) {
          data.cumulative.forEach((cum: any) => {
            cumulativeMap.set(cum.date, cum.value || 0)
          })
        }

        const transformed = data.points.map((point: any, index: number) => {
          try {
            const date = new Date(point.date)
            let label = ''

            if (portfolioReturnsPeriod === 'day') {
              label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            } else if (portfolioReturnsPeriod === 'week') {
              label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            } else {
              label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            }

            return {
              week: label,
              date: point.date,
              return: point.value || 0, // API returns 'value' not 'return'
              cumulativeReturn: cumulativeMap.get(point.date) ?? null,
              count: point.active_count || 0 // API returns 'active_count' not 'count'
            }
          } catch (err) {
            console.error('Error transforming point:', err, point)
            return null
          }
        }).filter((item: any) => item !== null)

        if (transformed.length > 0) {
          setPortfolioReturns(transformed)
        } else {
          setPortfolioReturns([])
        }
      } else {
        setPortfolioReturns([])
      }
    } catch (error) {
      console.error('Error fetching portfolio returns:', error)
      setPortfolioReturns([])
    } finally {
      setPortfolioReturnsLoading(false)
      fetchingPortfolioReturns.current = false
    }
  }, [user, portfolioReturnsPeriod])

  // Calculate ideas added data
  const ideasAddedData = React.useMemo(() => {
    if (!recommendations || recommendations.length === 0) return []

    const periods: Array<{ period: string; openRecommendations: number; watchlist: number; closed: number }> = []
    const now = new Date()
    const count = ideasAddedPeriod === 'week' ? 8 : ideasAddedPeriod === 'day' ? 30 : 6

    for (let i = count - 1; i >= 0; i--) {
      const periodStart = new Date(now)
      const periodEnd = new Date(now)

      if (ideasAddedPeriod === 'day') {
        periodStart.setDate(now.getDate() - i)
        periodStart.setHours(0, 0, 0, 0)
        periodEnd.setDate(now.getDate() - i)
        periodEnd.setHours(23, 59, 59, 999)
        const periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        periods.push({ period: periodLabel, openRecommendations: 0, watchlist: 0, closed: 0 })
      } else if (ideasAddedPeriod === 'week') {
        periodStart.setDate(now.getDate() - (i * 7))
        periodStart.setDate(periodStart.getDate() - periodStart.getDay())
        periodStart.setHours(0, 0, 0, 0)
        periodEnd.setDate(periodStart.getDate() + 6)
        periodEnd.setHours(23, 59, 59, 999)
        const periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        periods.push({ period: periodLabel, openRecommendations: 0, watchlist: 0, closed: 0 })
      } else {
        periodStart.setMonth(now.getMonth() - i)
        periodStart.setDate(1)
        periodStart.setHours(0, 0, 0, 0)
        periodEnd.setMonth(now.getMonth() - i)
        periodEnd.setDate(0)
        periodEnd.setHours(23, 59, 59, 999)
        const periodLabel = periodStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        periods.push({ period: periodLabel, openRecommendations: 0, watchlist: 0, closed: 0 })
      }
    }

    recommendations.forEach(rec => {
      if (!rec.entry_date) return
      const entryDate = new Date(rec.entry_date)
      
      periods.forEach((period, periodIndex) => {
        // Recalculate period dates based on the period index (same logic as when creating periods)
        const periodStart = new Date(now)
        const periodEnd = new Date(now)
        const i = count - 1 - periodIndex

        if (ideasAddedPeriod === 'day') {
          periodStart.setDate(now.getDate() - i)
          periodStart.setHours(0, 0, 0, 0)
          periodEnd.setDate(now.getDate() - i)
          periodEnd.setHours(23, 59, 59, 999)
        } else if (ideasAddedPeriod === 'week') {
          periodStart.setDate(now.getDate() - (i * 7))
          periodStart.setDate(periodStart.getDate() - periodStart.getDay())
          periodStart.setHours(0, 0, 0, 0)
          periodEnd.setDate(periodStart.getDate() + 6)
          periodEnd.setHours(23, 59, 59, 999)
        } else {
          periodStart.setMonth(now.getMonth() - i)
          periodStart.setDate(1)
          periodStart.setHours(0, 0, 0, 0)
          periodEnd.setMonth(now.getMonth() - i + 1)
          periodEnd.setDate(0)
          periodEnd.setHours(23, 59, 59, 999)
        }

        if (entryDate >= periodStart && entryDate <= periodEnd) {
          if (rec.status === 'OPEN') {
            period.openRecommendations++
          } else if (rec.status === 'WATCHLIST') {
            period.watchlist++
          } else if (rec.status === 'CLOSED') {
            period.closed++
          }
        }
      })
    })

    return periods
  }, [recommendations, ideasAddedPeriod])

  // Calculate portfolio allocation
  const portfolioAllocation = React.useMemo(() => {
    if (!recommendations || recommendations.length === 0) return []

    const allocationMap: Record<string, { buyCount: number; sellCount: number }> = {}

    recommendations
      .filter(rec => rec.status === 'OPEN')
      .forEach(rec => {
        if (!allocationMap[rec.ticker]) {
          allocationMap[rec.ticker] = { buyCount: 0, sellCount: 0 }
        }

        if (rec.action === 'BUY') {
          allocationMap[rec.ticker].buyCount += 1
        } else if (rec.action === 'SELL') {
          allocationMap[rec.ticker].sellCount += 1
        }
      })

    return Object.entries(allocationMap)
      .filter(([_, data]) => data.buyCount > 0 || data.sellCount > 0)
      .map(([ticker, data]) => ({
        ticker,
        buyCount: data.buyCount,
        sellCount: data.sellCount
      }))
  }, [recommendations])

  // Create calendar data for daily returns
  const calendarData = React.useMemo(() => {
    if (!portfolioReturns || portfolioReturns.length === 0 || returnsMatrixPeriod !== 'day') return []
    
    return portfolioReturns
      .filter(point => point.date)
      .map(point => ({
        day: point.date!,
        value: point.return ?? 0
      }))
  }, [portfolioReturns, returnsMatrixPeriod])

  // Create returns matrix heatmap data based on selected period
  const returnsMatrixData = React.useMemo(() => {
    if (!portfolioReturns || portfolioReturns.length === 0) return []

    if (returnsMatrixPeriod === 'day') {
      return []
    }

    if (returnsMatrixPeriod === 'month') {
      const matrixData: Array<{ year: number; month: number; return_pct: number }> = []
      const returnsByMonth: Record<string, number[]> = {}

      portfolioReturns.forEach(point => {
        const dateStr = point.week
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) {
          const parts = dateStr.split(' ')
          if (parts.length === 2) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            const monthIdx = monthNames.indexOf(parts[0])
            if (monthIdx >= 0) {
              const year = parseInt(parts[1])
              const key = `${year}-${monthIdx + 1}`
              if (!returnsByMonth[key]) {
                returnsByMonth[key] = []
              }
              returnsByMonth[key].push(point.return)
            }
          }
        } else {
          const year = date.getFullYear()
          const month = date.getMonth() + 1
          const key = `${year}-${month}`
          if (!returnsByMonth[key]) {
            returnsByMonth[key] = []
          }
          returnsByMonth[key].push(point.return)
        }
      })

      Object.entries(returnsByMonth).forEach(([key, returns]) => {
        const [year, month] = key.split('-').map(Number)
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
        matrixData.push({
          year,
          month,
          return_pct: avgReturn
        })
      })

      return matrixData
    }

    // For weekly, group by month
    const matrixData: Array<{ year: number; month: number; return_pct: number }> = []
    const returnsByMonth: Record<string, number[]> = {}

    portfolioReturns.forEach(point => {
      const now = new Date()
      const dateStr = point.week
      const parts = dateStr.split(' ')
      if (parts.length >= 1) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        const monthIdx = monthNames.indexOf(parts[0])
        if (monthIdx >= 0) {
          const year = parts.length > 1 && parts[1].length === 4
            ? parseInt(parts[1])
            : now.getFullYear()
          const key = `${year}-${monthIdx + 1}`
          if (!returnsByMonth[key]) {
            returnsByMonth[key] = []
          }
          returnsByMonth[key].push(point.return)
        }
      }
    })

    Object.entries(returnsByMonth).forEach(([key, returns]) => {
      const [year, month] = key.split('-').map(Number)
      const monthlyReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
      
      matrixData.push({
        year,
        month,
        return_pct: monthlyReturn
      })
    })

    return matrixData
  }, [portfolioReturns, returnsMatrixPeriod])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#F1EEE0]">
        <div className="text-[#6F6A60] font-mono">Loading performance...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#F1EEE0] overflow-y-auto">
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto w-full">
        {/* Header */}
      <div className="flex items-center justify-between">
          <h1 className="text-2xl font-mono font-bold text-[#1C1B17] tracking-tight">My Performance</h1>
      </div>

        {/* Summary Metrics */}
        {performance && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
              <CardHeader>
                <CardTitle className="text-base font-mono font-semibold text-[#1C1B17]">Total Return</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-mono font-bold tabular-nums ${
                  (portfolioReturns.length > 0 && portfolioReturns[portfolioReturns.length - 1]?.cumulativeReturn !== null 
                    ? portfolioReturns[portfolioReturns.length - 1].cumulativeReturn! >= 0 
                    : performance.total_return_pct >= 0) ? "text-[#2F8F5B]" : "text-[#B23B2A]"
                }`}>
                  {portfolioReturns.length > 0 && portfolioReturns[portfolioReturns.length - 1]?.cumulativeReturn !== null
                    ? `${portfolioReturns[portfolioReturns.length - 1].cumulativeReturn! >= 0 ? "+" : ""}${portfolioReturns[portfolioReturns.length - 1].cumulativeReturn!.toFixed(2)}%`
                    : performance.total_return_pct
                      ? `${performance.total_return_pct >= 0 ? "+" : ""}${performance.total_return_pct.toFixed(2)}%`
                      : "N/A"}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
              <CardHeader>
                <CardTitle className="text-base font-mono font-semibold text-[#1C1B17]">Sharpe Ratio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-[#1C1B17] tabular-nums">
                  {performance.sharpe_ratio
                    ? performance.sharpe_ratio.toFixed(2)
                    : "N/A"}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
            <CardHeader>
                <CardTitle className="text-base font-mono font-semibold text-[#1C1B17]">Win Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-[#1C1B17] tabular-nums">
                  {performance.win_rate ? `${performance.win_rate.toFixed(1)}%` : "N/A"}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Portfolio Returns Chart */}
        <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-mono font-bold text-[#1C1B17]">Portfolio Returns</CardTitle>
            <Select value={portfolioReturnsPeriod} onValueChange={(value: 'day' | 'week' | 'month') => setPortfolioReturnsPeriod(value)}>
              <SelectTrigger className="w-[120px] bg-[#FBF7ED] border-[#D7D0C2] font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {portfolioReturnsLoading ? (
              <div className="flex items-center justify-center h-[300px] text-[#6F6A60] font-mono">
                Loading...
              </div>
            ) : portfolioReturns.length > 0 ? (
              <div className="h-[300px]">
                <WeeklyReturnsChart data={portfolioReturns} height={300} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-[#6F6A60] font-mono">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ideas Added Chart */}
        {ideasAddedData.length > 0 && (
          <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-mono font-bold text-[#1C1B17]">Ideas Added</CardTitle>
              <Select value={ideasAddedPeriod} onValueChange={(value: 'day' | 'week' | 'month') => setIdeasAddedPeriod(value)}>
                <SelectTrigger className="w-[120px] bg-[#FBF7ED] border-[#D7D0C2] font-mono text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <IdeasAddedChart data={ideasAddedData} height={300} periodType={ideasAddedPeriod} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Portfolio Allocation Chart */}
        {portfolioAllocation.length > 0 && (
          <Card className="bg-[#F7F2E6] border-[#D7D0C2] overflow-visible">
            <CardHeader>
              <CardTitle className="text-lg font-mono font-bold text-[#1C1B17]">Portfolio Allocation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] -mx-2 overflow-visible">
                <PortfolioAllocationDonut data={portfolioAllocation} height={300} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Returns Matrix - Heatmap */}
        <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-mono font-bold text-[#1C1B17]">Returns Matrix</CardTitle>
            <Select value={returnsMatrixPeriod} onValueChange={(value: 'day' | 'week' | 'month') => setReturnsMatrixPeriod(value)}>
              <SelectTrigger className="w-[120px] bg-[#FBF7ED] border-[#D7D0C2] font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {returnsMatrixPeriod === 'day' ? (
              calendarData.length > 0 ? (
                <DailyReturnsCalendar data={calendarData} />
              ) : (
                <div className="text-[#6F6A60] font-mono text-center py-8">No daily returns data available</div>
              )
            ) : returnsMatrixData.length > 0 ? (
              <MonthlyReturnsHeatmap data={returnsMatrixData} />
            ) : (
              <div className="text-[#6F6A60] font-mono text-center py-8">No returns matrix data available</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
