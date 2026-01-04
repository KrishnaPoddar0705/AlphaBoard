// Edge Function: community-feed
// Purpose: Single feed endpoint that returns all ticker data (community stats + market data)
// Replaces per-ticker REST calls with one paginated feed

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin, if-none-match',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface FeedParams {
  region?: string
  sort?: string
  limit?: number
  cursor?: string
}

interface FeedItem {
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

interface FeedResponse {
  items: FeedItem[]
  nextCursor: string | null
  serverTs: number
}

// Decode cursor (base64 JSON: { v: number, t: string })
function decodeCursor(cursor: string | null): { value: number | null, ticker: string | null } {
  if (!cursor) return { value: null, ticker: null }
  try {
    const decoded = JSON.parse(atob(cursor))
    return { value: decoded.v || null, ticker: decoded.t || null }
  } catch {
    return { value: null, ticker: null }
  }
}

// Encode cursor
function encodeCursor(value: number, ticker: string): string {
  return btoa(JSON.stringify({ v: value, t: ticker }))
}

// Generate ETag from response using Web Crypto API
async function generateETag(response: FeedResponse): Promise<string> {
  const content = JSON.stringify(response)
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return `"${hashHex.substring(0, 16)}"`
}

serve(async (req) => {
  // Handle CORS preflight - must be first
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    // Get service role key for database operations
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not set')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user ID from auth token if present
    const authHeader = req.headers.get('authorization')
    let userId: string | null = null
    
    if (authHeader) {
      try {
        // Decode JWT to get user ID directly (more reliable)
        const token = authHeader.replace('Bearer ', '')
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]))
          userId = payload.sub || payload.user_id || null
        }
        
        // Fallback: try to get user via Supabase client if JWT decode fails
        if (!userId) {
          const userClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
              global: {
                headers: { Authorization: authHeader },
              },
            }
          )
          const { data: { user } } = await userClient.auth.getUser()
          userId = user?.id || null
        }
      } catch (error) {
        console.warn('Could not extract user ID from token:', error)
        // Continue without user ID (anonymous access)
      }
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
    )

    // Parse query parameters
    const url = new URL(req.url)
    const params: FeedParams = {
      region: url.searchParams.get('region') || 'USA',
      sort: url.searchParams.get('sort') || 'mostVoted',
      limit: parseInt(url.searchParams.get('limit') || '30', 10),
      cursor: url.searchParams.get('cursor') || null,
    }

    // Validate and normalize sort option (SQL function expects lowercase)
    const sortMap: Record<string, string> = {
      'mostvoted': 'mostvoted',
      'mostVoted': 'mostvoted',
      'mostcomments': 'mostcomments',
      'mostComments': 'mostcomments',
      'recent': 'recent',
    }
    params.sort = sortMap[params.sort || ''] || 'mostvoted'

    // Validate limit (max 100)
    if (params.limit! > 100) params.limit = 100
    if (params.limit! < 1) params.limit = 30

    // Decode cursor
    const { value: cursorValue, ticker: cursorTicker } = decodeCursor(params.cursor || null)

    // Call RPC function with user_id
    // Use lightweight feed (without market data) for faster initial loads
    const useLightweight = url.searchParams.get('lightweight') === 'true'
    const rpcFunction = useLightweight ? 'get_community_feed_lightweight' : 'get_community_feed'
    
    console.log('[community-feed] Calling RPC:', {
      rpcFunction,
      region: params.region,
      sort: params.sort,
      limit: params.limit! + 1,
      cursorValue,
      cursorTicker,
      hasUserId: !!userId,
    })
    
    const { data, error } = await supabaseClient.rpc(rpcFunction, {
      _region: params.region,
      _sort: params.sort,
      _limit: params.limit! + 1, // Fetch one extra to determine if there's more
      _cursor_value: cursorValue,
      _cursor_ticker: cursorTicker,
      _user_id: userId,
    })
    
    console.log('[community-feed] RPC response:', {
      dataLength: data?.length,
      hasError: !!error,
      errorMessage: error?.message,
    })

    if (error) {
      console.error('RPC error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch feed', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine if there's a next page
    // We requested limit + 1, so if we got more than limit, there's more data
    const hasMore = data && data.length > params.limit!
    const items = hasMore ? data.slice(0, params.limit!) : (data || [])

    // Generate next cursor from last item
    let nextCursor: string | null = null
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1]
      const sortValue = 
        params.sort === 'mostvoted' ? (lastItem.score || 0) :
        params.sort === 'mostcomments' ? (lastItem.comments_count || 0) :
        lastItem.last_activity_at ? new Date(lastItem.last_activity_at).getTime() / 1000 : 0
      nextCursor = encodeCursor(sortValue, lastItem.ticker)
      console.log('[community-feed] Generated nextCursor:', { 
        hasMore, 
        itemsReturned: items.length, 
        totalReceived: data?.length,
        lastItem: { ticker: lastItem.ticker, score: lastItem.score },
        nextCursor,
        sortValue
      })
    } else {
      console.log('[community-feed] No more pages:', { 
        hasMore, 
        itemsReturned: items.length, 
        totalReceived: data?.length 
      })
    }
    
    // Ensure nextCursor is set if we have more data (fallback)
    if (hasMore && !nextCursor && items.length > 0) {
      const lastItem = items[items.length - 1]
      const sortValue = lastItem.score || 0
      nextCursor = encodeCursor(sortValue, lastItem.ticker)
      console.log('[community-feed] Fallback cursor generation:', { nextCursor, ticker: lastItem.ticker })
    }

    const response: FeedResponse = {
      items,
      nextCursor,
      serverTs: Date.now(),
    }

    // Generate ETag
    const etag = await generateETag(response)

    // Check If-None-Match header for 304 response
    const ifNoneMatch = req.headers.get('if-none-match')
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ...corsHeaders,
          'ETag': etag,
          'Cache-Control': 'public, max-age=5, stale-while-revalidate=30',
        },
      })
    }

    // Return response with caching headers
    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'ETag': etag,
          'Cache-Control': 'public, max-age=5, stale-while-revalidate=30',
        },
      }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

