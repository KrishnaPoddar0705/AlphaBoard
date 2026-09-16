import { describe, it, expect } from 'vitest'
import {
  summarize, whatChanged, needsYou, teamNow, comingUp, whenLabel, stockLens, analystLens,
  weeklyCounts, relativeTime,
} from './home'
import type { ActivityFeedRow, CoverageBoardRow, EventReview, RosterMember } from './types'

const NOW = new Date(2026, 8, 17, 9, 0, 0) // Thu 17 Sep 2026, 09:00 local
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

let seq = 0
function row(over: Partial<ActivityFeedRow> = {}): ActivityFeedRow {
  seq++
  return {
    event_id: `e${seq}`, organization_id: 'org', coverage_id: 'bse', ticker: 'BSE.NS',
    company_name: 'BSE', sector: null, lead_analyst_id: null, kind: 'management_meeting',
    subtype: null, title: `Entry ${seq}`, event_date: '2026-09-16', is_scheduled: false,
    attendance: 'na', period_label: null, thesis_impact: null, kta: null, open_questions: null,
    broker_id: null, broker_name: null, analyst_id: 'krishna', analyst_username: 'Krishna',
    created_by: 'krishna', created_by_username: 'Krishna', created_at: hoursAgo(2),
    updated_at: hoursAgo(2), attachment_count: 0, contact_count: 0,
    review_requested: false, review_note: null, comment_count: 0,
    ...over,
  }
}

function coverage(over: Partial<CoverageBoardRow> = {}): CoverageBoardRow {
  return {
    id: 'bse', organization_id: 'org', created_by: 'krishna', ticker: 'BSE.NS',
    company_name: 'BSE', market: 'NSE', understanding_level: null, model_status: 'none',
    corporate_address: null, sector: null, lead_analyst_id: 'krishna', notes: null,
    is_active: true, created_at: hoursAgo(1000), updated_at: hoursAgo(1000),
    lead_analyst_username: 'Krishna', last_interaction_on: null, days_since_interaction: null,
    event_count: 0, broker_report_count: 0, latest_concall_period: null,
    latest_concall_attendance: null, latest_annual_report_period: null,
    latest_annual_report_attendance: null, next_scheduled_title: null, next_scheduled_on: null,
    contact_count: 0, last_primary_research_on: null,
    ...over,
  } as CoverageBoardRow
}

const review = (over: Partial<EventReview>): EventReview => ({
  id: 'r', event_id: 'e', reviewer_id: 'pm', reviewer_username: 'PM', verdict: 'endorse',
  note: null, created_at: hoursAgo(1), updated_at: hoursAgo(1), ...over,
})

describe('relativeTime', () => {
  it('reads minutes, hours, yesterday and days', () => {
    expect(relativeTime(hoursAgo(0.7), NOW)).toBe('42m ago')
    expect(relativeTime(hoursAgo(2), NOW)).toBe('2h ago')
    expect(relativeTime(hoursAgo(26), NOW)).toBe('Yesterday')
    expect(relativeTime(hoursAgo(24 * 4), NOW)).toBe('4d ago')
  })
})

describe('summarize', () => {
  it('counts only logged entries entered in the last 24h', () => {
    const rows = [
      row({ coverage_id: 'bse' }),
      row({ coverage_id: 'bse' }),
      row({ coverage_id: 'cdsl', created_at: hoursAgo(20) }),
      row({ coverage_id: 'tul', created_at: hoursAgo(30) }),        // too old
      row({ is_scheduled: true, event_date: '2026-09-26' }),         // not work done
    ]
    const s = summarize(rows, NOW)
    expect(s.entries24h).toBe(3)
    expect(s.companies24h).toBe(2)
  })

  it('reports zeros, not guesses, with no data', () => {
    expect(summarize([], NOW)).toEqual({
      entries24h: 0, companies24h: 0, thesisChanges7d: 0, lastEntry: null,
    })
  })
})

