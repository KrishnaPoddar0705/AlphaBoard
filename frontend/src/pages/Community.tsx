"use client"

import * as React from "react"
import { useDebounce } from "@/hooks/useDebounce"
import { Card, CardContent } from "@/components/ui/card-new"
import { Button } from "@/components/ui/button"
import { searchStocks, getStockSummary, getStockHistory } from "@/lib/api"
import { useUser } from "@clerk/clerk-react"
import { SortingBanner } from "@/components/community/SortingBanner"
import type { SortOption } from "@/components/community/SortingBanner"
import { useSearch } from "@/contexts/SearchContext"
import { Globe, RefreshCw } from "lucide-react"
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
import { useCommunityFeed } from "@/hooks/useCommunityFeed"
import { supabase } from "@/lib/supabase"
import { useQueryClient } from "@tanstack/react-query"

// Map UI sort options to feed sort options
function mapSortOption(sortBy: SortOption): 'mostVoted' | 'mostComments' | 'recent' {
  switch (sortBy) {
    case 'most-voted':
      return 'mostVoted'
    case 'most-comments':
      return 'mostComments'
    case 'winners':
    case 'losers':
      return 'recent' // For winners/losers, we'll filter client-side
    default:
      return 'mostVoted'
  }
}

export default function Community() {
  const { user } = useUser()
  const { searchQuery } = useSearch()
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const queryClient = useQueryClient()

  const [sortBy, setSortBy] = React.useState<SortOption>('all')
  // Initialize country from localStorage or default to 'USA'
  const [country, setCountry] = React.useState<'USA' | 'India'>(() => {
    const saved = localStorage.getItem('community-market-selection')
    return (saved === 'USA' || saved === 'India') ? saved : 'USA'
  })
  const [searchResults, setSearchResults] = React.useState<string[]>([])
  const [showAddStockDialog, setShowAddStockDialog] = React.useState(false)
  const [newStockTicker, setNewStockTicker] = React.useState('')
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [bookmarkedTickers, setBookmarkedTickers] = React.useState<Set<string>>(new Set())

  // Save country selection to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('community-market-selection', country)
  }, [country])

  // Map sort option to feed sort
  const feedSort = mapSortOption(sortBy)

  // Fetch feed using the hook
  const {
    items: feedItems,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch: refetchFeed,
  } = useCommunityFeed({
    region: country,
    sort: feedSort,
    limit: 1000, // Load all stocks at once
    enabled: true,
  })

  // Load user bookmarks
  const loadUserBookmarks = React.useCallback(async () => {
    if (!user) {
      setBookmarkedTickers(new Set())
      return
    }

    try {
      const { data, error } = await supabase.rpc('get_user_bookmarked_tickers', {
        p_region: country,
      })

      if (error) {
        return
      }

      if (data) {
        const tickerSet = new Set<string>(data.map((item: { ticker: string }) => item.ticker))
        setBookmarkedTickers(tickerSet)
      }
    } catch (error) {
    }
  }, [user, country])

  // Load bookmarks when user or country changes
  React.useEffect(() => {
    loadUserBookmarks()
  }, [loadUserBookmarks])

  // Market data state - lazy-loaded on scroll
  const [marketDataMap, setMarketDataMap] = React.useState<Record<string, {
    price: number | null
    change: number | null
    change_percent: number | null
    currency: string | null
    spark_ts: number[] | null
    spark_close: number[] | null
  }>>({})
  const [loadingMarketData, setLoadingMarketData] = React.useState<Set<string>>(new Set())

  // Lazy-load market data for visible items
  const loadMarketDataForTickers = React.useCallback(async (tickers: string[]) => {
    const tickersToLoad = tickers.filter(t => t && !marketDataMap[t] && !loadingMarketData.has(t))
    if (tickersToLoad.length === 0) {
      return
    }

    setLoadingMarketData(prev => new Set([...prev, ...tickersToLoad]))

    try {
      const { getMarketDataForTickers } = await import('@/lib/api/marketData')
      const data = await getMarketDataForTickers(tickersToLoad, country)

      // For searched stocks that don't have sparkline data, fetch history from backend API
      const tickersNeedingHistory = tickersToLoad.filter(ticker => {
        const item = data[ticker]
        return !item?.spark_ts || !item?.spark_close || item.spark_close.length === 0
      })

      // Fetch history data for stocks that need it (searched stocks)
      const historyPromises = tickersNeedingHistory.map(async (ticker) => {
        try {
          const historyData = await getStockHistory(ticker, '1w', '1d')
          if (historyData && Array.isArray(historyData) && historyData.length > 0) {
            // Sort by timestamp/date to ensure chronological order
            const sortedData = [...historyData].sort((a: any, b: any) => {
              const tsA = a.timestamp || (a.date ? new Date(a.date).getTime() : 0)
              const tsB = b.timestamp || (b.date ? new Date(b.date).getTime() : 0)
              return tsA - tsB
            })

            // Convert history data to sparkline format
            const spark_ts: number[] = []
            const spark_close: number[] = []

            sortedData.forEach((item: any) => {
              if (item.timestamp) {
                // Backend returns timestamp in milliseconds, convert to seconds for sparkline
                spark_ts.push(Math.floor(item.timestamp / 1000))
              } else if (item.date) {
                // Fallback: parse date string to timestamp (seconds)
                const date = new Date(item.date)
                spark_ts.push(Math.floor(date.getTime() / 1000))
              }

              if (item.close !== null && item.close !== undefined) {
                spark_close.push(Number(item.close))
              }
            })

            // Extract quote from latest data point
            const latest = sortedData[sortedData.length - 1]
            const previous = sortedData.length > 1 ? sortedData[sortedData.length - 2] : null

            let price: number | null = null
            let change: number | null = null
            let change_percent: number | null = null

            if (latest && latest.close !== null && latest.close !== undefined) {
              price = Number(latest.close)

              // Calculate change from previous day if available
              if (previous && previous.close !== null && previous.close !== undefined) {
                const prevPrice = Number(previous.close)
                change = price - prevPrice
                change_percent = prevPrice !== 0 ? (change / prevPrice) * 100 : 0
              }
            }

            // Update data with history-based quote and sparkline
            if (spark_ts.length > 0 && spark_close.length > 0) {
              data[ticker] = {
                ...(data[ticker] || {}),
                price: data[ticker]?.price ?? price,
                change: data[ticker]?.change ?? change,
                change_percent: data[ticker]?.change_percent ?? change_percent,
                spark_ts,
                spark_close,
              }
            } else if (price !== null) {
              // Update quote even if sparkline is empty
              data[ticker] = {
                ...(data[ticker] || {}),
                price: data[ticker]?.price ?? price,
                change: data[ticker]?.change ?? change,
                change_percent: data[ticker]?.change_percent ?? change_percent,
              }
            }
          }
        } catch (error) {
          // Silently fail for history fetch - sparkline will just be empty
        }
        return null
      })

      await Promise.all(historyPromises)

      // Always update map with returned data
      setMarketDataMap(prev => {
        const updated = { ...prev }
        // Update with returned data (overwrite existing entries)
        Object.keys(data).forEach(ticker => {
          const item = data[ticker]
          updated[ticker] = {
            price: item?.price ?? null,
            change: item?.change ?? null,
            change_percent: item?.change_percent ?? null,
            currency: item?.currency ?? null,
            spark_ts: item?.spark_ts ?? null,
            spark_close: item?.spark_close ?? null,
          }
        })
        // Mark tickers that weren't in response as processed (to prevent infinite retries)
        tickersToLoad.forEach(ticker => {
          if (!(ticker in updated)) {
            updated[ticker] = {
              price: null,
              change: null,
              change_percent: null,
              currency: null,
              spark_ts: null,
              spark_close: null,
            }
          }
        })
        return updated
      })
    } catch (error) {
      // Mark as failed to prevent infinite retries
      setMarketDataMap(prev => {
        const updated = { ...prev }
        tickersToLoad.forEach(ticker => {
          if (!updated[ticker]) {
            updated[ticker] = {
              price: null,
              change: null,
              change_percent: null,
              currency: null,
              spark_ts: null,
              spark_close: null,
            }
          }
        })
        return updated
      })
    } finally {
      setLoadingMarketData(prev => {
        const next = new Set(prev)
        tickersToLoad.forEach(t => next.delete(t))
        return next
      })
    }
  }, [country, marketDataMap, loadingMarketData])

  // Load market data immediately after feed loads (all stocks at once)
  // Use a ref to track if we've already initiated loading and debounce
  const marketDataLoadInitiated = React.useRef(false)
  const marketDataLoadTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    // Clear any pending timeout
    if (marketDataLoadTimeout.current) {
      clearTimeout(marketDataLoadTimeout.current)
    }

    // Reset when feed items change significantly
    if (feedItems.length === 0) {
      marketDataLoadInitiated.current = false
      return
    }

    // Debounce: wait 500ms after feed items stabilize
    marketDataLoadTimeout.current = setTimeout(() => {
      // Only load once per feed load
      if (marketDataLoadInitiated.current) return

      const allTickers = feedItems.map(item => item.ticker)
      const tickersNeedingData = allTickers.filter(t => {
        if (!t) return false
        // Load if not in map, or if in map but all values are null (data might have been added)
        const existing = marketDataMap[t]
        const hasNoData = existing &&
          existing.price === null &&
          existing.change === null &&
          existing.change_percent === null &&
          existing.spark_ts === null &&
          existing.spark_close === null
        return !loadingMarketData.has(t) && (!existing || hasNoData)
      })

      if (tickersNeedingData.length > 0) {
        marketDataLoadInitiated.current = true

        // Load all market data in batches of 100
        const batchSize = 100
        let completedBatches = 0
        const totalBatches = Math.ceil(tickersNeedingData.length / batchSize)

        for (let i = 0; i < tickersNeedingData.length; i += batchSize) {
          const batch = tickersNeedingData.slice(i, i + batchSize)
          // Stagger batches to avoid overwhelming the API
          setTimeout(() => {
            loadMarketDataForTickers(batch).finally(() => {
              completedBatches++
              // Reset flag after all batches complete
              if (completedBatches >= totalBatches) {
                setTimeout(() => {
                  marketDataLoadInitiated.current = false
                }, 2000)
              }
            })
          }, i * 200) // 200ms delay between batches
        }
      }
    }, 500) // 500ms debounce

    return () => {
      if (marketDataLoadTimeout.current) {
        clearTimeout(marketDataLoadTimeout.current)
      }
    }
  }, [feedItems.length, loadMarketDataForTickers])

  // Refresh market data
  const handleRefreshMarketData = async () => {
    setIsRefreshing(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not set')
      }

      // Call market-ingest Edge Function
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const url = `${supabaseUrl}/functions/v1/market-ingest`
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ region: country }),
      })

      if (!response.ok) {
        throw new Error(`Failed to refresh: ${response.status}`)
      }

      await response.json()

      // Wait a bit for data to be written, then refetch feed and market data
      setTimeout(async () => {
        // Refetch the feed to get updated data
        await refetchFeed()
        
        // Clear market data cache to force reload of market data
        setMarketDataMap({})
        
        // Reload bookmarks for the current country
        await loadUserBookmarks()
      }, 2000)
    } catch (error) {
      alert('Failed to refresh market data. Please try again.')
    } finally {
      setIsRefreshing(false)
    }
  }

  // User votes are now included in the feed response (my_vote field)

  // Handle search
  React.useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      handleSearch(debouncedSearchQuery)
    } else {
      setSearchResults([])
    }
  }, [debouncedSearchQuery])

  const handleSearch = async (query: string) => {
    try {
      const results = await searchStocks(query)
      const tickers = results.map((r: any) => r.symbol || r.ticker).filter(Boolean)
      setSearchResults(tickers)
    } catch (error) {
      setSearchResults([])
    }
  }

  // Transform feed items to stock cards
  const stockCards = React.useMemo(() => {
    // Create a set of tickers already in feed for quick lookup
    const feedTickerSet = new Set(feedItems.map(item => item.ticker))

    // Merge market data from lazy-loaded map
    const feedCards = feedItems.map((item) => {
      // Get market data from lazy-loaded map (or from feed item if available)
      const marketData = marketDataMap[item.ticker] || {
        price: item.price,
        change: item.change,
        change_percent: item.change_percent,
        spark_ts: item.spark_ts,
        spark_close: item.spark_close,
      }

      // Convert sparkline data from arrays to chart format
      const sparklineData = marketData.spark_ts && marketData.spark_close && marketData.spark_close.length > 0
        ? marketData.spark_ts.map((ts: number, i: number) => ({
          timestamp: ts * 1000, // Convert to milliseconds
          price: Number(marketData.spark_close![i]),
        }))
        : []

      return {
        ticker: item.ticker,
        price: marketData.price !== null && marketData.price !== undefined ? Number(marketData.price) : null,
        change: marketData.change !== null && marketData.change !== undefined ? Number(marketData.change) : null,
        changePercent: marketData.change_percent !== null && marketData.change_percent !== undefined ? Number(marketData.change_percent) : null,
        threadCount: item.threads_count,
        commentsCount: item.comments_count,
        score: item.score,
        upvotes: item.upvotes || 0,
        downvotes: item.downvotes || 0,
        sparklineData,
        userVote: item.my_vote !== null && item.my_vote !== undefined ? item.my_vote : null,
        isLoading: loadingMarketData.has(item.ticker),
        isBookmarked: bookmarkedTickers.has(item.ticker),
      }
    })

    // Add cards for searched stocks that aren't in the feed
    const searchCards: typeof feedCards = []
    if (debouncedSearchQuery.trim() && searchResults.length > 0) {
      for (const ticker of searchResults) {
        // Only add if not already in feed to avoid duplicates
        if (!feedTickerSet.has(ticker)) {
          // This stock is searched but not in feed - create a card for it
          const marketData = marketDataMap[ticker] || {
            price: null,
            change: null,
            change_percent: null,
            spark_ts: null,
            spark_close: null,
          }

          const sparklineData = marketData.spark_ts && marketData.spark_close && marketData.spark_close.length > 0
            ? marketData.spark_ts.map((ts: number, i: number) => ({
              timestamp: ts * 1000,
              price: Number(marketData.spark_close![i]),
            }))
            : []

          searchCards.push({
            ticker,
            price: marketData.price !== null && marketData.price !== undefined ? Number(marketData.price) : null,
            change: marketData.change !== null && marketData.change !== undefined ? Number(marketData.change) : null,
            changePercent: marketData.change_percent !== null && marketData.change_percent !== undefined ? Number(marketData.change_percent) : null,
            threadCount: 0,
            commentsCount: 0,
            score: 0,
            upvotes: 0,
            downvotes: 0,
            sparklineData,
            userVote: null,
            isLoading: loadingMarketData.has(ticker),
            isBookmarked: bookmarkedTickers.has(ticker),
          })

          // Load market data for searched stocks that aren't in feed
          if (!marketDataMap[ticker] && !loadingMarketData.has(ticker)) {
            loadMarketDataForTickers([ticker])
          }
        }
      }
    }

    return [...feedCards, ...searchCards]
  }, [feedItems, marketDataMap, loadingMarketData, bookmarkedTickers, debouncedSearchQuery, searchResults, loadMarketDataForTickers])

  // Sort and filter stocks - bookmarked stocks first
  const filteredStocks = React.useMemo(() => {
    // Sort: bookmarked stocks first, then by original order
    const sorted = [...stockCards].sort((a, b) => {
      if (a.isBookmarked && !b.isBookmarked) return -1
      if (!a.isBookmarked && b.isBookmarked) return 1
      return 0
    })

    let filtered = sorted

    // Apply search filter
    if (debouncedSearchQuery.trim() && searchResults.length > 0) {
      filtered = filtered.filter((s) => searchResults.includes(s.ticker))
    }

    // Apply client-side sorting for winners/losers
    if (sortBy === 'winners') {
      filtered = filtered
        .filter((s) => s.changePercent !== null && s.changePercent > 0)
        .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
    } else if (sortBy === 'losers') {
      filtered = filtered
        .filter((s) => s.changePercent !== null && s.changePercent < 0)
        .sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))
    }

    return filtered
  }, [stockCards, debouncedSearchQuery, searchResults, sortBy])

  // Fetch company names for display (optional, can be done lazily)
  const [companyNames, setCompanyNames] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    // Fetch company names for visible stocks (debounced)
    const tickersToFetch = filteredStocks
      .slice(0, 30) // Only fetch for first page
      .map(s => s.ticker)
      .filter(t => !companyNames[t])

    if (tickersToFetch.length === 0) return

    const fetchNames = async () => {
      const names: Record<string, string> = {}
      await Promise.all(
        tickersToFetch.map(async (ticker) => {
          try {
            const summary = await getStockSummary(ticker).catch(() => null)
            if (summary?.companyName) {
              names[ticker] = summary.companyName
            }
          } catch {
            // Ignore errors
          }
        })
      )
      setCompanyNames(prev => ({ ...prev, ...names }))
    }

    fetchNames()
  }, [filteredStocks.map(s => s.ticker).join(',')])

  // Intersection Observer for infinite scroll
  const observerTarget = React.useRef<HTMLDivElement>(null)

  // Auto-fetch next page when hasNextPage is true (aggressive infinite scroll)
  React.useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isLoading) {
      // Small delay to prevent rapid-fire requests
      const timer = setTimeout(() => {
        fetchNextPage()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [hasNextPage, isFetchingNextPage, isLoading, feedItems.length, fetchNextPage])

  // Intersection Observer as backup for scroll-based loading
  React.useEffect(() => {
    const currentTarget = observerTarget.current
    if (!currentTarget) return

    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries[0].isIntersecting
        if (isIntersecting && hasNextPage && !isFetchingNextPage && !isLoading) {
          fetchNextPage()
        }
      },
      { threshold: 0.1, rootMargin: '300px' } // Large rootMargin for early loading
    )

    observer.observe(currentTarget)

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage, feedItems.length])


  const handleAddStock = async () => {
    if (!newStockTicker.trim()) return

    const ticker = newStockTicker.trim().toUpperCase()
    setShowAddStockDialog(false)
    setNewStockTicker('')

    // Optimistically update bookmarks immediately
    setBookmarkedTickers(prev => new Set([...prev, ticker]))

    try {
      // Ensure stock exists in community_ticker_stats (for feed to pick it up)
      // This creates a placeholder entry if the stock doesn't exist
      const { error: statsError } = await supabase
        .from('community_ticker_stats')
        .upsert({
          ticker: ticker,
          region: country,
          threads_count: 0,
          comments_count: 0,
          score: 0,
          upvotes: 0,
          downvotes: 0,
          last_activity_at: null,
        }, {
          onConflict: 'ticker,region',
          ignoreDuplicates: false
        })

      if (statsError) {
        console.error('Failed to create ticker stats:', statsError)
      }

      // Bookmark the stock for the user
      const { error: bookmarkError } = await supabase.rpc('toggle_community_bookmark', {
        p_ticker: ticker,
        p_region: country,
      })

      if (bookmarkError) {
        console.error('Failed to bookmark:', bookmarkError)
        // Revert optimistic update on error
        setBookmarkedTickers(prev => {
          const next = new Set(prev)
          next.delete(ticker)
          return next
        })
      }

      // Fetch market data for the newly added ticker immediately
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        if (supabaseUrl) {
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token

          const ingestUrl = `${supabaseUrl}/functions/v1/market-ingest`
          const response = await fetch(ingestUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: JSON.stringify({
              region: country,
              tickers: [ticker], // Fetch data for this specific ticker
            }),
          })

          if (response.ok) {
            // Wait a bit for the data to be ingested, then refresh market data and feed
            setTimeout(async () => {
              // Force reload market data for this ticker by clearing it from the map first
              setMarketDataMap(prev => {
                const updated = { ...prev }
                delete updated[ticker] // Remove so it will be reloaded
                return updated
              })
              // Load market data for this ticker
              await loadMarketDataForTickers([ticker])

              // Refresh feed again after market data is loaded to show updated prices
              await queryClient.invalidateQueries({
                queryKey: ['community-feed', country, feedSort, 1000]
              })
              await refetchFeed()
            }, 2000) // Wait 2 seconds for ingestion to complete
          }
        }
      } catch (error) {
        console.error('Failed to fetch market data:', error)
      }

      // Immediately invalidate and refetch to show the stock
      // The stock should appear in feed because it's now in community_ticker_stats
      // Use resetQueries to clear cache and force fresh fetch
      await queryClient.resetQueries({
        queryKey: ['community-feed', country],
        exact: false
      })

      // Refetch feed immediately - stock should appear from community_ticker_stats
      // The updated_at timestamp will ensure it appears near the top among zero-score stocks
      await refetchFeed()

      // Also refresh bookmarks to ensure consistency
      await loadUserBookmarks()

      // After market data is ingested, refresh again to show prices
      setTimeout(async () => {
        await queryClient.invalidateQueries({
          queryKey: ['community-feed', country],
          exact: false
        })
        await refetchFeed()
      }, 3000) // Wait 3 seconds for market data ingestion to complete
    } catch (error) {
      console.error('Failed to add stock:', error)
      // Revert optimistic bookmark update on error
      setBookmarkedTickers(prev => {
        const next = new Set(prev)
        next.delete(ticker)
        return next
      })
    }
  }

  // Handle bookmark toggle from card
  const handleBookmarkToggle = async (ticker: string, isBookmarked: boolean) => {
    try {
      const { error } = await supabase.rpc('toggle_community_bookmark', {
        p_ticker: ticker,
        p_region: country,
      })

      if (error) {
        return
      }

      // Update local state
      setBookmarkedTickers(prev => {
        const next = new Set(prev)
        if (isBookmarked) {
          next.add(ticker)
        } else {
          next.delete(ticker)
        }
        return next
      })
    } catch (error) {
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-[#6F6A60]">Loading stocks...</div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-[#B23B2A]">
          Error loading feed: {error?.message || 'Unknown error'}
        </div>
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
          {feedItems.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshMarketData}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Market Data'}</span>
            </Button>
          )}
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

      {filteredStocks.length === 0 && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-[#6F6A60]">
              {debouncedSearchQuery.trim() ? "No stocks found matching your search." : "No stocks available."}
            </p>
            {!debouncedSearchQuery.trim() && (
              <Button
                variant="outline"
                onClick={handleRefreshMarketData}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Refreshing...' : 'Load Market Data'}</span>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
        {filteredStocks.map((stock) => (
          <CommunityStockCard
            key={stock.ticker}
            ticker={stock.ticker}
            companyName={companyNames[stock.ticker]}
            price={stock.price}
            change={stock.change}
            changePercent={stock.changePercent}
            sparklineData={stock.sparklineData}
            threadCount={stock.threadCount}
            commentsCount={stock.commentsCount}
            stockScore={stock.score}
            stockUpvotes={stock.upvotes || 0}
            stockDownvotes={stock.downvotes || 0}
            stockUserVote={stock.userVote}
            isLoading={stock.isLoading}
            isBookmarked={stock.isBookmarked}
            onVote={() => {
              // Refetch feed to get updated vote counts
              refetchFeed();
            }}
            onBookmark={handleBookmarkToggle}
          />
        ))}
      </div>

      {/* Infinite scroll trigger - automatically load all pages */}
      {hasNextPage && (
        <div ref={observerTarget} className="h-20 flex items-center justify-center py-4">
          {isFetchingNextPage && (
            <div className="text-[#6F6A60] text-sm font-mono">Loading more stocks... ({feedItems.length} loaded)</div>
          )}
          {!isFetchingNextPage && (
            <div className="text-[#6F6A60] text-xs font-mono">Loading more...</div>
          )}
        </div>
      )}
      {!hasNextPage && !isFetchingNextPage && filteredStocks.length > 0 && (
        <div className="h-10 flex items-center justify-center py-4">
          <div className="text-[#6F6A60] text-sm font-mono">All stocks loaded ({filteredStocks.length} total)</div>
        </div>
      )}
    </div>
  )
}
