"use client"

import * as React from "react"
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

  const loadPortfolioData = async () => {
    if (!user) return
    setLoading(true)
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
    } finally {
      setLoading(false)
    }
  }

  const loadPositionsAndTrades = async (portfolioId: string) => {
    if (!user) return
    try {
      const [positionsRes, tradesRes, snapshotsRes] = await Promise.all([
        getPortfolioPositions(portfolioId, user.id),
        getPortfolioTrades(portfolioId, user.id, 20),
        getPortfolioSnapshots(portfolioId, user.id, 90)
      ])
      setPositions(positionsRes.positions || [])
      setTrades(tradesRes.trades || [])
      setSnapshots(snapshotsRes.snapshots || [])
    } catch (error) {
      console.error('Error loading positions/trades:', error)
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
      <div className="flex items-center justify-center h-full bg-[#F1EEE0]">
        <div className="text-[#6F6A60] font-mono">Loading portfolio...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F1EEE0] p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-mono font-bold text-[#1C1B17]">Paper Portfolio</h1>
            <p className="text-[#6F6A60] font-mono text-sm mt-1">Track your paper trading performance</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Market Tabs */}
            <div className="flex bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg p-1">
              <button
                onClick={() => setSelectedMarket('US')}
                className={cn(
                  "px-3 py-1.5 rounded font-mono text-sm transition-colors",
                  selectedMarket === 'US' 
                    ? "bg-[#1C1B17] text-[#F7F2E6]" 
                    : "text-[#6F6A60] hover:text-[#1C1B17]"
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
                    ? "bg-[#1C1B17] text-[#F7F2E6]" 
                    : "text-[#6F6A60] hover:text-[#1C1B17]"
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
              className="border-[#D7D0C2] bg-[#FBF7ED] hover:bg-[#F7F2E6]"
            >
              <RefreshCw className={cn("w-4 h-4 text-[#6F6A60]", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Portfolio Summary Cards */}
        {currentPortfolio ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* NAV Card */}
              <div className="bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PieChart className="w-4 h-4 text-[#6F6A60]" />
                  <span className="text-xs font-mono text-[#6F6A60]">Net Asset Value</span>
                </div>
                <div className="text-xl font-mono font-bold text-[#1C1B17]">
                  {formatLargeNumber(currentPortfolio.nav, currentPortfolio.base_currency)}
                </div>
                <div className={cn(
                  "text-xs font-mono mt-1 flex items-center gap-1",
                  currentPortfolio.nav >= currentPortfolio.initial_capital ? "text-[#2A6B4F]" : "text-[#B23B2A]"
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
              <div className="bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-[#6F6A60]" />
                  <span className="text-xs font-mono text-[#6F6A60]">Cash Balance</span>
                </div>
                <div className="text-xl font-mono font-bold text-[#1C1B17]">
                  {formatLargeNumber(currentPortfolio.cash_balance, currentPortfolio.base_currency)}
                </div>
                <div className="text-xs font-mono text-[#6F6A60] mt-1">
                  {((currentPortfolio.cash_balance / currentPortfolio.nav) * 100).toFixed(1)}% of portfolio
                </div>
              </div>

              {/* Positions Value Card */}
              <div className="bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-[#6F6A60]" />
                  <span className="text-xs font-mono text-[#6F6A60]">Invested Value</span>
                </div>
                <div className="text-xl font-mono font-bold text-[#1C1B17]">
                  {formatLargeNumber(currentPortfolio.positions_value, currentPortfolio.base_currency)}
                </div>
                <div className="text-xs font-mono text-[#6F6A60] mt-1">
                  {activePositions.length} position{activePositions.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Unrealized P&L Card */}
              <div className={cn(
                "bg-[#FBF7ED] border rounded-lg p-4",
                currentPortfolio.unrealized_pnl >= 0 
                  ? "border-[#2A6B4F]/30"
                  : "border-[#B23B2A]/30"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  {currentPortfolio.unrealized_pnl >= 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-[#2A6B4F]" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-[#B23B2A]" />
                  )}
                  <span className="text-xs font-mono text-[#6F6A60]">Unrealized P&L</span>
                </div>
                <div className={cn(
                  "text-xl font-mono font-bold",
                  currentPortfolio.unrealized_pnl >= 0 ? "text-[#2A6B4F]" : "text-[#B23B2A]"
                )}>
                  {currentPortfolio.unrealized_pnl >= 0 ? '+' : ''}
                  {formatLargeNumber(currentPortfolio.unrealized_pnl, currentPortfolio.base_currency)}
                </div>
                <div className="text-xs font-mono text-[#6F6A60] mt-1">
                  Realized: {formatLargeNumber(currentPortfolio.realized_pnl, currentPortfolio.base_currency)}
                </div>
              </div>
            </div>

            {/* Positions Table */}
            <div className="bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg">
              <div className="p-4 border-b border-[#D7D0C2]">
                <h2 className="text-sm font-mono font-semibold text-[#1C1B17] flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-[#6F6A60]" />
                  Positions
                </h2>
              </div>
              <div className="p-4">
                {activePositions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#D7D0C2] text-left">
                          <th className="pb-3 text-xs font-mono font-medium text-[#6F6A60]">Symbol</th>
                          <th className="pb-3 text-xs font-mono font-medium text-[#6F6A60] text-right">Qty</th>
                          <th className="pb-3 text-xs font-mono font-medium text-[#6F6A60] text-right">Avg Cost</th>
                          <th className="pb-3 text-xs font-mono font-medium text-[#6F6A60] text-right">Current</th>
                          <th className="pb-3 text-xs font-mono font-medium text-[#6F6A60] text-right">Value</th>
                          <th className="pb-3 text-xs font-mono font-medium text-[#6F6A60] text-right">P&L</th>
                          <th className="pb-3 text-xs font-mono font-medium text-[#6F6A60] text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePositions.map((pos) => {
                          const isShort = pos.quantity < 0
                          const displayQty = Math.abs(pos.quantity)
                          return (
                            <tr 
                              key={pos.id} 
                              className="border-b border-[#E3DDCF] last:border-0 hover:bg-[#F7F2E6] cursor-pointer transition-colors"
                              onClick={() => navigate(`/stock/${pos.symbol}`)}
                            >
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-medium text-[#1C1B17]">{pos.symbol}</span>
                                  {isShort && (
                                    <Badge variant="outline" className="text-[10px] border-[#B23B2A]/50 text-[#B23B2A] px-1 py-0">
                                      SHORT
                                    </Badge>
                                  )}
                                </div>
                                {pos.exchange && (
                                  <div className="text-xs font-mono text-[#6F6A60]">{pos.exchange}</div>
                                )}
                              </td>
                              <td className={cn(
                                "py-3 text-right font-mono text-sm",
                                isShort ? "text-[#B23B2A]" : "text-[#1C1B17]"
                              )}>
                                {isShort ? `-${formatNumber(displayQty, displayQty % 1 === 0 ? 0 : 2)}` : formatNumber(displayQty, displayQty % 1 === 0 ? 0 : 2)}
                              </td>
                              <td className="py-3 text-right font-mono text-sm text-[#1C1B17]">
                                {currencySymbol}{formatNumber(pos.avg_cost)}
                              </td>
                              <td className="py-3 text-right font-mono text-sm text-[#1C1B17]">
                                {currencySymbol}{formatNumber(pos.current_price)}
                              </td>
                              <td className="py-3 text-right font-mono text-sm font-medium text-[#1C1B17]">
                                {currencySymbol}{formatNumber(Math.abs(pos.market_value))}
                              </td>
                              <td className="py-3 text-right">
                                <div className={cn(
                                  "font-mono text-sm font-medium",
                                  pos.unrealized_pnl >= 0 ? "text-[#2A6B4F]" : "text-[#B23B2A]"
                                )}>
                                  {pos.unrealized_pnl >= 0 ? '+' : ''}
                                  {currencySymbol}{formatNumber(pos.unrealized_pnl)}
                                </div>
                                <div className={cn(
                                  "text-xs font-mono",
                                  pos.unrealized_pnl_pct >= 0 ? "text-[#2A6B4F]/70" : "text-[#B23B2A]/70"
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
                                      ? "border-[#2A6B4F]/50 text-[#2A6B4F] hover:bg-[#2A6B4F]/10"
                                      : "border-[#B23B2A]/50 text-[#B23B2A] hover:bg-[#B23B2A]/10"
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
                  <div className="text-center py-12 text-[#6F6A60]">
                    <PieChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-mono">No positions yet</p>
                    <p className="text-sm font-mono mt-1">Add a recommendation with quantity to start paper trading</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg">
              <div className="p-4 border-b border-[#D7D0C2]">
                <h2 className="text-sm font-mono font-semibold text-[#1C1B17] flex items-center gap-2">
                  <History className="w-4 h-4 text-[#6F6A60]" />
                  Recent Activity
                </h2>
              </div>
              <div className="p-4">
                {trades.length > 0 ? (
                  <div className="space-y-3">
                    {trades.map((trade) => (
                      <div 
                        key={trade.id}
                        className="flex items-center justify-between py-3 border-b border-[#E3DDCF] last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant="outline"
                            className={cn(
                              "font-mono text-xs",
                              trade.side === 'BUY' 
                                ? "border-[#2A6B4F]/50 text-[#2A6B4F] bg-[#2A6B4F]/10"
                                : "border-[#B23B2A]/50 text-[#B23B2A] bg-[#B23B2A]/10"
                            )}
                          >
                            {trade.side}
                          </Badge>
                          <div>
                            <div className="font-mono text-sm font-medium text-[#1C1B17]">
                              {trade.quantity} {trade.symbol}
                            </div>
                            <div className="text-xs font-mono text-[#6F6A60]">
                              @ {currencySymbol}{formatNumber(trade.price)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono text-[#1C1B17]">
                            {currencySymbol}{formatNumber(trade.notional)}
                          </div>
                          <div className="text-xs font-mono text-[#6F6A60]">
                            {new Date(trade.executed_at).toLocaleDateString()}
                          </div>
                          {trade.realized_pnl !== undefined && trade.realized_pnl !== null && (
                            <div className={cn(
                              "text-xs font-mono font-medium",
                              trade.realized_pnl >= 0 ? "text-[#2A6B4F]" : "text-[#B23B2A]"
                            )}>
                              P&L: {trade.realized_pnl >= 0 ? '+' : ''}{currencySymbol}{formatNumber(trade.realized_pnl)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-[#6F6A60]">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-mono">No trades yet</p>
                    <p className="text-sm font-mono mt-1">Your trade history will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-[#FBF7ED] border border-[#D7D0C2] rounded-lg">
            <div className="p-12 text-center">
              <Wallet className="w-16 h-16 mx-auto mb-4 text-[#6F6A60] opacity-50" />
              <h3 className="text-xl font-mono font-semibold text-[#1C1B17] mb-2">No Portfolio Yet</h3>
              <p className="text-[#6F6A60] font-mono mb-6">
                Your paper trading portfolio will be created automatically when you add your first recommendation with a quantity.
              </p>
              <Button 
                onClick={() => navigate('/recommendations')}
                className="bg-[#1C1B17] text-[#F7F2E6] hover:bg-[#1C1B17]/90 font-mono"
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
