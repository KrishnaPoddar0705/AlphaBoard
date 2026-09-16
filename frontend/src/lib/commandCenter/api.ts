import { supabase } from '@/lib/supabase'
import type {
  Broker, Coverage, CoverageBoardRow, CommandCenterEvent, ActivityFeedRow,
  EventSearchHit, EventAttachment, ContactWithRecency, Contact, EventDraft,
  ActivityFilters,
} from './types'

/**
 * Every Command Center read and write goes through here, straight to Supabase with the
 * caller's own JWT. RLS is the authorization boundary.
 *
 * Nothing here may be routed through the FastAPI service: it holds the service-role key
 * and has no authentication of its own, so an endpoint there would bypass every policy
 * in database/migration_add_command_center.sql.
 */

interface PostgrestErrorLike {
  message: string
  code?: string
}

/**
 * Turns a PostgREST error into something the reader can act on.
 *
 * Three failure modes look alike from the client but need different fixes, and the raw
 * messages name none of them:
 *
 *  - 42501 "permission denied for table X" is a GRANT failure, never RLS -- RLS returns
 *    zero rows, it does not deny. It means either the request went out as `anon`
 *    (the Supabase session had not been established yet) or the migration was applied
 *    without reaching its GRANT block.
 *  - PGRST205 means the table is not in PostgREST's schema cache: usually the migration
 *    has not been applied at all, or it ran without the trailing NOTIFY.
 *  - "row-level security" IS a policy refusal: the row exists or would exist, and this
 *    user may not touch it.
 */
export function describeCcError(error: PostgrestErrorLike, what: string): Error {
  const message = error.message ?? ''
  const code = error.code ?? ''

  if (code === '42501' || /permission denied/i.test(message)) {
    return new Error(
      `${what}: not signed in to the database yet. Reload the page, and if it persists ` +
      `check that database/migration_add_command_center.sql was applied all the way ` +
      `through its GRANT section.`
    )
  }

  if (code === 'PGRST205' || /schema cache/i.test(message)) {
    return new Error(
      `${what}: the Command Center tables are not in the database yet. Apply ` +
      `database/migration_add_command_center.sql, then reload.`
    )
  }

  if (/row-level security/i.test(message)) {
    return new Error(`${what}: you do not have access to that.`)
  }

  return new Error(`${what}: ${message}`)
}

function unwrap<T>(res: { data: T | null; error: PostgrestErrorLike | null }, what: string): T {
  if (res.error) throw describeCcError(res.error, what)
  return (res.data ?? []) as T
}

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

export async function listCoverageBoard(): Promise<CoverageBoardRow[]> {
  // No organization filter: RLS already scopes this to the caller's desk (or, for a
  // user with no organization, to their own rows). Filtering again client-side would
  // only add a way to get it wrong.
  return unwrap(
    await supabase
      .from('cc_coverage_board')
      .select('*')
      .eq('is_active', true)
      .order('company_name', { ascending: true, nullsFirst: false }),
    'Could not load coverage'
  )
}

export async function getCoverageByTicker(ticker: string): Promise<CoverageBoardRow | null> {
  const { data, error } = await supabase
    .from('cc_coverage_board')
    .select('*')
    .eq('ticker', ticker.trim().toUpperCase())
    .maybeSingle()
  if (error) throw describeCcError(error, `Could not load ${ticker}`)
  return data as CoverageBoardRow | null
}

export interface NewCoverage {
  ticker: string
  company_name?: string | null
  market?: string | null
  sector?: string | null
  lead_analyst_id?: string | null
}

/**
 * Adds a stock to coverage.
 *
 * Deliberately select-then-insert rather than `.upsert()`. The uniqueness of a covered
 * ticker is enforced by PARTIAL unique indexes (one for organisations, one for solo
 * users), and PostgREST's upsert emits `ON CONFLICT (organization_id, ticker)` with no
 * WHERE clause, so index inference cannot match them and the request fails with 42P10.
 *
 * `organization_id` and `created_by` are intentionally not sent: a BEFORE trigger
 * derives both from the caller's JWT and overwrites anything the client provides.
 */
