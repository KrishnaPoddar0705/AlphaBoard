"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TrendingUp, AlertTriangle, Loader2 } from "lucide-react"
import { executeBuyToCover } from "@/lib/api"
import { useUser } from "@clerk/clerk-react"
import { cn } from "@/lib/utils"

interface ShortPosition {
  id: string
  symbol: string
  quantity: number  // This will be negative for shorts
  avg_cost: number
  current_price: number
  market_value: number
  unrealized_pnl: number
  unrealized_pnl_pct: number
}

interface BuyToCoverModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  position: ShortPosition
  currency: string
}

export function BuyToCoverModal({ open, onClose, onSuccess, position, currency }: BuyToCoverModalProps) {
  const { user } = useUser()
  const [quantity, setQuantity] = React.useState<string>('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // For shorts, quantity is negative, so we use absolute value
  const shortQty = Math.abs(position.quantity)
  const numericQty = parseFloat(quantity) || 0
  const isValidQty = numericQty > 0 && numericQty <= shortQty
  const estimatedCost = numericQty * position.current_price
  // Short P&L = (sell price - buy price) * qty = (avg_cost - current_price) * qty
  const estimatedPnl = numericQty * (position.avg_cost - position.current_price)
  const percentageOfPosition = shortQty > 0 ? (numericQty / shortQty) * 100 : 0

  React.useEffect(() => {
    if (open) {
      setQuantity('')
      setError(null)
    }
  }, [open])

  const handleCoverAll = () => {
    setQuantity(shortQty.toString())
  }

  const handleBuyToCover = async () => {
    if (!user || !isValidQty) return
    
    setLoading(true)
    setError(null)
    
    try {
      await executeBuyToCover(user.id, position.symbol, numericQty)
      onSuccess()
    } catch (err: any) {
      console.error('Buy to cover error:', err)
      const errorMessage = err.response?.data?.error || err.message || 'Failed to execute buy to cover'
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
            <TrendingUp className="w-5 h-5 text-positive-strong" />
            Buy to Cover {position.symbol}
          </DialogTitle>
          <DialogDescription className="text-ink-muted font-mono">
            Close your short position by buying back shares
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Position Info */}
          <div className="bg-paper-alt border border-border-editorial rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm font-mono">
              <span className="text-ink-muted">Short Position</span>
              <span className="text-negative font-medium">{shortQty} shares</span>
            </div>
            <div className="flex justify-between text-sm font-mono">
              <span className="text-ink-muted">Avg Sell Price</span>
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
              <Label htmlFor="quantity" className="text-ink font-mono text-sm">Quantity to Cover</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCoverAll}
                className="text-xs text-ink-muted hover:text-ink font-mono h-auto py-1 px-2"
              >
                Cover All
              </Button>
            </div>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              min={0}
              max={shortQty}
              step={1}
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
                    const qty = Math.floor((pct / 100) * shortQty)
                    setQuantity(qty.toString())
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
                <span className="text-ink-muted">Cost to Cover</span>
                <span className="text-ink font-medium">
                  {currencySymbol}{estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm font-mono">
                <span className="text-ink-muted">Realized P&L</span>
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
          {numericQty > shortQty && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[#C9A227]/10 border border-[#C9A227]/30 text-[#C9A227] text-sm font-mono">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Cannot cover more than {shortQty} shares</span>
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
            onClick={handleBuyToCover}
            disabled={!isValidQty || loading}
            className="flex-1 bg-positive-strong hover:bg-positive-strong/90 text-white font-mono text-xs"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Covering...
              </>
            ) : (
              <>
                Buy {numericQty > 0 ? numericQty : ''} to Cover
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
