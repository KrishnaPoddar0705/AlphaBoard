/**
 * Price Cache Utility
 * 
 * Caches stock prices in localStorage with a 1-minute TTL.
 * Persists across page reloads and reduces API calls to Yahoo Finance.
 */

const CACHE_KEY = 'stock_price_cache';
const CACHE_TTL = 60 * 1000; // 1 minute in milliseconds

interface PriceCacheEntry {
    price: number;
    timestamp: number;
}

interface PriceCache {
    [ticker: string]: PriceCacheEntry;
}

/**
 * Get the price cache from localStorage
 */
function getCache(): PriceCache {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return {};
        return JSON.parse(cached);
    } catch (error) {
        return {};
    }
}

/**
 * Save the price cache to localStorage
 */
function saveCache(cache: PriceCache): void {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
    }
}

/**
 * Check if a cached price is still valid (less than 1 minute old)
 */
export function isPriceCacheValid(ticker: string): boolean {
    const cache = getCache();
    const entry = cache[ticker];
    if (!entry) return false;
    
    const age = Date.now() - entry.timestamp;
    return age < CACHE_TTL;
}

/**
 * Get cached price for a ticker if it's still valid
 * Returns null if cache is expired or missing
 */
export function getCachedPrice(ticker: string): number | null {
    const cache = getCache();
    const entry = cache[ticker];
    
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age >= CACHE_TTL) {
        // Cache expired, remove it
        delete cache[ticker];
        saveCache(cache);
        return null;
    }
    
    return entry.price;
}

/**
 * Set cached price for a ticker
 */
export function setCachedPrice(ticker: string, price: number): void {
    const cache = getCache();
    cache[ticker] = {
        price,
        timestamp: Date.now(),
    };
    saveCache(cache);
}

/**
 * Get all valid cached prices
 * Returns a map of ticker -> price for all valid entries
 */
export function getAllCachedPrices(): Record<string, number> {
    const cache = getCache();
    const validPrices: Record<string, number> = {};
    const now = Date.now();
    const updatedCache: PriceCache = {};
    
    for (const [ticker, entry] of Object.entries(cache)) {
        const age = now - entry.timestamp;
        if (age < CACHE_TTL) {
            validPrices[ticker] = entry.price;
            updatedCache[ticker] = entry;
        }
    }
    
    // Clean up expired entries
    if (Object.keys(updatedCache).length !== Object.keys(cache).length) {
        saveCache(updatedCache);
    }
    
    return validPrices;
}

/**
 * Clear expired prices from cache
 */
export function clearExpiredPrices(): void {
    const cache = getCache();
    const now = Date.now();
    const validCache: PriceCache = {};
    
    for (const [ticker, entry] of Object.entries(cache)) {
        const age = now - entry.timestamp;
        if (age < CACHE_TTL) {
            validCache[ticker] = entry;
        }
    }
    
    if (Object.keys(validCache).length !== Object.keys(cache).length) {
        saveCache(validCache);
    }
}

/**
 * Clear all cached prices (useful for testing or manual refresh)
 */
export function clearAllPrices(): void {
    try {
        localStorage.removeItem(CACHE_KEY);
    } catch (error) {
    }
}

