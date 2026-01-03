import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X } from 'lucide-react'
import { searchStocks, getPrice, createWatchlistItem } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useUser } from '@clerk/clerk-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface AddToWatchlistModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddToWatchlistModal({ open, onClose, onSuccess }: AddToWatchlistModalProps) {
  const { user } = useUser()
  const [ticker, setTicker] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [entryPrice, setEntryPrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMarket, setSelectedMarket] = useState<'US' | 'IN'>('US')

  useEffect(() => {
    if (!open) {
      // Reset form when modal closes
      setTicker('')
      setSearchQuery('')
      setSearchResults([])
      setEntryPrice('')
      setCurrentPrice(null)
      setError(null)
    }
  }, [open])

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results = await searchStocks(query)
      setSearchResults(results || [])
    } catch (err) {
      console.error('Search error:', err)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectTicker = async (selectedTicker: string) => {
    setTicker(selectedTicker)
    setSearchQuery(selectedTicker)
    setSearchResults([])

    // Fetch current price
    try {
      const priceData = await getPrice(selectedTicker)
      setCurrentPrice(priceData.price || null)
      if (priceData.price) {
        setEntryPrice(priceData.price.toFixed(2))
      }
    } catch (err) {
      console.error('Error fetching price:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!user || !user.id) {
      setError('User not authenticated.')
      return
    }

    if (!ticker) {
      setError('Please select a stock ticker')
      return
    }

    try {
      setLoading(true)

      const { data: mapping } = await supabase
        .from('clerk_user_mapping')
        .select('supabase_user_id')
        .eq('clerk_user_id', user.id)
        .maybeSingle()

      if (!mapping) {
        setError('User mapping not found. Please ensure you are logged in.')
        return
      }

      const benchmarkTicker = selectedMarket === 'US' ? '^GSPC' : '^NSEI'
      const entryPriceNum = entryPrice && parseFloat(entryPrice) > 0 ? parseFloat(entryPrice) : null

      const newRec: any = {
        ticker: ticker.trim().toUpperCase(),
        action: 'WATCH',
        entry_price: entryPriceNum,
        thesis: null,
        benchmark_ticker: benchmarkTicker,
        status: 'WATCHLIST',
        images: null,
        price_target: null,
        target_date: null,
      }

      await createWatchlistItem(newRec, mapping.supabase_user_id)
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to add to watchlist')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#F7F2E6] border-[#D7D0C2] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-xl font-bold text-[#1C1B17]">Add to Watchlist</DialogTitle>
          <DialogDescription className="font-mono text-sm text-[#6F6A60]">
            Add a stock to your watchlist to track it
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {error && (
            <div className="p-3 bg-[#B23B2A]/10 border border-[#B23B2A] rounded text-sm font-mono text-[#B23B2A]">
              {error}
            </div>
          )}

          {/* Market Selection */}
          <div className="space-y-2">
            <Label className="font-mono text-sm text-[#1C1B17]">Market</Label>
            <Select value={selectedMarket} onValueChange={(value: 'US' | 'IN') => setSelectedMarket(value)}>
              <SelectTrigger className="bg-[#FBF7ED] border-[#D7D0C2] font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">USA</SelectItem>
                <SelectItem value="IN">India</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stock Search */}
          <div className="space-y-2">
            <Label className="font-mono text-sm text-[#1C1B17]">Stock Ticker *</Label>
            <div className="relative">
              <Input
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search for a stock..."
                className="bg-[#FBF7ED] border-[#D7D0C2] font-mono"
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-[#FBF7ED] border border-[#D7D0C2] rounded shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <div
                      key={`${result.symbol}-${index}-${result.exchange || ''}`}
                      onClick={() => handleSelectTicker(result.symbol)}
                      className="p-3 hover:bg-[#F7F2E6] cursor-pointer border-b border-[#E3DDCF] last:border-0"
                    >
                      <div className="font-mono font-semibold text-[#1C1B17]">{result.symbol}</div>
                      {result.name && (
                        <div className="font-mono text-xs text-[#6F6A60]">{result.name}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {ticker && (
              <p className="font-mono text-xs text-[#6F6A60]">
                Selected: <span className="font-semibold text-[#1C1B17]">{ticker}</span>
              </p>
            )}
          </div>

          {/* Entry Price - Optional */}
          <div className="space-y-2">
            <Label className="font-mono text-sm text-[#1C1B17]">Entry Price (Optional)</Label>
            <Input
              type="number"
              step="0.01"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="0.00"
              className="bg-[#FBF7ED] border-[#D7D0C2] font-mono tabular-nums"
            />
            {currentPrice && (
              <p className="font-mono text-xs text-[#6F6A60]">
                Current price: <span className="font-semibold text-[#1C1B17]">${currentPrice.toFixed(2)}</span>
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#D7D0C2]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="font-mono text-sm border-[#D7D0C2] text-[#1C1B17] hover:bg-[#FBF7ED]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !ticker}
              className="font-mono text-sm bg-[#1C1B17] text-[#F7F2E6] hover:bg-[#1C1B17]/90"
            >
              {loading ? 'Adding...' : 'Add to Watchlist'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