describe('whatChanged', () => {
  it('keeps positive and negative thesis impacts from the last week, newest first', () => {
    const older = row({ thesis_impact: 'negative', created_at: hoursAgo(30) })
    const newer = row({ thesis_impact: 'positive', created_at: hoursAgo(1) })
    const rows = [
      older, newer,
      row({ thesis_impact: 'neutral' }),
      row({ thesis_impact: null }),
      row({ thesis_impact: 'positive', created_at: hoursAgo(24 * 9) }),
    ]
    expect(whatChanged(rows, NOW).map((c) => c.row.event_id)).toEqual([newer.event_id, older.event_id])
  })
})

describe('needsYou', () => {
  it('surfaces review requests and unreviewed team entries, never the viewer\'s own', () => {
    const request = row({ analyst_id: 'aditi', created_by: 'aditi', review_requested: true })
    const pending = row({ analyst_id: 'rahul', created_by: 'rahul' })
    const mine = row({ analyst_id: 'pm', created_by: 'pm', review_requested: true })
    const reviewed = row({ analyst_id: 'rahul', created_by: 'rahul' })
    const out = needsYou({
      rows: [request, pending, mine, reviewed],
      reviews: [review({ event_id: reviewed.event_id, reviewer_id: 'pm' })],
      board: [], viewerId: 'pm', canReview: true, now: NOW,
    })
    expect(out.requests.map((r) => r.event_id)).toEqual([request.event_id])
    expect(out.pending.map((r) => r.event_id)).toEqual([pending.event_id])
  })

  it('shows analysts no review queue', () => {
    const out = needsYou({
      rows: [row({ analyst_id: 'aditi', created_by: 'aditi', review_requested: true })],
      reviews: [], board: [], viewerId: 'krishna', canReview: false, now: NOW,
    })
    expect(out.requests).toEqual([])
    expect(out.pending).toEqual([])
  })

  it('flags coverage with no primary research past the threshold, most stale first', () => {
    const board = [
      coverage({ id: 'fresh', last_primary_research_on: '2026-09-10' }),
      coverage({ id: 'old', last_primary_research_on: '2026-08-07' }),     // 41 days
      coverage({ id: 'never', last_primary_research_on: null }),
    ]
    const out = needsYou({ rows: [], reviews: [], board, viewerId: 'pm', canReview: true, now: NOW })
    expect(out.stale.map((s) => [s.coverage.id, s.days])).toEqual([['never', null], ['old', 41]])
  })

  it('makes no staleness claim before the migration adds the column', () => {
    const board = [coverage({ last_primary_research_on: undefined })]
    const out = needsYou({ rows: [], reviews: [], board, viewerId: 'pm', canReview: true, now: NOW })
    expect(out.stale).toEqual([])
  })

  it('limits stale coverage to names led by the team in a team scope', () => {
    const board = [
      coverage({ id: 'ours', lead_analyst_id: 'aditi' }),
      coverage({ id: 'theirs', lead_analyst_id: 'neha' }),
      coverage({ id: 'unowned', lead_analyst_id: null }),
    ]
    const out = needsYou({
      rows: [], reviews: [], board, viewerId: 'pm', canReview: true, scopeUserIds: ['aditi'], now: NOW,
    })
    expect(out.stale.map((s) => s.coverage.id)).toEqual(['ours'])
  })
})

describe('teamNow', () => {
  const roster: RosterMember[] = [
    { user_id: 'krishna', username: 'Krishna', role: 'analyst', team_ids: [] },
    { user_id: 'neha', username: 'Neha', role: 'analyst', team_ids: [] },
  ]

  it('pairs each person with their last entry and next booking', () => {
    const last = row({ analyst_id: 'krishna', created_at: hoursAgo(1) })
    const next = row({ analyst_id: 'krishna', is_scheduled: true, event_date: '2026-09-18' })
    const later = row({ analyst_id: 'krishna', is_scheduled: true, event_date: '2026-09-30' })
    const people = teamNow([row({ analyst_id: 'krishna', created_at: hoursAgo(5) }), last, later, next], roster, NOW)
    expect(people[0].userId).toBe('krishna')
    expect(people[0].lastEntry?.event_id).toBe(last.event_id)
    expect(people[0].nextEvent?.event_id).toBe(next.event_id)
    expect(people[0].entries7d).toBe(2)
  })

  it('lists people with nothing logged last, with no invented status', () => {
    const people = teamNow([row({ analyst_id: 'krishna' })], roster, NOW)
    expect(people[1]).toEqual({
      userId: 'neha', name: 'Neha', role: 'analyst', lastEntry: null, nextEvent: null, entries7d: 0,
    })
  })

  it('ignores entries from people outside the roster', () => {
    expect(teamNow([row({ analyst_id: 'stranger', created_by: 'stranger' })], roster, NOW)
      .map((p) => p.userId)).toEqual(['krishna', 'neha'])
  })
})

