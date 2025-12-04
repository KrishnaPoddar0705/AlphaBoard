// Edge Function: portfolio-returns
// Purpose: Calculate real-time portfolio performance metrics
// NO CACHING - Always compute fresh

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const YAHOO_FINANCE_API = 'https://query1.finance.yahoo.com/v8/finance/chart'
const MIN_REQUIRED_DAYS = 250 // Minimum trading days required (1 year = ~252 trading days)

interface PortfolioReturnsRequest {
  userId: string;
  period?: '1M' | '3M' | '6M' | '12M';
}

interface PriceData {
  dates: number[];
  prices: number[];
}

// Fetch historical prices for MULTIPLE tickers in ONE batch call
async function fetchBatchPriceHistory(tickers: string[], days: number): Promise<Map<string, PriceData>> {
  const resultMap = new Map<string, PriceData>()
  
  // CRITICAL: Calculate date range going BACKWARDS from TODAY
  // Current date should be December 1, 2025
  const endDate = new Date() // Get current system date
  endDate.setHours(23, 59, 59, 999) // End of today
  
  const startDate = new Date(endDate)
  
  // Go back exactly 1 year from today
  if (days >= 365) {
    // For 1 year: Go back exactly 365 days
    startDate.setFullYear(endDate.getFullYear() - 1)
    startDate.setHours(0, 0, 0, 0) // Start of day 1 year ago
  } else {
    // For shorter periods, calculate calendar days with buffer
    const calendarDaysNeeded = Math.ceil(days * 1.5) // 1.5x buffer for weekends/holidays
    startDate.setDate(endDate.getDate() - calendarDaysNeeded)
    startDate.setHours(0, 0, 0, 0)
  }
  
  const period1 = Math.floor(startDate.getTime() / 1000)
  const period2 = Math.floor(endDate.getTime() / 1000)
  
  // VALIDATE: Ensure we're not getting future dates
  const now = Date.now()
  if (period2 > now / 1000 + 86400) { // Allow 1 day tolerance
    console.error('ERROR: End date is in the future!')
    console.error(`period2: ${new Date(period2 * 1000).toISOString()}`)
    console.error(`now: ${new Date(now).toISOString()}`)
  }
  
  // Log exact dates being requested
  console.log(`\n=== DATE CALCULATION ===`)
  console.log(`System time: ${new Date().toISOString()}`)
  console.log(`END date: ${endDate.toISOString()} (${endDate.toISOString().split('T')[0]})`)
  console.log(`START date: ${startDate.toISOString()} (${startDate.toISOString().split('T')[0]})`)
  console.log(`Unix timestamps:`)
  console.log(`  period1 = ${period1} → ${new Date(period1 * 1000).toISOString().split('T')[0]}`)
  console.log(`  period2 = ${period2} → ${new Date(period2 * 1000).toISOString().split('T')[0]}`)
  console.log(`Days span: ${Math.floor((period2 - period1) / 86400)} calendar days`)
  console.log(`========================\n`)
  
  console.log(`\n=== BATCH FETCH ===`)
  console.log(`Tickers: ${tickers.join(', ')}`)
  console.log(`Requesting ${days} trading days`)
  console.log(`EXPLICIT Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`)
  console.log(`This should be PAST data, not future!`)
  console.log(`==================\n`)
  
  // Fetch each ticker individually (Yahoo's batch API is unreliable for multiple stocks)
  // Add timeout to prevent hanging
  const fetchWithTimeout = async (url: string, timeoutMs: number = 10000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };
  
  for (const ticker of tickers) {
    try {
      const url = `${YAHOO_FINANCE_API}/${ticker}?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false`
      
      console.log(`[${ticker}] Fetching...`)
      
      const response = await fetchWithTimeout(url, 10000)
      
      if (!response.ok) {
        console.error(`[${ticker}] HTTP ${response.status}`)
        
        // Skip this ticker if error
        if (response.status === 404) {
          console.warn(`[${ticker}] ⚠️ Not found - SKIPPING`)
        } else if (response.status === 429) {
          console.warn(`[${ticker}] ⚠️ Rate limited - waiting 2s`)
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue // Try again
        }
        
        await new Promise(resolve => setTimeout(resolve, 200))
        continue
      }
      
      const data = await response.json()
      
      if (!data.chart?.result?.[0]) {
        console.warn(`[${ticker}] ⚠️ No data - SKIPPING`)
        continue
      }
      
      const result = data.chart.result[0]
      const timestamps = result.timestamp || []
      const quotes = result.indicators?.quote?.[0]
      
      if (!quotes?.close) {
        console.warn(`[${ticker}] ⚠️ No price quotes - SKIPPING`)
        continue
      }
      
      // Extract valid prices
      const validData: { date: number; price: number }[] = []
      for (let i = 0; i < timestamps.length; i++) {
        const price = quotes.close[i]
        if (price !== null && price !== undefined && price > 0) {
          validData.push({ date: timestamps[i], price })
        }
      }
      
      // Check if we have enough data (at least 250 trading days for 1 year)
      if (validData.length < MIN_REQUIRED_DAYS) {
        const firstDate = validData.length > 0 ? new Date(validData[0].date * 1000).toISOString().split('T')[0] : 'N/A'
        const lastDate = validData.length > 0 ? new Date(validData[validData.length - 1].date * 1000).toISOString().split('T')[0] : 'N/A'
        
        console.warn(`[${ticker}] ⚠️ INSUFFICIENT DATA - SKIPPING`)
        console.warn(`[${ticker}]   - Got: ${validData.length} days`)
        console.warn(`[${ticker}]   - Required: ${MIN_REQUIRED_DAYS} days`)
        console.warn(`[${ticker}]   - Range: ${firstDate} to ${lastDate}`)
        console.warn(`[${ticker}]   - Stock is too new or has data gaps`)
        continue
      }
      
      // Success - add to results
      const firstDate = new Date(validData[0].date * 1000).toISOString().split('T')[0]
      const lastDate = new Date(validData[validData.length - 1].date * 1000).toISOString().split('T')[0]
      
      console.log(`[${ticker}] ✓ SUCCESS: ${validData.length} days from ${firstDate} to ${lastDate}`)
      
      resultMap.set(ticker, {
        dates: validData.map(d => d.date),
        prices: validData.map(d => d.price)
      })
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150))
      
    } catch (error) {
      console.error(`[${ticker}] ✗ ERROR:`, error.message)
      // Skip this ticker and continue with others
    }
  }
  
  console.log(`\n=== FETCH COMPLETE ===`)
  console.log(`Succeeded: ${resultMap.size}/${tickers.length} tickers`)
  console.log(`Skipped: ${tickers.length - resultMap.size} tickers (insufficient data)`)
  console.log(`======================\n`)
  
  return resultMap
}

