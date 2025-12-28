/**
 * Portfolio Returns Calculation Utilities
 * 
 * Functions to calculate period-specific returns and cumulative returns
 * for portfolio performance tracking.
 */

/**
 * Get price at a specific date for a stock
 * 
 * @param ticker - Stock ticker symbol
 * @param date - Target date
 * @param rec - Recommendation object with price data
 * @param historicalData - Optional historical price data array
 * @returns Price at the specified date, or null if not available
 */
export function getPriceAtDate(
    _ticker: string,
    date: Date,
    rec: any,
    historicalData?: Array<{ date: string; close: number }>
): number | null {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    // If date is today, use current_price
    if (isToday && rec.current_price) {
        return rec.current_price;
    }

    // If stock was closed and exit_date is before or on target date, use exit_price
    if (rec.status === 'CLOSED' && rec.exit_date) {
        const exitDate = new Date(rec.exit_date);
        if (exitDate <= date && rec.exit_price) {
            return rec.exit_price;
        }
    }

    // If we have historical data, find closest price
    if (historicalData && historicalData.length > 0) {
        // Sort by date
        const sorted = [...historicalData].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Find closest date (before or on target date)
        let closestPrice = null;
        for (const point of sorted) {
            const pointDate = new Date(point.date);
            if (pointDate <= date) {
                closestPrice = point.close;
            } else {
                break;
            }
        }

        if (closestPrice) {
            return closestPrice;
        }
    }

    // Fallback: if stock was added before or on this date, use entry_price as proxy
    // This is not ideal but practical when historical data is not available
    const entryDate = new Date(rec.entry_date);
    if (entryDate <= date && rec.entry_price) {
        return rec.entry_price;
    }

    return null;
}

/**
 * Calculate period return for a single stock
 * 
 * @param rec - Recommendation object
 * @param periodStart - Start of the period
 * @param periodEnd - End of the period
 * @param historicalData - Optional historical price data
 * @returns Period return as percentage, or null if cannot calculate
 */
export function calculatePeriodReturn(
    rec: any,
    periodStart: Date,
    periodEnd: Date,
    historicalData?: Array<{ date: string; close: number }>
): number | null {
    const entryDate = new Date(rec.entry_date);
    const exitDate = rec.exit_date ? new Date(rec.exit_date) : null;

    // Determine start price
    let startPrice: number | null;
    if (entryDate < periodStart) {
        // Stock was added before period start - need price at period start
        startPrice = getPriceAtDate(rec.ticker, periodStart, rec, historicalData);
    } else {
        // Stock was added during period - use entry price
        startPrice = rec.entry_price || null;
    }

    // Determine end price
    let endPrice: number | null;
    if (exitDate && exitDate <= periodEnd) {
        // Stock was closed during or before period end - use exit price
        endPrice = rec.exit_price || null;
    } else {
        // Stock is still active or closed after period - need price at period end
        endPrice = getPriceAtDate(rec.ticker, periodEnd, rec, historicalData);
    }

    // Calculate return
    if (!startPrice || !endPrice || startPrice <= 0) {
        return null;
    }

    const periodReturn = ((endPrice - startPrice) / startPrice) * 100;

    // Apply action (BUY/SELL) - SELL positions have inverted returns
    if (rec.action === 'SELL') {
        return -periodReturn;
    }

    return periodReturn;
}

/**
 * Calculate daily return for a single stock
 * 
 * @param rec - Recommendation object
 * @param date - Target date
 * @param previousDate - Previous date (for calculating daily change)
 * @param historicalData - Optional historical price data
 * @returns Daily return as percentage, or null if cannot calculate
 */
export function calculateDailyReturn(
    rec: any,
    date: Date,
    previousDate: Date,
    historicalData?: Array<{ date: string; close: number }>
): number | null {
    const entryDate = new Date(rec.entry_date);
    const exitDate = rec.exit_date ? new Date(rec.exit_date) : null;

    // Stock must have been added before or on the date
    if (entryDate > date) {
        return null;
    }

    // Stock must still be active (not closed before the date)
    if (exitDate && exitDate < date) {
        return null;
    }

    // Get prices for previous date and current date
    const previousPrice = getPriceAtDate(rec.ticker, previousDate, rec, historicalData);
    const currentPrice = getPriceAtDate(rec.ticker, date, rec, historicalData);

    if (!previousPrice || !currentPrice || previousPrice <= 0) {
        return null;
    }

    const dailyReturn = ((currentPrice - previousPrice) / previousPrice) * 100;

    // Apply action (BUY/SELL) - SELL positions have inverted returns
    if (rec.action === 'SELL') {
        return -dailyReturn;
    }

    return dailyReturn;
}

/**
 * Calculate cumulative returns from period returns
 * Uses (1 + return).cumprod() formula
 * 
 * @param periodReturns - Array of period returns as percentages
 * @returns Array of cumulative returns as percentages
 */
export function calculateCumulativeReturns(periodReturns: number[]): number[] {
    let cumulative = 1.0;
    const cumulativeReturns: number[] = [];

    for (const periodReturn of periodReturns) {
        // Convert percentage to decimal
        const returnDecimal = periodReturn / 100;
        // Multiply cumulative by (1 + return)
        cumulative *= (1 + returnDecimal);
        // Convert back to percentage
        cumulativeReturns.push((cumulative - 1) * 100);
    }

    return cumulativeReturns;
}

