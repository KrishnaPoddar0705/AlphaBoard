import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Upload } from 'lucide-react'
import { searchStocks, getPrice, createRecommendation } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useUser } from '@clerk/clerk-react'

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
  const [isSearching, setIsSearching] = useState(false)
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
    }
  }, [open])

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
      console.error('Search error:', err)
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
      console.error('Error fetching price:', err)
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

      await createRecommendation(newRec, mapping.supabase_user_id)
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
                Current price: ${currentPrice.toFixed(2)}
              </p>
            )}
          </div>

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
              disabled={loading || !ticker}
              className="font-mono text-xs bg-[#1C1B17] text-[#F7F2E6] hover:bg-[#1C1B17]/90"
            >
              {loading ? 'Creating...' : 'Create Recommendation'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

