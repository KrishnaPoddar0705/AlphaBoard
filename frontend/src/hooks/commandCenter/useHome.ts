import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listHomeWindow, listMyTeams, listRoster,
  listComments, listCommentAuthors, addComment, deleteComment,
} from '@/lib/commandCenter/collabApi'
import type {
  ActivityFeedRow, CommentAuthor, EventComment, RosterMember, TeamOption,
} from '@/lib/commandCenter/types'
import { useCommandCenterSession } from './useCommandCenterSession'
import { ccKeys } from './useCoverage'
import { track } from '@/lib/analytics'

const homeKeys = {
  teams: () => [...ccKeys.all, 'home', 'teams'] as const,
  roster: (teamId: string | null) => [...ccKeys.all, 'home', 'roster', teamId ?? 'visible'] as const,
  window: (key: string) => [...ccKeys.all, 'home', 'window', key] as const,
  commentAuthors: (key: string) => [...ccKeys.all, 'comments', 'authors', key] as const,
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

/** Comment authors for a set of entries. Lives under the comments key so a post refreshes it. */
export function useCommentAuthors(eventIds: string[]) {
  const { ready } = useCommandCenterSession()
  const key = useMemo(() => [...eventIds].sort().join(','), [eventIds])
  return useQuery<CommentAuthor[]>({
    queryKey: homeKeys.commentAuthors(key),
    queryFn: () => listCommentAuthors(eventIds),
    enabled: ready && eventIds.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
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
      // The whole comments subtree: this thread, and who has answered which push.
      qc.invalidateQueries({ queryKey: [...ccKeys.all, 'comments'] })
      track('cc_comment_added', {})
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: homeKeys.comments(eventId) })
      qc.invalidateQueries({ queryKey: [...ccKeys.all, 'comments', 'authors'] })
    },
    onError: (err) => toast.error(err.message),
  })
}
