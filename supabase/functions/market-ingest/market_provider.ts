// Market Provider Abstraction
// Purpose: Abstract market data fetching to allow provider swapping

export interface Quote {
  symbol: string
  price: number
  change: number
  changePercent: number
  currency: string
  asOf: Date
}

export interface Sparkline {
  symbol: string
  ts: number[]
  close: number[]
  asOf: Date
}

const YAHOO_FINANCE_API = 'https://query1.finance.yahoo.com/v8/finance/chart'

// Fetch quotes for multiple symbols
export async function fetchQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const resultMap = new Map<string, Quote>()
  
  // Yahoo Finance doesn't support batch quotes easily, so we fetch individually
  // But we'll do it in parallel with concurrency limit
  const BATCH_SIZE = 50
  const CONCURRENCY_LIMIT = 5
  
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE)
    
    // Process batch with concurrency limit
    const promises: Promise<void>[] = []
    for (let j = 0; j < batch.length; j += CONCURRENCY_LIMIT) {
      const concurrentBatch = batch.slice(j, j + CONCURRENCY_LIMIT)
      const batchPromises = concurrentBatch.map(async (symbol) => {
        try {
          const quote = await fetchSingleQuote(symbol)
          if (quote) {
            resultMap.set(symbol, quote)
          }
        } catch (error) {
          console.error(`Failed to fetch quote for ${symbol}:`, error)
        }
      })
      promises.push(...batchPromises)
      // Wait for this batch before starting next
      await Promise.all(batchPromises)
    }
  }
  
  return resultMap
}

// Fetch single quote
async function fetchSingleQuote(symbol: string): Promise<Quote | null> {
  try {
    const url = `${YAHOO_FINANCE_API}/${symbol}?interval=1m&range=1d`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Symbol ${symbol} not found`)
        return null
      }
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    const result = data.chart?.result?.[0]
    if (!result) {
      return null
    }
    
    const meta = result.meta
    const regularMarketPrice = meta.regularMarketPrice
    const previousClose = meta.previousClose || regularMarketPrice
    
    if (!regularMarketPrice) {
      return null
    }
    
    const change = regularMarketPrice - previousClose
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0
    
    return {
      symbol,
      price: regularMarketPrice,
      change,
      changePercent,
      currency: meta.currency || 'USD',
      asOf: new Date(meta.regularMarketTime * 1000),
    }
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error)
    return null
  }
}

// Fetch 7D sparklines for multiple symbols
export async function fetchSpark7d(symbols: string[]): Promise<Map<string, Sparkline>> {
  const resultMap = new Map<string, Sparkline>()
  
  const BATCH_SIZE = 50
  const CONCURRENCY_LIMIT = 5
  
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE)
    
    const promises: Promise<void>[] = []
    for (let j = 0; j < batch.length; j += CONCURRENCY_LIMIT) {
      const concurrentBatch = batch.slice(j, j + CONCURRENCY_LIMIT)
      const batchPromises = concurrentBatch.map(async (symbol) => {
        try {
          const sparkline = await fetchSingleSparkline(symbol)
          if (sparkline) {
            resultMap.set(symbol, sparkline)
          }
        } catch (error) {
          console.error(`Failed to fetch sparkline for ${symbol}:`, error)
        }
      })
      promises.push(...batchPromises)
      await Promise.all(batchPromises)
    }
  }
  
  return resultMap
}

// Fetch single 7D sparkline
async function fetchSingleSparkline(symbol: string): Promise<Sparkline | null> {
  try {
    // Fetch 7 days of daily data
    const endDate = Math.floor(Date.now() / 1000)
    const startDate = endDate - (7 * 24 * 60 * 60) // 7 days ago
    
    const url = `${YAHOO_FINANCE_API}/${symbol}?period1=${startDate}&period2=${endDate}&interval=1d`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    const result = data.chart?.result?.[0]
    if (!result) {
      return null
    }
    
    const timestamps = result.timestamp || []
    const quotes = result.indicators?.quote?.[0]
    if (!quotes?.close) {
      return null
    }
    
    // Extract valid closes (filter nulls)
    const validData: { ts: number, close: number }[] = []
    for (let i = 0; i < timestamps.length; i++) {
      const close = quotes.close[i]
      if (close !== null && close !== undefined && close > 0) {
        validData.push({
          ts: timestamps[i],
          close: close
        })
      }
    }
    
    // Ensure we have at least some data
    if (validData.length === 0) {
      return null
    }
    
    // Take last 7 points (or all if less than 7)
    const last7 = validData.slice(-7)
    
    return {
      symbol,
      ts: last7.map(d => d.ts),
      close: last7.map(d => d.close),
      asOf: new Date(),
    }
  } catch (error) {
    console.error(`Error fetching sparkline for ${symbol}:`, error)
    return null
  }
}