// Calculate portfolio returns for a given period
function calculateReturns(
  weightsMap: Map<string, number>,
  priceDataMap: Map<string, PriceData>,
  days: number
): number {
  const tickers = Array.from(weightsMap.keys())
  
  // Get the minimum data length across all tickers
  const minLength = Math.min(...tickers.map(t => priceDataMap.get(t)?.prices.length || 0))
  
  if (minLength < days) {
    return 0 // Not enough data
  }
  
  // Calculate portfolio return
  let portfolioReturn = 0
  
  for (const ticker of tickers) {
    const weight = weightsMap.get(ticker)! / 100.0
    const prices = priceDataMap.get(ticker)!.prices
    
    const startPrice = prices[prices.length - days]
    const endPrice = prices[prices.length - 1]
    
    if (startPrice && endPrice && startPrice > 0) {
      const tickerReturn = (endPrice - startPrice) / startPrice
      portfolioReturn += weight * tickerReturn
    }
  }
  
  return portfolioReturn
}

// Calculate portfolio volatility for a specific period
function calculateVolatility(
  weightsMap: Map<string, number>,
  priceDataMap: Map<string, PriceData>,
  days?: number
): number {
  const tickers = Array.from(weightsMap.keys())
  const minLength = Math.min(...tickers.map(t => priceDataMap.get(t)?.prices.length || 0))
  
  // Use specified days or full period
  const periodLength = days ? Math.min(days, minLength) : minLength
  
  if (periodLength < 2) return 0
  
  // Calculate daily portfolio returns for the period
  const dailyReturns: number[] = []
  const startIdx = minLength - periodLength
  
  for (let i = startIdx + 1; i < minLength; i++) {
    let dailyPortfolioReturn = 0
    
    for (const ticker of tickers) {
      const weight = weightsMap.get(ticker)! / 100.0
      const prices = priceDataMap.get(ticker)!.prices
      
      const prevPrice = prices[i - 1]
      const currPrice = prices[i]
      
      if (prevPrice && currPrice && prevPrice > 0) {
        const dailyReturn = (currPrice - prevPrice) / prevPrice
        dailyPortfolioReturn += weight * dailyReturn
      }
    }
    
    dailyReturns.push(dailyPortfolioReturn)
  }
  
  if (dailyReturns.length < 2) return 0
  
  // Calculate standard deviation
  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / dailyReturns.length
  const stdDev = Math.sqrt(variance)
  
  // Annualize volatility
  return stdDev * Math.sqrt(252)
}

// Calculate Sharpe ratio
function calculateSharpe(annualReturn: number, volatility: number, riskFreeRate: number = 0.05): number {
  if (volatility === 0) return 0
  return (annualReturn - riskFreeRate) / volatility
}

