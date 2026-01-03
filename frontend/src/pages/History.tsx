"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card-new"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { getPrice, getPriceTargets } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { useUser } from "@clerk/clerk-react"
import { TrendingUp, TrendingDown, X } from "lucide-react"

interface ClosedRecommendation {
  id: string
  ticker: string
  entry_price: number
  exit_price?: number
  current_price?: number
  exit_date: string
  entry_date: string
  final_return_pct?: number
  action?: string
  thesis?: string | null
}

interface PriceTarget {
  id: string
  ticker: string
  target_price: number
  target_date: string | null
  created_at: string
}

export default function History() {
  const navigate = useNavigate()
  const { user } = useUser()
  const [history, setHistory] = React.useState<ClosedRecommendation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [selectedStock, setSelectedStock] = React.useState<ClosedRecommendation | null>(null)
  const [priceTargets, setPriceTargets] = React.useState<PriceTarget[]>([])
  const [loadingTargets, setLoadingTargets] = React.useState(false)

  React.useEffect(() => {
    if (user) {
      loadHistory()
    }
  }, [user])

  const loadHistory = async () => {
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

      // Fetch CLOSED recommendations
      const { data, error } = await supabase
        .from("recommendations")
        .select("*")
        .eq("user_id", mapping.supabase_user_id)
        .eq("status", "CLOSED")
        .order("exit_date", { ascending: false })

      if (!error && data) {
        // Fetch current prices for display
        const historyWithPrices = await Promise.all(
          data.map(async (rec) => {
            try {
              const priceData = await getPrice(rec.ticker)
              return { ...rec, current_price: priceData.price || rec.exit_price }
            } catch {
              return { ...rec, current_price: rec.exit_price }
            }
          })
        )
        setHistory(historyWithPrices)
      }
    } catch (error) {
      console.error("Error loading history:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculateReturn = (rec: ClosedRecommendation) => {
    if (rec.final_return_pct !== undefined && rec.final_return_pct !== null) {
      return rec.final_return_pct
    }
    if (rec.entry_price && rec.exit_price) {
      const returnPct = ((rec.exit_price - rec.entry_price) / rec.entry_price) * 100
      return rec.action === 'SELL' ? -returnPct : returnPct
    }
    return null
  }

  const handleStockClick = async (rec: ClosedRecommendation) => {
    setSelectedStock(rec)
    setPriceTargets([])
    
    if (!user) return
    
    try {
      setLoadingTargets(true)
      const { data: mapping } = await supabase
        .from("clerk_user_mapping")
        .select("supabase_user_id")
        .eq("clerk_user_id", user.id)
        .maybeSingle()

      if (mapping) {
        // Fetch price targets for this ticker
        const targets = await getPriceTargets(rec.ticker, mapping.supabase_user_id)
        setPriceTargets(targets || [])
      }
    } catch (error) {
      console.error("Error loading price targets:", error)
    } finally {
      setLoadingTargets(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#F1EEE0]">
        <div className="text-[#6F6A60] font-mono">Loading history...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#F1EEE0]">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[#D7D0C2] bg-[#F7F2E6]">
        <h1 className="text-2xl font-mono font-bold text-[#1C1B17] tracking-tight">History</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {history.length === 0 ? (
          <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
            <CardContent className="py-12 text-center">
              <p className="font-mono text-[#6F6A60] text-lg mb-2">No closed positions yet.</p>
              <p className="font-mono text-sm text-[#6F6A60]">Close a position from your recommendations to see it here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {history.map((rec) => {
              const returnPct = calculateReturn(rec)
              const isPositive = returnPct !== null && returnPct >= 0
              const gainLoss = returnPct !== null && rec.entry_price && rec.exit_price
                ? (rec.exit_price - rec.entry_price) * (rec.action === 'SELL' ? -1 : 1)
                : null

              return (
                <Card
                  key={rec.id}
                  className="bg-[#F7F2E6] border-[#D7D0C2] hover:border-[#1C1B17] transition-all cursor-pointer"
                  onClick={() => handleStockClick(rec)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg font-mono font-bold text-[#1C1B17]">{rec.ticker}</CardTitle>
                        {rec.action && rec.action !== 'WATCH' && (
                          <Badge
                            variant={rec.action === 'BUY' ? 'default' : 'destructive'}
                            className="font-mono text-xs px-1.5 py-0"
                          >
                            {rec.action}
                          </Badge>
                        )}
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs">
                        CLOSED
                      </Badge>
                    </div>
                    <p className="font-mono text-xs text-[#6F6A60]">
                      Closed {new Date(rec.exit_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="font-mono text-xs text-[#6F6A60] mb-1">Entry</p>
                        <p className="font-mono font-semibold text-[#1C1B17] tabular-nums">
                          ${rec.entry_price?.toFixed(2) || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="font-mono text-xs text-[#6F6A60] mb-1">Exit</p>
                        <p className="font-mono font-semibold text-[#1C1B17] tabular-nums">
                          ${rec.exit_price?.toFixed(2) || 'N/A'}
                        </p>
                      </div>
                    </div>
                    {returnPct !== null && (
                      <div className="pt-3 border-t border-[#E3DDCF]">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-[#6F6A60]">Return</span>
                          <div className="flex items-center gap-2">
                            {isPositive ? (
                              <TrendingUp className="h-4 w-4 text-[#2F8F5B]" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-[#B23B2A]" />
                            )}
                            <div className="text-right">
                              {gainLoss !== null && (
                                <div className={`font-mono font-bold tabular-nums ${
                                  isPositive ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'
                                }`}>
                                  {isPositive ? '+' : ''}${gainLoss.toFixed(2)}
                                </div>
                              )}
                              <div className={`font-mono text-sm tabular-nums ${
                                isPositive ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'
                              }`}>
                                {isPositive ? '+' : ''}{returnPct.toFixed(2)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedStock} onOpenChange={(open) => !open && setSelectedStock(null)}>
        <DialogContent className="bg-[#F7F2E6] border-[#D7D0C2] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-xl font-bold text-[#1C1B17] flex items-center justify-between">
              <span>{selectedStock?.ticker}</span>
              <button
                onClick={() => setSelectedStock(null)}
                className="text-[#6F6A60] hover:text-[#1C1B17] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </DialogTitle>
            <DialogDescription className="font-mono text-sm text-[#6F6A60]">
              Closed Position Details
            </DialogDescription>
          </DialogHeader>

          {selectedStock && (
            <div className="space-y-6 mt-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-[#FBF7ED] border border-[#D7D0C2] rounded">
                <div>
                  <p className="font-mono text-xs text-[#6F6A60] mb-1">Entry Price</p>
                  <p className="font-mono font-semibold text-[#1C1B17] tabular-nums">
                    ${selectedStock.entry_price?.toFixed(2) || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-xs text-[#6F6A60] mb-1">Exit Price</p>
                  <p className="font-mono font-semibold text-[#1C1B17] tabular-nums">
                    ${selectedStock.exit_price?.toFixed(2) || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-xs text-[#6F6A60] mb-1">Entry Date</p>
                  <p className="font-mono text-sm text-[#1C1B17]">
                    {new Date(selectedStock.entry_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-xs text-[#6F6A60] mb-1">Exit Date</p>
                  <p className="font-mono text-sm text-[#1C1B17]">
                    {new Date(selectedStock.exit_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {/* Thesis */}
              {selectedStock.thesis && (
                <div className="p-4 bg-[#FBF7ED] border border-[#D7D0C2] rounded">
                  <h3 className="font-mono font-semibold text-[#1C1B17] mb-2">Investment Thesis</h3>
                  <p className="font-mono text-sm text-[#1C1B17] whitespace-pre-wrap">
                    {selectedStock.thesis}
                  </p>
                </div>
              )}

              {/* Price Targets */}
              <div className="p-4 bg-[#FBF7ED] border border-[#D7D0C2] rounded">
                <h3 className="font-mono font-semibold text-[#1C1B17] mb-3">Price Targets</h3>
                {loadingTargets ? (
                  <p className="font-mono text-sm text-[#6F6A60]">Loading price targets...</p>
                ) : priceTargets.length === 0 ? (
                  <p className="font-mono text-sm text-[#6F6A60]">No price targets set for this position.</p>
                ) : (
                  <div className="space-y-3">
                    {priceTargets.map((target) => (
                      <div
                        key={target.id}
                        className="flex items-center justify-between p-3 bg-[#F7F2E6] border border-[#E3DDCF] rounded"
                      >
                        <div>
                          <p className="font-mono font-semibold text-[#1C1B17] tabular-nums">
                            ${target.target_price.toFixed(2)}
                          </p>
                          {target.target_date && (
                            <p className="font-mono text-xs text-[#6F6A60] mt-1">
                              Target Date: {new Date(target.target_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          )}
                        </div>
                        {selectedStock.exit_price && (
                          <div className="text-right">
                            <p className={`font-mono text-xs tabular-nums ${
                              target.target_price >= selectedStock.exit_price
                                ? 'text-[#2F8F5B]'
                                : 'text-[#B23B2A]'
                            }`}>
                              {target.target_price >= selectedStock.exit_price ? '✓' : '✗'} Target{' '}
                              {target.target_price >= selectedStock.exit_price ? 'Met' : 'Missed'}
                            </p>
                            <p className="font-mono text-xs text-[#6F6A60] mt-1">
                              {((target.target_price - selectedStock.exit_price) / selectedStock.exit_price * 100).toFixed(1)}%
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#D7D0C2]">
                <button
                  onClick={() => navigate(`/stock/${selectedStock.ticker}`)}
                  className="px-4 py-2 text-sm font-mono font-medium text-[#1C1B17] bg-transparent border border-[#D7D0C2] rounded-lg hover:bg-[#FBF7ED] transition-colors"
                >
                  View Stock Details
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