export async function addCoverage(input: NewCoverage): Promise<Coverage> {
  const ticker = input.ticker.trim().toUpperCase()

  const existing = await supabase
    .from('cc_coverage')
    .select('id, is_active')
    .eq('ticker', ticker)
    .maybeSingle()
  if (existing.error) throw describeCcError(existing.error, 'Could not check coverage')

  if (existing.data) {
    // Re-adding something previously removed should revive it, not fail.
    if (existing.data.is_active) throw new Error(`${ticker} is already in your coverage`)
    return updateCoverage(existing.data.id, { is_active: true })
  }

  const { data, error } = await supabase
    .from('cc_coverage')
    .insert({
      ticker,
      company_name: input.company_name ?? null,
      market: input.market ?? null,
      sector: input.sector ?? null,
      lead_analyst_id: input.lead_analyst_id ?? null,
    })
    .select()
    .single()
  if (error) {
    // 23505: the ticker is already covered in this org, by someone whose coverage this
    // user cannot see (coverage is team-scoped). Say that, rather than a raw conflict.
    if (error.code === '23505') {
      const { data: taken } = await supabase.rpc('cc_coverage_taken', { p_ticker: ticker })
      if (taken) {
        throw new Error(
          `${ticker} is already covered by another team on your desk. Ask an admin to make ` +
          `you its lead analyst to see it here.`
        )
      }
    }
    throw describeCcError(error, `Could not add ${ticker}`)
  }
  return data as Coverage
}

export async function updateCoverage(
  id: string,
  patch: Partial<Omit<Coverage, 'id' | 'organization_id' | 'created_by' | 'ticker'>>
): Promise<Coverage> {
  const { data, error } = await supabase
    .from('cc_coverage').update(patch).eq('id', id).select().single()
  if (error) throw describeCcError(error, 'Could not save')
  return data as Coverage
}

/**
 * Soft-removes a stock from the board. A hard delete cascades away every event, contact
 * and attachment under it, and RLS restricts that to the creator or an org admin --
 * so the everyday "take this off my board" action archives instead.
 */
export async function archiveCoverage(id: string): Promise<void> {
  const { error } = await supabase.from('cc_coverage').update({ is_active: false }).eq('id', id)
  if (error) throw describeCcError(error, 'Could not remove')
}

// ---------------------------------------------------------------------------
// Brokers
// ---------------------------------------------------------------------------

export async function listBrokers(): Promise<Broker[]> {
  // Returns the global seeds plus anything this desk has added; RLS handles which.
  return unwrap(
    await supabase.from('cc_brokers').select('*').eq('is_active', true).order('name'),
    'Could not load brokers'
  )
}

/** Admin-only in an organization; enforced by RLS, not by this function. */
export async function addBroker(name: string): Promise<Broker> {
  const { data, error } = await supabase
    .from('cc_brokers').insert({ name: name.trim() }).select().single()
  if (error) {
    throw new Error(
      error.message.includes('row-level security')
        ? 'Only an organization admin can add a broker'
        : `Could not add broker: ${error.message}`
    )
  }
  return data as Broker
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function listEventsForCoverage(coverageId: string): Promise<ActivityFeedRow[]> {
  return unwrap(
    await supabase
      .from('cc_activity_feed')
      .select('*')
      .eq('coverage_id', coverageId)
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false }),
    'Could not load the timeline'
  )
}

export interface CreateEventInput extends EventDraft {
  /**
   * Minted client-side BEFORE this call so attachments can upload in the background
   * while the analyst is still typing, and land in their final storage folder.
   */
  id: string
  attachments?: Array<Pick<EventAttachment,
    'storage_path' | 'external_url' | 'file_name' | 'mime_type' | 'size_bytes'>>
}

