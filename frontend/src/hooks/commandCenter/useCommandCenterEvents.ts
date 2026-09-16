import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listEventsForCoverage, createEvent, updateEvent, deleteEvent,
  listAttachmentsForEvents, listEventContactIds, setEventContacts, listEventContacts,
  type EventContactTag,
  type CreateEventInput,
} from '@/lib/commandCenter/api'
import type {
  ActivityFeedRow, CommandCenterEvent, EventAttachment,
} from '@/lib/commandCenter/types'
import { useCommandCenterSession } from './useCommandCenterSession'
import { ccKeys, NO_SESSION_MESSAGE } from './useCoverage'

export function useCoverageEvents(coverageId: string | undefined) {
  const { ready } = useCommandCenterSession()
  return useQuery<ActivityFeedRow[]>({
    queryKey: ccKeys.events(coverageId ?? ''),
    queryFn: () => listEventsForCoverage(coverageId!),
    enabled: ready && !!coverageId,
    staleTime: 15_000,
  })
}

/** Attachments for a page of timeline entries, fetched in one round trip. */
export function useEventAttachments(eventIds: string[]) {
  const { ready } = useCommandCenterSession()
  const key = eventIds.slice().sort().join(',')
  return useQuery<EventAttachment[]>({
    queryKey: [...ccKeys.all, 'attachments', key],
    queryFn: () => listAttachmentsForEvents(eventIds),
    enabled: ready && eventIds.length > 0,
    staleTime: 30_000,
  })
}

/**
 * Names of the people met, keyed by entry. Only entries with a non-zero contact_count
 * are asked for, so a page with nobody tagged costs nothing.
 */
export function useEventContacts(rows: Array<{ event_id: string; contact_count?: number }>) {
  const { ready } = useCommandCenterSession()
  const ids = rows.filter((r) => (r.contact_count ?? 0) > 0).map((r) => r.event_id)
  const key = [...ids].sort().join(',')
  const query = useQuery<EventContactTag[]>({
    queryKey: [...ccKeys.all, 'event-contacts', key],
    queryFn: () => listEventContacts(ids),
    enabled: ready && ids.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
  const byEvent = new Map<string, EventContactTag['contact'][]>()
  for (const t of query.data ?? []) byEvent.set(t.event_id, [...(byEvent.get(t.event_id) ?? []), t.contact])
  return { byEvent, loading: ids.length > 0 && query.isPending }
}

export function useEventContactIds(eventId: string | undefined) {
  const { ready } = useCommandCenterSession()
  return useQuery<string[]>({
    queryKey: [...ccKeys.all, 'event-contacts', eventId ?? ''],
    queryFn: () => listEventContactIds(eventId!),
    enabled: ready && !!eventId,
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  const { authenticated } = useCommandCenterSession()
  return useMutation<CommandCenterEvent, Error, CreateEventInput>({
    // See useAddCoverage: without an access token the write goes out as `anon` and
    // comes back as a permission error that blames the database.
    mutationFn: (input: CreateEventInput) => {
      if (!authenticated) throw new Error(NO_SESSION_MESSAGE)
      return createEvent(input)
    },
    onSuccess: () => {
      // Prefix invalidation: the board's health numbers, the stock timeline, the
      // calendar and the org activity feed all move when one entry lands.
      qc.invalidateQueries({ queryKey: ccKeys.all })
    },
    onError: (err) => {
      toast.error(err.message)
      // A failure after the insert (tagging, file rows) still leaves a saved entry;
      // refresh so it shows on the timeline rather than looking lost.
      qc.invalidateQueries({ queryKey: ccKeys.all })
    },
  })
}

export function useUpdateEvent() {
  const qc = useQueryClient()
  return useMutation<
    CommandCenterEvent, Error,
    { id: string; patch: Partial<CommandCenterEvent>; contactIds?: string[] }
  >({
    mutationFn: async ({ id, patch, contactIds }) => {
      const row = await updateEvent(id, patch)
      if (contactIds) await setEventContacts(id, contactIds)
      return row
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ccKeys.all }),
    onError: (err) => toast.error(err.message),
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: deleteEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ccKeys.all })
      toast.success('Entry deleted')
    },
    onError: (err) => toast.error(err.message),
  })
}
