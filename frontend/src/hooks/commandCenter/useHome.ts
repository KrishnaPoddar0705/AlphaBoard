import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listHomeWindow, listMyTeams, listRoster, listReviews, setReview, clearReview,
  listComments, addComment, deleteComment,
} from '@/lib/commandCenter/collabApi'
import type {
  ActivityFeedRow, EventComment, EventReview, ReviewVerdict, RosterMember, TeamOption,
} from '@/lib/commandCenter/types'
import { useCommandCenterSession } from './useCommandCenterSession'
import { ccKeys } from './useCoverage'

const homeKeys = {
  teams: () => [...ccKeys.all, 'home', 'teams'] as const,
  roster: (teamId: string | null) => [...ccKeys.all, 'home', 'roster', teamId ?? 'visible'] as const,
  window: (key: string) => [...ccKeys.all, 'home', 'window', key] as const,
  reviews: (key: string) => [...ccKeys.all, 'reviews', key] as const,
  comments: (eventId: string) => [...ccKeys.all, 'comments', eventId] as const,
}

export function useMyTeams() {
  const { ready } = useCommandCenterSession()
  return useQuery<TeamOption[]>({
    queryKey: homeKeys.teams(),
    queryFn: listMyTeams,
    enabled: ready,
    staleTime: 5 * 60_000,
  })
}

/** null data = the home migration is not applied, so there is no team information. */
export function useRoster(teamId: string | null) {
  const { ready } = useCommandCenterSession()
  return useQuery<RosterMember[] | null>({
    queryKey: homeKeys.roster(teamId),
    queryFn: () => listRoster(teamId),
    enabled: ready,
    staleTime: 5 * 60_000,
  })
}

/**
 * The rows the home screen summarises. `userIds` narrows to a team or one person; null
 * means everything the caller's RLS lets them see. Refetches every minute so a desk that
 * leaves the screen open sees new entries arrive.
 */
export function useHomeWindow(userIds: string[] | null, enabled = true) {
  const { ready } = useCommandCenterSession()
  const key = userIds ? [...userIds].sort().join(',') : 'all'
  return useQuery<ActivityFeedRow[]>({
    queryKey: homeKeys.window(key),
    queryFn: () => listHomeWindow({ userIds }),
    enabled: ready && enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  })
}

export function useReviews(eventIds: string[]) {
  const { ready } = useCommandCenterSession()
  const key = useMemo(() => [...eventIds].sort().join(','), [eventIds])
  return useQuery<EventReview[]>({
    queryKey: homeKeys.reviews(key),
    queryFn: () => listReviews(eventIds),
    enabled: ready && eventIds.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
}

export function useSetReview() {
  const qc = useQueryClient()
  const { userId } = useCommandCenterSession()
  return useMutation<void, Error, { eventId: string; verdict: ReviewVerdict | null; note?: string | null }>({
    mutationFn: ({ eventId, verdict, note }) => {
      if (!userId) throw new Error('Not signed in')
      return verdict
        ? setReview({ eventId, reviewerId: userId, verdict, note })
        : clearReview(eventId, userId)
    },
    onSuccess: (_d, { verdict }) => {
      qc.invalidateQueries({ queryKey: [...ccKeys.all, 'reviews'] })
      toast.success(verdict === 'endorse' ? 'Endorsed' : verdict === 'reject' ? 'Rejected' : 'Review withdrawn')
    },
    onError: (err) => toast.error(err.message),
  })
}

export function useComments(eventId: string, enabled = true) {
  const { ready } = useCommandCenterSession()
  return useQuery<EventComment[]>({
    queryKey: homeKeys.comments(eventId),
    queryFn: () => listComments(eventId),
    enabled: ready && enabled,
    staleTime: 15_000,
  })
}

export function useAddComment(eventId: string) {
  const qc = useQueryClient()
  const { userId } = useCommandCenterSession()
  return useMutation<void, Error, string>({
    mutationFn: (body) => {
      if (!userId) throw new Error('Not signed in')
      return addComment(eventId, userId, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: homeKeys.comments(eventId) })
      // comment_count lives on the feed rows.
      qc.invalidateQueries({ queryKey: [...ccKeys.all, 'home'] })
      qc.invalidateQueries({ queryKey: [...ccKeys.all, 'events'] })
      qc.invalidateQueries({ queryKey: [...ccKeys.all, 'activity'] })
    },
    onError: (err) => toast.error(err.message),
  })
}

export function useDeleteComment(eventId: string) {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: deleteComment,
    onSuccess: () => qc.invalidateQueries({ queryKey: homeKeys.comments(eventId) }),
    onError: (err) => toast.error(err.message),
  })
}