export async function createEvent(input: CreateEventInput): Promise<CommandCenterEvent> {
  const { contact_ids = [], ...event } = input
  let attachments = input.attachments ?? []

  // organization_id and created_by are omitted on purpose -- derived by trigger.
  const { data, error } = await supabase
    .from('cc_events')
    .insert({
      id: event.id,
      coverage_id: event.coverage_id,
      kind: event.kind,
      subtype: event.subtype ?? null,
      title: event.title.trim(),
      event_date: event.event_date,
      is_scheduled: event.is_scheduled ?? false,
      attendance: event.attendance ?? 'na',
      period_label: event.period_label ?? null,
      broker_id: event.broker_id ?? null,
      kta: event.kta?.trim() || null,
      thesis_impact: event.thesis_impact ?? null,
      open_questions: event.open_questions?.trim() || null,
      analyst_id: event.analyst_id ?? null,
      // Sent only when used, so logging keeps working on a database that has not had
      // migration_command_center_home.sql applied yet.
      ...(event.review_requested
        ? { review_requested: true, review_note: event.review_note?.trim() || null }
        : {}),
    })
    .select()
    .single()

  let saved = data as CommandCenterEvent | null
  if (error) {
    // The id is minted client-side, so a retry after a later step failed (tagging, file
    // rows) re-sends an id that is already saved. Treat that as "already inserted" and
    // carry on with the remaining steps instead of failing on the primary key forever.
    const alreadySaved = error.code === '23505' && /cc_events_pkey/.test(error.message ?? '')
    if (!alreadySaved) throw describeCcError(error, 'Could not save this entry')
    const existing = await supabase.from('cc_events').select('*').eq('id', event.id).maybeSingle()
    if (existing.error || !existing.data) throw describeCcError(error, 'Could not save this entry')
    saved = existing.data as CommandCenterEvent
    // Files that made it on the first attempt are not attached twice.
    if (attachments.length) {
      const already = await supabase
        .from('cc_event_attachments').select('storage_path, external_url').eq('event_id', event.id)
      const have = new Set((already.data ?? []).map((a) => a.storage_path ?? a.external_url))
      attachments = attachments.filter((a) => !have.has(a.storage_path ?? a.external_url))
    }
  }

  await Promise.all([
    contact_ids.length ? setEventContacts(event.id, contact_ids) : Promise.resolve(),
    attachments.length ? addEventAttachments(event.id, attachments) : Promise.resolve(),
  ])

  return saved as CommandCenterEvent
}

export async function updateEvent(
  id: string,
  patch: Partial<Omit<CommandCenterEvent, 'id' | 'organization_id' | 'created_by' | 'coverage_id'>>
): Promise<CommandCenterEvent> {
  const { data, error } = await supabase
    .from('cc_events').update(patch).eq('id', id).select().single()
  if (error) throw describeCcError(error, 'Could not save')
  return data as CommandCenterEvent
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('cc_events').delete().eq('id', id)
  if (error) {
    throw new Error(
      error.message.includes('row-level security')
        ? 'Only the person who logged this entry, or an admin, can delete it'
        : `Could not delete: ${error.message}`
    )
  }
}

/**
 * Finds the existing concall / annual-report row for a period, so the trackers can
 * toggle a cell instead of creating duplicates.
 */
export async function findEventByPeriod(
  coverageId: string, kind: 'concall' | 'annual_report', periodLabel: string
): Promise<CommandCenterEvent | null> {
  const { data, error } = await supabase
    .from('cc_events')
    .select('*')
    .eq('coverage_id', coverageId)
    .eq('kind', kind)
    .eq('period_label', periodLabel)
    .eq('is_scheduled', false)
    .maybeSingle()
  if (error) throw describeCcError(error, `Could not load ${periodLabel}`)
  return data as CommandCenterEvent | null
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export async function addEventAttachments(
  eventId: string,
  files: Array<Pick<EventAttachment,
    'storage_path' | 'external_url' | 'file_name' | 'mime_type' | 'size_bytes'>>
): Promise<EventAttachment[]> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth?.user?.id
  if (!uid) throw new Error('You must be signed in to attach files')

  const { data, error } = await supabase
    .from('cc_event_attachments')
    .insert(files.map((f) => ({
      event_id: eventId,
      storage_path: f.storage_path ?? null,
      external_url: f.external_url ?? null,
      file_name: f.file_name,
      mime_type: f.mime_type ?? null,
      size_bytes: f.size_bytes ?? null,
      uploaded_by: uid,
    })))
    .select()
  if (error) throw describeCcError(error, 'Could not save attachments')
  return data as EventAttachment[]
}

