import { addDays, daysBetween, toDayString } from './format'
import type {
  ActivityFeedRow, CoverageBoardRow, EventKind, EventReview, RosterMember, ThesisImpact,
} from './types'

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
  /** Logged entries in the last 7 days marked positive or negative for the thesis. */
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
  direction: Extract<ThesisImpact, 'positive' | 'negative'>
}

/** Logged entries from the last `days` that moved the thesis, newest first. */
export function whatChanged(rows: ActivityFeedRow[], now: Date = new Date(), days = 7): ChangeItem[] {
  return rows
    .filter((r) => isLogged(r) && enteredWithin(r, now, days * DAY)
      && (r.thesis_impact === 'positive' || r.thesis_impact === 'negative'))
    .sort(byEnteredDesc)
    .map((row) => ({ row, direction: row.thesis_impact as ChangeItem['direction'] }))
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
  /** Entries whose analyst asked for a review, not yet reviewed by the viewer. */
  requests: ActivityFeedRow[]
  /** Other recent entries by people the viewer reviews, not yet reviewed by them. */
  pending: ActivityFeedRow[]
  /** Covered names nobody has spoken to the company about in `staleDays`. */
  stale: StaleItem[]
  total: number
}

export interface NeedsYouInput {
  rows: ActivityFeedRow[]
  reviews: EventReview[]
  board: CoverageBoardRow[]
  viewerId: string | null
  /** Admin or PM. RLS is the real gate; this only decides what to put in front of them. */
  canReview: boolean
  /** When set, stale coverage is limited to names led by these people. */
  scopeUserIds?: string[] | null
  staleDays?: number
  pendingDays?: number
  now?: Date
}

export function needsYou({
  rows, reviews, board, viewerId, canReview, scopeUserIds,
  staleDays = 30, pendingDays = 14, now = new Date(),
}: NeedsYouInput): NeedsYou {
  const reviewedByMe = new Set(
    reviews.filter((r) => r.reviewer_id === viewerId).map((r) => r.event_id)
  )
  const reviewable = (r: ActivityFeedRow) =>
    canReview && isLogged(r) && !!viewerId
    && r.created_by !== viewerId && ownerOf(r) !== viewerId
    && !reviewedByMe.has(r.event_id)

  const requests = rows.filter((r) => reviewable(r) && r.review_requested).sort(byEnteredDesc)
  const pending = rows
    .filter((r) => reviewable(r) && !r.review_requested && enteredWithin(r, now, pendingDays * DAY))
    .sort(byEnteredDesc)

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

  return { requests, pending, stale, total: requests.length + pending.length + stale.length }
}

// ---------------------------------------------------------------------------
// Team right now
// ---------------------------------------------------------------------------

export interface PersonNow {
  userId: string
  name: string
  role: string | null
  lastEntry: ActivityFeedRow | null
  nextEvent: ActivityFeedRow | null
  entries7d: number
}

/**
 * Per person: what they last logged and what they have booked next. People on the roster
 * with nothing in the window still appear -- "nothing logged" is itself the signal.
 */
export function teamNow(
  rows: ActivityFeedRow[], roster: RosterMember[] | null, now: Date = new Date()
): PersonNow[] {
  const todayIso = toDayString(now)
  const people = new Map<string, PersonNow>()
  const ensure = (userId: string, name: string, role: string | null) => {
    let p = people.get(userId)
    if (!p) {
      p = { userId, name, role, lastEntry: null, nextEvent: null, entries7d: 0 }
      people.set(userId, p)
    }
    return p
  }

  for (const m of roster ?? []) ensure(m.user_id, m.username ?? 'Unknown', m.role)

  for (const r of rows) {
    const id = ownerOf(r)
    // With a roster, only people on it; without one (migration pending), whoever appears.
    if (roster && !people.has(id)) continue
    const p = ensure(id, ownerName(r), null)
    if (isLogged(r)) {
      if (!p.lastEntry || r.created_at > p.lastEntry.created_at) p.lastEntry = r
      if (enteredWithin(r, now, 7 * DAY)) p.entries7d++
    } else if (r.event_date >= todayIso) {
      if (!p.nextEvent || r.event_date < p.nextEvent.event_date) p.nextEvent = r
    }
  }

  return [...people.values()].sort((a, b) => {
    if (!a.lastEntry || !b.lastEntry) return a.lastEntry ? -1 : b.lastEntry ? 1 : a.name.localeCompare(b.name)
    return b.lastEntry.created_at.localeCompare(a.lastEntry.created_at)
  })
}

