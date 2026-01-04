// Community Feed API Client
// Purpose: Single feed endpoint that replaces per-ticker REST calls

import { supabase } from '../supabase'

export type FeedItem = {
  ticker: string
  threads_count: number
  comments_count: number
  score: number
  upvotes: number
  downvotes: number
  my_vote: number | null
  last_activity_at: string | null
  price: number | null
  change: number | null
  change_percent: number | null
  currency: string | null
  spark_ts: number[] | null
  spark_close: number[] | null
  quote_updated_at: string | null
  spark_updated_at: string | null
}

export type FeedResponse = {
  items: FeedItem[]
  nextCursor: string | null
  serverTs: number
}

export type FeedParams = {
  region?: 'USA' | 'India'
  sort?: 'mostVoted' | 'mostComments' | 'recent'
  limit?: number
  cursor?: string | null
}

/**
 * Fetch community feed from Edge Function
 */
export async function getCommunityFeed(params: FeedParams): Promise<FeedResponse> {
  const {
    region = 'USA',
    sort = 'mostVoted',
    limit = 30,
    cursor = null,
  } = params

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not set')
  }

  // Build query string
  const queryParams = new URLSearchParams({
    region,
    sort,
    limit: limit.toString(),
    lightweight: 'true', // Use lightweight feed (no market data) for faster loads
  })
  if (cursor) {
    queryParams.set('cursor', cursor)
  }

  // Get auth token for Edge Function
  // Try to get session, but don't fail if it's not ready yet
  let token: string | undefined
  try {
    const { data: { session } } = await supabase.auth.getSession()
    token = session?.access_token
  } catch (error) {
    // Session not ready yet - continue without token (anonymous access)
    console.debug('Session not ready, proceeding without auth token')
  }

  const url = `${supabaseUrl}/functions/v1/community-feed?${queryParams.toString()}`
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  // Add ETag for caching if we have a previous response
  if (cursor) {
    // We could store ETag from previous response, but for now just include cursor
  }

  // Only add Authorization header if we have a valid token
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    if (response.status === 304) {
      // Not Modified - return cached data (caller should handle this)
      throw new Error('NOT_MODIFIED')
    }
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  const data: FeedResponse = await response.json()
  return data
}

