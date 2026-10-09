import { eventTypeOf } from './constants'
import { addDays, daysBetween, toDayString } from './format'
import type {
  ActivityFeedRow, CommentAuthor, CoverageBoardRow, EventKind, RosterMember,
} from './types'
// Type-only, so this file stays free of any runtime dependency on the hooks layer.
import type { OrgRole } from '@/hooks/useOrganization'

/**
 * The home screen's arithmetic, kept pure so every number on it is testable.
 *
 * Rule for everything in this file: a figure is a count or a pick of rows people
 * actually entered. Nothing is estimated, scored or filled in. When there is no data the
 * functions return empty lists and zeros, and the UI says so.
 */

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Whose work an entry is: the analyst it was logged for, else whoever logged it. */
export function ownerOf(row: Pick<ActivityFeedRow, 'analyst_id' | 'created_by'>): string {
  return row.analyst_id ?? row.created_by
}

export function ownerName(
  row: Pick<ActivityFeedRow, 'analyst_id' | 'analyst_username' | 'created_by_username'>
): string {
  return (row.analyst_id ? row.analyst_username : row.created_by_username)
    ?? row.created_by_username ?? 'Unknown'
}

const isLogged = (r: ActivityFeedRow) => !r.is_scheduled

/** Entered within the last `ms` -- "news" is when it reached the system. */
const enteredWithin = (r: ActivityFeedRow, now: Date, ms: number) =>
  now.getTime() - new Date(r.created_at).getTime() <= ms

/** '42m ago' / '2h ago' / 'Yesterday' / '3d ago', from a timestamp. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  const days = daysBetween(toDayString(new Date(iso)), now)
  if (days <= 1) return 'Yesterday'
  return days < 365 ? `${days}d ago` : `${Math.floor(days / 365)}y ago`
}

// ---------------------------------------------------------------------------
// Headline
// ---------------------------------------------------------------------------

export interface HomeSummary {
  /** Logged entries entered in the last 24 hours. */
  entries24h: number
  /** Distinct companies those entries were about. */
  companies24h: number
  /** Logged entries in the last 7 days with a Svan rating or a thesis move. */
  thesisChanges7d: number
  /** The most recent logged entry, for "nothing today -- last entry was ..." */
  lastEntry: ActivityFeedRow | null
}

export function summarize(rows: ActivityFeedRow[], now: Date = new Date()): HomeSummary {
  const logged = rows.filter(isLogged)
  const recent = logged.filter((r) => enteredWithin(r, now, DAY))
  return {
    entries24h: recent.length,
    companies24h: new Set(recent.map((r) => r.coverage_id)).size,
    thesisChanges7d: whatChanged(rows, now).length,
    lastEntry: [...logged].sort(byEnteredDesc)[0] ?? null,
  }
}

const byEnteredDesc = (a: ActivityFeedRow, b: ActivityFeedRow) =>
  b.created_at.localeCompare(a.created_at)

// ---------------------------------------------------------------------------
// What changed
// ---------------------------------------------------------------------------

export interface ChangeItem {
  row: ActivityFeedRow
}

/**
 * Logged entries from the last `days` that say something about where the desk stands:
 * the analyst gave a Svan rating, or marked the thesis as moved. Newest first.
 */
export function whatChanged(rows: ActivityFeedRow[], now: Date = new Date(), days = 7): ChangeItem[] {
  return rows
    .filter((r) => isLogged(r) && enteredWithin(r, now, days * DAY)
      && (!!r.svan_rating || r.thesis_impact === 'positive' || r.thesis_impact === 'negative'))
    .sort(byEnteredDesc)
    .map((row) => ({ row }))
}

// ---------------------------------------------------------------------------
// Needs you
// ---------------------------------------------------------------------------

export interface StaleItem {
  coverage: CoverageBoardRow
  /** Days since the last meeting / concall / AGM; null when there has never been one. */
  days: number | null
}

export interface NeedsYou {
  /** Entries the analyst explicitly pushed to the viewer's role, not yet answered by them. */
  requests: ActivityFeedRow[]
  /** Covered names nobody has spoken to the company about in `staleDays`. */
  stale: StaleItem[]
  total: number
}

export interface NeedsYouInput {
  rows: ActivityFeedRow[]
  /** Comment authors on the pushed entries: a reply is what answers a push. */
  replies: CommentAuthor[]
  board: CoverageBoardRow[]
  viewerId: string | null
  /**
   * Which push target the viewer answers to: a PM sees "Push to PM" entries, an admin
   * sees "Push to Admin" entries. The two are independent, so an entry pushed only to
   * the PM never reaches an admin's queue.
   */
  viewerRole: OrgRole | null
  /** When set, stale coverage is limited to names led by these people. */
  scopeUserIds?: string[] | null
  staleDays?: number
  now?: Date
}

