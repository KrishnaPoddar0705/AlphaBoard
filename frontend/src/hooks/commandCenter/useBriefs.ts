import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { Brief } from '@/lib/commandCenter/types'
import { useCommandCenterSession } from './useCommandCenterSession'
import { ccKeys } from './useCoverage'

const DAILY_SHOWN = 5
/** How long to keep polling after an admin asks for a brief: an LLM call plus TTS. */
const POLL_FOR_MS = 3 * 60_000

const COLUMNS =
  'id, organization_id, kind, brief_date, period_start, period_end, headline, bullets, stats, script, audio_path, audio_seconds, created_at'

/**
 * The last five daily briefs and the latest weekly one, for org admins only.
 *
 * Gated on the role as well as RLS: nobody else can read cc_briefs, so for them the
 * query would only ever come back empty -- better not to make it.
 */
export function useBriefs() {
  const { ready, role, organizationId } = useCommandCenterSession()
  const [polling, setPolling] = useState(false)
  const enabled = ready && role === 'admin' && !!organizationId

  const query = useQuery<{ daily: Brief[]; weekly: Brief | null }>({
    queryKey: [...ccKeys.all, 'briefs', organizationId],
    queryFn: async () => {
      const [daily, weekly] = await Promise.all([
        supabase.from('cc_briefs').select(COLUMNS).eq('organization_id', organizationId!)
          .eq('kind', 'daily').order('brief_date', { ascending: false }).limit(DAILY_SHOWN),
        supabase.from('cc_briefs').select(COLUMNS).eq('organization_id', organizationId!)
          .eq('kind', 'weekly').order('brief_date', { ascending: false }).limit(1),
      ])
      // Missing table (migration not applied yet) reads as "no briefs", not a broken home.
      if (daily.error || weekly.error) return { daily: [], weekly: null }
      return { daily: (daily.data ?? []) as Brief[], weekly: ((weekly.data ?? [])[0] as Brief) ?? null }
    },
    enabled,
    staleTime: 5 * 60_000,
    refetchInterval: polling ? 10_000 : false,
  })

  const generate = useMutation({
    mutationFn: async (kind: 'daily' | 'weekly') => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not signed in yet.')
      try {
        await api.post('/api/command-center/briefs/generate', { kind }, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
      } catch (err) {
        const e = err as { response?: { status?: number; data?: { detail?: string } } }
        if (e.response?.status === 429) throw new Error('Already asked recently. Give it a few minutes.')
        throw new Error(e.response?.data?.detail || 'Could not start the brief.')
      }
    },
    onSuccess: () => {
      setPolling(true)
      setTimeout(() => setPolling(false), POLL_FOR_MS)
    },
  })

  return { ...query, enabled, generate, polling }
}

/** A short-lived signed URL for a brief's audio, made only when it is about to play. */
export function useBriefAudioUrl(path: string | null) {
  return useQuery<string | null>({
    queryKey: [...ccKeys.all, 'brief-audio', path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('cc-briefs').createSignedUrl(path!, 3600)
      if (error) throw new Error('Could not load the audio.')
      return data.signedUrl
    },
    enabled: !!path,
    staleTime: 50 * 60_000,
  })
}
