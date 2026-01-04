// Edge Function: market-ingest
// Purpose: Scheduled function to fetch market data from Yahoo Finance and cache in Postgres
// Runs every 30 minutes via Supabase cron

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { fetchQuotes, fetchSpark7d } from './market_provider.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface IngestRequest {
  region?: string
  force?: boolean
  tickers?: string[] // Optional: specific tickers to fetch (for on-demand fetching)
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    // Get service role key
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not set')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
    )

    // Parse request body (optional)
    let region = 'USA'
    let specificTickers: string[] | undefined = undefined
    try {
      const body = await req.json().catch(() => ({}))
      region = body.region || 'USA'
      specificTickers = body.tickers // Optional: specific tickers to fetch
    } catch {
      // No body, use default
    }

    // If specific tickers are provided, use only those (for on-demand fetching)
    let tickers: string[] = []
    let marketStocksCount = 0
    let communityTickersCount = 0
    
    if (specificTickers && Array.isArray(specificTickers) && specificTickers.length > 0) {
      // On-demand fetch for specific tickers
      tickers = specificTickers.filter(t => t && typeof t === 'string').map(t => t.trim().toUpperCase())
      console.log(`[market-ingest] On-demand ingestion for ${tickers.length} specific tickers:`, tickers)
    } else {
      // Scheduled fetch: get all market stocks + community tickers
      console.log(`[market-ingest] Scheduled ingestion for region: ${region}`)

      // Market stock lists
      const SP500_STOCKS = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'V', 'JNJ',
        'WMT', 'UNH', 'MA', 'PG', 'JPM', 'HD', 'DIS', 'BAC', 'VZ', 'ADBE',
        'NFLX', 'CMCSA', 'NKE', 'MRK', 'PFE', 'T', 'INTC', 'CSCO', 'XOM', 'CVX',
        'ABBV', 'COST', 'PEP', 'AVGO', 'TMO', 'WFC', 'ABT', 'ACN', 'MCD', 'NEE',
        'DHR', 'LIN', 'BMY', 'PM', 'HON', 'RTX', 'LOW', 'UPS', 'QCOM',
        'AMGN', 'TXN', 'SPGI', 'INTU', 'C', 'SBUX', 'BLK', 'GS', 'AXP', 'ADP',
        'BKNG', 'DE', 'CAT', 'GE', 'MMC', 'TJX', 'ZTS', 'MDT', 'GILD', 'CI',
        'ISRG', 'SYK', 'CME', 'REGN', 'MO', 'SHW', 'APH', 'KLAC', 'CDNS', 'SNPS',
        'FTNT', 'ANSS', 'MCHP', 'SWKS', 'QRVO', 'CRWD', 'ZS', 'NET', 'DOCN', 'ESTC',
        'MDB', 'DDOG', 'SPLK', 'OKTA', 'VRSN', 'TEAM', 'ZM', 'COUP', 'NOW', 'WDAY',
        'VEEV', 'PLTR', 'SNOW', 'COIN', 'MSTR', 'RBLX', 'SOFI', 'HOOD', 'AFRM', 'UPST', 'OPEN', 'WISH'
      ]

      const NIFTY50_STOCKS = [
        'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'HINDUNILVR.NS',
        'ICICIBANK.NS', 'BHARTIARTL.NS', 'SBIN.NS', 'BAJFINANCE.NS', 'LICI.NS',
        'ITC.NS', 'LT.NS', 'HCLTECH.NS', 'AXISBANK.NS', 'MARUTI.NS',
        'SUNPHARMA.NS', 'ONGC.NS', 'NTPC.NS', 'NESTLEIND.NS', 'ULTRACEMCO.NS',
        'TITAN.NS', 'WIPRO.NS', 'POWERGRID.NS', 'TATAMOTORS.NS', 'ADANIENT.NS',
        'JSWSTEEL.NS', 'ADANIPORTS.NS', 'COALINDIA.NS', 'TECHM.NS', 'HDFCLIFE.NS',
        'GRASIM.NS', 'DIVISLAB.NS', 'M&M.NS', 'BAJAJFINSV.NS', 'CIPLA.NS',
        'TATASTEEL.NS', 'APOLLOHOSP.NS', 'SBILIFE.NS', 'BRITANNIA.NS', 'EICHERMOT.NS',
        'HEROMOTOCO.NS', 'DRREDDY.NS', 'BPCL.NS', 'INDUSINDBK.NS', 'HINDALCO.NS',
        'VEDL.NS', 'GODREJCP.NS', 'DABUR.NS', 'MARICO.NS', 'PIDILITIND.NS'
      ]

      // Get all market stocks for the region
      const marketStocks = region === 'USA' ? SP500_STOCKS : NIFTY50_STOCKS
      marketStocksCount = marketStocks.length

      // Also get tickers from community_ticker_stats (stocks with activity)
      let communityTickers: string[] = []
      try {
        const { data: tickerStats, error: statsError } = await supabaseClient
          .from('community_ticker_stats')
          .select('ticker, region')
          .eq('region', region)

        if (!statsError && tickerStats) {
          communityTickers = tickerStats.map(ts => ts.ticker)
        }
      } catch (error) {
        console.warn('Error fetching community ticker stats:', error)
        // Continue with just market stocks
      }
      communityTickersCount = communityTickers.length

      // Combine market stocks with community tickers (deduplicate)
      const allTickersSet = new Set([...marketStocks, ...communityTickers])
      tickers = Array.from(allTickersSet)
    }

    if (tickers.length === 0) {
      console.log(`[market-ingest] No tickers found for region ${region}`)
      return new Response(
        JSON.stringify({ message: 'No tickers to ingest', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[market-ingest] Found ${tickers.length} tickers to ingest${marketStocksCount > 0 ? ` (${marketStocksCount} market + ${communityTickersCount} community)` : ''}`)

    // Circuit breaker state
    let errorCount = 0
    const ERROR_THRESHOLD = 0.1 // 10% error rate
    const maxErrors = Math.ceil(tickers.length * ERROR_THRESHOLD)

    // Fetch quotes
    console.log(`[market-ingest] Fetching quotes...`)
    const quotesMap = await fetchQuotes(tickers)
    console.log(`[market-ingest] Fetched ${quotesMap.size} quotes`)

    // Upsert quotes into market_quotes
    const quoteInserts = Array.from(quotesMap.values()).map(quote => ({
      symbol: quote.symbol,
      region: region,
      price: quote.price,
      change: quote.change,
      change_percent: quote.changePercent,
      currency: quote.currency,
      as_of: quote.asOf.toISOString(),
      updated_at: new Date().toISOString(),
    }))

    if (quoteInserts.length > 0) {
      const { error: quoteError } = await supabaseClient
        .from('market_quotes')
        .upsert(quoteInserts, {
          onConflict: 'symbol,region',
        })

      if (quoteError) {
        console.error('Error upserting quotes:', quoteError)
        errorCount++
      } else {
        console.log(`[market-ingest] Upserted ${quoteInserts.length} quotes`)
      }
    }

    // Fetch sparklines
    console.log(`[market-ingest] Fetching sparklines...`)
    const sparklinesMap = await fetchSpark7d(tickers)
    console.log(`[market-ingest] Fetched ${sparklinesMap.size} sparklines`)

    // Upsert sparklines into market_sparklines
    const sparklineInserts = Array.from(sparklinesMap.values()).map(sparkline => ({
      symbol: sparkline.symbol,
      region: region,
      period: '7d',
      interval: '1d',
      ts: sparkline.ts,
      close: sparkline.close,
      as_of: sparkline.asOf.toISOString(),
      updated_at: new Date().toISOString(),
    }))

    if (sparklineInserts.length > 0) {
      const { error: sparklineError } = await supabaseClient
        .from('market_sparklines')
        .upsert(sparklineInserts, {
          onConflict: 'symbol,region,period,interval',
        })

      if (sparklineError) {
        console.error('Error upserting sparklines:', sparklineError)
        errorCount++
      } else {
        console.log(`[market-ingest] Upserted ${sparklineInserts.length} sparklines`)
      }
    }

    // Seed community_ticker_stats for stocks that don't have entries yet
    // This ensures all stocks appear in the feed even without community activity
    const tickersWithData = Array.from(new Set([
      ...Array.from(quotesMap.keys()),
      ...Array.from(sparklinesMap.keys()),
    ]))

    if (tickersWithData.length > 0) {
      const statsInserts = tickersWithData.map(ticker => ({
        ticker,
        region,
        threads_count: 0,
        comments_count: 0,
        score: 0,
        last_activity_at: null,
        updated_at: new Date().toISOString(),
      }))

      const { error: statsError } = await supabaseClient
        .from('community_ticker_stats')
        .upsert(statsInserts, {
          onConflict: 'ticker,region',
          ignoreDuplicates: false, // Update existing
        })

      if (statsError) {
        console.warn('Error seeding ticker stats:', statsError)
      } else {
        console.log(`[market-ingest] Seeded ${statsInserts.length} ticker stats entries`)
      }
    }

    // Check circuit breaker
    if (errorCount > maxErrors) {
      console.error(`[market-ingest] Circuit breaker triggered: ${errorCount} errors (threshold: ${maxErrors})`)
      return new Response(
        JSON.stringify({ 
          error: 'Circuit breaker triggered', 
          errorCount,
          threshold: maxErrors,
          message: 'Too many errors, stopping ingestion'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const summary = {
      region,
      tickersProcessed: tickers.length,
      quotesFetched: quotesMap.size,
      sparklinesFetched: sparklinesMap.size,
      quotesUpserted: quoteInserts.length,
      sparklinesUpserted: sparklineInserts.length,
      tickerStatsSeeded: tickersWithData.length,
      errors: errorCount,
      timestamp: new Date().toISOString(),
    }

    console.log(`[market-ingest] Completed:`, summary)

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[market-ingest] Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