describe('comingUp', () => {
  it('lists scheduled events in the next two weeks, soonest first', () => {
    const rows = [
      row({ is_scheduled: true, event_date: '2026-09-26', title: 'Concall' }),
      row({ is_scheduled: true, event_date: '2026-09-17', title: 'Mgmt call' }),
      row({ is_scheduled: true, event_date: '2026-10-30', title: 'Too far' }),
      row({ is_scheduled: false, event_date: '2026-09-18', title: 'Logged, not upcoming' }),
    ]
    expect(comingUp(rows, NOW).map((u) => [u.row.title, u.when]))
      .toEqual([['Mgmt call', 'Today'], ['Concall', '+9d']])
  })

  it('labels the next few days by weekday', () => {
    expect(whenLabel('2026-09-18', NOW)).toBe('Tomorrow')
    expect(whenLabel('2026-09-19', NOW)).toMatch(/Sat/)
  })
})

describe('stockLens', () => {
  it('counts new research and picks the latest signal and next event per stock', () => {
    const board = [coverage({ id: 'bse', last_primary_research_on: '2026-09-15' }),
      coverage({ id: 'quiet', ticker: 'QUIET', lead_analyst_id: 'krishna' })]
    const rows = [
      row({ coverage_id: 'bse', thesis_impact: 'positive', created_at: hoursAgo(1) }),
      row({ coverage_id: 'bse', thesis_impact: 'negative', created_at: hoursAgo(10) }),
      row({ coverage_id: 'bse', is_scheduled: true, event_date: '2026-09-26' }),
    ]
    const [bse, quiet] = stockLens(rows, board, NOW)
    expect(bse).toMatchObject({ ticker: 'BSE.NS', new7d: 2, latestSignal: 'positive', daysSincePrimary: 2 })
    expect(bse.nextEvent?.event_date).toBe('2026-09-26')
    expect(quiet).toMatchObject({ ticker: 'QUIET', new7d: 0, lastEntry: null, daysSincePrimary: null })
  })
})

describe('analystLens', () => {
  it('tallies entries, stocks and verdicts per person', () => {
    const a = row({ analyst_id: 'aditi', coverage_id: 'bse', created_at: hoursAgo(3) })
    const b = row({ analyst_id: 'aditi', coverage_id: 'cdsl', created_at: hoursAgo(24 * 10) })
    const c = row({ analyst_id: 'aditi', coverage_id: 'cdsl', created_at: hoursAgo(24 * 12) })
    const lens = analystLens([a, b, c], null, [
      review({ event_id: a.event_id, verdict: 'endorse' }),
      review({ event_id: b.event_id, verdict: 'reject' }),
    ], NOW)
    expect(lens[0]).toMatchObject({
      userId: 'aditi', entries7d: 1, entries30d: 3, stocks30d: 2, endorsed: 1, rejected: 1, unreviewed: 1,
    })
  })
})

describe('weeklyCounts', () => {
  it('buckets logged entries by Monday-start week and kind', () => {
    const rows = [
      row({ event_date: '2026-09-16', kind: 'concall' }),       // this week (Mon 14 Sep)
      row({ event_date: '2026-09-14', kind: 'concall' }),
      row({ event_date: '2026-09-11', kind: 'broker_report' }), // last week
      row({ event_date: '2026-09-20', kind: 'concall', is_scheduled: true }),
    ]
    const weeks = weeklyCounts(rows, NOW, 2)
    expect(weeks).toEqual([
      { week: '2026-09-07', broker_report: 1 },
      { week: '2026-09-14', concall: 2 },
    ])
  })
})
