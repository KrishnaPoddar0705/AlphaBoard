import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get currency symbol based on ticker
 * @param ticker - Stock ticker symbol
 * @returns '$' for USA stocks, '₹' for India stocks (.NS or .BO)
 */
export function getCurrencySymbol(ticker?: string): string {
  if (!ticker) return '$'
  if (ticker.includes('.NS') || ticker.includes('.BO')) {
    return '₹'
  }
  return '$'
}

/**
 * Format currency value with appropriate symbol
 * @param value - Numeric value to format
 * @param ticker - Stock ticker symbol (optional, for currency detection)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "$123.45" or "₹123.45"
 */
export function formatCurrency(value: number | undefined | null, ticker?: string, decimals: number = 2): string {
  if (value === undefined || value === null) return 'N/A'
  const symbol = getCurrencySymbol(ticker)
  return `${symbol}${value.toFixed(decimals)}`
}