/**
 * Escalation is opt-in.
 *
 * Entries reach a PM or an admin only because the analyst pushed them there -- there is
 * no automatic queue. Logging work and asking for a view on it are separate acts, so the
 * desk's routine output stays out of the PM's and the admin's way.
 *
 * A push is a question, and it is answered in the entry's comments: once the viewer has
 * commented, the entry leaves their queue.
 */
export function needsYou({
  rows, replies, board, viewerId, viewerRole, scopeUserIds,
  staleDays = 30, now = new Date(),
}: NeedsYouInput): NeedsYou {
  const answeredByMe = new Set(
    replies.filter((c) => c.author_id === viewerId).map((c) => c.event_id)
  )
  const unanswered = (r: ActivityFeedRow) =>
    isLogged(r) && !!viewerId
    && r.created_by !== viewerId && ownerOf(r) !== viewerId
    && !answeredByMe.has(r.event_id)

  // Undefined (not false) means the push migration is not applied yet. Treating it as
  // "not pushed" is the safe reading: an empty queue, never the old firehose.
  const pushedToMe = (r: ActivityFeedRow) =>
    (viewerRole === 'portfolio_manager' && r.push_to_pm === true)
    || (viewerRole === 'admin' && r.push_to_admin === true)

  const requests = rows.filter((r) => unanswered(r) && pushedToMe(r)).sort(byEnteredDesc)

  const stale: StaleItem[] = board
    // Undefined means the home migration is not applied -- no signal, so no claim.
    .filter((c) => c.is_active && c.last_primary_research_on !== undefined)
    .filter((c) => !scopeUserIds || (c.lead_analyst_id && scopeUserIds.includes(c.lead_analyst_id)))
    .map((c) => ({
      coverage: c,
      days: c.last_primary_research_on ? daysBetween(c.last_primary_research_on, now) : null,
    }))
    .filter((s) => s.days === null || s.days > staleDays)
    .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity))

  return { requests, stale, total: requests.length + stale.length }
}

/**
 * The viewer's own pushes that nobody else has commented on yet. Their own comments do
 * not count: adding context to a question is not an answer to it.
 */
export function awaitingReply(
  rows: ActivityFeedRow[], replies: CommentAuthor[], viewerId: string | null
): ActivityFeedRow[] {
  if (!viewerId) return []
  const answered = new Set(
    replies.filter((c) => c.author_id !== viewerId).map((c) => c.event_id)
  )
  return rows
    .filter((r) => isLogged(r) && r.review_requested && ownerOf(r) === viewerId
      && !answered.has(r.event_id))
    .sort(byEnteredDesc)
}

// ---------------------------------------------------------------------------
// Scheduling labels
// ---------------------------------------------------------------------------

/**
 * 'Today' / 'Tomorrow' / 'Fri' (within a week) / '+9d'.
 *
 * The Coming Up panel that once owned this file section is gone; the Calendar tab
 * covers scheduling now. The label survives for the bookings listed under an analyst.
 */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const ahead = -daysBetween(iso, now)
  if (ahead === 0) return 'Today'
  if (ahead === 1) return 'Tomorrow'
  if (ahead > 1 && ahead < 7) {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' })
  }
  return ahead > 0 ? `+${ahead}d` : `${ahead}d`
}

// ---------------------------------------------------------------------------
// Lenses
// ---------------------------------------------------------------------------

/** What the home table is narrowed to. Null means "all" for that filter. */
export interface LensFilters {
  analystId: string | null
  sector: string | null
  coverageId: string | null
  /** An EVENT_TYPES id ('1:1', 'concall', ...), not a raw kind. */
  typeId: string | null
}

/** The entries that pass every filter that is set. */
export function filterEntries(rows: ActivityFeedRow[], f: LensFilters): ActivityFeedRow[] {
  return rows.filter((r) =>
    (!f.analystId || ownerOf(r) === f.analystId)
    && (!f.sector || r.sector === f.sector)
    && (!f.coverageId || r.coverage_id === f.coverageId)
    && (!f.typeId || eventTypeOf(r.kind, r.subtype).id === f.typeId))
}

/**
 * The stocks to list, given rows built from already-filtered entries. An untouched name
 * still shows under a sector or stock filter -- "nothing logged" is the signal -- but an
 * analyst filter keeps only what they lead or logged on, and an activity filter only
 * names with that activity.
 */
export function filterStocks(stocks: StockLensRow[], f: LensFilters): StockLensRow[] {
  return stocks.filter((s) =>
    (!f.sector || s.sector === f.sector)
    && (!f.coverageId || s.coverageId === f.coverageId)
    && (!f.analystId || s.leadAnalystId === f.analystId || !!s.lastEntry)
    && (!f.typeId || !!s.lastEntry))
}

