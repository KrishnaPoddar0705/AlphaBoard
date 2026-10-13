import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listCoverageBoard, getCoverageByTicker, addCoverage, updateCoverage, archiveCoverage,
  type NewCoverage,
} from '@/lib/commandCenter/api'
import type { Coverage, CoverageBoardRow } from '@/lib/commandCenter/types'
import { useCommandCenterSession } from './useCommandCenterSession'
import { track } from '@/lib/analytics'

/**
 * Shown when supabase-js has no access token. Names the cause, because the underlying
 * 401 ("permission denied for table cc_coverage") points at the database and the
 * database is fine.
 */
export const NO_SESSION_MESSAGE =
  'Not signed in to the database yet -- reload the page. If it keeps happening, sign out and back in to refresh your Supabase session.'

/** Query keys are prefix-invalidated, matching the convention in useCommunityFeed. */
export const ccKeys = {
  all: ['command-center'] as const,
  board: () => [...ccKeys.all, 'board'] as const,
  coverage: (ticker: string) => [...ccKeys.all, 'coverage', ticker] as const,
  events: (coverageId: string) => [...ccKeys.all, 'events', coverageId] as const,
  contacts: (coverageId: string) => [...ccKeys.all, 'contacts', coverageId] as const,
  brokers: () => [...ccKeys.all, 'brokers'] as const,
  activity: (key: string) => [...ccKeys.all, 'activity', key] as const,
  calendar: (from: string, to: string) => [...ccKeys.all, 'calendar', from, to] as const,
}

export function useCoverageBoard() {
  const { ready } = useCommandCenterSession()
  return useQuery<CoverageBoardRow[]>({
    queryKey: ccKeys.board(),
    queryFn: listCoverageBoard,
    enabled: ready,
    staleTime: 30_000,
  })
}

export function useCoverage(ticker: string | undefined) {
  const { ready } = useCommandCenterSession()
  return useQuery<CoverageBoardRow | null>({
    queryKey: ccKeys.coverage(ticker ?? ''),
    queryFn: () => getCoverageByTicker(ticker!),
    enabled: ready && !!ticker,
    staleTime: 30_000,
  })
}

export function useAddCoverage() {
  const qc = useQueryClient()
  const { authenticated } = useCommandCenterSession()
  return useMutation<Coverage, Error, NewCoverage>({
    // Guarded on the ACCESS TOKEN, not on a session object: without one the request
    // goes out as `anon`, which this feature revokes, and the 401 that comes back reads
    // like a broken migration. Checking here turns that into a sentence the reader can
    // act on. Reads gate the same way through their `enabled` flag.
    mutationFn: (input: NewCoverage) => {
      if (!authenticated) throw new Error(NO_SESSION_MESSAGE)
      return addCoverage(input)
    },
    onSuccess: (row, input) => {
      qc.invalidateQueries({ queryKey: ccKeys.all })
      toast.success(`${row.ticker} added to coverage`)
      track('cc_coverage_added', { ticker: row.ticker, sector: input.sector })
    },
    onError: (err) => toast.error(err.message),
  })
}

export function useUpdateCoverage() {
  const qc = useQueryClient()
  const { authenticated } = useCommandCenterSession()
  return useMutation<Coverage, Error, { id: string; patch: Partial<Coverage> }>({
    mutationFn: ({ id, patch }) => {
      if (!authenticated) throw new Error(NO_SESSION_MESSAGE)
      return updateCoverage(id, patch)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ccKeys.all }),
    onError: (err) => toast.error(err.message),
  })
}

export function useArchiveCoverage() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: archiveCoverage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ccKeys.all })
      toast.success('Removed from coverage')
      track('cc_coverage_archived', {})
    },
    onError: (err) => toast.error(err.message),
  })
}
