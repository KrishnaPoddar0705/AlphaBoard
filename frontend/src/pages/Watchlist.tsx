"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card-new"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"
import { getPrice, createRecommendation, deleteWatchlistItem } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { useUser } from "@clerk/clerk-react"
import { AddToWatchlistModal } from "@/components/recommendations/AddToWatchlistModal"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface WatchlistItem {
  id: string
  ticker: string
  current_price?: number
  entry_date: string
  thesis?: string | null
  images?: string[] | null
}

export default function Watchlist() {
  const navigate = useNavigate()
  const { user } = useUser()
  const [watchlist, setWatchlist] = React.useState<WatchlistItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showAddModal, setShowAddModal] = React.useState(false)
  const [showPromoteModal, setShowPromoteModal] = React.useState(false)
  const [selectedItem, setSelectedItem] = React.useState<WatchlistItem | null>(null)
  const [promoteAction, setPromoteAction] = React.useState<'BUY' | 'SELL'>('BUY')
  const [promoteEntryPrice, setPromoteEntryPrice] = React.useState('')

  React.useEffect(() => {
    if (user) {
      loadWatchlist()
    }
  }, [user])

  const loadWatchlist = async () => {
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

      // Fetch recommendations with WATCHLIST status
      const { data, error } = await supabase
        .from("recommendations")
        .select("*")
        .eq("user_id", mapping.supabase_user_id)
        .eq("status", "WATCHLIST")
        .order("entry_date", { ascending: false })

      if (!error && data) {
        // Fetch current prices
        const watchlistWithPrices = await Promise.all(
          data.map(async (rec) => {
            try {
              const priceData = await getPrice(rec.ticker)
              return { ...rec, current_price: priceData.price || rec.current_price }
            } catch {
              return rec
            }
          })
        )
        setWatchlist(watchlistWithPrices)
      }
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (item: WatchlistItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return

    try {
      const { data: mapping } = await supabase
        .from("clerk_user_mapping")
        .select("supabase_user_id")
        .eq("clerk_user_id", user.id)
        .maybeSingle()

      if (mapping) {
        await supabase
          .from("recommendations")
          .delete()
          .eq("id", item.id)
          .eq("user_id", mapping.supabase_user_id)
        loadWatchlist()
      }
    } catch (error) {
    }
  }

  const handlePromote = async () => {
    if (!user || !selectedItem || !promoteEntryPrice) return

    try {
      const { data: mapping } = await supabase
        .from("clerk_user_mapping")
        .select("supabase_user_id")
        .eq("clerk_user_id", user.id)
        .maybeSingle()

      if (!mapping) {
        alert("User mapping not found. Please ensure you are logged in.")
        return
      }

      const entryPriceNum = parseFloat(promoteEntryPrice)
      if (isNaN(entryPriceNum) || entryPriceNum <= 0) {
        alert("Please enter a valid entry price")
        return
      }

      // Get current price for the ticker
      let currentPrice = entryPriceNum
      try {
        const priceData = await getPrice(selectedItem.ticker)
        currentPrice = priceData.price || entryPriceNum
      } catch {
        // Use entry price as fallback
      }

      // Determine benchmark ticker based on ticker format
      const benchmarkTicker = selectedItem.ticker.includes('.NS') || selectedItem.ticker.includes('.INVO') 
        ? '^NSEI' 
        : '^GSPC'

      // Create new recommendation using the API
      const newRec: any = {
        ticker: selectedItem.ticker.trim().toUpperCase(),
        action: promoteAction,
        entry_price: entryPriceNum,
        current_price: currentPrice,
        thesis: selectedItem.thesis || null,
        benchmark_ticker: benchmarkTicker,
        status: 'OPEN',
        images: selectedItem.images || null,
      }

      // Create new recommendation first
      await createRecommendation(newRec, mapping.supabase_user_id)

      // Delete the watchlist item after successful promotion using backend API
      // This bypasses RLS since there's no DELETE policy in the database
      try {
        await deleteWatchlistItem(selectedItem.id, mapping.supabase_user_id)
      } catch (deleteError: any) {
        // Don't throw error - recommendation was created successfully
        // Just show a warning to the user
        alert(`Recommendation created successfully, but failed to remove from watchlist: ${deleteError.message || 'Unknown error'}`)
      }

      setShowPromoteModal(false)
      setSelectedItem(null)
      setPromoteEntryPrice('')
      loadWatchlist()
    } catch (error: any) {
      alert(error.message || "Failed to promote watchlist item")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#F1EEE0]">
        <div className="text-[#6F6A60] font-mono">Loading watchlist...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#F1EEE0]">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-[#D7D0C2] bg-[#F7F2E6]">
        <h1 className="text-2xl font-mono font-bold text-[#1C1B17] tracking-tight">Watchlist</h1>
        <Button
          onClick={() => setShowAddModal(true)}
          className="font-mono text-sm bg-[#1C1B17] text-[#F7F2E6] hover:bg-[#1C1B17]/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add to Watchlist
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {watchlist.length === 0 ? (
          <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
            <CardContent className="py-12 text-center">
              <p className="font-mono text-[#6F6A60] text-lg mb-2">Your watchlist is empty.</p>
              <p className="font-mono text-sm text-[#6F6A60]">Add stocks from the community page or use the button above!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {watchlist.map((item) => (
              <Card
                key={item.id}
                className="bg-[#F7F2E6] border-[#D7D0C2] hover:border-[#1C1B17] transition-all cursor-pointer"
                onClick={() => navigate(`/stock/${item.ticker}`)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-mono font-bold text-[#1C1B17]">{item.ticker}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleRemove(item, e)}
                      className="h-8 w-8 text-[#6F6A60] hover:text-[#B23B2A]"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="font-mono text-xs text-[#6F6A60] mt-1">
                    Added {new Date(item.entry_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-2xl font-mono font-bold text-[#1C1B17] tabular-nums">
                    ${item.current_price?.toFixed(2) || "N/A"}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedItem(item)
                      setPromoteEntryPrice(item.current_price?.toFixed(2) || '')
                      setShowPromoteModal(true)
                    }}
                    className="w-full font-mono text-xs border-[#D7D0C2] text-[#1C1B17] hover:bg-[#FBF7ED]"
                  >
                    Promote to BUY/SELL
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add to Watchlist Modal */}
      <AddToWatchlistModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          loadWatchlist()
          setShowAddModal(false)
        }}
      />

      {/* Promote Modal */}
      <Dialog open={showPromoteModal} onOpenChange={setShowPromoteModal}>
        <DialogContent className="bg-[#F7F2E6] border-[#D7D0C2] max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono text-xl font-bold text-[#1C1B17]">
              Promote to Recommendation
            </DialogTitle>
            <DialogDescription className="font-mono text-sm text-[#6F6A60]">
              Convert {selectedItem?.ticker} from watchlist to a BUY or SELL recommendation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="font-mono text-sm text-[#1C1B17]">Action</Label>
              <Select value={promoteAction} onValueChange={(value: 'BUY' | 'SELL') => setPromoteAction(value)}>
                <SelectTrigger className="bg-[#FBF7ED] border-[#D7D0C2] font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">BUY</SelectItem>
                  <SelectItem value="SELL">SELL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-sm text-[#1C1B17]">Entry Price *</Label>
              <Input
                type="number"
                step="0.01"
                value={promoteEntryPrice}
                onChange={(e) => setPromoteEntryPrice(e.target.value)}
                placeholder="0.00"
                className="bg-[#FBF7ED] border-[#D7D0C2] font-mono tabular-nums"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPromoteModal(false)
                  setSelectedItem(null)
                  setPromoteEntryPrice('')
                }}
                className="font-mono text-sm border-[#D7D0C2] text-[#1C1B17] hover:bg-[#FBF7ED]"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePromote}
                disabled={!promoteEntryPrice || parseFloat(promoteEntryPrice) <= 0}
                className="font-mono text-sm bg-[#1C1B17] text-[#F7F2E6] hover:bg-[#1C1B17]/90"
              >
                Promote
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