export interface StockLensRow {
  coverageId: string
  ticker: string
  companyName: string | null
  sector: string | null
  leadAnalystId: string | null
  leadAnalyst: string | null
  /** Logged entries entered in the last 7 days. */
  new7d: number
  lastEntry: ActivityFeedRow | null
  daysSincePrimary: number | null | undefined
}

export function stockLens(
  rows: ActivityFeedRow[], board: CoverageBoardRow[], now: Date = new Date(),
  scopeUserIds?: string[] | null
): StockLensRow[] {
  const byId = new Map<string, StockLensRow>()
  const ensure = (
    id: string, ticker: string, name: string | null,
    from?: Pick<ActivityFeedRow, 'sector' | 'lead_analyst_id'>
  ) => {
    let s = byId.get(id)
    if (!s) {
      const cov = board.find((c) => c.id === id)
      s = {
        coverageId: id, ticker, companyName: name,
        // The board is the source; an entry on a name the board no longer lists says the same.
        sector: cov?.sector ?? from?.sector ?? null,
        leadAnalystId: cov?.lead_analyst_id ?? from?.lead_analyst_id ?? null,
        leadAnalyst: cov?.lead_analyst_username ?? null,
        new7d: 0, lastEntry: null,
        daysSincePrimary: cov?.last_primary_research_on === undefined ? undefined
          : cov.last_primary_research_on ? daysBetween(cov.last_primary_research_on, now) : null,
      }
      byId.set(id, s)
    }
    return s
  }

  // In a team scope, names the team leads are listed even if untouched this month.
  for (const c of board) {
    if (!c.is_active) continue
    if (!scopeUserIds || (c.lead_analyst_id && scopeUserIds.includes(c.lead_analyst_id))) {
      ensure(c.id, c.ticker, c.company_name)
    }
  }

  const sorted = [...rows].sort(byEnteredDesc)
  for (const r of sorted) {
    if (!isLogged(r)) continue
    const s = ensure(r.coverage_id, r.ticker, r.company_name, r)
    if (enteredWithin(r, now, 7 * DAY)) s.new7d++
    if (!s.lastEntry) s.lastEntry = r
  }

  return [...byId.values()].sort((a, b) =>
    b.new7d - a.new7d
    || (b.lastEntry?.created_at ?? '').localeCompare(a.lastEntry?.created_at ?? '')
    || a.ticker.localeCompare(b.ticker))
}

export interface AnalystLensRow {
  userId: string
  name: string
  role: string | null
  entries7d: number
  entries30d: number
  stocks30d: number
  lastEntry: ActivityFeedRow | null
}

export function analystLens(
  rows: ActivityFeedRow[], roster: RosterMember[] | null, now: Date = new Date()
): AnalystLensRow[] {
  const people = new Map<string, AnalystLensRow & { stocks: Set<string> }>()
  const ensure = (userId: string, name: string, role: string | null) => {
    let p = people.get(userId)
    if (!p) {
      p = {
        userId, name, role, entries7d: 0, entries30d: 0, stocks30d: 0, lastEntry: null,
        stocks: new Set(),
      }
      people.set(userId, p)
    }
    return p
  }
  for (const m of roster ?? []) ensure(m.user_id, m.username ?? 'Unknown', m.role)

  for (const r of rows) {
    const id = ownerOf(r)
    if (roster && !people.has(id)) continue
    const p = ensure(id, ownerName(r), null)
    if (!isLogged(r)) continue
    if (!p.lastEntry || r.created_at > p.lastEntry.created_at) p.lastEntry = r
    if (!enteredWithin(r, now, 30 * DAY)) continue
    p.entries30d++
    p.stocks.add(r.coverage_id)
    if (enteredWithin(r, now, 7 * DAY)) p.entries7d++
  }

  return [...people.values()]
    .map(({ stocks, ...p }) => ({ ...p, stocks30d: stocks.size }))
    .sort((a, b) => b.entries7d - a.entries7d || b.entries30d - a.entries30d || a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type WeeklyRow = { week: string } & Partial<Record<EventKind, number>>

/** Logged entries per week (weeks start Monday, by event date), oldest first. */
export function weeklyCounts(rows: ActivityFeedRow[], now: Date = new Date(), weeks = 5): WeeklyRow[] {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const starts = Array.from({ length: weeks }, (_, i) =>
    addDays(toDayString(monday), -7 * (weeks - 1 - i)))

  const out: WeeklyRow[] = starts.map((s) => ({ week: s }))
  for (const r of rows) {
    if (!isLogged(r)) continue
    const idx = starts.findIndex((s, i) => r.event_date >= s && (i === starts.length - 1 || r.event_date < starts[i + 1]))
    if (idx === -1 || r.event_date > toDayString(now)) continue
    out[idx][r.kind] = (out[idx][r.kind] ?? 0) + 1
  }
  return out
}