// ---------------------------------------------------------------------------
// Coming up
// ---------------------------------------------------------------------------

export interface UpcomingItem {
  row: ActivityFeedRow
  /** 'Today' / 'Tomorrow' / 'Fri' (within a week) / '+9d' */
  when: string
}

export function comingUp(rows: ActivityFeedRow[], now: Date = new Date(), days = 14): UpcomingItem[] {
  const from = toDayString(now)
  const to = addDays(from, days)
  return rows
    .filter((r) => r.is_scheduled && r.event_date >= from && r.event_date <= to)
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.title.localeCompare(b.title))
    .map((row) => ({ row, when: whenLabel(row.event_date, now) }))
}

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

export interface StockLensRow {
  coverageId: string
  ticker: string
  companyName: string | null
  leadAnalyst: string | null
  /** Logged entries entered in the last 7 days. */
  new7d: number
  lastEntry: ActivityFeedRow | null
  /** Thesis impact of the most recent entry that recorded one. */
  latestSignal: ThesisImpact | null
  nextEvent: ActivityFeedRow | null
  daysSincePrimary: number | null | undefined
}

export function stockLens(
  rows: ActivityFeedRow[], board: CoverageBoardRow[], now: Date = new Date(),
  scopeUserIds?: string[] | null
): StockLensRow[] {
  const todayIso = toDayString(now)
  const byId = new Map<string, StockLensRow>()
  const ensure = (id: string, ticker: string, name: string | null) => {
    let s = byId.get(id)
    if (!s) {
      const cov = board.find((c) => c.id === id)
      s = {
        coverageId: id, ticker, companyName: name,
        leadAnalyst: cov?.lead_analyst_username ?? null,
        new7d: 0, lastEntry: null, latestSignal: null, nextEvent: null,
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
    const s = ensure(r.coverage_id, r.ticker, r.company_name)
    if (isLogged(r)) {
      if (enteredWithin(r, now, 7 * DAY)) s.new7d++
      if (!s.lastEntry) s.lastEntry = r
      if (!s.latestSignal && r.thesis_impact) s.latestSignal = r.thesis_impact
    } else if (r.event_date >= todayIso && (!s.nextEvent || r.event_date < s.nextEvent.event_date)) {
      s.nextEvent = r
    }
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
  upcoming: number
  endorsed: number
  rejected: number
  /** Their logged entries from the last 30 days that nobody has reviewed yet. */
  unreviewed: number
}

export function analystLens(
  rows: ActivityFeedRow[], roster: RosterMember[] | null, reviews: EventReview[],
  now: Date = new Date()
): AnalystLensRow[] {
  const todayIso = toDayString(now)
  const verdicts = new Map<string, { endorse: number; reject: number }>()
  for (const r of reviews) {
    const v = verdicts.get(r.event_id) ?? { endorse: 0, reject: 0 }
    v[r.verdict]++
    verdicts.set(r.event_id, v)
  }

  const people = new Map<string, AnalystLensRow & { stocks: Set<string> }>()
  const ensure = (userId: string, name: string, role: string | null) => {
    let p = people.get(userId)
    if (!p) {
      p = {
        userId, name, role, entries7d: 0, entries30d: 0, stocks30d: 0, lastEntry: null,
        upcoming: 0, endorsed: 0, rejected: 0, unreviewed: 0, stocks: new Set(),
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
    if (!isLogged(r)) {
      if (r.event_date >= todayIso) p.upcoming++
      continue
    }
    if (!p.lastEntry || r.created_at > p.lastEntry.created_at) p.lastEntry = r
    if (!enteredWithin(r, now, 30 * DAY)) continue
    p.entries30d++
    p.stocks.add(r.coverage_id)
    if (enteredWithin(r, now, 7 * DAY)) p.entries7d++
    const v = verdicts.get(r.event_id)
    if (v) { p.endorsed += v.endorse; p.rejected += v.reject } else p.unreviewed++
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