// Calculate maximum drawdown for a specific period
function calculateMaxDrawdown(
  weightsMap: Map<string, number>,
  priceDataMap: Map<string, PriceData>,
  days?: number
): number {
  const tickers = Array.from(weightsMap.keys())
  const minLength = Math.min(...tickers.map(t => priceDataMap.get(t)?.prices.length || 0))
  
  // Use specified days or full period
  const periodLength = days ? Math.min(days, minLength) : minLength
  
  if (periodLength < 2) return 0
  
  // Calculate portfolio value over time for the period (starting at 100)
  const portfolioValues: number[] = [100]
  const startIdx = minLength - periodLength
  
  for (let i = startIdx + 1; i < minLength; i++) {
    let dailyReturn = 0
    
    for (const ticker of tickers) {
      const weight = weightsMap.get(ticker)! / 100.0
      const prices = priceDataMap.get(ticker)!.prices
      
      const prevPrice = prices[i - 1]
      const currPrice = prices[i]
      
      if (prevPrice && currPrice && prevPrice > 0) {
        dailyReturn += weight * (currPrice - prevPrice) / prevPrice
      }
    }
    
    portfolioValues.push(portfolioValues[portfolioValues.length - 1] * (1 + dailyReturn))
  }
  
  // Calculate max drawdown
  let maxDrawdown = 0
  let peak = portfolioValues[0]
  
  for (const value of portfolioValues) {
    if (value > peak) {
      peak = value
    }
    const drawdown = (peak - value) / peak
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  }
  
  return maxDrawdown
}