export async function listAttachmentsForEvents(eventIds: string[]): Promise<EventAttachment[]> {
  if (eventIds.length === 0) return []
  return unwrap(
    await supabase.from('cc_event_attachments').select('*').in('event_id', eventIds),
    'Could not load attachments'
  )
}

export async function deleteAttachmentRow(id: string): Promise<void> {
  const { error } = await supabase.from('cc_event_attachments').delete().eq('id', id)
  if (error) throw describeCcError(error, 'Could not remove the file')
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

/** Reads the view, so `last_met_on` is derived rather than a column anyone maintains. */
export async function listContacts(coverageId: string): Promise<ContactWithRecency[]> {
  const rows = unwrap<Array<Omit<ContactWithRecency, 'id'> & { contact_id: string }>>(
    await supabase
      .from('cc_contact_last_met')
      .select('*')
      .eq('coverage_id', coverageId)
      .order('designation')
      .order('name'),
    'Could not load contacts'
  )
  // The view names the key `contact_id`; everything in the app (tagging, edit, delete,
  // list keys) uses `id`. Without this mapping `id` was undefined, so tagging a saved
  // contact on an entry sent a null contact_id and RLS refused it.
  return rows.map(({ contact_id, ...rest }) => ({ ...rest, id: contact_id }))
}

export async function createContact(
  input: Pick<Contact, 'coverage_id' | 'name' | 'designation'> &
    Partial<Pick<Contact, 'designation_other' | 'email' | 'phone'>>
): Promise<Contact> {
  const { data, error } = await supabase
    .from('cc_contacts')
    .insert({
      coverage_id: input.coverage_id,
      name: input.name.trim(),
      designation: input.designation,
      designation_other: input.designation === 'Other' ? (input.designation_other ?? null) : null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
    })
    .select()
    .single()
  if (error) throw describeCcError(error, 'Could not save contact')
  return data as Contact
}

export async function updateContact(id: string, patch: Partial<Contact>): Promise<Contact> {
  const { data, error } = await supabase
    .from('cc_contacts').update(patch).eq('id', id).select().single()
  if (error) throw describeCcError(error, 'Could not save contact')
  return data as Contact
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from('cc_contacts').delete().eq('id', id)
  if (error) throw describeCcError(error, 'Could not delete contact')
}

/** Replaces the set of contacts tagged on an event. */
export async function setEventContacts(eventId: string, contactIds: string[]): Promise<void> {
  const del = await supabase.from('cc_event_contacts').delete().eq('event_id', eventId)
  if (del.error) throw describeCcError(del.error, 'Could not update attendees')
  if (contactIds.length === 0) return

  const { error } = await supabase
    .from('cc_event_contacts')
    .insert(contactIds.map((contact_id) => ({ event_id: eventId, contact_id })))
  if (error) {
    // The entry itself is already saved by the time this runs; say so, and pass the
    // database's reason through rather than guessing at one.
    throw new Error(
      error.message.includes('row-level security')
        ? `The entry was saved, but tagging who was there was refused by the database ` +
          `(${error.message}). Press Save again to retry the tagging.`
        : `The entry was saved, but tagging who was there failed: ${error.message}. ` +
          `Press Save again to retry.`
    )
  }
}

export interface EventContactTag {
  event_id: string
  contact: Pick<Contact, 'id' | 'name' | 'designation' | 'designation_other'>
}

/** Who was met, for a page of entries, in one round trip per 150 ids. */
export async function listEventContacts(eventIds: string[]): Promise<EventContactTag[]> {
  const out: EventContactTag[] = []
  for (let i = 0; i < eventIds.length; i += 150) {
    const { data, error } = await supabase
      .from('cc_event_contacts')
      .select('event_id, contact:cc_contacts(id, name, designation, designation_other)')
      .in('event_id', eventIds.slice(i, i + 150))
    if (error) throw describeCcError(error, 'Could not load who was met')
    for (const row of (data ?? []) as unknown as Array<{ event_id: string; contact: EventContactTag['contact'] | null }>) {
      // A contact this viewer cannot see (RLS) embeds as null; skip rather than guess.
      if (row.contact) out.push({ event_id: row.event_id, contact: row.contact })
    }
  }
  return out
}

export async function listEventContactIds(eventId: string): Promise<string[]> {
  const rows = unwrap<Array<{ contact_id: string }>>(
    await supabase.from('cc_event_contacts').select('contact_id').eq('event_id', eventId),
    'Could not load attendees'
  )
  return rows.map((r) => r.contact_id)
}

// ---------------------------------------------------------------------------
// Activity feed and search
// ---------------------------------------------------------------------------

export interface ActivityPage {
  rows: ActivityFeedRow[]
  hasMore: boolean
}

export async function listActivity(
  filters: ActivityFilters = {}, page = 0, pageSize = 40
): Promise<ActivityPage> {
  let q = supabase
    .from('cc_activity_feed')
    .select('*')
    // Logged work only. Upcoming events live on the calendar and the home screen's
    // "Coming up"; here they sort to the top (future dates) and crowd out what happened.
    .eq('is_scheduled', false)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize)   // +1 row to detect "more"

  if (filters.analystId) q = q.eq('analyst_id', filters.analystId)
  if (filters.coverageId) q = q.eq('coverage_id', filters.coverageId)
  if (filters.kinds?.length) q = q.in('kind', filters.kinds)
  if (filters.brokerId) q = q.eq('broker_id', filters.brokerId)
  if (filters.from) q = q.gte('event_date', filters.from)
  if (filters.to) q = q.lte('event_date', filters.to)

  const rows = unwrap<ActivityFeedRow[]>(await q, 'Could not load activity')
  return { rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize }
}

