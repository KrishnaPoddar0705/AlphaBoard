/**
 * Returns Cache Utility
 * 
 * Caches calculated stock returns in localStorage with a 1-minute TTL.
 * Uses ticker + entryPrice as the cache key to handle same ticker with different entry prices.
 */

import { getCachedPrice } from './priceCache';

const CACHE_KEY = 'stock_returns_cache';
const CACHE_TTL = 60 * 1000; // 1 minute in milliseconds

interface ReturnsCacheEntry {
    return: number;
    timestamp: number;
}

interface ReturnsCache {
    [key: string]: ReturnsCacheEntry;
}

/**
 * Generate cache key from ticker and entry price
 */
function getCacheKey(ticker: string, entryPrice: number): string {
    return `${ticker}_${entryPrice.toFixed(2)}`;
}

/**
 * Get the returns cache from localStorage
 */
function getCache(): ReturnsCache {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return {};
        return JSON.parse(cached);
    } catch (error) {
        return {};
    }
}

/**
 * Save the returns cache to localStorage
 */
function saveCache(cache: ReturnsCache): void {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
    }
}

/**
 * Calculate return percentage from entry price and current price
 */
export function calculateReturn(
    entryPrice: number,
    currentPrice: number,
    action: 'BUY' | 'SELL' = 'BUY'
): number {
    if (entryPrice <= 0) return 0;
    
    const returnValue = ((currentPrice - entryPrice) / entryPrice) * 100;
    return action === 'SELL' ? -returnValue : returnValue;
}

/**
 * Get cached return for a ticker and entry price if it's still valid
 * Returns null if cache is expired or missing
 */
export function getCachedReturn(ticker: string, entryPrice: number): number | null {
    const cache = getCache();
    const key = getCacheKey(ticker, entryPrice);
    const entry = cache[key];
    
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age >= CACHE_TTL) {
        // Cache expired, remove it
        delete cache[key];
        saveCache(cache);
        return null;
    }
    
    return entry.return;
}

/**
 * Set cached return for a ticker and entry price
 */
export function setCachedReturn(ticker: string, entryPrice: number, returnValue: number): void {
    const cache = getCache();
    const key = getCacheKey(ticker, entryPrice);
    cache[key] = {
        return: returnValue,
        timestamp: Date.now(),
    };
    saveCache(cache);
}

/**
 * Get return from cache or calculate it
 * 
 * This is the main function to use - it will:
 * 1. If currentPrice is provided and valid, always calculate (don't trust cache)
 * 2. If currentPrice not available, check cache
 * 3. If cache valid, return cached value
 * 4. If cache invalid/missing, try to get from price cache
 * 5. Update cache with calculated value
 */
export function getReturnFromCacheOrCalculate(
    ticker: string,
    entryPrice: number,
    currentPrice: number | null | undefined,
    action: 'BUY' | 'SELL' = 'BUY'
): number {
    // If we have a valid currentPrice, always calculate (prioritize fresh data)
    if (currentPrice !== null && currentPrice !== undefined && currentPrice > 0 && entryPrice > 0) {
        const returnValue = calculateReturn(entryPrice, currentPrice, action);
        // Cache the calculated return
        setCachedReturn(ticker, entryPrice, returnValue);
        return returnValue;
    }
    
    // No currentPrice available - check cache
    const cachedReturn = getCachedReturn(ticker, entryPrice);
    if (cachedReturn !== null) {
        return cachedReturn;
    }
    
    // Cache miss or expired - try to get from price cache
    const cachedPrice = getCachedPrice(ticker);
    if (cachedPrice !== null && cachedPrice > 0 && entryPrice > 0) {
        const returnValue = calculateReturn(entryPrice, cachedPrice, action);
        // Cache the calculated return
        setCachedReturn(ticker, entryPrice, returnValue);
        return returnValue;
    }
    
    // No price available at all, return 0 (but don't cache it)
    return 0;
}

/**
 * Clear expired returns from cache
 */
export function clearExpiredReturns(): void {
    const cache = getCache();
    const now = Date.now();
    const validCache: ReturnsCache = {};
    
    for (const [key, entry] of Object.entries(cache)) {
        const age = now - entry.timestamp;
        if (age < CACHE_TTL) {
            validCache[key] = entry;
        }
    }
    
    if (Object.keys(validCache).length !== Object.keys(cache).length) {
        saveCache(validCache);
    }
}

/**
 * Clear all cached returns (useful for testing or manual refresh)
 */
export function clearAllReturns(): void {
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch (error) {
    }
}

