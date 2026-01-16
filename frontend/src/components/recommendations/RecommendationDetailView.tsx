import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card-new'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Upload, X, Edit2, Save, Target, TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUser } from '@clerk/clerk-react'
import { PriceTargetTimeline } from '@/components/stock/PriceTargetTimeline'
import { createPriceTarget, getTickerPortfolioInfo } from '@/lib/api'
import { AddPriceTargetModal } from '@/components/stock/AddPriceTargetModal'
import { SellModal } from '@/components/portfolio/SellModal'
import { BuyToCoverModal } from '@/components/portfolio/BuyToCoverModal'
import { formatCurrency, getCurrencySymbol, cn } from '@/lib/utils'

// Local interface definition to avoid Vite HMR issues with TypeScript exports
interface TickerPortfolioInfo {
  ticker: string;
  position: {
    total_shares: number;
    avg_cost: number;
    current_price: number | null;
    realized_pnl: number;
    unrealized_pnl: number;
  } | null;
  trades: {
    id: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    notional: number;
    executed_at: string;
    realized_pnl: number | null;
    price_source: string | null;
  }[];
  realized_pnl: number;
  unrealized_pnl: number;
  total_shares: number;
}

interface Recommendation {
  id: string
  ticker: string
  entry_price: number
  current_price?: number
  status: string
  entry_date: string
  thesis?: string
  images?: string[]
  action?: string
  position_size?: number
}

interface RecommendationDetailViewProps {
  recommendation: Recommendation | null
  onUpdate: () => void
}