/**
 * Ranked, highlighted search over KTA bodies.
 *
 * Goes through the RPC rather than `.textSearch()` on the view because PostgREST can
 * filter a tsvector but cannot ORDER BY ts_rank_cd or return ts_headline snippets --
 * and "the most relevant note first, with the matching words shown" is the feature.
 */
export async function searchEvents(
  filters: ActivityFilters & { search: string }, limit = 50, offset = 0
): Promise<EventSearchHit[]> {
  const { data, error } = await supabase.rpc('cc_search_events', {
    p_query: filters.search,
    p_coverage_id: filters.coverageId ?? null,
    p_kinds: filters.kinds?.length ? filters.kinds : null,
    p_analyst_id: filters.analystId ?? null,
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw describeCcError(error, 'Search failed')
  return (data ?? []) as EventSearchHit[]
}

/** Everything in a date window, for the calendar. Past and scheduled alike. */
export async function listEventsInRange(from: string, to: string): Promise<ActivityFeedRow[]> {
  return unwrap(
    await supabase
      .from('cc_activity_feed')
      .select('*')
      .gte('event_date', from)
      .lte('event_date', to)
      .order('event_date', { ascending: true }),
    'Could not load the calendar'
  )
}

// ---------------------------------------------------------------------------
// Importing from the existing Watchlist
// ---------------------------------------------------------------------------

export interface WatchlistCandidate {
  ticker: string
  /** True when this stock is already on the Command Center board. */
  alreadyCovered: boolean
}

/**
 * The tickers on the caller's personal Watchlist page, for one-click import.
 *
 * Reads the same rows `/watchlist` renders -- `recommendations` with
 * status = 'WATCHLIST' -- rather than `user_stock_watchlist`, which is a separate,
 * Clerk-id-keyed table that the Watchlist page does not actually use.
 */
export async function listWatchlistCandidates(userId: string): Promise<WatchlistCandidate[]> {
  const [watchlist, covered] = await Promise.all([
    supabase.from('recommendations').select('ticker')
      .eq('user_id', userId).eq('status', 'WATCHLIST'),
    supabase.from('cc_coverage').select('ticker').eq('is_active', true),
  ])
  if (watchlist.error) throw describeCcError(watchlist.error, 'Could not read your watchlist')
  if (covered.error) throw describeCcError(covered.error, 'Could not read coverage')

  const coveredSet = new Set((covered.data ?? []).map((r: { ticker: string }) => r.ticker))
  const seen = new Set<string>()
  const out: WatchlistCandidate[] = []
  for (const row of (watchlist.data ?? []) as Array<{ ticker: string }>) {
    const ticker = row.ticker?.trim().toUpperCase()
    if (!ticker || seen.has(ticker)) continue
    seen.add(ticker)
    out.push({ ticker, alreadyCovered: coveredSet.has(ticker) })
  }
  return out.sort((a, b) => a.ticker.localeCompare(b.ticker))
}

/** Open calls and price targets on a ticker, shown read-only on the stock page. */
export interface LiveCall {
  id: string
  user_id: string
  username: string | null
  action: string
  entry_price: number | null
  current_price: number | null
  target_irr: number | null
  entry_date: string | null
  status: string
}

export async function listLiveCalls(ticker: string): Promise<LiveCall[]> {
  // Readable under the existing `recommendations` SELECT policy, which already makes
  // every organization member's calls visible org-wide -- this is a query, not a new
  // grant.
  const { data, error } = await supabase
    .from('recommendations')
    .select('id, user_id, action, entry_price, current_price, target_irr, entry_date, status, profiles(username)')
    .eq('ticker', ticker)
    .eq('status', 'OPEN')
    .order('entry_date', { ascending: false })
  if (error) throw describeCcError(error, 'Could not load open calls')

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    user_id: r.user_id as string,
    username: (r.profiles as { username?: string } | null)?.username ?? null,
    action: r.action as string,
    entry_price: r.entry_price as number | null,
    current_price: r.current_price as number | null,
    target_irr: r.target_irr as number | null,
    entry_date: r.entry_date as string | null,
    status: r.status as string,
  }))
}

