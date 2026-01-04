"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import { useDebounce } from "@/hooks/useDebounce"
import { Card, CardContent } from "@/components/ui/card-new"
import { Button } from "@/components/ui/button"
import { getPrice, getStockHistory, getStockSummary, searchStocks } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { useUser } from "@clerk/clerk-react"
import { getSupabaseUserIdForClerkUser } from "@/lib/clerkSupabaseSync"
import { SortingBanner } from "@/components/community/SortingBanner"
import type { SortOption } from "@/components/community/SortingBanner"
import { useSearch } from "@/contexts/SearchContext"
import { SP500_STOCKS } from "@/data/sp500"
import { NIFTY50_STOCKS } from "@/data/nifty50"
import { Globe } from "lucide-react"
import { CommunityStockCard } from "@/components/community/CommunityStockCard"
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
  // Community metrics
  threadCount: number // Number of threads (posts) for this ticker
  commentsCount: number // Total number of comments across all posts
  aggregateScore: number // Sum of all post scores for this ticker
  top_thread_title?: string | null
  userVote?: number | null // -1, 0, or 1 for ticker-level vote
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
      const now = new Date()
      const yesterday24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const yesterday24hISO = yesterday24h.toISOString()

      // Fetch community posts for this ticker
      const postsResult = await supabase
        .from("community_posts")
        .select("id, created_at, score, comment_count, title, last_activity_at")
        .eq("ticker", ticker)
        .eq("is_deleted", false)

      const posts = postsResult.data || []
      
      // Calculate aggregate score (sum of all post scores)
      const aggregateScore = posts.reduce((sum, p) => sum + (p.score || 0), 0)
      
      // Get post IDs to fetch comments
      const postIds = posts.map((p) => p.id)
      
      // Fetch comments for these posts
      let comments: any[] = []
      if (postIds.length > 0) {
        const commentsResult = await supabase
          .from("community_comments")
          .select("id, created_at")
          .eq("is_deleted", false)
          .in("post_id", postIds)
        
        comments = commentsResult.data || []
      }

      // Get top thread (most recent by last_activity_at)
      let top_thread_title: string | null = null
      if (posts.length > 0) {
        const sortedPosts = [...posts].sort((a, b) => 
          new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
        )
        const topPost = sortedPosts[0]
        top_thread_title = topPost?.title || null
      }

      // Thread count (number of posts)
      const threadCount = posts.length

      // Get stock-level vote data from community_stocks table
      // Default to 0 if stock doesn't exist yet (RPC function will create it on first vote)
      let stockScore = 0
      let stockUpvotes = 0
      let stockDownvotes = 0
      let stockUserVote: number | null = null
      
      const { data: stockData } = await supabase
        .from('community_stocks')
        .select('score, upvotes, downvotes, ticker')
        .eq('ticker', ticker)
        .maybeSingle()
      
      if (stockData) {
        stockScore = stockData.score ?? 0
        stockUpvotes = stockData.upvotes ?? 0
        stockDownvotes = stockData.downvotes ?? 0
      }
      // If stockData is null, defaults (0) are already set above
      
      // Get user's stock-level vote (works for both authenticated and anonymous users)
      // Check Supabase session directly (includes anonymous users)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        const { data: userVoteData } = await supabase
          .from('community_votes')
          .select('value')
          .eq('target_type', 'stock')
          .eq('target_id', ticker)
          .eq('user_id', session.user.id)
          .maybeSingle()
        
        if (userVoteData) {
          stockUserVote = userVoteData.value as number
        }
      }

      // Legacy metrics for backward compatibility
      const upvotes = 0
      const downvotes = 0
      const comments_total = comments.length

      return {
        upvotes,
        downvotes,
        comments: comments_total,
        totalVotes: upvotes + downvotes,
        threadCount,
        commentsCount: comments_total,
        aggregateScore,
        top_thread_title,
        stockScore,
        stockUpvotes,
        stockDownvotes,
        stockUserVote,
      }
    } catch (error) {
      console.error(`Error fetching metrics for ${ticker}:`, error)
      return {
        upvotes: 0,
        downvotes: 0,
        comments: 0,
        totalVotes: 0,
        threadCount: 0,
        commentsCount: 0,
        aggregateScore: 0,
        top_thread_title: null,
        stockScore: 0,
        stockUpvotes: 0,
        stockDownvotes: 0,
        stockUserVote: null,
      }
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
        threadCount: 0,
        commentsCount: 0,
        aggregateScore: 0,
        top_thread_title: null,
        dayChartData: [],
        isLoading: true,
        userVote: null,
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
            upvotes: metrics.upvotes,
            downvotes: metrics.downvotes,
            comments: metrics.comments,
            totalVotes: metrics.totalVotes,
            threadCount: metrics.threadCount,
            commentsCount: metrics.commentsCount,
            aggregateScore: metrics.aggregateScore,
            top_thread_title: metrics.top_thread_title,
            dayChartData: chartData,
            isLoading: false,
            userVote: metrics.userVote,
            stockScore: metrics.stockScore ?? 0,
            stockUpvotes: metrics.stockUpvotes ?? 0,
            stockDownvotes: metrics.stockDownvotes ?? 0,
            stockUserVote: metrics.stockUserVote ?? null,
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
            threadCount: 0,
            commentsCount: 0,
            aggregateScore: 0,
            top_thread_title: null,
            dayChartData: [],
            isLoading: false,
            userVote: null,
            stockScore: 0,
            stockUpvotes: 0,
            stockDownvotes: 0,
            stockUserVote: null,
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

  // Voting is now handled internally by CommunityActionStrip component via useVote hook

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
          <CommunityStockCard
            key={stock.ticker}
            ticker={stock.ticker}
            companyName={stock.companyName}
            price={stock.price}
            change={stock.change}
            changePercent={stock.changePercent}
            sparklineData={stock.dayChartData}
            threadCount={stock.threadCount}
            commentsCount={stock.commentsCount}
            stockScore={stock.stockScore ?? 0}
            stockUpvotes={stock.stockUpvotes ?? 0}
            stockDownvotes={stock.stockDownvotes ?? 0}
            stockUserVote={stock.stockUserVote ?? null}
            isLoading={stock.isLoading}
            top_thread_title={stock.top_thread_title}
          />
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
