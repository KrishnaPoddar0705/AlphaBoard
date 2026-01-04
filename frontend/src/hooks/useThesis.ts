/**
 * useThesis Hook
 * 
 * Manages thesis generation, caching, and regeneration.
 * Uses localStorage for client-side caching.
 */

import { useState, useEffect, useCallback } from 'react';
import type { Thesis, ThesisCacheEntry } from '../types/thesis';
import { generateThesis } from '../lib/api';

const CACHE_KEY_PREFIX = 'thesis_cache_';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

function getCacheKey(ticker: string): string {
  return `${CACHE_KEY_PREFIX}${ticker.toUpperCase()}`;
}

function getCachedThesis(ticker: string): ThesisCacheEntry | null {
  try {
    const cacheKey = getCacheKey(ticker);
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const entry: ThesisCacheEntry = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid (30 minutes)
    if (now - entry.timestamp < CACHE_DURATION) {
      return entry;
    }

    // Cache expired, remove it
    localStorage.removeItem(cacheKey);
    return null;
  } catch (error) {
    return null;
  }
}

function setCachedThesis(ticker: string, thesis: Thesis, regeneratedCount: number = 0): void {
  try {
    const cacheKey = getCacheKey(ticker);
    const entry: ThesisCacheEntry = {
      ticker: ticker.toUpperCase(),
      thesis,
      timestamp: Date.now(),
      regenerated_count: regeneratedCount,
    };
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (error) {
  }
}

interface UseThesisReturn {
  thesis: Thesis | null;
  isLoading: boolean;
  error: string | null;
  regenerate: () => Promise<void>;
  clearCache: () => void;
}

export function useThesis(ticker: string | null, analystNotes?: string): UseThesisReturn {
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadThesis = useCallback(async (forceRegenerate: boolean = false) => {
    if (!ticker) {
      setThesis(null);
      return;
    }

    // Check cache first (unless forcing regenerate)
    if (!forceRegenerate) {
      const cached = getCachedThesis(ticker);
      if (cached) {
        setThesis(cached.thesis);
        setError(null);
        return;
      }
    }

    // Generate new thesis
    setIsLoading(true);
    setError(null);

    try {
      const newThesis = await generateThesis(ticker, analystNotes);
      setThesis(newThesis);

      // Cache the thesis
      const cached = getCachedThesis(ticker);
      const regeneratedCount = cached ? cached.regenerated_count + 1 : 0;
      setCachedThesis(ticker, newThesis, regeneratedCount);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to generate thesis';
      setError(errorMessage);

      // If we have cached data, keep it even if regeneration failed
      const cached = getCachedThesis(ticker);
      if (cached) {
        setThesis(cached.thesis);
      }
    } finally {
      setIsLoading(false);
    }
  }, [ticker, analystNotes]);

  const regenerate = useCallback(async () => {
    await loadThesis(true);
  }, [loadThesis]);

  const clearCache = useCallback(() => {
    if (ticker) {
      const cacheKey = getCacheKey(ticker);
      localStorage.removeItem(cacheKey);
      setThesis(null);
    }
  }, [ticker]);

  // Load thesis on mount or when ticker changes
  useEffect(() => {
    loadThesis(false);
  }, [loadThesis]);

  return {
    thesis,
    isLoading,
    error,
    regenerate,
    clearCache,
  };
}

