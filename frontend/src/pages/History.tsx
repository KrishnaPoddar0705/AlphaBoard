"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card-new"
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useUser } from "@clerk/clerk-react"
import { getCurrencySymbol } from "@/lib/utils"
import { getPrice } from "@/lib/api"

interface Trade {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  quantity: number
  price: number
  notional: number
  executed_at: string
  realized_pnl: number | null
}

interface TickerSummary {
  ticker: string
  trades: Trade[]
  totalShares: number
  avgCost: number
  realizedPnl: number
  unrealizedPnl: number
  currentPrice: number | null
  totalBought: number
  totalSold: number
  marketValue: number
}

type SortField = 'ticker' | 'position' | 'marketValue' | 'pnl' | 'recent'
type SortDirection = 'asc' | 'desc'

export default function History() {
  const navigate = useNavigate()
  const { user } = useUser()
  const [tickerSummaries, setTickerSummaries] = React.useState<TickerSummary[]>([])
  const [loading, setLoading] = React.useState(true)
  const [expandedTickers, setExpandedTickers] = React.useState<Set<string>>(new Set())
  const [sortField, setSortField] = React.useState<SortField>('recent')
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc')

  React.useEffect(() => {
    if (user) {
      loadTradingHistory()
    }
  }, [user])

  const loadTradingHistory = async () => {
    if (!user) return
    setLoading(true)
    try {
      // Get Supabase user ID
      const { data: mapping } = await supabase
        .from("clerk_user_mapping")
        .select("supabase_user_id")
        .eq("clerk_user_id", user.id)
        .maybeSingle()

      if (!mapping) {
        setLoading(false)
        return
      }

      // Get all portfolios for user
      const { data: portfolios } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", mapping.supabase_user_id)

      if (!portfolios || portfolios.length === 0) {
        setLoading(false)
        return
      }

      const portfolioIds = portfolios.map(p => p.id)

      // Get all trades
      const { data: trades, error } = await supabase
        .from("portfolio_trades")
        .select("*")
        .in("portfolio_id", portfolioIds)
        .order("executed_at", { ascending: false })

      if (error || !trades) {
        setLoading(false)
        return
      }

      // Get all positions for current holdings
      const { data: positions } = await supabase
        .from("portfolio_positions")
        .select("*")
        .in("portfolio_id", portfolioIds)

      // Group trades by ticker
      const tickerMap = new Map<string, Trade[]>()
      for (const trade of trades) {
        const existing = tickerMap.get(trade.symbol) || []
        existing.push({
          id: trade.id,
          symbol: trade.symbol,
          side: trade.side,
          quantity: parseFloat(trade.quantity),
          price: parseFloat(trade.price),
          notional: parseFloat(trade.notional),
          executed_at: trade.executed_at,
          realized_pnl: trade.realized_pnl ? parseFloat(trade.realized_pnl) : null
        })
        tickerMap.set(trade.symbol, existing)
      }

      // Build summaries for each ticker
      const summaries: TickerSummary[] = []
      const uniqueTickers = Array.from(tickerMap.keys())

      // Fetch current prices for all tickers
      const pricePromises = uniqueTickers.map(async (ticker) => {
        try {
          const priceData = await getPrice(ticker)
          return { ticker, price: priceData.price }
        } catch {
          return { ticker, price: null }
        }
      })
      const prices = await Promise.all(pricePromises)
      const priceMap = new Map(prices.map(p => [p.ticker, p.price]))

      for (const [ticker, tickerTrades] of tickerMap.entries()) {
        // Find position for this ticker
        const position = positions?.find(p => p.symbol === ticker)
        const currentPrice = priceMap.get(ticker) || null

        // Calculate totals from trades
        let totalBought = 0
        let totalSold = 0
        let realizedPnl = 0
        let costBasis = 0

        for (const trade of tickerTrades) {
          if (trade.side === 'BUY') {
            totalBought += trade.quantity
            costBasis += trade.notional
          } else {
            totalSold += trade.quantity
            if (trade.realized_pnl) {
              realizedPnl += trade.realized_pnl
            }
          }
        }

        const totalShares = position ? parseFloat(position.quantity) : (totalBought - totalSold)
        const avgCost = position ? parseFloat(position.avg_cost) : (totalShares > 0 ? costBasis / totalBought : 0)
        const isShort = totalShares < 0
        const absShares = Math.abs(totalShares)
        const marketValue = currentPrice && totalShares !== 0 ? currentPrice * absShares : 0
        // For shorts: P&L = (sell price - buy price) = (avgCost - currentPrice) * shares
        // For longs: P&L = (currentPrice - avgCost) * shares
        const unrealizedPnl = currentPrice && totalShares !== 0 
          ? isShort 
            ? (avgCost - currentPrice) * absShares
            : (currentPrice - avgCost) * totalShares
          : 0

        summaries.push({
          ticker,
          trades: tickerTrades,
          totalShares,
          avgCost,
          realizedPnl: position?.realized_pnl ? parseFloat(position.realized_pnl) : realizedPnl,
          unrealizedPnl,
          currentPrice,
          totalBought,
          totalSold,
          marketValue
        })
      }

      setTickerSummaries(summaries)
    } catch (error) {
      console.error("Error loading trading history:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc') // Default to descending for new field
    }
  }

  const sortedSummaries = React.useMemo(() => {
    const sorted = [...tickerSummaries]
    
    sorted.sort((a, b) => {
      let aVal: number | string
      let bVal: number | string

      switch (sortField) {
        case 'ticker':
          aVal = a.ticker
          bVal = b.ticker
          break
        case 'position':
          aVal = a.totalShares
          bVal = b.totalShares
          break
        case 'marketValue':
          aVal = a.marketValue
          bVal = b.marketValue
          break
        case 'pnl':
          aVal = a.realizedPnl + a.unrealizedPnl
          bVal = b.realizedPnl + b.unrealizedPnl
          break
        case 'recent':
        default:
          aVal = new Date(a.trades[0]?.executed_at || 0).getTime()
          bVal = new Date(b.trades[0]?.executed_at || 0).getTime()
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      return sortDirection === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })

    return sorted
  }, [tickerSummaries, sortField, sortDirection])

  const toggleExpanded = (ticker: string) => {
    setExpandedTickers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(ticker)) {
        newSet.delete(ticker)
      } else {
        newSet.add(ticker)
      }
      return newSet
    })
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#F1EEE0]">
        <div className="text-[#6F6A60] font-mono">Loading trading history...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#F1EEE0]">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[#D7D0C2] bg-[#F7F2E6]">
        <div>
          <h1 className="text-2xl font-mono font-bold text-[#1C1B17] tracking-tight">Trading Ledger</h1>
          <p className="font-mono text-sm text-[#6F6A60] mt-1">
            {tickerSummaries.length} stocks • {tickerSummaries.reduce((acc, s) => acc + s.trades.length, 0)} trades
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tickerSummaries.length === 0 ? (
          <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
            <CardContent className="py-12 text-center">
              <p className="font-mono text-[#6F6A60] text-lg mb-2">No trading activity yet.</p>
              <p className="font-mono text-sm text-[#6F6A60]">Add a recommendation with quantity to start paper trading.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-0">
            {/* Table Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-[#F7F2E6] border border-[#D7D0C2] rounded-t-lg font-mono text-xs font-semibold text-[#6F6A60] uppercase tracking-wider">
              <div 
                className="col-span-3 flex items-center cursor-pointer hover:text-[#1C1B17]"
                onClick={() => handleSort('ticker')}
              >
                Stock
                <SortIcon field="ticker" />
              </div>
              <div 
                className="col-span-2 text-right flex items-center justify-end cursor-pointer hover:text-[#1C1B17]"
                onClick={() => handleSort('position')}
              >
                Position
                <SortIcon field="position" />
              </div>
              <div className="col-span-2 text-right">
                Avg Cost
              </div>
              <div 
                className="col-span-2 text-right flex items-center justify-end cursor-pointer hover:text-[#1C1B17]"
                onClick={() => handleSort('marketValue')}
              >
                Market Value
                <SortIcon field="marketValue" />
              </div>
              <div 
                className="col-span-3 text-right flex items-center justify-end cursor-pointer hover:text-[#1C1B17]"
                onClick={() => handleSort('pnl')}
              >
                Total P&L
                <SortIcon field="pnl" />
              </div>
            </div>

            {/* Table Body */}
            <div className="border-x border-b border-[#D7D0C2] rounded-b-lg overflow-hidden">
              {sortedSummaries.map((summary, index) => {
                const isExpanded = expandedTickers.has(summary.ticker)
                const currencySymbol = getCurrencySymbol(summary.ticker)
                const totalPnl = summary.realizedPnl + summary.unrealizedPnl
                const isPnlPositive = totalPnl >= 0
                const isLast = index === sortedSummaries.length - 1

                return (
                  <div 
                    key={summary.ticker}
                    className={`bg-[#F7F2E6] ${!isLast && !isExpanded ? 'border-b border-[#E3DDCF]' : ''}`}
                  >
                    {/* Row */}
                    <div
                      className="cursor-pointer hover:bg-[#FBF7ED] transition-colors"
                      onClick={() => toggleExpanded(summary.ticker)}
                    >
                      {/* Desktop View */}
                      <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-4 items-center">
                        {/* Stock */}
                        <div className="col-span-3 flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-[#6F6A60] flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-[#6F6A60] flex-shrink-0" />
                          )}
                          <div>
                            <h3 
                              className="font-mono font-bold text-[#1C1B17] hover:underline"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/stock/${summary.ticker}`)
                              }}
                            >
                              {summary.ticker}
                            </h3>
                            <p className="font-mono text-xs text-[#6F6A60]">
                              {summary.trades.length} trade{summary.trades.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        {/* Position */}
                        <div className="col-span-2 text-right">
                          {summary.totalShares !== 0 ? (
                            <p className={`font-mono font-semibold tabular-nums ${
                              summary.totalShares < 0 ? 'text-[#B23B2A]' : 'text-[#1C1B17]'
                            }`}>
                              {summary.totalShares < 0 && <span className="text-[10px] mr-1">SHORT</span>}
                              {Math.abs(summary.totalShares).toLocaleString()}
                            </p>
                          ) : (
                            <p className="font-mono text-[#6F6A60]">-</p>
                          )}
                        </div>

                        {/* Avg Cost */}
                        <div className="col-span-2 text-right">
                          <p className="font-mono text-[#1C1B17] tabular-nums">
                            {summary.avgCost > 0 ? `${currencySymbol}${summary.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                          </p>
                        </div>

                        {/* Market Value */}
                        <div className="col-span-2 text-right">
                          <p className="font-mono font-semibold text-[#1C1B17] tabular-nums">
                            {summary.marketValue > 0 ? `${currencySymbol}${summary.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                          </p>
                        </div>

                        {/* P&L */}
                        <div className="col-span-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isPnlPositive ? (
                              <TrendingUp className="h-4 w-4 text-[#2F8F5B]" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-[#B23B2A]" />
                            )}
                            <p className={`font-mono font-bold tabular-nums ${
                              isPnlPositive ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'
                            }`}>
                              {isPnlPositive ? '+' : ''}{currencySymbol}
                              {Math.abs(totalPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="flex gap-2 justify-end mt-1">
                            {summary.realizedPnl !== 0 && (
                              <p className={`font-mono text-xs tabular-nums ${
                                summary.realizedPnl >= 0 ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'
                              }`}>
                                R: {summary.realizedPnl >= 0 ? '+' : ''}{currencySymbol}{Math.abs(summary.realizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            )}
                            {summary.unrealizedPnl !== 0 && (
                              <p className={`font-mono text-xs tabular-nums ${
                                summary.unrealizedPnl >= 0 ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'
                              }`}>
                                U: {summary.unrealizedPnl >= 0 ? '+' : ''}{currencySymbol}{Math.abs(summary.unrealizedPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mobile View */}
                      <div className="md:hidden p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-[#6F6A60]" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-[#6F6A60]" />
                            )}
                            <div>
                              <h3 className="font-mono font-bold text-[#1C1B17]">{summary.ticker}</h3>
                              <p className="font-mono text-xs text-[#6F6A60]">
                                {summary.trades.length} trade{summary.trades.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              {isPnlPositive ? (
                                <TrendingUp className="h-3 w-3 text-[#2F8F5B]" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-[#B23B2A]" />
                              )}
                              <p className={`font-mono font-bold tabular-nums ${
                                isPnlPositive ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'
                              }`}>
                                {isPnlPositive ? '+' : ''}{currencySymbol}
                                {Math.abs(totalPnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <p className="font-mono text-xs text-[#6F6A60]">Position</p>
                            {summary.totalShares !== 0 ? (
                              <p className={`font-mono font-semibold tabular-nums ${
                                summary.totalShares < 0 ? 'text-[#B23B2A]' : 'text-[#1C1B17]'
                              }`}>
                                {summary.totalShares < 0 ? `SHORT ${Math.abs(summary.totalShares).toLocaleString()}` : summary.totalShares.toLocaleString()}
                              </p>
                            ) : (
                              <p className="font-mono text-[#6F6A60]">-</p>
                            )}
                          </div>
                          <div>
                            <p className="font-mono text-xs text-[#6F6A60]">Avg Cost</p>
                            <p className="font-mono text-[#1C1B17] tabular-nums">
                              {summary.avgCost > 0 ? `${currencySymbol}${summary.avgCost.toFixed(2)}` : '-'}
                            </p>
                          </div>
                          <div>
                            <p className="font-mono text-xs text-[#6F6A60]">Market Val</p>
                            <p className="font-mono font-semibold text-[#1C1B17] tabular-nums">
                              {summary.marketValue > 0 ? `${currencySymbol}${summary.marketValue.toFixed(2)}` : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded: Trade History */}
                    {isExpanded && (
                      <div className="border-t border-[#D7D0C2] bg-[#FBF7ED]">
                        <div className="p-4">
                          <h4 className="font-mono text-sm font-semibold text-[#6F6A60] mb-3">
                            Trade History
                          </h4>
                          <div className="space-y-2">
                            {summary.trades.map((trade) => (
                              <div
                                key={trade.id}
                                className="flex items-center justify-between py-3 px-4 bg-[#F7F2E6] border border-[#E3DDCF] rounded"
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                                      trade.side === 'BUY'
                                        ? 'bg-[#E6F4ED] text-[#2F8F5B]'
                                        : 'bg-[#FDECEA] text-[#B23B2A]'
                                    }`}
                                  >
                                    {trade.side}
                                  </span>
                                  <div>
                                    <p className="font-mono text-sm text-[#1C1B17]">
                                      {trade.quantity.toLocaleString()} shares @ {currencySymbol}{trade.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p className="font-mono text-xs text-[#6F6A60]">
                                      {new Date(trade.executed_at).toLocaleDateString('en-GB', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                      })} at {new Date(trade.executed_at).toLocaleTimeString('en-GB', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-mono font-semibold text-[#1C1B17] tabular-nums">
                                    {currencySymbol}{trade.notional.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                  {trade.realized_pnl !== null && trade.realized_pnl !== 0 && (
                                    <p className={`font-mono text-xs tabular-nums ${
                                      trade.realized_pnl >= 0 ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'
                                    }`}>
                                      P&L: {trade.realized_pnl >= 0 ? '+' : ''}{currencySymbol}
                                      {Math.abs(trade.realized_pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
