// Market Data API Client
// Purpose: Lazy-load market data (quotes + sparklines) for specific tickers

import { supabase } from '../supabase'

export type MarketDataItem = {
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

export type MarketDataResponse = {
  data: Record<string, MarketDataItem>
}

/**
 * Fetch market data for specific tickers
 */
export async function getMarketDataForTickers(
  tickers: string[],
  region: 'USA' | 'India' = 'USA'
): Promise<Record<string, MarketDataItem>> {
  // Map 'India' to 'India' for the API (region is already correct)
  const apiRegion = region === 'India' ? 'India' : 'USA'
  if (tickers.length === 0) {
    return {}
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not set')
  }

  // Get auth token for Edge Function
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  const url = `${supabaseUrl}/functions/v1/market-data-batch?region=${apiRegion}&tickers=${tickers.join(',')}`
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  const data: MarketDataResponse = await response.json()
  return data.data || {}
}

