import { useQuery } from '@tanstack/react-query'
import {
  listActivity, searchEvents, listEventsInRange, listDeskMembers, listActivityCounts,
  type ActivityPage, type DeskMember,
} from '@/lib/commandCenter/api'
import type { ActivityFilters, ActivityFeedRow, EventSearchHit } from '@/lib/commandCenter/types'
import { useCommandCenterSession } from './useCommandCenterSession'
import { ccKeys } from './useCoverage'

function filterKey(f: ActivityFilters, page: number): string {
  return JSON.stringify([f.analystId, f.coverageId, f.kinds, f.brokerId, f.from, f.to, page])
}

export function useActivityFeed(filters: ActivityFilters, page = 0) {
  const { ready } = useCommandCenterSession()
  return useQuery<ActivityPage>({
    queryKey: ccKeys.activity(filterKey(filters, page)),
    queryFn: () => listActivity(filters, page),
    enabled: ready && !filters.search,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  })
}

/**
 * Ranked search over KTA bodies. Separate from useActivityFeed because it goes through
 * the `cc_search_events` RPC -- PostgREST can filter a tsvector but cannot order by
 * relevance or return highlighted snippets, and both are the point of searching.
 */
export function useEventSearch(filters: ActivityFilters) {
  const { ready } = useCommandCenterSession()
  const term = filters.search?.trim() ?? ''
  return useQuery<EventSearchHit[]>({
    queryKey: [...ccKeys.all, 'search', term, filterKey(filters, 0)],
    queryFn: () => searchEvents({ ...filters, search: term }),
    enabled: ready && term.length > 1,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  })
}

/** Everything in a date window -- past entries and scheduled future events alike. */
export function useCalendarEvents(from: string, to: string) {
  const { ready } = useCommandCenterSession()
  return useQuery<ActivityFeedRow[]>({
    queryKey: ccKeys.calendar(from, to),
    queryFn: () => listEventsInRange(from, to),
    enabled: ready,
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  })
}

export function useDeskMembers() {
  const { ready, organizationId, userId } = useCommandCenterSession()
  return useQuery<DeskMember[]>({
    queryKey: [...ccKeys.all, 'members', organizationId ?? 'solo'],
    queryFn: () => listDeskMembers(organizationId, userId!),
    enabled: ready && !!userId,
    staleTime: 5 * 60_000,
  })
}

export function useActivityCounts(from: string, to: string, analystId?: string | null) {
  const { ready } = useCommandCenterSession()
  return useQuery<Array<{ day: string; value: number }>>({
    queryKey: [...ccKeys.all, 'counts', from, to, analystId ?? 'everyone'],
    queryFn: () => listActivityCounts(from, to, analystId),
    enabled: ready,
    staleTime: 60_000,
  })
}