// Generate equity curve for a specific period
function generateEquityCurve(
  weightsMap: Map<string, number>,
  priceDataMap: Map<string, PriceData>,
  days?: number
): Array<{ date: string; value: number }> {
  const tickers = Array.from(weightsMap.keys())
  
  // Get common dates
  const firstTicker = tickers[0]
  const dates = priceDataMap.get(firstTicker)!.dates
  const minLength = Math.min(...tickers.map(t => priceDataMap.get(t)?.prices.length || 0))
  
  // Use specified days or full period
  const periodLength = days ? Math.min(days, minLength) : minLength
  const startIdx = minLength - periodLength
  
  const equityCurve: Array<{ date: string; value: number }> = []
  let portfolioValue = 1.0
  
  equityCurve.push({
    date: new Date(dates[startIdx] * 1000).toISOString().split('T')[0],
    value: portfolioValue
  })
  
  for (let i = startIdx + 1; i < minLength; i++) {
    let dailyReturn = 0
    
    for (const ticker of tickers) {
      const weight = weightsMap.get(ticker)! / 100.0
      const prices = priceDataMap.get(ticker)!.prices
      
      const prevPrice = prices[i - 1]
      const currPrice = prices[i]
      
      if (prevPrice && currPrice && prevPrice > 0) {
        dailyReturn += weight * (currPrice - prevPrice) / prevPrice
      }
    }
    
    portfolioValue *= (1 + dailyReturn)
    
    equityCurve.push({
      date: new Date(dates[i] * 1000).toISOString().split('T')[0],
      value: portfolioValue
    })
  }
  
  return equityCurve
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    let requestBody: PortfolioReturnsRequest
    try {
      requestBody = await req.json()
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { userId, period = '12M' } = requestBody

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Map period to days
    const periodDays = {
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '12M': 365
    }[period] || 365

    // Fetch weights from database
    const { data: weights, error: weightsError } = await supabaseClient
      .from('analyst_portfolio_weights')
      .select('ticker, weight_pct')
      .eq('user_id', userId)

    if (weightsError || !weights || weights.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No portfolio weights found for user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create weights map
    const weightsMap = new Map<string, number>()
    for (const w of weights) {
      weightsMap.set(w.ticker, w.weight_pct)
    }

    const tickers = Array.from(weightsMap.keys())
    console.log(`\n=========================================`)
    console.log(`PORTFOLIO RETURNS CALCULATION`)
    console.log(`=========================================`)
    console.log(`Tickers in portfolio: ${tickers.length}`)
    console.log(`Tickers: ${tickers.join(', ')}`)
    console.log(`Selected period: ${period} (${periodDays} trading days)`)
    console.log(`Current date: ${new Date().toISOString().split('T')[0]}`)
    console.log(`Target: 1 year back (365 trading days = ~510 calendar days)`)
    console.log(`=========================================\n`)

    // Fetch price history using batch API (all tickers in one call)
    const priceDataMap = await fetchBatchPriceHistory(tickers, 365)
    
    if (priceDataMap.size === 0) {
      throw new Error('No tickers have sufficient historical data (need 1 year)')
    }
    
    // Get list of tickers that have sufficient data
    const validTickers = Array.from(priceDataMap.keys())
    const skippedTickers = tickers.filter(t => !priceDataMap.has(t))
    
    console.log(`\n=== DATA VALIDATION ===`)
    console.log(`Valid tickers (${validTickers.length}): ${validTickers.join(', ')}`)
    if (skippedTickers.length > 0) {
      console.log(`Skipped tickers (${skippedTickers.length}): ${skippedTickers.join(', ')}`)
      console.log(`Reason: Insufficient historical data (< ${MIN_REQUIRED_DAYS} trading days)`)
    }
    
    // REBALANCE WEIGHTS - Only use tickers with sufficient data
    // Redistribute weights proportionally among valid tickers
    const adjustedWeightsMap = new Map<string, number>()
    let totalOriginalWeight = 0
    
    for (const ticker of validTickers) {
      const originalWeight = weightsMap.get(ticker) || 0
      totalOriginalWeight += originalWeight
    }
    
    if (totalOriginalWeight === 0) {
      throw new Error('All tickers with data have 0% weight. Cannot calculate performance.')
    }
    
    // Redistribute to sum to 100%
    for (const ticker of validTickers) {
      const originalWeight = weightsMap.get(ticker) || 0
      const adjustedWeight = (originalWeight / totalOriginalWeight) * 100
      adjustedWeightsMap.set(ticker, adjustedWeight)
    }
    
    console.log(`\n=== ADJUSTED WEIGHTS ===`)
    for (const ticker of validTickers) {
      const original = weightsMap.get(ticker) || 0
      const adjusted = adjustedWeightsMap.get(ticker) || 0
      console.log(`[${ticker}] ${original.toFixed(2)}% → ${adjusted.toFixed(2)}%`)
    }
    const totalAdjusted = Array.from(adjustedWeightsMap.values()).reduce((sum, w) => sum + w, 0)
    console.log(`Total adjusted weight: ${totalAdjusted.toFixed(2)}%`)
    console.log(`========================\n`)
    
    // Check data availability
    const dataLengths = Array.from(priceDataMap.values()).map(d => d.prices.length)
    const minLength = Math.min(...dataLengths)
    const maxLength = Math.max(...dataLengths)
    
    console.log(`=== PRICE DATA SUMMARY ===`)
    console.log(`Data points: min=${minLength}, max=${maxLength}`)
    console.log(`Period requested: ${periodDays} days`)
    console.log(`Data sufficient: ${minLength >= periodDays ? 'YES ✓' : 'NO ✗'}`)
    console.log(`==========================\n`)

    // Calculate returns for different periods using ADJUSTED weights
    const returns = {
      '1M': calculateReturns(adjustedWeightsMap, priceDataMap, 30),
      '3M': calculateReturns(adjustedWeightsMap, priceDataMap, 90),
      '6M': calculateReturns(adjustedWeightsMap, priceDataMap, 180),
      '12M': calculateReturns(adjustedWeightsMap, priceDataMap, 365),
    }

    console.log(`=== CALCULATED RETURNS ===`)
    console.log(`1M: ${(returns['1M'] * 100).toFixed(2)}%`)
    console.log(`3M: ${(returns['3M'] * 100).toFixed(2)}%`)
    console.log(`6M: ${(returns['6M'] * 100).toFixed(2)}%`)
    console.log(`12M: ${(returns['12M'] * 100).toFixed(2)}%`)
    console.log(`==========================\n`)

    // Calculate metrics for the SELECTED period only using ADJUSTED weights
    const periodReturn = returns[period]
    const volatility = calculateVolatility(adjustedWeightsMap, priceDataMap, periodDays)
    const sharpe = calculateSharpe(periodReturn, volatility)
    const drawdown = calculateMaxDrawdown(adjustedWeightsMap, priceDataMap, periodDays)

    // Generate equity curve for the SELECTED period only using ADJUSTED weights
    const equityCurve = generateEquityCurve(adjustedWeightsMap, priceDataMap, periodDays)
    
    console.log(`=== FINAL METRICS (${period}) ===`)
    console.log(`Return: ${(periodReturn * 100).toFixed(2)}%`)
    console.log(`Volatility: ${(volatility * 100).toFixed(2)}%`)
    console.log(`Sharpe: ${sharpe.toFixed(2)}`)
    console.log(`Drawdown: ${(drawdown * 100).toFixed(2)}%`)
    console.log(`Equity curve points: ${equityCurve.length}`)
    console.log(`==============================\n`)

    return new Response(
      JSON.stringify({
        returns,
        volatility,
        sharpe,
        drawdown,
        equityCurve,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in portfolio-returns:', error)
    console.error('Error stack:', error.stack)
    console.error('Error name:', error.name)
    
    // Return proper error structure
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        details: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

