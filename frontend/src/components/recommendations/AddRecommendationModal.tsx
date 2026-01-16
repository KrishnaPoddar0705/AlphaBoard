import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Upload, Wallet, AlertTriangle } from 'lucide-react'
import { searchStocks, getPrice, createRecommendation, getPortfolioCash, executeBuyTrade, executeShortSellTrade } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useUser } from '@clerk/clerk-react'
import { cn } from '@/lib/utils'

interface AddRecommendationModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  watchlistMode?: boolean // If true, creates a WATCHLIST recommendation instead of OPEN
}

export function AddRecommendationModal({ open, onClose, onSuccess, watchlistMode = false }: AddRecommendationModalProps) {
  const { user } = useUser()
  const [ticker, setTicker] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [_isSearching, setIsSearching] = useState(false)
  const [entryPrice, setEntryPrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [action, setAction] = useState<'BUY' | 'SELL'>('BUY')
  const [thesis, setThesis] = useState('')
  const [priceTarget, setPriceTarget] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMarket, setSelectedMarket] = useState<'US' | 'IN'>('US')
  
  // Paper trading fields
  const [quantity, setQuantity] = useState('')
  const [cashBalance, setCashBalance] = useState<number | null>(null)
  const [_loadingCash, setLoadingCash] = useState(false)

  // Calculate required cash and validate
  const numericQty = parseFloat(quantity) || 0
  const numericPrice = parseFloat(entryPrice) || currentPrice || 0
  const requiredCash = numericQty * numericPrice
  const hasInsufficientCash = cashBalance !== null && requiredCash > cashBalance
  const currencySymbol = selectedMarket === 'IN' ? '₹' : '$'

  useEffect(() => {
    if (!open) {
      // Reset form when modal closes
      setTicker('')
      setSearchQuery('')
      setSearchResults([])
      setEntryPrice('')
      setCurrentPrice(null)
      setAction('BUY')
      setThesis('')
      setPriceTarget('')
      setTargetDate('')
      setSelectedImages([])
      setError(null)
      setQuantity('')
      setCashBalance(null)
    }
  }, [open])

  // Fetch cash balance when modal opens or market changes
  useEffect(() => {
    if (open && user && !watchlistMode) {
      fetchCashBalance()
    }
  }, [open, user, selectedMarket, watchlistMode])

  const fetchCashBalance = async () => {
    if (!user) return
    setLoadingCash(true)
    try {
      const data = await getPortfolioCash(user.id, selectedMarket)
      setCashBalance(data.cash_balance)
    } catch (err) {
      console.error('Error fetching cash balance:', err)
      setCashBalance(null)
    } finally {
      setLoadingCash(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results = await searchStocks(query)
      setSearchResults(results || [])
    } catch (err) {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectTicker = async (selectedTicker: string) => {
    setTicker(selectedTicker)
    setSearchQuery('')
    setSearchResults([])
    
    try {
      const priceData = await getPrice(selectedTicker)
      setCurrentPrice(priceData.price)
      setEntryPrice(priceData.price.toString())
    } catch (err) {
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedImages((prev) => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !ticker) {
      setError('Please select a stock ticker')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get Supabase user ID
      const { data: mapping } = await supabase
        .from('clerk_user_mapping')
        .select('supabase_user_id')
        .eq('clerk_user_id', user.id)
        .maybeSingle()

      if (!mapping) {
        setError('User mapping not found. Please ensure you are logged in.')
        return
      }

      if (!ticker) {
        setError('Please select a stock ticker')
        return
      }

      // Entry price is required for recommendations, optional for watchlist
      if (!watchlistMode && (!entryPrice || parseFloat(entryPrice) <= 0)) {
        setError('Please enter a valid entry price')
        return
      }

      const entryPriceNum = entryPrice && parseFloat(entryPrice) > 0 ? parseFloat(entryPrice) : null
      const imageUrls: string[] = []

      // Upload images
      for (const file of selectedImages) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${mapping.supabase_user_id}/${ticker}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('recommendation-images')
          .upload(fileName, file)

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('recommendation-images')
            .getPublicUrl(fileName)
          imageUrls.push(publicUrl)
        }
      }

      const benchmarkTicker = selectedMarket === 'US' ? '^GSPC' : '^NSEI'

      const newRec: any = {
        ticker: ticker.trim().toUpperCase(),
        action: watchlistMode ? 'WATCH' : action,
        entry_price: watchlistMode ? null : entryPriceNum, // Watchlist items don't need entry price
        thesis: thesis?.trim() || null,
        benchmark_ticker: benchmarkTicker,
        status: watchlistMode ? 'WATCHLIST' : 'OPEN',
        images: imageUrls.length > 0 ? imageUrls : null,
        price_target: priceTarget ? parseFloat(priceTarget) : null,
        target_date: targetDate ? new Date(targetDate).toISOString() : null,
      }

      // Create the recommendation
      const recResult = await createRecommendation(newRec, mapping.supabase_user_id)
      
      // If quantity is provided, execute paper trade based on action type
      const numericQtySubmit = parseFloat(quantity) || 0
      if (!watchlistMode && numericQtySubmit > 0 && user) {
        try {
          // Get the recommendation ID from the result
          const recommendationId = recResult?.id || recResult?.recommendation?.id
          
          if (action === 'BUY') {
            // Execute buy trade with the entry price
            await executeBuyTrade(
              user.id,
              ticker.trim().toUpperCase(),
              numericQtySubmit,
              selectedMarket,
              recommendationId,
              entryPriceNum || undefined
            )
          } else if (action === 'SELL') {
            // Execute short sell trade with the entry price
            await executeShortSellTrade(
              user.id,
              ticker.trim().toUpperCase(),
              numericQtySubmit,
              selectedMarket,
              recommendationId,
              entryPriceNum || undefined
            )
          }
        } catch (tradeError: any) {
          // Log the error but don't fail the whole operation
          console.error('Paper trade failed:', tradeError)
          setError(`Recommendation created, but paper trade failed: ${tradeError.message || 'Unknown error'}`)
          setTimeout(() => {
            onSuccess()
            onClose()
          }, 2000)
          return
        }
      }
      
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create recommendation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#F7F2E6] border-[#D7D0C2] max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-xl font-bold text-[#1C1B17]">Add Recommendation</DialogTitle>
          <DialogDescription className="font-mono text-sm text-[#6F6A60]">
            Create a new stock recommendation
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
              {ticker && (
                <div className="mt-2 p-2 bg-[#FBF7ED] border border-[#D7D0C2] rounded">
                  <span className="font-mono text-sm text-[#1C1B17]">Selected: {ticker}</span>
                </div>
              )}
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
          </div>

          {/* Action - Only show for recommendations, not watchlist */}
          {!watchlistMode && (
            <div className="space-y-2">
              <Label className="font-mono text-sm text-[#1C1B17]">Action *</Label>
              <Select value={action} onValueChange={(value: 'BUY' | 'SELL') => setAction(value)}>
                <SelectTrigger className="bg-[#FBF7ED] border-[#D7D0C2] font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">BUY</SelectItem>
                  <SelectItem value="SELL">SELL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Entry Price - Only required for recommendations, optional for watchlist */}
          <div className="space-y-2">
            <Label className="font-mono text-sm text-[#1C1B17]">
              Entry Price {watchlistMode ? '(Optional)' : '*'}
            </Label>
            <Input
              type="number"
              step="0.01"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value)}
              placeholder="0.00"
              required={!watchlistMode}
              className="bg-[#FBF7ED] border-[#D7D0C2] font-mono tabular-nums"
            />
            {currentPrice && (
              <p className="font-mono text-xs text-[#6F6A60]">
                Current price: {currencySymbol}{currentPrice.toFixed(2)}
              </p>
            )}
          </div>

          {/* Quantity for Paper Trading - Show for both BUY and SELL recommendations, not watchlist */}
          {!watchlistMode && (
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-mono text-sm text-[#1C1B17]">
                    Quantity (Shares) {action === 'SELL' && <span className="text-[#6F6A60]">- Short Sell</span>}
                  </Label>
                  {cashBalance !== null && (
                    <div className="flex items-center gap-1 text-xs font-mono text-[#6F6A60]">
                      <Wallet className="w-3 h-3" />
                      Cash: {currencySymbol}{cashBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  )}
                </div>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter number of shares"
                  className="bg-[#FBF7ED] border-[#D7D0C2] font-mono tabular-nums"
                />
              </div>
              
              {/* Cash Display - Required for BUY, Proceeds for SELL */}
              {numericQty > 0 && numericPrice > 0 && (
                <div className={cn(
                  "p-3 rounded-lg border font-mono text-sm",
                  action === 'BUY' && hasInsufficientCash 
                    ? "bg-[#B23B2A]/10 border-[#B23B2A]/30 text-[#B23B2A]"
                    : "bg-[#2A6B4F]/10 border-[#2A6B4F]/30 text-[#2A6B4F]"
                )}>
                  <div className="flex justify-between">
                    <span>{action === 'BUY' ? 'Required Cash:' : 'Cash Proceeds:'}</span>
                    <span className="font-semibold">{currencySymbol}{requiredCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {action === 'BUY' && hasInsufficientCash && (
                    <div className="flex items-center gap-1 mt-2 text-xs">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Insufficient cash balance</span>
                    </div>
                  )}
                  {action === 'SELL' && (
                    <div className="text-xs mt-1 text-[#6F6A60]">
                      This will create a short position. Buy back to close.
                    </div>
                  )}
                </div>
              )}
              
              <p className="font-mono text-xs text-[#6F6A60]">
                {action === 'BUY' 
                  ? 'Optional: Enter quantity to track as a paper trade in your portfolio'
                  : 'Optional: Enter quantity to short sell in your paper portfolio'
                }
              </p>
            </div>
          )}

          {/* Thesis */}
          <div className="space-y-2">
            <Label className="font-mono text-sm text-[#1C1B17]">Investment Thesis</Label>
            <Textarea
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
              placeholder="Enter your investment thesis..."
              rows={4}
              className="bg-[#FBF7ED] border-[#D7D0C2] font-mono text-sm"
            />
          </div>

          {/* Price Target */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-mono text-sm text-[#1C1B17]">Price Target</Label>
              <Input
                type="number"
                step="0.01"
                value={priceTarget}
                onChange={(e) => setPriceTarget(e.target.value)}
                placeholder="0.00"
                className="bg-[#FBF7ED] border-[#D7D0C2] font-mono tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-sm text-[#1C1B17]">Target Date</Label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="bg-[#FBF7ED] border-[#D7D0C2] font-mono"
              />
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label className="font-mono text-sm text-[#1C1B17]">Documents & Images</Label>
            <div className="border border-[#D7D0C2] border-dashed rounded-lg p-4">
              <Label htmlFor="file-upload-modal" className="cursor-pointer">
                <div className="flex flex-col items-center justify-center py-2">
                  <Upload className="h-6 w-6 text-[#6F6A60] mb-2" />
                  <p className="font-mono text-xs text-[#1C1B17]">Click to upload</p>
                </div>
              </Label>
              <input
                id="file-upload-modal"
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>
            {selectedImages.length > 0 && (
              <div className="space-y-2">
                {selectedImages.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-[#FBF7ED] border border-[#D7D0C2] rounded"
                  >
                    <span className="font-mono text-xs text-[#1C1B17]">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeImage(index)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#D7D0C2]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="font-mono text-xs bg-transparent border-[#D7D0C2] text-[#1C1B17] hover:bg-[#FBF7ED]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !ticker || (numericQty > 0 && hasInsufficientCash)}
              className="font-mono text-xs bg-[#1C1B17] text-[#F7F2E6] hover:bg-[#1C1B17]/90"
            >
              {loading ? 'Creating...' : numericQty > 0 ? `Create & Buy ${numericQty} shares` : 'Create Recommendation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

