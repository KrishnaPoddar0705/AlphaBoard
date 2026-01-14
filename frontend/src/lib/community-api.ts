import { supabase } from "./supabase"

export interface StockComment {
  id: string
  ticker: string
  user_id: string | null
  content: string
  parent_id: string | null
  upvotes: number
  downvotes: number
  created_at: string
  updated_at: string
}

export interface StockVote {
  id: string
  ticker: string
  user_id: string | null
  vote_type: "upvote" | "downvote"
  created_at: string
}

/**
 * Get comments for a stock
 */
export async function getStockComments(ticker: string): Promise<StockComment[]> {
  const { data, error } = await supabase
    .from("stock_comments")
    .select("*")
    .eq("ticker", ticker)
    .is("parent_id", null)
    .order("created_at", { ascending: false })

  if (error) {
    return []
  }

  return data || []
}

/**
 * Create a comment on a stock
 */
export async function createStockComment(
  ticker: string,
  content: string,
  userId?: string | null,
  parentId?: string | null
): Promise<StockComment | null> {
  const { data, error } = await supabase
    .from("stock_comments")
    .insert({
      ticker,
      user_id: userId || null,
      content,
      parent_id: parentId || null,
    })
    .select()
    .single()

  if (error) {
    return null
  }

  return data
}

/**
 * Vote on a stock
 */
export async function voteOnStock(
  ticker: string,
  voteType: "upvote" | "downvote",
  userId?: string | null
): Promise<boolean> {
  const voteUserId = userId || `anon_${Date.now()}_${Math.random()}`

  const { error } = await supabase.from("stock_votes").upsert({
    ticker,
    user_id: voteUserId,
    vote_type: voteType,
  })

  if (error) {
    return false
  }

  return true
}

/**
 * Get votes for a stock
 */
export async function getStockVotes(ticker: string): Promise<{
  upvotes: number
  downvotes: number
  userVote: "upvote" | "downvote" | null
}> {
  const { data, error } = await supabase
    .from("stock_votes")
    .select("*")
    .eq("ticker", ticker)

  if (error) {
    return { upvotes: 0, downvotes: 0, userVote: null }
  }

  const upvotes = data?.filter((v) => v.vote_type === "upvote").length || 0
  const downvotes = data?.filter((v) => v.vote_type === "downvote").length || 0

  return {
    upvotes,
    downvotes,
    userVote: null, // Will be set by caller if user is authenticated
  }
}

/**
 * Vote on a comment
 */
export async function voteOnComment(
  commentId: string,
  voteType: "upvote" | "downvote",
  userId?: string | null
): Promise<boolean> {
  const voteUserId = userId || `anon_${Date.now()}_${Math.random()}`

  const { error } = await supabase.from("comment_votes").upsert({
    comment_id: commentId,
    user_id: voteUserId,
    vote_type: voteType,
  })

  if (error) {
    return false
  }

  return true
}

/**
 * Add stock to watchlist
 */
export async function addToWatchlist(
  ticker: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase.from("user_stock_watchlist").upsert({
    user_id: userId,
    ticker,
  })

  if (error) {
    return false
  }

  return true
}

/**
 * Remove stock from watchlist
 */
export async function removeFromWatchlist(
  ticker: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("user_stock_watchlist")
    .delete()
    .eq("user_id", userId)
    .eq("ticker", ticker)

  if (error) {
    return false
  }

  return true
}

/**
 * Get user's watchlist
 */
export async function getWatchlist(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_stock_watchlist")
    .select("ticker")
    .eq("user_id", userId)
    .order("added_at", { ascending: false })

  if (error) {
    return []
  }

  return data?.map((item) => item.ticker) || []
}

/**
 * Track stock view in history
 */
export async function trackStockView(
  ticker: string,
  userId: string
): Promise<void> {
  await supabase.from("user_stock_history").insert({
    user_id: userId,
    ticker,
    viewed_at: new Date().toISOString(),
  })
}

/**
 * Get user's stock history
 */
export async function getStockHistory(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_stock_history")
    .select("ticker")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(50)

  if (error) {
    return []
  }

  // Get unique tickers
  const uniqueTickers = Array.from(new Set(data?.map((item) => item.ticker) || []))
  return uniqueTickers
}



