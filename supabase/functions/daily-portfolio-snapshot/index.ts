// Edge Function: daily-portfolio-snapshot
// Purpose: Create end-of-day NAV snapshots for all portfolios
// Should be called daily after market close (via pg_cron or external scheduler)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface Position {
  id: string
  portfolio_id: string
  symbol: string
  quantity: number
  avg_cost: number
  realized_pnl: number
}

interface Portfolio {
  id: string
  user_id: string
  market: string
  base_currency: string
  cash_balance: number
  initial_capital: number
}

interface PriceCache {
  [symbol: string]: number | null
}

// Fetch price for a symbol using Yahoo Finance API
async function fetchPrice(symbol: string): Promise<number | null> {
  try {
    // Use Yahoo Finance API (via a proxy or direct call)
    // For Supabase Edge Functions, we need to fetch externally
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    )

    if (!response.ok) {
      console.log(`[snapshot] Failed to fetch price for ${symbol}: ${response.status}`)
      return null
    }

    const data = await response.json()
    const result = data?.chart?.result?.[0]
    
    if (!result) {
      console.log(`[snapshot] No data for ${symbol}`)
      return null
    }

    // Try to get the latest close price
    const quote = result.meta
    const regularMarketPrice = quote?.regularMarketPrice
    
    if (regularMarketPrice && regularMarketPrice > 0) {
      return regularMarketPrice
    }

    // Fallback to previous close
    const previousClose = quote?.chartPreviousClose || quote?.previousClose
    if (previousClose && previousClose > 0) {
      return previousClose
    }

    return null
  } catch (error) {
    console.error(`[snapshot] Error fetching price for ${symbol}:`, error)
    return null
  }
}

// Batch fetch prices for multiple symbols
async function fetchPricesForSymbols(symbols: string[]): Promise<PriceCache> {
  const priceCache: PriceCache = {}
  
  // Fetch in parallel with concurrency limit
  const batchSize = 10
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(async (symbol) => {
        const price = await fetchPrice(symbol)
        return { symbol, price }
      })
    )
    
    for (const { symbol, price } of results) {
      priceCache[symbol] = price
    }
  }
  
  return priceCache
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  const startTime = Date.now()
  console.log('[snapshot] Starting daily portfolio snapshot job')

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

    // Get all portfolios
    const { data: portfolios, error: portfolioError } = await supabaseClient
      .from('portfolios')
      .select('*')

    if (portfolioError) {
      console.error('[snapshot] Error fetching portfolios:', portfolioError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch portfolios', details: portfolioError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!portfolios || portfolios.length === 0) {
      console.log('[snapshot] No portfolios found')
      return new Response(
        JSON.stringify({ success: true, message: 'No portfolios to process', snapshots_created: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[snapshot] Found ${portfolios.length} portfolios`)

    // Get all positions across all portfolios
    const { data: positions, error: positionsError } = await supabaseClient
      .from('portfolio_positions')
      .select('*')
      .gt('quantity', 0)

    if (positionsError) {
      console.error('[snapshot] Error fetching positions:', positionsError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch positions', details: positionsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get unique symbols
    const uniqueSymbols = [...new Set((positions || []).map(p => p.symbol))]
    console.log(`[snapshot] Fetching prices for ${uniqueSymbols.length} unique symbols`)

    // Fetch all prices
    const priceCache = await fetchPricesForSymbols(uniqueSymbols)
    console.log(`[snapshot] Fetched ${Object.keys(priceCache).filter(k => priceCache[k] !== null).length} prices`)

    // Create snapshots for each portfolio
    const snapshotDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const snapshots: any[] = []
    const errors: string[] = []

    for (const portfolio of portfolios as Portfolio[]) {
      try {
        const portfolioPositions = (positions || []).filter(
          (p: Position) => p.portfolio_id === portfolio.id
        )

        let positionsValue = 0
        let unrealizedPnl = 0
        let realizedPnl = 0

        for (const pos of portfolioPositions as Position[]) {
          const quantity = Number(pos.quantity)
          const avgCost = Number(pos.avg_cost)
          realizedPnl += Number(pos.realized_pnl || 0)

          // Get current price from cache
          const currentPrice = priceCache[pos.symbol]
          
          if (currentPrice && currentPrice > 0) {
            positionsValue += quantity * currentPrice
            unrealizedPnl += quantity * (currentPrice - avgCost)
          } else {
            // Fallback to avg_cost if no price available
            positionsValue += quantity * avgCost
            console.log(`[snapshot] No price for ${pos.symbol}, using avg_cost`)
          }
        }

        const cashBalance = Number(portfolio.cash_balance)
        const nav = cashBalance + positionsValue

        // Upsert snapshot
        const { error: upsertError } = await supabaseClient
          .from('portfolio_daily_snapshots')
          .upsert({
            portfolio_id: portfolio.id,
            snapshot_date: snapshotDate,
            cash_balance: cashBalance,
            positions_value: positionsValue,
            nav: nav,
            realized_pnl_to_date: realizedPnl,
            unrealized_pnl: unrealizedPnl,
          }, {
            onConflict: 'portfolio_id,snapshot_date'
          })

        if (upsertError) {
          console.error(`[snapshot] Error creating snapshot for portfolio ${portfolio.id}:`, upsertError)
          errors.push(`Portfolio ${portfolio.id}: ${upsertError.message}`)
        } else {
          snapshots.push({
            portfolio_id: portfolio.id,
            market: portfolio.market,
            nav: nav,
            positions_value: positionsValue,
            cash_balance: cashBalance,
          })
        }
      } catch (portfolioError) {
        console.error(`[snapshot] Error processing portfolio ${portfolio.id}:`, portfolioError)
        errors.push(`Portfolio ${portfolio.id}: ${portfolioError instanceof Error ? portfolioError.message : String(portfolioError)}`)
      }
    }

    const duration = Date.now() - startTime
    console.log(`[snapshot] Completed in ${duration}ms. Created ${snapshots.length} snapshots, ${errors.length} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        date: snapshotDate,
        snapshots_created: snapshots.length,
        errors_count: errors.length,
        errors: errors.length > 0 ? errors : undefined,
        duration_ms: duration,
        snapshots: snapshots,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[snapshot] Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
