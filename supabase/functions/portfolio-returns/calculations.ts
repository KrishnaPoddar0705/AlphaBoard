// Calculation utilities for portfolio-returns Edge Function

export interface PriceData {
  dates: number[]
  prices: number[]
}

// Calculate portfolio returns
export function calculateReturns(
  weightsMap: Map<string, number>,
  priceDataMap: Map<string, PriceData>,
  days: number
): number {
  const tickers = Array.from(weightsMap.keys())
  const minLength = Math.min(...tickers.map(t => priceDataMap.get(t)?.prices.length || 0))
  
  if (minLength < days) return 0
  
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

// Calculate volatility
export function calculateVolatility(
  weightsMap: Map<string, number>,
  priceDataMap: Map<string, PriceData>,
  days?: number
): number {
  const tickers = Array.from(weightsMap.keys())
  const minLength = Math.min(...tickers.map(t => priceDataMap.get(t)?.prices.length || 0))
  const periodLength = days ? Math.min(days, minLength) : minLength
  
  if (periodLength < 2) return 0
  
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
        dailyPortfolioReturn += weight * ((currPrice - prevPrice) / prevPrice)
      }
    }
    dailyReturns.push(dailyPortfolioReturn)
  }
  
  if (dailyReturns.length < 2) return 0
  
  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / dailyReturns.length
  return Math.sqrt(variance) * Math.sqrt(252)
}

// Calculate Sharpe
export function calculateSharpe(annualReturn: number, volatility: number): number {
  if (volatility === 0) return 0
  return (annualReturn - 0.05) / volatility
}

// Calculate drawdown
export function calculateMaxDrawdown(
  weightsMap: Map<string, number>,
  priceDataMap: Map<string, PriceData>,
  days?: number
): number {
  const tickers = Array.from(weightsMap.keys())
  const minLength = Math.min(...tickers.map(t => priceDataMap.get(t)?.prices.length || 0))
  const periodLength = days ? Math.min(days, minLength) : minLength
  
  if (periodLength < 2) return 0
  
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
        dailyReturn += weight * ((currPrice - prevPrice) / prevPrice)
      }
    }
    portfolioValues.push(portfolioValues[portfolioValues.length - 1] * (1 + dailyReturn))
  }
  
  let maxDrawdown = 0
  let peak = portfolioValues[0]
  
  for (const value of portfolioValues) {
    if (value > peak) peak = value
    const drawdown = (peak - value) / peak
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }
  
  return maxDrawdown
}

// Generate equity curve
export function generateEquityCurve(
  weightsMap: Map<string, number>,
  priceDataMap: Map<string, PriceData>,
  days?: number
): Array<{ date: string; value: number }> {
  const tickers = Array.from(weightsMap.keys())
  const firstTicker = tickers[0]
  const dates = priceDataMap.get(firstTicker)!.dates
  const minLength = Math.min(...tickers.map(t => priceDataMap.get(t)?.prices.length || 0))
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
        dailyReturn += weight * ((currPrice - prevPrice) / prevPrice)
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
