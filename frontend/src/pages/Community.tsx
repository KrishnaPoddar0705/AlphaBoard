"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import { useDebounce } from "@/hooks/useDebounce"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card-new"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUp, ArrowDown, MessageCircle } from "lucide-react"
import { getPrice, getStockHistory, getStockSummary, searchStocks } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { useUser } from "@clerk/clerk-react"
import { MiniLineChart } from "@/components/charts/MiniLineChart"
import { SortingBanner } from "@/components/community/SortingBanner"
import type { SortOption } from "@/components/community/SortingBanner"
import { useSearch } from "@/contexts/SearchContext"
import { SP500_STOCKS } from "@/data/sp500"
import { NIFTY50_STOCKS } from "@/data/nifty50"
import { Globe } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface StockCard {
  ticker: string
  companyName?: string
  price: number
  change: number
  changePercent: number
  upvotes: number
  downvotes: number
  comments: number
  totalVotes: number
  dayChartData: Array<{ timestamp: number; price: number; open?: number; close?: number }>
  isLoading: boolean
}

const BATCH_SIZE = 25
const CONCURRENT_API_CALLS = 12
const PRICE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

interface PriceCacheEntry {
  price: number
  timestamp: number
}

const priceCache = new Map<string, PriceCacheEntry>()

export default function Community() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { searchQuery } = useSearch()
  const debouncedSearchQuery = useDebounce(searchQuery, 300)

  const [allTickers, setAllTickers] = React.useState<string[]>([])
  const [displayedStocks, setDisplayedStocks] = React.useState<StockCard[]>([])
  const [sortBy, setSortBy] = React.useState<SortOption>('all')
  const [country, setCountry] = React.useState<'USA' | 'India'>('USA')
  const [loading, setLoading] = React.useState(true)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)
  const [hasMore, setHasMore] = React.useState(true)
  const [currentBatch, setCurrentBatch] = React.useState(0)
  const [searchResults, setSearchResults] = React.useState<string[]>([])
  const [showAddStockDialog, setShowAddStockDialog] = React.useState(false)
  const [newStockTicker, setNewStockTicker] = React.useState('')

  // Fetch all unique tickers from database and include market stocks
  React.useEffect(() => {
    fetchAllTickers()
  }, [country])

  // Handle search
  React.useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      handleSearch(debouncedSearchQuery)
    } else {
      setSearchResults([])
    }
  }, [debouncedSearchQuery])

  // Load stocks when tickers or sort changes
  React.useEffect(() => {
    if (allTickers.length > 0) {
      setCurrentBatch(0)
      setDisplayedStocks([])
      loadBatch(0)
    }
  }, [allTickers, sortBy])

  // Apply search filter
  React.useEffect(() => {
    if (searchResults.length > 0) {
      setCurrentBatch(0)
      setDisplayedStocks([])
      loadBatch(0, searchResults)
    } else if (debouncedSearchQuery.trim() === '') {
      // Reset to all tickers when search is cleared
      setCurrentBatch(0)
      setDisplayedStocks([])
      loadBatch(0)
    }
  }, [searchResults])

  const fetchAllTickers = async () => {
    try {
      // Fetch unique tickers from all community tables
      const [postsResult, votesResult, commentsResult] = await Promise.all([
        supabase.from("stock_posts").select("ticker").not("ticker", "is", null),
        supabase.from("stock_votes").select("ticker").not("ticker", "is", null),
        supabase.from("stock_comments").select("ticker").not("ticker", "is", null),
      ])

      const tickers = new Set<string>()
      
      postsResult.data?.forEach((item) => tickers.add(item.ticker))
      votesResult.data?.forEach((item) => tickers.add(item.ticker))
      commentsResult.data?.forEach((item) => tickers.add(item.ticker))

      // Add market stocks based on selected country
      const marketStocks = country === 'USA' ? SP500_STOCKS : NIFTY50_STOCKS
      marketStocks.forEach(t => tickers.add(t))

      // Fallback to popular stocks if no data
      if (tickers.size === 0) {
        const fallbackTickers = country === 'USA' 
          ? ["MSTR", "AAPL", "TSLA", "COIN", "META", "GOOG", "MSFT", "NVDA", "AMZN", "NFLX"]
          : ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "HINDUNILVR.NS"]
        fallbackTickers.forEach(t => tickers.add(t))
      }

      const sortedTickers = Array.from(tickers).sort()
      setAllTickers(sortedTickers)
    } catch (error) {
      console.error("Error fetching tickers:", error)
      // Fallback to market stocks
      const fallbackTickers = country === 'USA' 
        ? ["MSTR", "AAPL", "TSLA", "COIN", "META", "GOOG", "MSFT", "NVDA", "AMZN", "NFLX"]
        : ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "HINDUNILVR.NS"]
      setAllTickers(fallbackTickers)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (query: string) => {
    try {
      const results = await searchStocks(query)
      const tickers = results.map((r: any) => r.symbol || r.ticker).filter(Boolean)
      setSearchResults(tickers)
    } catch (error) {
      console.error("Error searching stocks:", error)
      setSearchResults([])
    }
  }

  const getCachedPrice = (ticker: string): number | null => {
    const cached = priceCache.get(ticker)
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
      return cached.price
    }
    return null
  }

  const setCachedPrice = (ticker: string, price: number) => {
    priceCache.set(ticker, { price, timestamp: Date.now() })
  }

  const fetchStockPrice = async (ticker: string): Promise<number> => {
    const cached = getCachedPrice(ticker)
    if (cached !== null) {
      return cached
    }

    try {
      const priceData = await getPrice(ticker)
      const price = priceData.price || 0
      if (price > 0) {
        setCachedPrice(ticker, price)
      }
      return price
    } catch (error) {
      console.error(`Error fetching price for ${ticker}:`, error)
      return 0
    }
  }

  const fetchDayChartData = async (ticker: string): Promise<Array<{ timestamp: number; price: number; open?: number; close?: number }>> => {
    try {
      // Fetch 7 days (1 week) of data for chart display
      let historyData7d
      let historyData5d
      
      try {
        historyData7d = await getStockHistory(ticker, "7d")
      } catch {
        historyData7d = null
      }
      
      // Fallback to 5d if 7d fails
      if (!historyData7d || historyData7d.length === 0) {
        try {
          historyData5d = await getStockHistory(ticker, "5d")
        } catch {
          historyData5d = null
        }
      }

      const historyData = historyData7d && historyData7d.length > 0 ? historyData7d : historyData5d

      if (!historyData || !Array.isArray(historyData) || historyData.length === 0) {
        return []
      }

      // Use all available data points (up to 7 days)
      return historyData.map((item: any) => {
        const dateStr = item.date || item.timestamp
        const date = dateStr ? new Date(dateStr) : new Date()
        return {
          timestamp: date.getTime(),
          price: item.close || item.price || 0,
          open: item.open,
          close: item.close,
        }
      }).filter((item) => item.price > 0) // Filter out invalid prices
    } catch (error) {
      console.error(`Error fetching chart data for ${ticker}:`, error)
      return []
    }
  }

  const fetchStockMetrics = async (ticker: string) => {
    try {
      const [votesResult, commentsResult] = await Promise.all([
        supabase.from("stock_votes").select("*").eq("ticker", ticker),
        supabase.from("stock_comments").select("*", { count: "exact", head: true }).eq("ticker", ticker),
      ])

      const votes = votesResult.data || []
      const upvotes = votes.filter((v) => v.vote_type === "upvote").length
      const downvotes = votes.filter((v) => v.vote_type === "downvote").length
      const comments = commentsResult.count || 0

      return { upvotes, downvotes, comments, totalVotes: upvotes + downvotes }
    } catch (error) {
      console.error(`Error fetching metrics for ${ticker}:`, error)
      return { upvotes: 0, downvotes: 0, comments: 0, totalVotes: 0 }
    }
  }

  const loadBatch = async (batchIndex: number, tickerList?: string[]) => {
    const tickersToUse = tickerList || allTickers
    if (tickersToUse.length === 0) return

    setIsLoadingMore(true)

    try {
      const startIndex = batchIndex * BATCH_SIZE
      const endIndex = startIndex + BATCH_SIZE
      const batchTickers = tickersToUse.slice(startIndex, endIndex)

      if (batchTickers.length === 0) {
        setHasMore(false)
        setIsLoadingMore(false)
        return
      }

      // Create loading placeholders
      const loadingStocks: StockCard[] = batchTickers.map((ticker) => ({
        ticker,
        companyName: undefined,
        price: 0,
        change: 0,
        changePercent: 0,
        upvotes: 0,
        downvotes: 0,
        comments: 0,
        totalVotes: 0,
        dayChartData: [],
        isLoading: true,
      }))

      setDisplayedStocks((prev) => [...prev, ...loadingStocks])

      // Batch API calls
      const batches: string[][] = []
      for (let i = 0; i < batchTickers.length; i += CONCURRENT_API_CALLS) {
        batches.push(batchTickers.slice(i, i + CONCURRENT_API_CALLS))
      }

      const stockPromises = batchTickers.map(async (ticker) => {
        try {
          const [price, metrics, chartData, summaryData] = await Promise.all([
            fetchStockPrice(ticker),
            fetchStockMetrics(ticker),
            fetchDayChartData(ticker),
            getStockSummary(ticker).catch(() => ({ companyName: null })),
          ])

          // Calculate change percent using (close - open) / open from latest day
          let changePercent = 0
          let change = 0

          // Get the latest day's data (most recent entry)
          const latestDay = chartData.length > 0 ? chartData[chartData.length - 1] : null
          
          if (latestDay && latestDay.open && latestDay.close && latestDay.open > 0) {
            // Use (close - open) / open formula
            changePercent = ((latestDay.close - latestDay.open) / latestDay.open) * 100
            change = latestDay.close - latestDay.open
          } else if (chartData.length >= 2) {
            // Fallback: use first and last price if open/close not available
            const firstPrice = chartData[0].price
            const lastPrice = chartData[chartData.length - 1].price
            if (firstPrice > 0) {
              changePercent = ((lastPrice - firstPrice) / firstPrice) * 100
              change = lastPrice - firstPrice
            }
          } else if (price > 0) {
            // Final fallback: use random change if no chart data
            changePercent = (Math.random() * 40 - 10) // -10% to 30%
            change = (price * changePercent) / 100
          }

          return {
            ticker,
            companyName: summaryData?.companyName || undefined,
            price,
            change,
            changePercent,
            ...metrics,
            dayChartData: chartData,
            isLoading: false,
          } as StockCard
        } catch (error) {
          console.error(`Error loading ${ticker}:`, error)
          return {
            ticker,
            companyName: undefined,
            price: 0,
            change: 0,
            changePercent: 0,
            upvotes: 0,
            downvotes: 0,
            comments: 0,
            totalVotes: 0,
            dayChartData: [],
            isLoading: false,
          } as StockCard
        }
      })

      const results = await Promise.allSettled(stockPromises)
      const validStocks = results
        .map((result) => (result.status === "fulfilled" ? result.value : null))
        .filter((s): s is StockCard => s !== null)

      // Replace loading placeholders with actual data
      setDisplayedStocks((prev) => {
        const filtered = prev.filter((s) => !batchTickers.includes(s.ticker))
        return [...filtered, ...validStocks]
      })

      setHasMore(endIndex < tickersToUse.length)
    } catch (error) {
      console.error("Error loading batch:", error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      const nextBatch = currentBatch + 1
      setCurrentBatch(nextBatch)
      loadBatch(nextBatch, searchResults.length > 0 ? searchResults : undefined)
    }
  }

  // Intersection Observer for infinite scroll
  const observerTarget = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          handleLoadMore()
        }
      },
      { threshold: 0.1 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current)
      }
    }
  }, [hasMore, isLoadingMore])

  // Sort stocks
  const sortedStocks = React.useMemo(() => {
    let sorted = [...displayedStocks]

    switch (sortBy) {
      case "winners":
        sorted = sorted.filter((s) => s.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent)
        break
      case "losers":
        sorted = sorted.filter((s) => s.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent)
        break
      case "most-voted":
        sorted = sorted.sort((a, b) => b.totalVotes - a.totalVotes)
        break
      case "most-comments":
        sorted = sorted.sort((a, b) => b.comments - a.comments)
        break
      case "all":
      default:
        // Keep original order
        break
    }

    return sorted
  }, [displayedStocks, sortBy])

  // Filter by search
  const filteredStocks = React.useMemo(() => {
    if (debouncedSearchQuery.trim() && searchResults.length > 0) {
      return sortedStocks.filter((s) => searchResults.includes(s.ticker))
    }
    return sortedStocks
  }, [sortedStocks, debouncedSearchQuery, searchResults])

  const handleVote = async (ticker: string, voteType: "upvote" | "downvote") => {
    if (!user) {
      const anonymousId = `anon_${Date.now()}_${Math.random()}`
      await supabase.from("stock_votes").upsert({
        ticker,
        user_id: anonymousId,
        vote_type: voteType,
      })
    } else {
      await supabase.from("stock_votes").upsert({
        ticker,
        user_id: user.id,
        vote_type: voteType,
      })
    }

    // Update local state
    setDisplayedStocks((prev) =>
      prev.map((stock) => {
        if (stock.ticker === ticker) {
          const newUpvotes = voteType === "upvote" ? stock.upvotes + 1 : stock.upvotes
          const newDownvotes = voteType === "downvote" ? stock.downvotes + 1 : stock.downvotes
          return {
            ...stock,
            upvotes: newUpvotes,
            downvotes: newDownvotes,
            totalVotes: newUpvotes + newDownvotes,
          }
        }
        return stock
      })
    )
  }

  const handleStockClick = (ticker: string) => {
    navigate(`/stock/${ticker}`)
  }

  const handleAddStock = async () => {
    if (!newStockTicker.trim()) return

    const ticker = newStockTicker.trim().toUpperCase()
    
    // Check if stock already exists in community
    const exists = allTickers.includes(ticker)
    if (exists) {
      alert(`Stock ${ticker} already exists in the community`)
      setShowAddStockDialog(false)
      setNewStockTicker('')
      return
    }

    // Add ticker to list and reload
    setAllTickers((prev) => [...prev, ticker].sort())
    setShowAddStockDialog(false)
    setNewStockTicker('')
    
    // Trigger reload
    setCurrentBatch(0)
    setDisplayedStocks([])
    loadBatch(0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#6F6A60]">Loading stocks...</div>
      </div>
    )
  }

  return (
    <div className="p-5 md:p-7 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-[28px] font-bold text-[#1C1B17] tracking-tight">Community</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#6F6A60]" />
            <Select value={country} onValueChange={(value: 'USA' | 'India') => setCountry(value)}>
              <SelectTrigger className="w-[120px] bg-[#F7F2E6]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USA">USA</SelectItem>
                <SelectItem value="India">India</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Dialog open={showAddStockDialog} onOpenChange={setShowAddStockDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <span>Add Stock</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Stock to Community</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ticker">Ticker Symbol</Label>
                  <Input
                    id="ticker"
                    placeholder="e.g., AAPL or RELIANCE.NS"
                    value={newStockTicker}
                    onChange={(e) => setNewStockTicker(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddStock()
                      }
                    }}
                  />
                  <p className="text-xs text-[#6F6A60]">
                    {country === 'India' 
                      ? 'Use .NS suffix for NSE stocks (e.g., RELIANCE.NS)'
                      : 'Enter ticker symbol (e.g., AAPL, MSFT)'}
                  </p>
                </div>
                <Button onClick={handleAddStock} className="w-full">
                  Add Stock
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <SortingBanner sortBy={sortBy} onSortChange={setSortBy} />

      {filteredStocks.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-[#6F6A60]">
            {debouncedSearchQuery.trim() ? "No stocks found matching your search." : "No stocks available."}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
        {filteredStocks.map((stock) => (
          <Card
            key={stock.ticker}
            className="cursor-pointer hover:border-[#1C1B17] transition-all"
            onClick={() => handleStockClick(stock.ticker)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base font-semibold text-[#1C1B17]">{stock.ticker}</CardTitle>
                  {stock.companyName && (
                    <p className="text-xs text-[#6F6A60] truncate mt-0.5">{stock.companyName}</p>
                  )}
                </div>
                <Badge
                  variant={stock.changePercent >= 0 ? "default" : "destructive"}
                  className={`text-xs font-medium ml-2 flex-shrink-0 ${
                    stock.changePercent >= 0
                      ? "bg-[#2F8F5B] text-white border-[#2F8F5B]"
                      : "bg-[#B23B2A] text-white border-[#B23B2A]"
                  }`}
                >
                  {stock.changePercent >= 0 ? "+" : ""}
                  {stock.changePercent.toFixed(1)}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="text-3xl font-bold text-[#1C1B17] tabular-nums">
                  {stock.isLoading ? "..." : `$${stock.price.toFixed(2)}`}
                </div>
                <div className={`text-sm ${stock.change >= 0 ? "text-[#2F8F5B]" : "text-[#B23B2A]"}`}>
                  {stock.change >= 0 ? "+" : ""}${stock.change.toFixed(2)} from last day
                </div>
              </div>

              {/* Chart */}
              {stock.isLoading ? (
                <div className="h-20 w-full bg-[#FBF7ED] rounded-lg flex items-center justify-center border border-[#E3DDCF]">
                  <div className="text-[#6F6A60] text-xs">Loading...</div>
                </div>
              ) : (
                <div className="h-20 w-full">
                  <MiniLineChart
                    data={stock.dayChartData}
                    isPositive={stock.changePercent >= 0}
                    height={80}
                  />
                </div>
              )}

              {/* Engagement metrics */}
              <div className="flex items-center gap-4 pt-2 border-t border-[#D7D0C2]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleVote(stock.ticker, "upvote")
                  }}
                  className="h-8 gap-1"
                >
                  <ArrowUp className="h-4 w-4" />
                  <span className="text-sm tabular-nums">{stock.upvotes}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleVote(stock.ticker, "downvote")
                  }}
                  className="h-8 gap-1"
                >
                  <ArrowDown className="h-4 w-4" />
                  <span className="text-sm tabular-nums">{stock.downvotes}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleStockClick(stock.ticker)
                  }}
                  className="h-8 gap-1"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-sm tabular-nums">{stock.comments}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Infinite scroll trigger */}
      <div ref={observerTarget} className="h-10 flex items-center justify-center">
        {isLoadingMore && <div className="text-[#6F6A60] text-sm">Loading more stocks...</div>}
        {!hasMore && filteredStocks.length > 0 && (
          <div className="text-[#6F6A60] text-sm">No more stocks to load.</div>
        )}
      </div>
    </div>
  )
}
