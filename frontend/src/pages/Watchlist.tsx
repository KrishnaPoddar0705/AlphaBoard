"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card-new"
import { Button } from "@/components/ui/button"
import { Plus, X, TrendingUp, TrendingDown, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { getPrice, createRecommendation, deleteWatchlistItem, getStockSummary, getStockHistory } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { useUser } from "@clerk/clerk-react"
import { AddToWatchlistModal } from "@/components/recommendations/AddToWatchlistModal"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getCurrencySymbol, formatCurrency } from "@/lib/utils"

interface WatchlistItem {
  id: string
  ticker: string
  current_price?: number
  entry_date: string
  thesis?: string | null
  images?: string[] | null
  companyName?: string
  marketCap?: number
  oneDayReturn?: number
  oneWeekReturn?: number
  oneMonthReturn?: number
}

type SortField = 'companyName' | 'current_price' | 'oneDayReturn' | 'oneWeekReturn' | 'oneMonthReturn' | 'marketCap' | 'entry_date'
type SortDirection = 'asc' | 'desc' | null

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
  const [sortField, setSortField] = React.useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = React.useState<SortDirection>(null)

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
        // Fetch current prices, company names, market cap, and returns
        const watchlistWithData = await Promise.all(
          data.map(async (rec) => {
            try {
              const [priceData, summaryData, historyData1d, historyData1m] = await Promise.all([
                getPrice(rec.ticker).catch(() => ({ price: rec.current_price })),
                getStockSummary(rec.ticker).catch(() => null),
                getStockHistory(rec.ticker, "7d", "1d").catch(() => null),
                getStockHistory(rec.ticker, "1mo", "1d").catch(() => null)
              ])

              const currentPrice = priceData.price || rec.current_price || 0

              // Calculate 1D return from yesterday's close vs current price
              let oneDayReturn: number | undefined = undefined
              if (historyData1d && Array.isArray(historyData1d) && historyData1d.length >= 2) {
                const yesterdayClose = historyData1d[historyData1d.length - 2]?.close
                if (yesterdayClose && currentPrice) {
                  oneDayReturn = ((currentPrice - yesterdayClose) / yesterdayClose) * 100
                }
              }

              // Calculate 1W return (7 days ago vs current)
              let oneWeekReturn: number | undefined = undefined
              if (historyData1m && Array.isArray(historyData1m) && historyData1m.length >= 7) {
                const weekAgoClose = historyData1m[historyData1m.length - 7]?.close
                if (weekAgoClose && currentPrice) {
                  oneWeekReturn = ((currentPrice - weekAgoClose) / weekAgoClose) * 100
                }
              }

              // Calculate 1M return (oldest available data point vs current)
              // Use the first element which should be approximately 1 month ago
              let oneMonthReturn: number | undefined = undefined
              if (historyData1m && Array.isArray(historyData1m) && historyData1m.length > 0) {
                // Get the oldest data point (first element) which should be ~1 month ago
                const monthAgoClose = historyData1m[0]?.close
                if (monthAgoClose && currentPrice && monthAgoClose > 0) {
                  oneMonthReturn = ((currentPrice - monthAgoClose) / monthAgoClose) * 100
                }
              }

              return {
                ...rec,
                current_price: currentPrice,
                companyName: summaryData?.companyName || rec.ticker,
                marketCap: summaryData?.marketCap,
                oneDayReturn,
                oneWeekReturn,
                oneMonthReturn
              }
            } catch {
              return {
                ...rec,
                current_price: rec.current_price || 0,
                companyName: rec.ticker
              }
            }
          })
        )
        setWatchlist(watchlistWithData)
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortField(null)
        setSortDirection(null)
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedWatchlist = React.useMemo(() => {
    if (!sortField || !sortDirection) return watchlist

    return [...watchlist].sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]

      // Handle undefined/null values
      if (aValue === undefined || aValue === null) return 1
      if (bValue === undefined || bValue === null) return -1

      // Handle date sorting
      if (sortField === 'entry_date') {
        aValue = new Date(aValue).getTime()
        bValue = new Date(bValue).getTime()
      }

      // Handle string sorting (company name)
      if (sortField === 'companyName') {
        const comparison = (aValue || '').localeCompare(bValue || '')
        return sortDirection === 'asc' ? comparison : -comparison
      }

      // Handle numeric sorting
      const comparison = Number(aValue) - Number(bValue)
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [watchlist, sortField, sortDirection])

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-3 h-3 text-[#6F6A60]" />
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="w-3 h-3 text-[#1C1B17]" />
    }
    return <ChevronDown className="w-3 h-3 text-[#1C1B17]" />
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
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {watchlist.length === 0 ? (
          <Card className="bg-[#F7F2E6] border-[#D7D0C2]">
            <CardContent className="py-12 text-center">
              <p className="font-mono text-[#6F6A60] text-lg mb-2">Your watchlist is empty.</p>
              <p className="font-mono text-sm text-[#6F6A60]">Add stocks from the community page or use the button above!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <table className="w-full border-collapse bg-[#F7F2E6] rounded-lg overflow-hidden">
                <thead>
                  <tr className="border-b-2 border-[#D7D0C2] bg-[#FBF7ED]">
                    <th
                      className="px-4 py-3 text-left text-xs font-mono font-semibold text-[#1C1B17] uppercase tracking-wider cursor-pointer hover:bg-[#F7F2E6] transition-colors select-none"
                      onClick={() => handleSort('companyName')}
                    >
                      <div className="flex items-center gap-1.5">
                        Company Name
                        {getSortIcon('companyName')}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-mono font-semibold text-[#1C1B17] uppercase tracking-wider cursor-pointer hover:bg-[#F7F2E6] transition-colors select-none"
                      onClick={() => handleSort('current_price')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        Current Price
                        {getSortIcon('current_price')}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-mono font-semibold text-[#1C1B17] uppercase tracking-wider cursor-pointer hover:bg-[#F7F2E6] transition-colors select-none"
                      onClick={() => handleSort('oneDayReturn')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        1D Return
                        {getSortIcon('oneDayReturn')}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-mono font-semibold text-[#1C1B17] uppercase tracking-wider cursor-pointer hover:bg-[#F7F2E6] transition-colors select-none"
                      onClick={() => handleSort('oneWeekReturn')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        1W Return
                        {getSortIcon('oneWeekReturn')}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-mono font-semibold text-[#1C1B17] uppercase tracking-wider cursor-pointer hover:bg-[#F7F2E6] transition-colors select-none"
                      onClick={() => handleSort('oneMonthReturn')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        1M Return
                        {getSortIcon('oneMonthReturn')}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-mono font-semibold text-[#1C1B17] uppercase tracking-wider cursor-pointer hover:bg-[#F7F2E6] transition-colors select-none"
                      onClick={() => handleSort('marketCap')}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        Market Cap
                        {getSortIcon('marketCap')}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-mono font-semibold text-[#1C1B17] uppercase tracking-wider cursor-pointer hover:bg-[#F7F2E6] transition-colors select-none"
                      onClick={() => handleSort('entry_date')}
                    >
                      <div className="flex items-center gap-1.5">
                        Date Added
                        {getSortIcon('entry_date')}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-mono font-semibold text-[#1C1B17] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D7D0C2]">
                  {sortedWatchlist.map((item) => {
                    const currencySymbol = getCurrencySymbol(item.ticker)
                    const isPositive1D = (item.oneDayReturn ?? 0) >= 0
                    const isPositive1W = (item.oneWeekReturn ?? 0) >= 0
                    const isPositive1M = (item.oneMonthReturn ?? 0) >= 0
                    const formatMarketCap = (cap?: number) => {
                      if (!cap) return 'N/A'
                      if (cap >= 1e12) return `${currencySymbol}${(cap / 1e12).toFixed(2)}T`
                      if (cap >= 1e9) return `${currencySymbol}${(cap / 1e9).toFixed(2)}B`
                      if (cap >= 1e6) return `${currencySymbol}${(cap / 1e6).toFixed(2)}M`
                      return `${currencySymbol}${cap.toFixed(2)}`
                    }

                    const renderReturn = (returnValue: number | undefined, isPositive: boolean) => {
                      if (returnValue === undefined) {
                        return <span className="text-[#6F6A60]">N/A</span>
                      }
                      return (
                        <div className={`flex items-center justify-end gap-1 ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                          {isPositive ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span className="font-semibold">
                            {isPositive ? '+' : ''}{returnValue.toFixed(2)}%
                          </span>
                        </div>
                      )
                    }

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-[#FBF7ED] transition-colors cursor-pointer"
                        onClick={() => navigate(`/stock/${item.ticker}`)}
                      >
                        <td className="px-4 py-3 text-sm font-mono text-[#1C1B17]">
                          <div className="font-semibold">{item.companyName || item.ticker}</div>
                          <div className="text-xs text-[#6F6A60] mt-0.5">{item.ticker}</div>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-right text-[#1C1B17] tabular-nums font-semibold">
                          {formatCurrency(item.current_price, item.ticker)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-right tabular-nums">
                          {renderReturn(item.oneDayReturn, isPositive1D)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-right tabular-nums">
                          {renderReturn(item.oneWeekReturn, isPositive1W)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-right tabular-nums">
                          {renderReturn(item.oneMonthReturn, isPositive1M)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-right text-[#1C1B17] tabular-nums">
                          {formatMarketCap(item.marketCap)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-[#6F6A60]">
                          {new Date(item.entry_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedItem(item)
                                setPromoteEntryPrice(item.current_price?.toFixed(2) || '')
                                setShowPromoteModal(true)
                              }}
                              className="font-mono text-xs border-[#D7D0C2] text-[#1C1B17] hover:bg-[#FBF7ED] h-7 px-2"
                            >
                              Promote
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleRemove(item, e)}
                              className="h-7 w-7 text-[#6F6A60] hover:text-[#B23B2A]"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {sortedWatchlist.map((item) => {
                const currencySymbol = getCurrencySymbol(item.ticker)
                const isPositive1D = (item.oneDayReturn ?? 0) >= 0
                const isPositive1W = (item.oneWeekReturn ?? 0) >= 0
                const isPositive1M = (item.oneMonthReturn ?? 0) >= 0
                const formatMarketCap = (cap?: number) => {
                  if (!cap) return 'N/A'
                  if (cap >= 1e12) return `${currencySymbol}${(cap / 1e12).toFixed(2)}T`
                  if (cap >= 1e9) return `${currencySymbol}${(cap / 1e9).toFixed(2)}B`
                  if (cap >= 1e6) return `${currencySymbol}${(cap / 1e6).toFixed(2)}M`
                  return `${currencySymbol}${cap.toFixed(2)}`
                }

                const renderReturnMobile = (returnValue: number | undefined, isPositive: boolean) => {
                  if (returnValue === undefined) {
                    return <div className="font-mono text-[#6F6A60]">N/A</div>
                  }
                  return (
                    <div className={`font-mono font-semibold tabular-nums flex items-center gap-1 ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
                      {isPositive ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span>{isPositive ? '+' : ''}{returnValue.toFixed(2)}%</span>
                    </div>
                  )
                }

                return (
                  <Card
                    key={item.id}
                    className="bg-[#F7F2E6] border-[#D7D0C2]"
                    onClick={() => navigate(`/stock/${item.ticker}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-mono font-bold text-[#1C1B17] text-base">
                            {item.companyName || item.ticker}
                          </div>
                          <div className="font-mono text-xs text-[#6F6A60] mt-0.5">{item.ticker}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleRemove(item, e)}
                          className="h-8 w-8 text-[#6F6A60] hover:text-[#B23B2A] flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <div className="font-mono text-xs text-[#6F6A60] mb-1">Current Price</div>
                          <div className="font-mono font-bold text-[#1C1B17] tabular-nums">
                            {formatCurrency(item.current_price, item.ticker)}
                          </div>
                        </div>
                        <div>
                          <div className="font-mono text-xs text-[#6F6A60] mb-1">1D Return</div>
                          {renderReturnMobile(item.oneDayReturn, isPositive1D)}
                        </div>
                        <div>
                          <div className="font-mono text-xs text-[#6F6A60] mb-1">1W Return</div>
                          {renderReturnMobile(item.oneWeekReturn, isPositive1W)}
                        </div>
                        <div>
                          <div className="font-mono text-xs text-[#6F6A60] mb-1">1M Return</div>
                          {renderReturnMobile(item.oneMonthReturn, isPositive1M)}
                        </div>
                        <div>
                          <div className="font-mono text-xs text-[#6F6A60] mb-1">Market Cap</div>
                          <div className="font-mono text-[#1C1B17] tabular-nums">
                            {formatMarketCap(item.marketCap)}
                          </div>
                        </div>
                        <div>
                          <div className="font-mono text-xs text-[#6F6A60] mb-1">Date Added</div>
                          <div className="font-mono text-[#1C1B17] text-xs">
                            {new Date(item.entry_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                        </div>
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
                )
              })}
            </div>
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

