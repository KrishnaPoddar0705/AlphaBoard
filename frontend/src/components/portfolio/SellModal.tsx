"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TrendingDown, AlertTriangle, Loader2 } from "lucide-react"
import { executeSellTrade } from "@/lib/api"
import { useUser } from "@clerk/clerk-react"
import { cn } from "@/lib/utils"

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

interface SellModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  position: PortfolioPosition
  currency: string
}

export function SellModal({ open, onClose, onSuccess, position, currency }: SellModalProps) {
  const { user } = useUser()
  const [quantity, setQuantity] = React.useState<string>('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const maxQty = position.quantity
  const numericQty = parseFloat(quantity) || 0
  const isValidQty = numericQty > 0 && numericQty <= maxQty
  const estimatedProceeds = numericQty * position.current_price
  const estimatedPnl = numericQty * (position.current_price - position.avg_cost)
  const percentageOfPosition = maxQty > 0 ? (numericQty / maxQty) * 100 : 0

  React.useEffect(() => {
    if (open) {
      setQuantity('')
      setError(null)
    }
  }, [open])

  const handleSellAll = () => {
    setQuantity(maxQty.toString())
  }

  const handleSell = async () => {
    if (!user || !isValidQty) return
    
    setLoading(true)
    setError(null)
    
    try {
      await executeSellTrade(user.id, position.symbol, numericQty)
      onSuccess()
    } catch (err: any) {
      console.error('Sell error:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Failed to execute sell'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const currencySymbol = currency === 'INR' ? '₹' : '$'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-paper-light border-border-editorial">
        <DialogHeader>
          <DialogTitle className="text-ink font-mono flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-negative" />
            Sell {position.symbol}
          </DialogTitle>
          <DialogDescription className="text-ink-muted font-mono">
            Enter the quantity you want to sell
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Position Info */}
          <div className="bg-paper-alt border border-border-editorial rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm font-mono">
              <span className="text-ink-muted">Available</span>
              <span className="text-ink font-medium">{position.quantity} shares</span>
            </div>
            <div className="flex justify-between text-sm font-mono">
              <span className="text-ink-muted">Avg Cost</span>
              <span className="text-ink">{currencySymbol}{position.avg_cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-mono">
              <span className="text-ink-muted">Current Price</span>
              <span className="text-ink">{currencySymbol}{position.current_price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-mono">
              <span className="text-ink-muted">Unrealized P&L</span>
              <span className={cn(
                "font-medium",
                position.unrealized_pnl >= 0 ? "text-positive-strong" : "text-negative"
              )}>
                {position.unrealized_pnl >= 0 ? '+' : ''}{currencySymbol}{position.unrealized_pnl.toFixed(2)}
                <span className="text-xs ml-1">
                  ({position.unrealized_pnl_pct >= 0 ? '+' : ''}{position.unrealized_pnl_pct.toFixed(2)}%)
                </span>
              </span>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="quantity" className="text-ink font-mono text-sm">Quantity to Sell</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleSellAll}
                className="text-xs text-ink-muted hover:text-ink font-mono h-auto py-1 px-2"
              >
                Sell All
              </Button>
            </div>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              min={0}
              max={maxQty}
              step={maxQty % 1 === 0 ? 1 : 0.0001}
              className="bg-paper-alt border-border-editorial text-ink font-mono text-lg"
            />
            
            {/* Quick percentage buttons */}
            <div className="flex gap-2">
              {[25, 50, 75, 100].map((pct) => (
                <Button
                  key={pct}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const qty = (pct / 100) * maxQty
                    const rounded = maxQty % 1 === 0 ? Math.floor(qty) : parseFloat(qty.toFixed(4))
                    setQuantity(rounded.toString())
                  }}
                  className={cn(
                    "flex-1 text-xs font-mono border-border-editorial",
                    Math.abs(percentageOfPosition - pct) < 1 
                      ? "bg-ink border-ink text-paper-light" 
                      : "bg-paper-alt text-ink-muted hover:bg-paper-light"
                  )}
                >
                  {pct}%
                </Button>
              ))}
            </div>
          </div>

          {/* Estimated Results */}
          {numericQty > 0 && (
            <div className="bg-paper-alt border border-border-editorial rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm font-mono">
                <span className="text-ink-muted">Estimated Proceeds</span>
                <span className="text-ink font-medium">
                  {currencySymbol}{estimatedProceeds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm font-mono">
                <span className="text-ink-muted">Estimated P&L</span>
                <span className={cn(
                  "font-medium",
                  estimatedPnl >= 0 ? "text-positive-strong" : "text-negative"
                )}>
                  {estimatedPnl >= 0 ? '+' : ''}
                  {currencySymbol}{estimatedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-negative/10 border border-negative/30 text-negative text-sm font-mono">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quantity Validation */}
          {numericQty > maxQty && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#C9A227] text-sm font-mono">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Cannot sell more than {maxQty} shares</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-border-editorial font-mono text-xs bg-transparent text-ink hover:bg-paper-alt"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSell}
            disabled={!isValidQty || loading}
            className="flex-1 bg-negative hover:bg-negative/90 text-white font-mono text-xs"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Selling...
              </>
            ) : (
              <>
                Sell {numericQty > 0 ? numericQty : ''} {position.symbol}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