export function RecommendationDetailView({ recommendation, onUpdate }: RecommendationDetailViewProps) {
  const { user } = useUser()
  const [isEditingThesis, setIsEditingThesis] = useState(false)
  const [editedThesis, setEditedThesis] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [showAddTargetModal, setShowAddTargetModal] = useState(false)
  const [tradingActivity, setTradingActivity] = useState<TickerPortfolioInfo | null>(null)
  const [loadingTradingActivity, setLoadingTradingActivity] = useState(false)
  const [showSellModal, setShowSellModal] = useState(false)
  const [showBuyToCoverModal, setShowBuyToCoverModal] = useState(false)

  useEffect(() => {
    if (recommendation) {
      setEditedThesis(recommendation.thesis || '')
    }
  }, [recommendation])

  // Load trading activity for this ticker
  useEffect(() => {
    const loadTradingActivity = async () => {
      if (!recommendation || !user) return
      setLoadingTradingActivity(true)
      try {
        const data = await getTickerPortfolioInfo(recommendation.ticker, user.id)
        setTradingActivity(data)
      } catch (error) {
        console.error('Failed to load trading activity:', error)
        setTradingActivity(null)
      } finally {
        setLoadingTradingActivity(false)
      }
    }
    loadTradingActivity()
  }, [recommendation?.ticker, user])

  if (!recommendation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F1EEE0]">
        <div className="text-center">
          <p className="font-mono text-[#6F6A60] text-lg mb-2">Select a recommendation</p>
          <p className="font-mono text-sm text-[#6F6A60]">Choose a stock from the sidebar to view details</p>
        </div>
      </div>
    )
  }

  const calculateReturn = () => {
    if (!recommendation.entry_price || !recommendation.current_price) return null
    const returnPct = ((recommendation.current_price - recommendation.entry_price) / recommendation.entry_price) * 100
    return recommendation.action === 'SELL' ? -returnPct : returnPct
  }

  const returnPct = calculateReturn()
  const isPositive = returnPct !== null && returnPct >= 0
  const gainLoss = returnPct !== null
    ? (recommendation.current_price! - recommendation.entry_price) * (recommendation.action === 'SELL' ? -1 : 1)
    : null

  const handleSaveThesis = async () => {
    if (!user || !recommendation) return

    try {
      // Get Supabase user ID
      const { data: mapping } = await supabase
        .from('clerk_user_mapping')
        .select('supabase_user_id')
        .eq('clerk_user_id', user.id)
        .maybeSingle()

      if (!mapping) {
        return
      }

      await supabase
        .from('recommendations')
        .update({ thesis: editedThesis })
        .eq('id', recommendation.id)
        .eq('user_id', mapping.supabase_user_id)

      setIsEditingThesis(false)
      onUpdate()
    } catch (error) {
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      setSelectedFiles((prev) => [...prev, ...files])
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleClosePosition = () => {
    if (!user || !recommendation) return
    
    if (recommendation.action === 'SELL') {
      // SELL recommendation = short position, need to buy to cover
      if (tradingActivity && tradingActivity.total_shares < 0) {
        // Has short position, open buy to cover modal
        setShowBuyToCoverModal(true)
      } else {
        // No short position, just close recommendation
        closeRecommendationOnly()
      }
    } else {
      // BUY recommendation = long position, need to sell
      if (tradingActivity && tradingActivity.total_shares > 0) {
        // Has long position, open sell modal
        setShowSellModal(true)
      } else {
        // No portfolio position, just close the recommendation
        closeRecommendationOnly()
      }
    }
  }

  const closeRecommendationOnly = async () => {
    if (!user || !recommendation) return
    
    const exitPrice = recommendation.current_price || recommendation.entry_price
    if (!exitPrice) {
      alert('Cannot close position: current price not available')
      return
    }

    const returnPct = recommendation.entry_price > 0
      ? ((exitPrice - recommendation.entry_price) / recommendation.entry_price * 100) * (recommendation.action === 'SELL' ? -1 : 1)
      : 0

    const currencySymbol = getCurrencySymbol(recommendation.ticker)
    if (!window.confirm(`Close recommendation for ${recommendation.ticker} at ${currencySymbol}${exitPrice.toFixed(2)}?`)) {
      return
    }

    try {
      const { data: mapping } = await supabase
        .from('clerk_user_mapping')
        .select('supabase_user_id')
        .eq('clerk_user_id', user.id)
        .maybeSingle()

      if (!mapping) return

      await supabase
        .from('recommendations')
        .update({
          status: 'CLOSED',
          exit_price: exitPrice,
          exit_date: new Date().toISOString(),
          final_return_pct: returnPct,
        })
        .eq('id', recommendation.id)
        .eq('user_id', mapping.supabase_user_id)

      onUpdate()
    } catch (error) {
      alert('Failed to close recommendation')
    }
  }

  const handleSellSuccess = () => {
    setShowSellModal(false)
    // Reload trading activity and recommendation data
    onUpdate()
  }

  const handleBuyToCoverSuccess = () => {
    setShowBuyToCoverModal(false)
    // Reload trading activity and recommendation data
    onUpdate()
  }

  const handleUploadFiles = async () => {
    if (!user || !recommendation || selectedFiles.length === 0) return
    setUploading(true)

    try {
      // Get Supabase user ID
      const { data: mapping } = await supabase
        .from('clerk_user_mapping')
        .select('supabase_user_id')
        .eq('clerk_user_id', user.id)
        .maybeSingle()

      if (!mapping) {
        return
      }

      const imageUrls: string[] = [...(recommendation.images || [])]

      // Upload new files
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${mapping.supabase_user_id}/${recommendation.ticker}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        
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

      // Update recommendation with new image URLs
      await supabase
        .from('recommendations')
        .update({ images: imageUrls })
        .eq('id', recommendation.id)
        .eq('user_id', mapping.supabase_user_id)

      setSelectedFiles([])
      onUpdate()
    } catch (error) {
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F1EEE0]">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-mono font-bold text-[#1C1B17]">{recommendation.ticker}</h1>
              {recommendation.action && recommendation.action !== 'WATCH' && (
                <Badge
                  variant={recommendation.action === 'BUY' ? 'default' : 'destructive'}
                  className="font-mono text-sm px-3 py-1"
                >
                  {recommendation.action}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={recommendation.status === 'OPEN' ? 'default' : 'secondary'} className="font-mono">
                {recommendation.status}
              </Badge>
              <span className="font-mono text-sm text-[#6F6A60]">
                Added {new Date(recommendation.entry_date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
          {recommendation.status === 'OPEN' && (
            <Button
              variant="outline"
              onClick={handleClosePosition}
              className={cn(
                "font-mono text-sm",
                recommendation.action === 'SELL'
                  ? "border-[#2A6B4F] text-[#2A6B4F] hover:bg-[#2A6B4F] hover:text-[#F7F2E6]"
                  : "border-[#B23B2A] text-[#B23B2A] hover:bg-[#B23B2A] hover:text-[#F7F2E6]"
              )}
            >
              {recommendation.action === 'SELL' 
                ? (tradingActivity && tradingActivity.total_shares < 0 
                    ? `Buy to Cover (${Math.abs(tradingActivity.total_shares).toLocaleString()} shares)`
                    : 'Close Position')
                : (tradingActivity && tradingActivity.total_shares > 0 
                    ? `Sell Position (${tradingActivity.total_shares.toLocaleString()} shares)`
                    : 'Close Position')
              }
            </Button>
          )}
        </div>

        {/* Price and Return Card */}
        <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <Label className="font-mono text-xs text-[#6F6A60] uppercase tracking-wider">Current Price</Label>
                <div className="text-2xl font-mono font-bold text-[#1C1B17] tabular-nums mt-1">
                  {formatCurrency(recommendation.current_price, recommendation.ticker)}
                </div>
              </div>
              <div>
                <Label className="font-mono text-xs text-[#6F6A60] uppercase tracking-wider">Entry Price</Label>
                <div className="text-2xl font-mono font-bold text-[#1C1B17] tabular-nums mt-1">
                  {formatCurrency(recommendation.entry_price, recommendation.ticker)}
                </div>
              </div>
              <div>
                <Label className="font-mono text-xs text-[#6F6A60] uppercase tracking-wider">Gain/Loss</Label>
                <div className="flex items-center gap-2 mt-1">
                  {returnPct !== null ? (
                    <>
                      {isPositive ? (
                        <TrendingUp className="h-5 w-5 text-[#2F8F5B]" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-[#B23B2A]" />
                      )}
                      <div>
                        <div className={`text-xl font-mono font-bold tabular-nums ${
                          isPositive ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'
                        }`}>
                          {isPositive ? '+' : ''}{formatCurrency(gainLoss, recommendation.ticker)}
                        </div>
                        <div className={`text-sm font-mono tabular-nums ${
                          isPositive ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'
                        }`}>
                          {isPositive ? '+' : ''}{returnPct.toFixed(2)}%
                        </div>
                      </div>
                    </>
                  ) : (
                    <span className="font-mono text-[#6F6A60]">N/A</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trading Activity */}
        {tradingActivity && (tradingActivity.trades.length > 0 || tradingActivity.position) && (
          <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-mono font-bold text-[#1C1B17] flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Position Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#FBF7ED] border border-[#E3DDCF] p-3 rounded">
                  <Label className="font-mono text-xs text-[#6F6A60]">Shares Held</Label>
                  <p className="font-mono text-lg font-bold text-[#1C1B17] mt-1">
                    {tradingActivity.total_shares.toLocaleString()}
                  </p>
                </div>
                <div className="bg-[#FBF7ED] border border-[#E3DDCF] p-3 rounded">
                  <Label className="font-mono text-xs text-[#6F6A60]">Avg Cost</Label>
                  <p className="font-mono text-lg font-bold text-[#1C1B17] mt-1">
                    {tradingActivity.position?.avg_cost
                      ? formatCurrency(tradingActivity.position.avg_cost, recommendation.ticker)
                      : '-'}
                  </p>
                </div>
                <div className="bg-[#FBF7ED] border border-[#E3DDCF] p-3 rounded">
                  <Label className="font-mono text-xs text-[#6F6A60]">Unrealized P&L</Label>
                  <p className={`font-mono text-lg font-bold mt-1 ${tradingActivity.unrealized_pnl >= 0 ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'}`}>
                    {tradingActivity.unrealized_pnl >= 0 ? '+' : ''}
                    {formatCurrency(tradingActivity.unrealized_pnl, recommendation.ticker)}
                  </p>
                </div>
                <div className="bg-[#FBF7ED] border border-[#E3DDCF] p-3 rounded">
                  <Label className="font-mono text-xs text-[#6F6A60]">Realized P&L</Label>
                  <p className={`font-mono text-lg font-bold mt-1 ${tradingActivity.realized_pnl >= 0 ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'}`}>
                    {tradingActivity.realized_pnl >= 0 ? '+' : ''}
                    {formatCurrency(tradingActivity.realized_pnl, recommendation.ticker)}
                  </p>
                </div>
              </div>

              {/* Trade History */}
              {tradingActivity.trades.length > 0 && (
                <div className="space-y-2">
                  {tradingActivity.trades.slice(0, 5).map((trade) => (
                    <div
                      key={trade.id}
                      className="flex items-center justify-between py-2 border-b border-[#E3DDCF] last:border-b-0"
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
                        <span className="font-mono text-sm text-[#1C1B17]">
                          {trade.quantity.toLocaleString()} shares @ {formatCurrency(trade.price, recommendation.ticker)}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm font-semibold text-[#1C1B17] tabular-nums">
                          {formatCurrency(trade.notional, recommendation.ticker)}
                        </p>
                        <p className="font-mono text-xs text-[#6F6A60]">
                          {new Date(trade.executed_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </p>
                        {trade.realized_pnl !== null && trade.realized_pnl !== 0 && (
                          <p className={`font-mono text-xs ${trade.realized_pnl >= 0 ? 'text-[#2F8F5B]' : 'text-[#B23B2A]'}`}>
                            P&L: {trade.realized_pnl >= 0 ? '+' : ''}{formatCurrency(trade.realized_pnl, recommendation.ticker)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {loadingTradingActivity && (
                <div className="text-center py-4 text-[#6F6A60] font-mono text-sm">
                  Loading trading activity...
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Investment Thesis */}
        <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-mono font-bold text-[#1C1B17]">Investment Thesis</CardTitle>
            {!isEditingThesis ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingThesis(true)}
                className="font-mono text-xs bg-transparent border-[#D7D0C2] text-[#1C1B17] hover:bg-[#FBF7ED]"
              >
                <Edit2 className="h-3 w-3 mr-1" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditingThesis(false)
                    setEditedThesis(recommendation.thesis || '')
                  }}
                  className="font-mono text-xs bg-transparent border-[#D7D0C2] text-[#1C1B17] hover:bg-[#FBF7ED]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveThesis}
                  className="font-mono text-xs bg-[#1C1B17] text-[#F7F2E6] hover:bg-[#1C1B17]/90"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {isEditingThesis ? (
              <Textarea
                value={editedThesis}
                onChange={(e) => setEditedThesis(e.target.value)}
                placeholder="Enter your investment thesis..."
                rows={6}
                className="font-mono text-sm bg-[#FBF7ED] border-[#D7D0C2] text-[#1C1B17] placeholder:text-[#6F6A60]"
              />
            ) : (
              <p className="font-mono text-sm text-[#1C1B17] leading-relaxed whitespace-pre-wrap">
                {recommendation.thesis || 'No thesis added yet. Click Edit to add one.'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Price Target Timeline */}
        <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-mono font-bold text-[#1C1B17] flex items-center gap-2">
              <Target className="h-4 w-4" />
              Price Target Timeline
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddTargetModal(true)}
              className="font-mono text-xs bg-transparent border-[#D7D0C2] text-[#1C1B17] hover:bg-[#FBF7ED]"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Target
            </Button>
          </CardHeader>
          <CardContent>
            <PriceTargetTimeline ticker={recommendation.ticker} />
          </CardContent>
        </Card>

        {/* Documents & Images */}
        <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
          <CardHeader>
            <CardTitle className="font-mono font-bold text-[#1C1B17]">Documents & Images</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload Section */}
            <div className="border border-[#D7D0C2] border-dashed rounded-lg p-4">
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center justify-center py-4">
                  <Upload className="h-8 w-8 text-[#6F6A60] mb-2" />
                  <p className="font-mono text-sm text-[#1C1B17] mb-1">Click to upload documents or images</p>
                  <p className="font-mono text-xs text-[#6F6A60]">PNG, JPG, PDF up to 10MB</p>
                </div>
              </Label>
              <input
                id="file-upload"
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Selected Files Preview */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <Label className="font-mono text-xs text-[#6F6A60] uppercase">Selected Files</Label>
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-[#FBF7ED] border border-[#D7D0C2] rounded"
                  >
                    <span className="font-mono text-sm text-[#1C1B17]">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(index)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  onClick={handleUploadFiles}
                  disabled={uploading}
                  className="font-mono text-xs bg-[#1C1B17] text-[#F7F2E6] hover:bg-[#1C1B17]/90"
                  size="sm"
                >
                  {uploading ? 'Uploading...' : 'Upload Files'}
                </Button>
              </div>
            )}

            {/* Existing Images */}
            {recommendation.images && recommendation.images.length > 0 && (
              <div className="space-y-2">
                <Label className="font-mono text-xs text-[#6F6A60] uppercase">Uploaded Files</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {recommendation.images.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-32 object-cover rounded border border-[#D7D0C2]"
                        onError={(e) => {
                          // If image fails, show a placeholder
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            parent.innerHTML = `
                              <div class="w-full h-32 bg-[#FBF7ED] border border-[#D7D0C2] rounded flex items-center justify-center">
                                <span class="font-mono text-xs text-[#6F6A60]">Document</span>
                              </div>
                            `
                          }
                        }}
                      />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                      >
                        <span className="font-mono text-xs text-white">View</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showAddTargetModal && (
        <AddPriceTargetModal
          ticker={recommendation.ticker}
          onClose={() => setShowAddTargetModal(false)}
          onSubmit={async (targetPrice, targetDate) => {
            if (!user) return
            const { data: mapping } = await supabase
              .from('clerk_user_mapping')
              .select('supabase_user_id')
              .eq('clerk_user_id', user.id)
              .maybeSingle()
            if (mapping) {
              await createPriceTarget(recommendation.ticker, targetPrice, targetDate, mapping.supabase_user_id)
              onUpdate()
            }
            setShowAddTargetModal(false)
          }}
        />
      )}

      {/* Sell Modal for closing long position */}
      {showSellModal && tradingActivity && tradingActivity.total_shares > 0 && (
        <SellModal
          open={showSellModal}
          onClose={() => setShowSellModal(false)}
          onSuccess={handleSellSuccess}
          position={{
            id: recommendation.id,
            symbol: recommendation.ticker,
            quantity: tradingActivity.total_shares,
            avg_cost: tradingActivity.position?.avg_cost || recommendation.entry_price,
            current_price: recommendation.current_price || tradingActivity.position?.current_price || 0,
            market_value: tradingActivity.total_shares * (recommendation.current_price || tradingActivity.position?.current_price || 0),
            unrealized_pnl: tradingActivity.unrealized_pnl,
            unrealized_pnl_pct: tradingActivity.position?.avg_cost && tradingActivity.position.avg_cost > 0
              ? ((recommendation.current_price || tradingActivity.position?.current_price || 0) - tradingActivity.position.avg_cost) / tradingActivity.position.avg_cost * 100
              : 0,
            realized_pnl: tradingActivity.realized_pnl,
            updated_at: new Date().toISOString()
          }}
          currency={recommendation.ticker.includes('.NS') || recommendation.ticker.includes('.BO') ? 'INR' : 'USD'}
        />
      )}

      {/* Buy to Cover Modal for closing short position */}
      {showBuyToCoverModal && tradingActivity && tradingActivity.total_shares < 0 && (
        <BuyToCoverModal
          open={showBuyToCoverModal}
          onClose={() => setShowBuyToCoverModal(false)}
          onSuccess={handleBuyToCoverSuccess}
          position={{
            id: recommendation.id,
            symbol: recommendation.ticker,
            quantity: tradingActivity.total_shares, // Negative for shorts
            avg_cost: tradingActivity.position?.avg_cost || recommendation.entry_price,
            current_price: recommendation.current_price || tradingActivity.position?.current_price || 0,
            market_value: Math.abs(tradingActivity.total_shares) * (recommendation.current_price || tradingActivity.position?.current_price || 0),
            // For shorts: P&L = (sell price - buy price) = (avg_cost - current_price)
            unrealized_pnl: tradingActivity.position?.avg_cost 
              ? (tradingActivity.position.avg_cost - (recommendation.current_price || 0)) * Math.abs(tradingActivity.total_shares)
              : 0,
            unrealized_pnl_pct: tradingActivity.position?.avg_cost && recommendation.current_price
              ? ((tradingActivity.position.avg_cost - recommendation.current_price) / tradingActivity.position.avg_cost) * 100
              : 0
          }}
          currency={recommendation.ticker.includes('.NS') || recommendation.ticker.includes('.BO') ? 'INR' : 'USD'}
        />
      )}
    </div>
  )
}

