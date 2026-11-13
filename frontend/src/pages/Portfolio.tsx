"use client"

import * as React from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  RefreshCw,
  History,
  PieChart
} from "lucide-react"
import { 
  getUserPortfolios, 
  getPortfolioPositions, 
  getPortfolioTrades,
  getPortfolioSnapshots
} from "@/lib/api"
import { useUser } from "@clerk/clerk-react"
import { SellModal } from "@/components/portfolio/SellModal"
import { BuyToCoverModal } from "@/components/portfolio/BuyToCoverModal"
import { cn } from "@/lib/utils"

// Portfolio types
interface PortfolioSummary {
  id: string
  market: 'US' | 'IN'
  base_currency: 'USD' | 'INR'
  initial_capital: number
  cash_balance: number
  positions_value: number
  nav: number
  unrealized_pnl: number
  realized_pnl: number
  created_at: string
  updated_at: string
}

interface PortfolioPosition {
  id: string
  symbol: string
  exchange?: string
  quantity: number
  avg_cost: number
  current_price: number
  market_value: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
  realized_pnl: number
  updated_at: string
}

interface PortfolioTrade {
  id: string
  portfolio_id: string
  recommendation_id?: string
  side: 'BUY' | 'SELL'
  symbol: string
  quantity: number
  price: number
  notional: number
  executed_at: string
  price_source?: string
  realized_pnl?: number
  created_at: string
}

interface PortfolioSnapshot {
  id: string
  portfolio_id: string
  snapshot_date: string
  cash_balance: number
  positions_value: number
  nav: number
  realized_pnl_to_date: number
  unrealized_pnl: number
  created_at: string
}

type MarketTab = 'US' | 'IN'

