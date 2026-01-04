"use client"

import * as React from "react"
import { useParams, useLocation, useNavigate } from "react-router-dom"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ArrowUp, ArrowDown } from "lucide-react"
import { getPrice, getStockSummary, getStockHistory, getIncomeStatement, getBalanceSheet, getCashFlow } from "@/lib/api"
import { supabase } from "@/lib/supabase"
import { useUser } from "@clerk/clerk-react"
import { StockHeaderBar } from "@/components/stock/StockHeaderBar"
import { TimeRangeChips } from "@/components/stock/TimeRangeChips"
import { PriceChartPanel } from "@/components/stock/PriceChartPanel"
import { KeyStatsPanel } from "@/components/stock/KeyStatsPanel"
import { AboutPanel } from "@/components/stock/AboutPanel"
import { IncomeStatementSection } from "@/components/stock/IncomeStatementSection"
import { CeoCard } from "@/components/stock/CeoCard"
import { CompanyFactsCard } from "@/components/stock/CompanyFactsCard"
import { RatingsSnapshot } from "@/components/stock/RatingsSnapshot"
import { CommunityTab } from "@/components/community/CommunityTab"
import { listPosts } from "@/lib/community/api"
import toast from "react-hot-toast"

interface Comment {
  id: string
  content: string
  user_id: string | null
  upvotes: number
  downvotes: number
  created_at: string
  parent_id: string | null
}

