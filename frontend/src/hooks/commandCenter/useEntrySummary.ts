import { useEffect } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'
import { useCommandCenterSession } from './useCommandCenterSession'
import { ccKeys } from './useCoverage'

/** Mirrors MIN_CHARS in backend/app/takeaway_summary.py: shorter takeaways are already a summary. */
export const SUMMARY_MIN_CHARS = 280

export interface EntrySummary {
  /** null when the takeaways are too short to be worth condensing. */
  bullets: string[] | null
  cached: boolean
}

interface SummaryRow { event_id: string; source_hash: string; bullets: string[] }

const rowKey = (eventId: string) => [...ccKeys.all, 'summary-row', eventId] as const

/** sha256 hex of the trimmed takeaways -- the same key the backend caches under. */
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Cached rows straight from Supabase, under RLS. Any failure (say the read migration is
 * not applied yet) reads as "no cache" so the backend path still works.
 */
async function readRows(eventIds: string[]): Promise<SummaryRow[]> {
  const { data, error } = await supabase
    .from('cc_event_summaries')
    .select('event_id, source_hash, bullets')
    .in('event_id', eventIds)
  return error ? [] : (data as SummaryRow[])
}

function readRow(qc: QueryClient, eventId: string) {
  return qc.fetchQuery({
    queryKey: rowKey(eventId),
    queryFn: async () => (await readRows([eventId]))[0] ?? null,
    staleTime: Infinity,
  })
}

async function generate(eventId: string): Promise<EntrySummary> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not signed in yet.')
  try {
    const res = await api.get<EntrySummary>(`/api/command-center/events/${eventId}/summary`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    return res.data
  } catch (err) {
    const e = err as { response?: { status?: number; data?: { detail?: string } } }
    if (e.response?.status === 429) throw new Error('Too many requests. Give it a moment.')
    // FastAPI's own 404 for a route it does not have: the backend is older than the
    // frontend (deployed separately, on Fly), not a missing entry.
    if (e.response?.status === 404 && e.response.data?.detail === 'Not Found') {
      throw new Error('AI summaries are not live on the server yet.')
    }
    if (!e.response) throw new Error('Could not reach the AlphaBoard server.')
    throw new Error(e.response?.data?.detail || 'The summary could not be generated.')
  }
}

/**
 * Seeds the cached summary of every listed entry in one query, so moving between
 * entries in an open list shows each summary at once instead of a request per click.
 */
export function usePrefetchSummaries(entries: Pick<ActivityFeedRow, 'event_id' | 'kta'>[]) {
  const qc = useQueryClient()
  const { ready } = useCommandCenterSession()
  const ids = entries
    .filter((e) => (e.kta?.trim().length ?? 0) >= SUMMARY_MIN_CHARS)
    .map((e) => e.event_id)
    .filter((id) => qc.getQueryData(rowKey(id)) === undefined)
  const key = ids.join(',')

  useEffect(() => {
    if (!ready || !key) return
    const wanted = key.split(',')
    void readRows(wanted).then((rows) => {
      const byId = new Map(rows.map((r) => [r.event_id, r]))
      for (const id of wanted) qc.setQueryData(rowKey(id), byId.get(id) ?? null)
    })
  }, [ready, key, qc])
}

/**
 * The AI bullet summary of an entry's key takeaways.
 *
 * Cached: one Supabase read (often already seeded by usePrefetchSummaries), matched by
 * hash against the takeaways on screen. Stale or missing: the backend generates it
 * (Claude Haiku, ~2s) and caches it for everyone. Short takeaways never make a call.
 */
export function useEntrySummary(entry: Pick<ActivityFeedRow, 'event_id' | 'kta'>) {
  const qc = useQueryClient()
  const { ready } = useCommandCenterSession()
  const text = entry.kta?.trim() ?? ''
  const eligible = text.length >= SUMMARY_MIN_CHARS

  const query = useQuery<EntrySummary>({
    // The text is in the key, so an edit to the takeaways is a new query.
    queryKey: [...ccKeys.all, 'summary', entry.event_id, text],
    queryFn: async () => {
      const [hash, row] = await Promise.all([sha256(text), readRow(qc, entry.event_id)])
      if (row && row.source_hash === hash) return { bullets: row.bullets, cached: true }
      const fresh = await generate(entry.event_id)
      if (fresh.bullets) qc.setQueryData(rowKey(entry.event_id), { event_id: entry.event_id, source_hash: hash, bullets: fresh.bullets })
      return fresh
    },
    enabled: ready && eligible,
    staleTime: Infinity,
    retry: false,
  })
  return { ...query, eligible }
}
