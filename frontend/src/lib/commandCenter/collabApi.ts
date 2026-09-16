import { supabase } from '@/lib/supabase'
import { describeCcError } from './api'
import { addDays, today } from './format'
import type {
  ActivityFeedRow, EventComment, EventReview, ReviewVerdict, RosterMember, TeamOption,
} from './types'

/**
 * Reads and writes for the Command Center home: the team lens, PM reviews and comments.
 * Everything here is backed by database/migration_command_center_home.sql, and like
 * api.ts it talks to Supabase with the caller's JWT -- RLS decides who sees and who may
 * endorse. The UI only hides controls that would be refused.
 */

interface ErrorLike { message: string; code?: string }

/**
 * True when the home migration has not been applied yet: the table or function is
 * missing from PostgREST's schema cache. The home screen still works from the existing
 * views in that case; only reviews, comments and the team lens go quiet.
 */
export function isNotInstalled(error: ErrorLike | null): boolean {
  if (!error) return false
  return ['PGRST205', 'PGRST202', '42P01', '42883'].includes(error.code ?? '') ||
    /schema cache|does not exist/i.test(error.message ?? '')
}

// ---------------------------------------------------------------------------
// Home window
// ---------------------------------------------------------------------------

export interface HomeWindowOptions {
  /** Restrict to entries logged by or for these people. Omit for everything visible. */
  userIds?: string[] | null
  /** How far back to read logged work, in days. */
  lookbackDays?: number
  /** How far ahead to read scheduled events, in days. */
  aheadDays?: number
}

/**
 * Everything the home screen summarises, in one read: recent logged work (by date OR by
 * when it was entered, so a late write-up of last month's meeting still counts as news)
 * and scheduled events ahead.
 */
export async function listHomeWindow({
  userIds, lookbackDays = 35, aheadDays = 30,
}: HomeWindowOptions = {}): Promise<ActivityFeedRow[]> {
  const from = addDays(today(), -lookbackDays)
  const to = addDays(today(), aheadDays)
  const enteredSince = new Date(Date.now() - lookbackDays * 86_400_000).toISOString()

  let q = supabase
    .from('cc_activity_feed')
    .select('*')
    .or(`event_date.gte.${from},created_at.gte.${enteredSince}`)
    .lte('event_date', to)
    .order('created_at', { ascending: false })
    .limit(1500)

  if (userIds) {
    if (userIds.length === 0) return []
    const list = userIds.join(',')
    q = q.or(`analyst_id.in.(${list}),created_by.in.(${list})`)
  }

  const { data, error } = await q
  if (error) throw describeCcError(error, 'Could not load the desk')
  return (data ?? []) as ActivityFeedRow[]
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export async function listMyTeams(): Promise<TeamOption[]> {
  const { data, error } = await supabase.rpc('cc_my_teams')
  if (isNotInstalled(error)) return []
  if (error) throw describeCcError(error, 'Could not load teams')
  return (data ?? []) as TeamOption[]
}

/** The people whose work the caller can see, optionally narrowed to one team. */
export async function listRoster(teamId?: string | null): Promise<RosterMember[] | null> {
  const { data, error } = await supabase.rpc('cc_team_roster', { p_team_id: teamId ?? null })
  // null, not [], so callers can tell "migration missing" from "nobody on the team".
  if (isNotInstalled(error)) return null
  if (error) throw describeCcError(error, 'Could not load the team')
  return ((data ?? []) as RosterMember[]).map((m) => ({ ...m, team_ids: m.team_ids ?? [] }))
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

type ReviewRow = Omit<EventReview, 'reviewer_username'> & {
  profiles: { username: string | null } | null
}

export async function listReviews(eventIds: string[]): Promise<EventReview[]> {
  if (eventIds.length === 0) return []
  const out: EventReview[] = []
  // Chunked: a long `in.(...)` list overflows the URL PostgREST receives.
  for (let i = 0; i < eventIds.length; i += 150) {
    const { data, error } = await supabase
      .from('cc_event_reviews')
      .select('id, event_id, reviewer_id, verdict, note, created_at, updated_at, profiles:reviewer_id(username)')
      .in('event_id', eventIds.slice(i, i + 150))
    if (isNotInstalled(error)) return []
    if (error) throw describeCcError(error, 'Could not load reviews')
    for (const r of (data ?? []) as unknown as ReviewRow[]) {
      const { profiles, ...rest } = r
      out.push({ ...rest, reviewer_username: profiles?.username ?? null })
    }
  }
  return out
}

export async function setReview(input: {
  eventId: string
  reviewerId: string
  verdict: ReviewVerdict
  note?: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('cc_event_reviews')
    .upsert(
      {
        event_id: input.eventId,
        reviewer_id: input.reviewerId,
        verdict: input.verdict,
        note: input.note?.trim() || null,
      },
      { onConflict: 'event_id,reviewer_id' }
    )
  if (error) throw describeCcError(error, 'Could not save your review')
}

export async function clearReview(eventId: string, reviewerId: string): Promise<void> {
  const { error } = await supabase
    .from('cc_event_reviews')
    .delete()
    .eq('event_id', eventId)
    .eq('reviewer_id', reviewerId)
  if (error) throw describeCcError(error, 'Could not withdraw your review')
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

type CommentRow = Omit<EventComment, 'author_username'> & {
  profiles: { username: string | null } | null
}

export async function listComments(eventId: string): Promise<EventComment[]> {
  const { data, error } = await supabase
    .from('cc_event_comments')
    .select('id, event_id, author_id, body, created_at, profiles:author_id(username)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (isNotInstalled(error)) return []
  if (error) throw describeCcError(error, 'Could not load comments')
  return ((data ?? []) as unknown as CommentRow[]).map(({ profiles, ...rest }) => ({
    ...rest,
    author_username: profiles?.username ?? null,
  }))
}

export async function addComment(eventId: string, authorId: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('cc_event_comments')
    .insert({ event_id: eventId, author_id: authorId, body: body.trim() })
  if (error) throw describeCcError(error, 'Could not post your comment')
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('cc_event_comments').delete().eq('id', id)
  if (error) throw describeCcError(error, 'Could not delete the comment')
}