export default function Portfolio() {
  const navigate = useNavigate()
  const { user } = useUser()
  const [portfolios, setPortfolios] = React.useState<PortfolioSummary[]>([])
  const [positions, setPositions] = React.useState<PortfolioPosition[]>([])
  const [trades, setTrades] = React.useState<PortfolioTrade[]>([])
  const [_snapshots, setSnapshots] = React.useState<PortfolioSnapshot[]>([])
  const [loading, setLoading] = React.useState(true)
  const [portfolioError, setPortfolioError] = React.useState<string | null>(null)
  const [positionsLoading, setPositionsLoading] = React.useState(false)
  const [positionsError, setPositionsError] = React.useState<string | null>(null)
  const [tradesLoading, setTradesLoading] = React.useState(false)
  const [tradesError, setTradesError] = React.useState<string | null>(null)
  const [selectedMarket, setSelectedMarket] = React.useState<MarketTab>('IN')
  const [sellModalOpen, setSellModalOpen] = React.useState(false)
  const [coverModalOpen, setCoverModalOpen] = React.useState(false)
  const [selectedPosition, setSelectedPosition] = React.useState<PortfolioPosition | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)

  const currentPortfolio = portfolios.find(p => p.market === selectedMarket)

  React.useEffect(() => {
    if (user) {
      loadPortfolioData()
    }
  }, [user])

  React.useEffect(() => {
    if (currentPortfolio && user) {
      loadPositionsAndTrades(currentPortfolio.id)
    }
  }, [currentPortfolio?.id, user])

  const getErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const serverMsg =
        typeof error.response?.data === "object" && error.response?.data
          ? // common FastAPI-ish shapes
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((error.response.data as any).detail ??
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (error.response.data as any).error ??
              undefined)
          : undefined
      const msg = typeof serverMsg === "string" ? serverMsg : error.message
      return status ? `${status}: ${msg}` : msg
    }
    if (error instanceof Error) return error.message
    return "Something went wrong. Please try again."
  }

  const loadPortfolioData = async () => {
    if (!user) return
    setLoading(true)
    setPortfolioError(null)
    try {
      const response = await getUserPortfolios(user.id)
      setPortfolios(response.portfolios || [])
      
      // Set default market based on available portfolios
      if (response.portfolios?.length > 0) {
        const hasIN = response.portfolios.some(p => p.market === 'IN')
        const hasUS = response.portfolios.some(p => p.market === 'US')
        // Default to India market first
        if (hasIN) setSelectedMarket('IN')
        else if (hasUS) setSelectedMarket('US')
      }
    } catch (error) {
      console.error('Error loading portfolios:', error)
      setPortfolioError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const loadPositionsAndTrades = async (portfolioId: string) => {
    if (!user) return
    try {
      setPositionsLoading(true)
      setTradesLoading(true)
      setPositionsError(null)
      setTradesError(null)

      // Use allSettled so one 500 doesn't block the rest
      const [positionsRes, tradesRes, snapshotsRes] = await Promise.allSettled([
        getPortfolioPositions(portfolioId, user.id),
        getPortfolioTrades(portfolioId, user.id, 20),
        getPortfolioSnapshots(portfolioId, user.id, 90),
      ])

      if (positionsRes.status === "fulfilled") {
        setPositions(positionsRes.value.positions || [])
      } else {
        console.error("Error loading positions:", positionsRes.reason)
        setPositionsError(getErrorMessage(positionsRes.reason))
      }

      if (tradesRes.status === "fulfilled") {
        setTrades(tradesRes.value.trades || [])
      } else {
        console.error("Error loading trades:", tradesRes.reason)
        setTradesError(getErrorMessage(tradesRes.reason))
      }

      if (snapshotsRes.status === "fulfilled") {
        setSnapshots(snapshotsRes.value.snapshots || [])
      } else {
        // Snapshots are currently not rendered on this page; keep this silent-ish.
        console.error("Error loading snapshots:", snapshotsRes.reason)
      }
    } catch (error) {
      console.error('Error loading positions/trades:', error)
      // This should be rare now (allSettled), but keep a fallback.
      const msg = getErrorMessage(error)
      setPositionsError(prev => prev ?? msg)
      setTradesError(prev => prev ?? msg)
    } finally {
      setPositionsLoading(false)
      setTradesLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadPortfolioData()
    if (currentPortfolio) {
      await loadPositionsAndTrades(currentPortfolio.id)
    }
    setRefreshing(false)
  }

  const handleSellClick = (position: PortfolioPosition) => {
    setSelectedPosition(position)
    setSellModalOpen(true)
  }

  const handleCoverClick = (position: PortfolioPosition) => {
    setSelectedPosition(position)
    setCoverModalOpen(true)
  }

  const handleSellComplete = () => {
    setSellModalOpen(false)
    setSelectedPosition(null)
    handleRefresh()
  }

  const handleCoverComplete = () => {
    setCoverModalOpen(false)
    setSelectedPosition(null)
    handleRefresh()
  }

  const formatLargeNumber = (num: number, currency: string): string => {
    const symbol = currency === 'INR' ? '₹' : '$'
    if (Math.abs(num) >= 1e9) {
      return `${symbol}${(num / 1e9).toFixed(2)}B`
    } else if (Math.abs(num) >= 1e6) {
      return `${symbol}${(num / 1e6).toFixed(2)}M`
    } else if (Math.abs(num) >= 1e3) {
      return `${symbol}${(num / 1e3).toFixed(1)}K`
    }
    return `${symbol}${num.toFixed(2)}`
  }

  const formatNumber = (num: number, decimals: number = 2): string => {
    return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }

  const currencySymbol = currentPortfolio?.base_currency === 'INR' ? '₹' : '$'
  
  // Filter to only show active positions (quantity != 0 - includes shorts)
  const activePositions = positions.filter(p => p.quantity !== 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-paper">
        <div className="text-ink-muted font-mono">Loading portfolio...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {portfolioError && (
          <div className="bg-paper-alt border border-negative/30 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-sm font-semibold text-ink">Couldn’t load portfolio</div>
                <div className="font-mono text-xs text-ink-muted mt-1">{portfolioError}</div>
              </div>
              <Button
                variant="outline"
                className="border-border-editorial bg-paper-alt hover:bg-paper-light font-mono"
                onClick={handleRefresh}
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-mono font-bold text-ink">Paper Portfolio</h1>
            <p className="text-ink-muted font-mono text-sm mt-1">Track your paper trading performance</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Market Tabs */}
            <div className="flex bg-paper-alt border border-border-editorial rounded-lg p-1">
              <button
                onClick={() => setSelectedMarket('US')}
                className={cn(
                  "px-3 py-1.5 rounded font-mono text-sm transition-colors",
                  selectedMarket === 'US' 
                    ? "bg-ink text-paper-light" 
                    : "text-ink-muted hover:text-ink"
                )}
              >
                <DollarSign className="w-4 h-4 inline mr-1" />
                US Market
              </button>
              <button
                onClick={() => setSelectedMarket('IN')}
                className={cn(
                  "px-3 py-1.5 rounded font-mono text-sm transition-colors",
                  selectedMarket === 'IN' 
                    ? "bg-ink text-paper-light" 
                    : "text-ink-muted hover:text-ink"
                )}
              >
                <span className="mr-1">₹</span>
                India
              </button>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="border-border-editorial bg-paper-alt hover:bg-paper-light"
            >
              <RefreshCw className={cn("w-4 h-4 text-ink-muted", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Portfolio Summary Cards */}
        {currentPortfolio ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* NAV Card */}
              <div className="bg-paper-alt border border-border-editorial rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PieChart className="w-4 h-4 text-ink-muted" />
                  <span className="text-xs font-mono text-ink-muted">Net Asset Value</span>
                </div>
                <div className="text-xl font-mono font-bold text-ink">
                  {formatLargeNumber(currentPortfolio.nav, currentPortfolio.base_currency)}
                </div>
                <div className={cn(
                  "text-xs font-mono mt-1 flex items-center gap-1",
                  currentPortfolio.nav >= currentPortfolio.initial_capital ? "text-positive-strong" : "text-negative"
                )}>
                  {currentPortfolio.nav >= currentPortfolio.initial_capital ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {(((currentPortfolio.nav - currentPortfolio.initial_capital) / currentPortfolio.initial_capital) * 100).toFixed(2)}% all time
                </div>
              </div>

              {/* Cash Balance Card */}
              <div className="bg-paper-alt border border-border-editorial rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-ink-muted" />
                  <span className="text-xs font-mono text-ink-muted">Cash Balance</span>
                </div>
                <div className="text-xl font-mono font-bold text-ink">
                  {formatLargeNumber(currentPortfolio.cash_balance, currentPortfolio.base_currency)}
                </div>
                <div className="text-xs font-mono text-ink-muted mt-1">
                  {((currentPortfolio.cash_balance / currentPortfolio.nav) * 100).toFixed(1)}% of portfolio
                </div>
              </div>

              {/* Positions Value Card */}
              <div className="bg-paper-alt border border-border-editorial rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-ink-muted" />
                  <span className="text-xs font-mono text-ink-muted">Invested Value</span>
                </div>
                <div className="text-xl font-mono font-bold text-ink">
                  {formatLargeNumber(currentPortfolio.positions_value, currentPortfolio.base_currency)}
                </div>
                <div className="text-xs font-mono text-ink-muted mt-1">
                  {activePositions.length} position{activePositions.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Unrealized P&L Card */}
              <div className={cn(
                "bg-paper-alt border rounded-lg p-4",
                currentPortfolio.unrealized_pnl >= 0 
                  ? "border-positive-strong/30"
                  : "border-negative/30"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  {currentPortfolio.unrealized_pnl >= 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-positive-strong" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-negative" />
                  )}
                  <span className="text-xs font-mono text-ink-muted">Unrealized P&L</span>
                </div>
                <div className={cn(
                  "text-xl font-mono font-bold",
                  currentPortfolio.unrealized_pnl >= 0 ? "text-positive-strong" : "text-negative"
                )}>
                  {currentPortfolio.unrealized_pnl >= 0 ? '+' : ''}
                  {formatLargeNumber(currentPortfolio.unrealized_pnl, currentPortfolio.base_currency)}
                </div>
                <div className="text-xs font-mono text-ink-muted mt-1">
                  Realized: {formatLargeNumber(currentPortfolio.realized_pnl, currentPortfolio.base_currency)}
                </div>
              </div>
            </div>

            {/* Positions Table */}
            <div className="bg-paper-alt border border-border-editorial rounded-lg">
              <div className="p-4 border-b border-border-editorial">
                <h2 className="text-sm font-mono font-semibold text-ink flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-ink-muted" />
                  Positions
                </h2>
              </div>
              <div className="p-4">
                {positionsError && (
                  <div className="mb-4 bg-paper-light border border-negative/30 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-xs font-semibold text-ink">Couldn’t refresh positions</div>
                        <div className="font-mono text-[11px] text-ink-muted mt-1">{positionsError}</div>
                      </div>
                      {currentPortfolio && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border-editorial bg-paper-alt hover:bg-paper-light font-mono"
                          onClick={() => loadPositionsAndTrades(currentPortfolio.id)}
                        >
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {positionsLoading && activePositions.length === 0 ? (
                  <div className="text-center py-12 text-ink-muted">
                    <PieChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-mono">Loading positions…</p>
                  </div>
                ) : activePositions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-editorial text-left">
                          <th className="pb-3 text-xs font-mono font-medium text-ink-muted">Symbol</th>
                          <th className="pb-3 text-xs font-mono font-medium text-ink-muted text-right">Qty</th>
                          <th className="pb-3 text-xs font-mono font-medium text-ink-muted text-right">Avg Cost</th>
                          <th className="pb-3 text-xs font-mono font-medium text-ink-muted text-right">Current</th>
                          <th className="pb-3 text-xs font-mono font-medium text-ink-muted text-right">Value</th>
                          <th className="pb-3 text-xs font-mono font-medium text-ink-muted text-right">P&L</th>
                          <th className="pb-3 text-xs font-mono font-medium text-ink-muted text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePositions.map((pos) => {
                          const isShort = pos.quantity < 0
                          const displayQty = Math.abs(pos.quantity)
                          return (
                            <tr 
                              key={pos.id} 
                              className="border-b border-gridline last:border-0 hover:bg-paper-light cursor-pointer transition-colors"
                              onClick={() => navigate(`/stock/${pos.symbol}`)}
                            >
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-medium text-ink">{pos.symbol}</span>
                                  {isShort && (
                                    <Badge variant="outline" className="text-[10px] border-negative/50 text-negative px-1 py-0">
                                      SHORT
                                    </Badge>
                                  )}
                                </div>
                                {pos.exchange && (
                                  <div className="text-xs font-mono text-ink-muted">{pos.exchange}</div>
                                )}
                              </td>
                              <td className={cn(
                                "py-3 text-right font-mono text-sm",
                                isShort ? "text-negative" : "text-ink"
                              )}>
                                {isShort ? `-${formatNumber(displayQty, displayQty % 1 === 0 ? 0 : 2)}` : formatNumber(displayQty, displayQty % 1 === 0 ? 0 : 2)}
                              </td>
                              <td className="py-3 text-right font-mono text-sm text-ink">
                                {currencySymbol}{formatNumber(pos.avg_cost)}
                              </td>
                              <td className="py-3 text-right font-mono text-sm text-ink">
                                {currencySymbol}{formatNumber(pos.current_price)}
                              </td>
                              <td className="py-3 text-right font-mono text-sm font-medium text-ink">
                                {currencySymbol}{formatNumber(Math.abs(pos.market_value))}
                              </td>
                              <td className="py-3 text-right">
                                <div className={cn(
                                  "font-mono text-sm font-medium",
                                  pos.unrealized_pnl >= 0 ? "text-positive-strong" : "text-negative"
                                )}>
                                  {pos.unrealized_pnl >= 0 ? '+' : ''}
                                  {currencySymbol}{formatNumber(pos.unrealized_pnl)}
                                </div>
                                <div className={cn(
                                  "text-xs font-mono",
                                  pos.unrealized_pnl_pct >= 0 ? "text-positive-strong/70" : "text-negative/70"
                                )}>
                                  {pos.unrealized_pnl_pct >= 0 ? '+' : ''}
                                  {pos.unrealized_pnl_pct.toFixed(2)}%
                                </div>
                              </td>
                              <td className="py-3 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={cn(
                                    "font-mono text-xs",
                                    isShort 
                                      ? "border-positive-strong/50 text-positive-strong hover:bg-positive-strong/10"
                                      : "border-negative/50 text-negative hover:bg-negative/10"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (isShort) {
                                      handleCoverClick(pos)
                                    } else {
                                      handleSellClick(pos)
                                    }
                                  }}
                                >
                                  {isShort ? 'Cover' : 'Sell'}
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-ink-muted">
                    <PieChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-mono">No positions yet</p>
                    <p className="text-sm font-mono mt-1">Add a recommendation with quantity to start paper trading</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-paper-alt border border-border-editorial rounded-lg">
              <div className="p-4 border-b border-border-editorial">
                <h2 className="text-sm font-mono font-semibold text-ink flex items-center gap-2">
                  <History className="w-4 h-4 text-ink-muted" />
                  Recent Activity
                </h2>
              </div>
              <div className="p-4">
                {tradesError && (
                  <div className="mb-4 bg-paper-light border border-negative/30 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-xs font-semibold text-ink">Couldn’t refresh trades</div>
                        <div className="font-mono text-[11px] text-ink-muted mt-1">{tradesError}</div>
                      </div>
                      {currentPortfolio && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border-editorial bg-paper-alt hover:bg-paper-light font-mono"
                          onClick={() => loadPositionsAndTrades(currentPortfolio.id)}
                        >
                          Retry
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {tradesLoading && trades.length === 0 ? (
                  <div className="text-center py-12 text-ink-muted">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-mono">Loading trades…</p>
                  </div>
                ) : trades.length > 0 ? (
                  <div className="space-y-3">
                    {trades.map((trade) => (
                      <div 
                        key={trade.id}
                        className="flex items-center justify-between py-3 border-b border-gridline last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant="outline"
                            className={cn(
                              "font-mono text-xs",
                              trade.side === 'BUY' 
                                ? "border-positive-strong/50 text-positive-strong bg-positive-strong/10"
                                : "border-negative/50 text-negative bg-negative/10"
                            )}
                          >
                            {trade.side}
                          </Badge>
                          <div>
                            <div className="font-mono text-sm font-medium text-ink">
                              {trade.quantity} {trade.symbol}
                            </div>
                            <div className="text-xs font-mono text-ink-muted">
                              @ {currencySymbol}{formatNumber(trade.price)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono text-ink">
                            {currencySymbol}{formatNumber(trade.notional)}
                          </div>
                          <div className="text-xs font-mono text-ink-muted">
                            {new Date(trade.executed_at).toLocaleDateString()}
                          </div>
                          {trade.realized_pnl !== undefined && trade.realized_pnl !== null && (
                            <div className={cn(
                              "text-xs font-mono font-medium",
                              trade.realized_pnl >= 0 ? "text-positive-strong" : "text-negative"
                            )}>
                              P&L: {trade.realized_pnl >= 0 ? '+' : ''}{currencySymbol}{formatNumber(trade.realized_pnl)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-ink-muted">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-mono">No trades yet</p>
                    <p className="text-sm font-mono mt-1">Your trade history will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-paper-alt border border-border-editorial rounded-lg">
            <div className="p-12 text-center">
              <Wallet className="w-16 h-16 mx-auto mb-4 text-ink-muted opacity-50" />
              <h3 className="text-xl font-mono font-semibold text-ink mb-2">No Portfolio Yet</h3>
              <p className="text-ink-muted font-mono mb-6">
                Your paper trading portfolio will be created automatically when you add your first recommendation with a quantity.
              </p>
              <Button 
                onClick={() => navigate('/recommendations')}
                className="bg-ink text-paper-light hover:bg-ink/90 font-mono"
              >
                Go to Recommendations
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Sell Modal */}
      {selectedPosition && currentPortfolio && selectedPosition.quantity > 0 && (
        <SellModal
          open={sellModalOpen}
          onClose={() => {
            setSellModalOpen(false)
            setSelectedPosition(null)
          }}
          onSuccess={handleSellComplete}
          position={selectedPosition}
          currency={currentPortfolio.base_currency}
        />
      )}

      {/* Buy to Cover Modal */}
      {selectedPosition && currentPortfolio && selectedPosition.quantity < 0 && (
        <BuyToCoverModal
          open={coverModalOpen}
          onClose={() => {
            setCoverModalOpen(false)
            setSelectedPosition(null)
          }}
          onSuccess={handleCoverComplete}
          position={selectedPosition}
          currency={currentPortfolio.base_currency}
        />
      )}
    </div>
  )
}
