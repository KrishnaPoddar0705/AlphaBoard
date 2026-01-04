// Edge Function: market-data-batch
// Purpose: Fetch market data (quotes + sparklines) for specific tickers
// Used for lazy-loading market data on scroll

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

interface MarketDataItem {
  ticker: string
  price: number | null
  change: number | null
  change_percent: number | null
  currency: string | null
  spark_ts: number[] | null
  spark_close: number[] | null
  quote_updated_at: string | null
  spark_updated_at: string | null
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
    )

    // Parse request body or query params
    const url = new URL(req.url)
    const region = url.searchParams.get('region') || 'USA'
    const tickersParam = url.searchParams.get('tickers')
    
    let tickers: string[] = []
    if (tickersParam) {
      tickers = tickersParam.split(',').filter(t => t.trim())
    } else if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      tickers = body.tickers || []
    }

    if (!tickers || tickers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No tickers provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Limit batch size to prevent abuse
    if (tickers.length > 100) {
      tickers = tickers.slice(0, 100)
    }

    // Fetch market data for tickers
    const { data, error } = await supabaseClient.rpc('get_market_data_for_tickers', {
      _tickers: tickers,
      _region: region,
    })

    if (error) {
      console.error('RPC error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch market data', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert to map for easy lookup
    const marketDataMap: Record<string, MarketDataItem> = {}
    if (data && Array.isArray(data)) {
      for (const item of data) {
        if (item && item.ticker) {
          const ticker = item.ticker.toUpperCase() // Normalize ticker to uppercase
          marketDataMap[ticker] = {
            ticker: ticker,
            price: item.price ?? null,
            change: item.change ?? null,
            change_percent: item.change_percent ?? null,
            currency: item.currency ?? null,
            spark_ts: item.spark_ts ?? null,
            spark_close: item.spark_close ?? null,
            quote_updated_at: item.quote_updated_at ?? null,
            spark_updated_at: item.spark_updated_at ?? null,
          }
        }
      }
    }

    // Always return a response, even if empty (to prevent retries)
    console.log(`[market-data-batch] Returning data for ${Object.keys(marketDataMap).length} tickers out of ${tickers.length} requested`)
    console.log(`[market-data-batch] Tickers in response:`, Object.keys(marketDataMap))
    console.log(`[market-data-batch] Requested tickers:`, tickers)

    return new Response(
      JSON.stringify({ data: marketDataMap }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
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