export default function StockDetail() {
  const { ticker } = useParams<{ ticker: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useUser()
  const [stockData, setStockData] = React.useState<any>(null)
  const [comments, setComments] = React.useState<Comment[]>([])
  const [newComment, setNewComment] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  // Stock-level voting state (same as Community cards)
  const [stockScore, setStockScore] = React.useState(0)
  const [stockUpvotes, setStockUpvotes] = React.useState(0)
  const [stockDownvotes, setStockDownvotes] = React.useState(0)
  const [stockUserVote, setStockUserVote] = React.useState<number | null>(null) // -1, 1, or null
  const [isVoting, setIsVoting] = React.useState(false)
  const [timeframe, setTimeframe] = React.useState("1YR")
  const [commentSort, setCommentSort] = React.useState<"latest" | "top">("latest")
  const [financials, setFinancials] = React.useState<any>(null)
  const [loadingFinancials, setLoadingFinancials] = React.useState(false)
  const [chartData, setChartData] = React.useState<any[]>([])
  const [, setLoadingChart] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'overview' | 'financials' | 'community'>('overview')
  const [communityPostCount, setCommunityPostCount] = React.useState(0)

  // Determine active tab from URL
  React.useEffect(() => {
    if (location.pathname.includes('/community')) {
      setActiveTab('community')
    } else if (location.pathname.includes('/financials')) {
      setActiveTab('financials')
    } else {
      setActiveTab('overview')
    }
  }, [location.pathname])

  // Load community post count
  React.useEffect(() => {
    if (ticker && activeTab === 'community') {
      listPosts({ ticker, sort: 'hot', limit: 1, clerkUserId: user?.id })
        .then(result => setCommunityPostCount(result.posts.length))
        .catch(() => {})
    }
  }, [ticker, activeTab, user?.id])

  React.useEffect(() => {
    if (ticker) {
      loadStockData()
      loadComments()
      loadStockVotes() // Use new function name
      loadFinancials()
      loadChartData()
      trackView()
    }
  }, [ticker, timeframe])

  React.useEffect(() => {
    if (ticker) {
      loadComments()
    }
  }, [commentSort, ticker])

  const loadStockData = async () => {
    if (!ticker) return
    setLoading(true)
    try {
      const [priceData, summaryData] = await Promise.all([
        getPrice(ticker),
        getStockSummary(ticker).catch(() => null),
      ])

      setStockData({
        ticker,
        price: priceData.price || 0,
        change: summaryData?.change || 0,
        changePercent: summaryData?.changePercent || 0,
        ...summaryData,
      })
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  const loadChartData = async () => {
    if (!ticker) return
    setLoadingChart(true)
    try {
      // Map timeframe to period and interval
      const timeframeMap: Record<string, { period: string; interval: string }> = {
        '1D': { period: '1d', interval: '5m' },
        '1W': { period: '5d', interval: '1d' },
        '1M': { period: '1mo', interval: '1d' },
        '3M': { period: '3mo', interval: '1d' },
        '6M': { period: '6mo', interval: '1d' },
        'YTD': { period: 'ytd', interval: '1d' },
        '1YR': { period: '1y', interval: '1d' },
        '5YR': { period: '5y', interval: '1mo' },
        '10YR': { period: '10y', interval: '3mo' },
        'ALL': { period: 'max', interval: '3mo' },
      }
      
      const config = timeframeMap[timeframe] || { period: '1y', interval: '1d' }
      
      const historyData = await getStockHistory(ticker, config.period, config.interval)
      if (historyData && Array.isArray(historyData)) {
        setChartData(historyData)
      }
    } catch (error) {
    } finally {
      setLoadingChart(false)
    }
  }

  const loadComments = async () => {
    if (!ticker) return
    try {
      let query = supabase
        .from("stock_comments")
        .select("*")
        .eq("ticker", ticker)
        .is("parent_id", null)

      if (commentSort === "latest") {
        query = query.order("created_at", { ascending: false })
      } else {
        query = query.order("upvotes", { ascending: false })
      }

      const { data, error } = await query

      if (!error && data) {
        if (commentSort === "top") {
          data.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes))
        }
        setComments(data)
      }
    } catch (error) {
    }
  }

  const loadFinancials = async () => {
    if (!ticker) return
    setLoadingFinancials(true)
    try {
      const [income, balance, cashflow] = await Promise.all([
        getIncomeStatement(ticker).catch(() => null),
        getBalanceSheet(ticker).catch(() => null),
        getCashFlow(ticker).catch(() => null),
      ])
      setFinancials({ income, balance, cashflow })
    } catch (error) {
    } finally {
      setLoadingFinancials(false)
    }
  }

  // Load stock-level votes (same system as Community cards)
  const loadStockVotes = async () => {
    if (!ticker) return
    try {
      // Get stock-level vote data from community_stocks table
      const { data: stockData } = await supabase
        .from('community_stocks')
        .select('score, upvotes, downvotes, ticker')
        .eq('ticker', ticker)
        .maybeSingle()
      
      if (stockData) {
        setStockScore(stockData.score ?? 0)
        setStockUpvotes(stockData.upvotes ?? 0)
        setStockDownvotes(stockData.downvotes ?? 0)
      } else {
        // Default to 0 if stock doesn't exist yet
        setStockScore(0)
        setStockUpvotes(0)
        setStockDownvotes(0)
      }
      
      // Get user's stock-level vote (works for both authenticated and anonymous users)
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
          setStockUserVote(userVoteData.value as number)
        } else {
          setStockUserVote(null)
        }
      } else {
        setStockUserVote(null)
      }
    } catch (error) {
      // Set defaults on error
      setStockScore(0)
      setStockUpvotes(0)
      setStockDownvotes(0)
      setStockUserVote(null)
    }
  }

  const trackView = async () => {
    if (!ticker || !user) return
    try {
      await supabase.from("user_stock_history").insert({
        user_id: user.id,
        ticker,
        viewed_at: new Date().toISOString(),
      })
    } catch (error) {
      // Ignore errors for tracking
    }
  }

  // Handle vote using the same RPC endpoint as cards
  const handleVote = async (intent: "up" | "down") => {
    if (!ticker || isVoting) return // Prevent double-clicks

    setIsVoting(true)

    try {
      // Import ensureVoterSession dynamically
      const { ensureVoterSession } = await import('@/lib/auth/ensureVoterSession')
      
      // Ensure we have a Supabase session (creates anonymous session if needed)
      const hasSession = await ensureVoterSession()
      if (!hasSession) {
        setIsVoting(false)
        return // Error toast is shown by ensureVoterSession
      }

      // Calculate new vote value based on current vote and intent
      // Same logic as useVote hook
      let newValue: number | null = null
      const currentVote = stockUserVote
      
      if (intent === 'up') {
        if (currentVote === 1) {
          newValue = null // Remove vote
        } else {
          newValue = 1 // Add or switch to upvote
        }
      } else {
        if (currentVote === -1) {
          newValue = null // Remove vote
        } else {
          newValue = -1 // Add or switch to downvote
        }
      }

      // Call RPC function (uses auth.uid() from JWT)
      const { data, error } = await supabase.rpc('rpc_cast_vote', {
        p_target_type: 'stock',
        p_target_id: ticker,
        p_new_value: newValue,
      })

      if (error) {
        setIsVoting(false)
        return
      }

      // Update state with response
      if (data) {
        setStockScore(data.score)
        setStockUpvotes(data.upvotes)
        setStockDownvotes(data.downvotes)
        setStockUserVote(data.my_vote)
      }
    } catch (error) {
    } finally {
      setIsVoting(false)
    }
  }

  const handleCommentSubmit = async () => {
    if (!ticker || !newComment.trim()) return

    const userId = user?.id || null

    try {
      const { error } = await supabase.from("stock_comments").insert({
        ticker,
        user_id: userId,
        content: newComment.trim(),
      })

      if (!error) {
        setNewComment("")
        loadComments()
      }
    } catch (error) {
    }
  }

  const handleCommentVote = async (commentId: string, voteType: "upvote" | "downvote") => {
    const userId = user?.id || `anon_${Date.now()}_${Math.random()}`

    try {
      await supabase.from("comment_votes").upsert({
        comment_id: commentId,
        user_id: userId,
        vote_type: voteType,
      })
      loadComments()
    } catch (error) {
    }
  }

  const addToWatchlist = async () => {
    if (!ticker || !user) return

    try {
      await supabase.from("user_stock_watchlist").upsert({
        user_id: user.id,
        ticker,
      })
    } catch (error) {
    }
  }

  // Determine region based on ticker format
  const getRegion = (ticker: string): 'USA' | 'India' => {
    if (ticker.includes('.NS') || ticker.includes('.BO')) {
      return 'India'
    }
    return 'USA'
  }

  const [isAddingToCommunity, setIsAddingToCommunity] = React.useState(false)

  const handleAddToCommunity = async () => {
    if (!ticker || isAddingToCommunity) return

    setIsAddingToCommunity(true)
    const region = getRegion(ticker)
    
    try {
      // Ensure stock exists in community_ticker_stats
      const { error: statsError } = await supabase
        .from('community_ticker_stats')
        .upsert({
          ticker: ticker,
          region: region,
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
        throw new Error('Failed to create ticker stats')
      }

      // Bookmark the stock for the user
      if (user) {
        const { error: bookmarkError } = await supabase.rpc('toggle_community_bookmark', {
          p_ticker: ticker,
          p_region: region,
        })

        if (bookmarkError) {
          console.error('Failed to bookmark:', bookmarkError)
          // Don't throw - bookmarking is optional
        }
      }

      // Fetch market data for the newly added ticker
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        if (supabaseUrl) {
          const { data: { session } } = await supabase.auth.getSession()
          const token = session?.access_token

          const ingestUrl = `${supabaseUrl}/functions/v1/market-ingest`
          await fetch(ingestUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: JSON.stringify({
              region: region,
              tickers: [ticker],
            }),
          })
        }
      } catch (error) {
        console.error('Failed to fetch market data:', error)
        // Don't throw - market data fetch is optional
      }

      // Show success message with toast
      toast.success(`${ticker} added to community dashboard!`, {
        duration: 4000,
        position: 'top-right',
        icon: '✅',
        style: {
          background: '#F7F2E6',
          color: '#1C1B17',
          border: '1px solid #2F8F5B',
        },
      })
    } catch (error) {
      console.error('Failed to add stock to community:', error)
      toast.error('Failed to add stock to community. Please try again.', {
        duration: 4000,
        position: 'top-right',
        icon: '❌',
        style: {
          background: '#F7F2E6',
          color: '#B23B2A',
          border: '1px solid #B23B2A',
        },
      })
    } finally {
      setIsAddingToCommunity(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#F1EEE0]">
        <div className="text-[#6F6A60] font-mono">Loading...</div>
      </div>
    )
  }

  if (!stockData) {
    return (
      <div className="flex items-center justify-center h-full bg-[#F1EEE0]">
        <div className="text-[#6F6A60] font-mono">Stock not found</div>
      </div>
    )
  }

  const changePercent = stockData.changePercent || 0
  const change = stockData.change || 0

  return (
    <div className="h-full overflow-y-auto bg-[#F1EEE0] font-mono" style={{ fontFamily: 'ui-monospace, "IBM Plex Mono", "Space Mono", monospace' }}>
      {/* Top Header Bar */}
      <StockHeaderBar
        ticker={stockData.ticker}
        companyName={stockData.companyName}
        exchange={stockData.exchange}
        logoUrl={stockData.logoUrl}
        price={stockData.price}
        changePercent={changePercent}
        change={change}
        score={stockScore}
        upvotes={stockUpvotes}
        downvotes={stockDownvotes}
        userVote={stockUserVote}
        onVote={handleVote}
        onAddToWatchlist={addToWatchlist}
        onAddToCommunity={handleAddToCommunity}
        isVoting={isVoting}
        isAddingToCommunity={isAddingToCommunity}
      />

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#D7D0C2]">
          <button
            onClick={() => {
              setActiveTab('overview')
              navigate(`/stock/${ticker}`)
            }}
            className={`
              px-4 py-2 text-sm font-mono rounded border transition-colors
              ${activeTab === 'overview'
                ? 'bg-[#1C1B17] text-[#F7F2E6] border-[#1C1B17]'
                : 'bg-transparent text-[#1C1B17] border-[#D7D0C2] hover:bg-[#FBF7ED]'
              }
            `}
          >
            Overview
          </button>
          <button
            onClick={() => {
              setActiveTab('financials')
              navigate(`/stock/${ticker}/financials`)
            }}
            className={`
              px-4 py-2 text-sm font-mono rounded border transition-colors
              ${activeTab === 'financials'
                ? 'bg-[#1C1B17] text-[#F7F2E6] border-[#1C1B17]'
                : 'bg-transparent text-[#1C1B17] border-[#D7D0C2] hover:bg-[#FBF7ED]'
              }
            `}
          >
            Financials
          </button>
          <button
            onClick={() => {
              setActiveTab('community')
              navigate(`/stock/${ticker}/community`)
            }}
            className={`
              px-4 py-2 text-sm font-mono rounded border transition-colors
              ${activeTab === 'community'
                ? 'bg-[#1C1B17] text-[#F7F2E6] border-[#1C1B17]'
                : 'bg-transparent text-[#1C1B17] border-[#D7D0C2] hover:bg-[#FBF7ED]'
              }
            `}
          >
            Community {communityPostCount > 0 && `(${communityPostCount})`}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'community' ? (
          <CommunityTab />
        ) : (
          <>
            {/* Time Range Chips */}
            <div className="mb-8">
              <TimeRangeChips value={timeframe} onChange={setTimeframe} />
            </div>

            {/* Main Top Grid: 12 columns */}
        <div className="grid grid-cols-12 gap-6 mb-8">
          {/* Left: Price Chart (7 cols) */}
          <div className="col-span-12 lg:col-span-7">
            <PriceChartPanel ticker={stockData.ticker} timeframe={timeframe} chartData={chartData} />
          </div>

          {/* Middle: Key Stats (2 cols) */}
          <div className="col-span-12 md:col-span-6 lg:col-span-2">
            <KeyStatsPanel
              marketCap={stockData.marketCap}
              high52w={stockData.high}
              low52w={stockData.low}
              dividendYield={stockData.dividendYield}
              pe={stockData.pe}
              volume={stockData.volume}
              sharesOutstanding={stockData.sharesOutstanding}
            />
          </div>

          {/* Right: About (3 cols) */}
          <div className="col-span-12 md:col-span-6 lg:col-span-3">
            <AboutPanel
              companyName={stockData.companyName}
              description={stockData.description}
              website={stockData.website}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-b border-[#D7D0C2] my-8" />

        {/* Income Statement Section with Right Sidebar */}
        <div className="grid grid-cols-12 gap-6 mb-8">
          {/* Left: Income Statement (9 cols) */}
          <div className="col-span-12 lg:col-span-9">
            <IncomeStatementSection
              incomeData={financials?.income}
              loading={loadingFinancials}
              ticker={stockData.ticker}
            />
          </div>

          {/* Right: Sidebar Cards (3 cols) */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <CeoCard ceoName={stockData.companyName} />
            <CompanyFactsCard
              industry={stockData.industry}
              sector={stockData.sector}
              employees={stockData.fullTimeEmployees}
            />
          </div>
        </div>

        {/* Ratings Snapshot */}
        <div className="mb-8">
          <RatingsSnapshot
            ratings={{
              dcf: stockData.recommendationMean ? Math.min(5, Math.max(1, stockData.recommendationMean)) : 0,
              roe: stockData.roe ? Math.min(5, Math.max(1, Math.round((stockData.roe || 0) * 10) / 10)) : 0,
              roa: stockData.returnOnAssets ? Math.min(5, Math.max(1, Math.round((stockData.returnOnAssets || 0) * 10) / 10)) : 0,
              debtToEquity: stockData.debtToEquity ? Math.min(5, Math.max(1, Math.round((stockData.debtToEquity || 0) * 10) / 10)) : 0,
              pe: stockData.pe ? Math.min(5, Math.max(1, Math.round((stockData.pe || 0) / 10))) : 0,
              pb: stockData.pb ? Math.min(5, Math.max(1, Math.round((stockData.pb || 0) * 10) / 10)) : 0,
              overall: stockData.recommendationMean ? Math.min(5, Math.max(1, stockData.recommendationMean)) : 0,
            }}
          />
        </div>

        {/* Balance Statement & Cash Flow Sections */}
        <div className="space-y-6 mb-8">
          {/* Balance Statement */}
          <div className="bg-[#F7F2E6] border border-[#D7D0C2] p-5">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#D7D0C2]">
              <h2 className="text-base font-mono font-bold text-[#1C1B17]">Balance Statement</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="font-mono text-xs px-3 py-1.5 h-auto bg-transparent border-[#D7D0C2] text-[#1C1B17]"
                  size="sm"
                >
                  Quarterly
                </Button>
                <Button
                  variant="outline"
                  className="font-mono text-xs px-3 py-1.5 h-auto bg-transparent border-[#D7D0C2] text-[#1C1B17]"
                  size="sm"
                >
                  Annually
                </Button>
              </div>
            </div>
            {financials?.balance && financials.balance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#D7D0C2]">
                      <th className="text-left py-2 px-3 text-[#6F6A60] font-medium uppercase tracking-wider text-[0.7rem]">
                        Period
                      </th>
                      <th className="text-right py-2 px-3 text-[#6F6A60] font-medium uppercase tracking-wider text-[0.7rem]">
                        Cash & ST Investments
                      </th>
                      <th className="text-right py-2 px-3 text-[#6F6A60] font-medium uppercase tracking-wider text-[0.7rem]">
                        Total Assets
                      </th>
                      <th className="text-right py-2 px-3 text-[#6F6A60] font-medium uppercase tracking-wider text-[0.7rem]">
                        Total Liabilities
                      </th>
                      <th className="text-right py-2 px-3 text-[#6F6A60] font-medium uppercase tracking-wider text-[0.7rem]">
                        Total Equity
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {financials.balance.slice(0, 5).map((row: any, idx: number) => (
                      <tr key={idx} className="border-b border-[#E3DDCF]">
                        <td className="py-2 px-3 text-[#1C1B17]">{row.period || row.year || row.date || "N/A"}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#1C1B17]">
                          {(row.cash || row.cashAndShortTerm || row.cashAndCashEquivalents) ? 
                            `$${((row.cash || row.cashAndShortTerm || row.cashAndCashEquivalents) / 1e6).toFixed(2)}M` : "N/A"}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#1C1B17]">
                          {(row.totalAssets || row.assets) ? 
                            `$${((row.totalAssets || row.assets) / 1e6).toFixed(2)}M` : "N/A"}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#1C1B17]">
                          {(row.totalLiabilities || row.liabilities) ? 
                            `$${((row.totalLiabilities || row.liabilities) / 1e6).toFixed(2)}M` : "N/A"}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#1C1B17]">
                          {(row.totalEquity || row.equity) ? 
                            `$${((row.totalEquity || row.equity) / 1e6).toFixed(2)}M` : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs font-mono text-[#6F6A60]">No balance sheet data available</p>
            )}
          </div>

          {/* Cash Flow */}
          <div className="bg-[#F7F2E6] border border-[#D7D0C2] p-5">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#D7D0C2]">
              <h2 className="text-base font-mono font-bold text-[#1C1B17]">Cash Flow Statement</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="font-mono text-xs px-3 py-1.5 h-auto bg-transparent border-[#D7D0C2] text-[#1C1B17]"
                  size="sm"
                >
                  Quarterly
                </Button>
                <Button
                  variant="outline"
                  className="font-mono text-xs px-3 py-1.5 h-auto bg-transparent border-[#D7D0C2] text-[#1C1B17]"
                  size="sm"
                >
                  Annually
                </Button>
              </div>
            </div>
            <p className="text-xs font-mono text-[#6F6A60]">Cash flow data will be displayed here</p>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-[#F7F2E6] border border-[#D7D0C2] p-5">
          <h2 className="text-base font-mono font-bold text-[#1C1B17] mb-4">
            Comments ({comments.length})
          </h2>

          {/* Comment Input */}
          <div className="mb-6 pb-6 border-b border-[#D7D0C2]">
            <Textarea
              placeholder="Share your thoughts about this stock..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={4}
              className="bg-[#FBF7ED] border-[#D7D0C2] text-[#1C1B17] placeholder:text-[#6F6A60] font-mono text-sm mb-3"
            />
            <Button
              onClick={handleCommentSubmit}
              disabled={!newComment.trim()}
              className="font-mono text-xs bg-[#1C1B17] text-[#F7F2E6] hover:bg-[#1C1B17]/90"
              size="sm"
            >
              Post Comment
            </Button>
          </div>

          {/* Comment Sort */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-mono text-[#6F6A60]">Sort by:</span>
            <Button
              variant={commentSort === "latest" ? "default" : "outline"}
              onClick={() => setCommentSort("latest")}
              className={`font-mono text-xs px-3 py-1.5 h-auto ${
                commentSort === "latest"
                  ? "bg-[#1C1B17] text-[#F7F2E6] border-[#1C1B17]"
                  : "bg-transparent border-[#D7D0C2] text-[#1C1B17]"
              }`}
              size="sm"
            >
              Latest
            </Button>
            <Button
              variant={commentSort === "top" ? "default" : "outline"}
              onClick={() => setCommentSort("top")}
              className={`font-mono text-xs px-3 py-1.5 h-auto ${
                commentSort === "top"
                  ? "bg-[#1C1B17] text-[#F7F2E6] border-[#1C1B17]"
                  : "bg-transparent border-[#D7D0C2] text-[#1C1B17]"
              }`}
              size="sm"
            >
              Top
            </Button>
          </div>

          {/* Comments List */}
          <div className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-xs font-mono text-[#6F6A60] text-center py-8">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="bg-[#FBF7ED] border border-[#D7D0C2] p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-mono font-semibold text-[#1C1B17]">
                        {comment.user_id ? `User ${comment.user_id.slice(0, 8)}` : "Anonymous"}
                      </p>
                      <p className="text-xs font-mono text-[#6F6A60]">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="mb-3 text-sm font-mono text-[#1C1B17] leading-relaxed">
                    {comment.content}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCommentVote(comment.id, "upvote")}
                      className="gap-1 font-mono text-xs h-auto py-1 px-2 text-[#1C1B17] hover:bg-[#F7F2E6]"
                    >
                      <ArrowUp className="h-3 w-3" />
                      <span className="tabular-nums">{comment.upvotes}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCommentVote(comment.id, "downvote")}
                      className="gap-1 font-mono text-xs h-auto py-1 px-2 text-[#1C1B17] hover:bg-[#F7F2E6]"
                    >
                      <ArrowDown className="h-3 w-3" />
                      <span className="tabular-nums">{comment.downvotes}</span>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  )
}
