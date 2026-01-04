// TanStack Query hook for community feed
// Purpose: Infinite query with cursor pagination

import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCommunityFeed } from '@/lib/api/communityFeed'
import type { FeedItem } from '@/lib/api/communityFeed'

export interface UseCommunityFeedOptions {
  region?: 'USA' | 'India'
  sort?: 'mostVoted' | 'mostComments' | 'recent'
  limit?: number
  enabled?: boolean
}

export interface UseCommunityFeedResult {
  items: FeedItem[]
  fetchNextPage: () => void
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook for fetching community feed with infinite scroll
 */
export function useCommunityFeed(
  options: UseCommunityFeedOptions = {}
): UseCommunityFeedResult {
  const {
    region = 'USA',
    sort = 'mostVoted',
    limit = 30,
    enabled = true,
  } = options

  // Track if Supabase session is ready
  const [sessionReady, setSessionReady] = useState(false)

  // Wait for Supabase session to be initialized
  useEffect(() => {
    let mounted = true

    const checkSession = async () => {
      try {
        // Wait for session to be ready (with timeout)
        await supabase.auth.getSession()
        if (mounted) {
          setSessionReady(true)
        }
      } catch (error) {
        // Even if there's an error, allow the query to proceed (anonymous access)
        if (mounted) {
          setSessionReady(true)
        }
      }
    }

    // Small delay to allow Supabase to initialize
    const timeout = setTimeout(checkSession, 100)
    
    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (mounted) {
        setSessionReady(true)
      }
    })

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const query = useInfiniteQuery<{
    items: FeedItem[]
    nextCursor: string | null
    serverTs: number
  }, Error>({
    queryKey: ['community-feed', region, sort, limit],
    queryFn: async ({ pageParam = null }) => {
      try {
        const response = await getCommunityFeed({
          region,
          sort,
          limit,
          cursor: pageParam as string | null,
        })
        return response
      } catch (error) {
        if (error instanceof Error && error.message === 'NOT_MODIFIED') {
          // Return cached data from previous page
          // This is a simplified handling - in production you'd want to cache the response
          throw error
        }
        throw error
      }
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 10 * 1000, // 10 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
    enabled: enabled && sessionReady, // Wait for session to be ready
    retry: (failureCount, error) => {
      // Retry 401 errors once (auth might not be ready yet)
      if (error instanceof Error && error.message.includes('HTTP 401')) {
        return failureCount < 1 // Retry once for 401
      }
      // Don't retry other 4xx errors
      if (error instanceof Error && error.message.includes('HTTP 4')) {
        return false
      }
      return failureCount < 2
    },
  })

  // Flatten all pages into a single array
  const items: FeedItem[] = query.data?.pages.flatMap(page => page.items) || []

  return {
    items,
    fetchNextPage: () => query.fetchNextPage(),
    hasNextPage: query.hasNextPage ?? false,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: () => query.refetch(),
  }
}