// ---------------------------------------------------------------------------
// Desk roster
// ---------------------------------------------------------------------------

export interface DeskMember {
  id: string
  username: string | null
  role: string
}

/**
 * Everyone on the desk, for the analyst filter and the "who logged nothing this week"
 * gap check. Returns just the caller for a user with no organization.
 */
export async function listDeskMembers(organizationId: string | null, selfId: string):
  Promise<DeskMember[]> {
  if (!organizationId) {
    const { data } = await supabase.from('profiles').select('id, username').eq('id', selfId).maybeSingle()
    return [{ id: selfId, username: (data as { username?: string } | null)?.username ?? null, role: 'analyst' }]
  }

  const { data, error } = await supabase
    .from('user_organization_membership')
    .select('user_id, role, profiles:user_id(username)')
    .eq('organization_id', organizationId)
  if (error) throw describeCcError(error, 'Could not load the team')

  return (data ?? [])
    .map((r: Record<string, unknown>) => ({
      id: r.user_id as string,
      username: (r.profiles as { username?: string } | null)?.username ?? null,
      role: r.role as string,
    }))
    .sort((a, b) => (a.username ?? '').localeCompare(b.username ?? ''))
}

/** Entries per day across the desk, for the analyst activity heatmap. */
export async function listActivityCounts(from: string, to: string, analystId?: string | null):
  Promise<Array<{ day: string; value: number }>> {
  let q = supabase
    .from('cc_events')
    .select('event_date')
    .eq('is_scheduled', false)
    .gte('event_date', from)
    .lte('event_date', to)
  if (analystId) q = q.eq('analyst_id', analystId)

  const { data, error } = await q
  if (error) throw describeCcError(error, 'Could not load activity counts')

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as Array<{ event_date: string }>) {
    counts.set(row.event_date, (counts.get(row.event_date) ?? 0) + 1)
  }
  return [...counts.entries()].map(([day, value]) => ({ day, value }))
}
