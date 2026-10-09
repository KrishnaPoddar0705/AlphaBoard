import { describe, it, expect } from 'vitest'
import {
  summarize, whatChanged, needsYou, awaitingReply, whenLabel, stockLens, analystLens,
  weeklyCounts, relativeTime, filterEntries, filterStocks, type LensFilters,
} from './home'
import type { ActivityFeedRow, CoverageBoardRow } from './types'

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
  it('includes an entry with a Svan rating even when the thesis did not move', () => {
    const rated = row({ thesis_impact: 'neutral', svan_rating: 'buy' })
    expect(whatChanged([rated, row({ thesis_impact: 'neutral' })], NOW).map((c) => c.row.event_id))
      .toEqual([rated.event_id])
  })

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
  it('surfaces only what was pushed to the viewer, never the viewer\'s own', () => {
    const pushed = row({ analyst_id: 'aditi', created_by: 'aditi', push_to_pm: true })
    const unpushed = row({ analyst_id: 'rahul', created_by: 'rahul' })
    const mine = row({ analyst_id: 'pm', created_by: 'pm', push_to_pm: true })
    const answered = row({ analyst_id: 'rahul', created_by: 'rahul', push_to_pm: true })
    const out = needsYou({
      rows: [pushed, unpushed, mine, answered],
      replies: [{ event_id: answered.event_id, author_id: 'pm' }],
      board: [], viewerId: 'pm', viewerRole: 'portfolio_manager', now: NOW,
    })
    expect(out.requests.map((r) => r.event_id)).toEqual([pushed.event_id])
  })

  it('keeps a pushed entry queued until the viewer themselves replies', () => {
    const pushed = row({ analyst_id: 'aditi', created_by: 'aditi', push_to_pm: true })
    const out = needsYou({
      rows: [pushed],
      replies: [{ event_id: pushed.event_id, author_id: 'aditi' }],
      board: [], viewerId: 'pm', viewerRole: 'portfolio_manager', now: NOW,
    })
    expect(out.requests.map((r) => r.event_id)).toEqual([pushed.event_id])
  })

  it('never queues an entry nobody pushed, however recent', () => {
    const out = needsYou({
      rows: [row({ analyst_id: 'aditi', created_by: 'aditi', created_at: hoursAgo(1) })],
      replies: [], board: [], viewerId: 'pm',
      viewerRole: 'portfolio_manager', now: NOW,
    })
    expect(out.requests).toEqual([])
    expect(out.total).toBe(0)
  })

  it('keeps the two push targets independent', () => {
    const toPm = row({ analyst_id: 'aditi', created_by: 'aditi', push_to_pm: true })
    const toAdmin = row({ analyst_id: 'aditi', created_by: 'aditi', push_to_admin: true })
    const toBoth = row({
      analyst_id: 'aditi', created_by: 'aditi', push_to_pm: true, push_to_admin: true,
    })
    const args = {
      rows: [toPm, toAdmin, toBoth],
      replies: [], board: [], viewerId: 'viewer', now: NOW,
    }
    const pm = needsYou({ ...args, viewerRole: 'portfolio_manager' })
    const admin = needsYou({ ...args, viewerRole: 'admin' })

    expect(pm.requests.map((r) => r.event_id).sort())
      .toEqual([toPm.event_id, toBoth.event_id].sort())
    expect(admin.requests.map((r) => r.event_id).sort())
      .toEqual([toAdmin.event_id, toBoth.event_id].sort())
  })

  it('reads a missing push column as not pushed, so a pre-migration database is quiet', () => {
    const out = needsYou({
      rows: [row({ analyst_id: 'aditi', created_by: 'aditi', push_to_pm: undefined })],
      replies: [], board: [], viewerId: 'pm',
      viewerRole: 'portfolio_manager', now: NOW,
    })
    expect(out.requests).toEqual([])
  })

  it('shows analysts no pushed queue', () => {
    const out = needsYou({
      rows: [row({ analyst_id: 'aditi', created_by: 'aditi', push_to_pm: true })],
      replies: [], board: [], viewerId: 'krishna',
      viewerRole: 'analyst', now: NOW,
    })
    expect(out.requests).toEqual([])
  })

  it('flags coverage with no primary research past the threshold, most stale first', () => {
    const board = [
      coverage({ id: 'fresh', last_primary_research_on: '2026-09-10' }),
      coverage({ id: 'old', last_primary_research_on: '2026-08-07' }),     // 41 days
      coverage({ id: 'never', last_primary_research_on: null }),
    ]
    const out = needsYou({ rows: [], replies: [], board, viewerId: 'pm', viewerRole: 'portfolio_manager', now: NOW })
    expect(out.stale.map((s) => [s.coverage.id, s.days])).toEqual([['never', null], ['old', 41]])
  })

  it('makes no staleness claim before the migration adds the column', () => {
    const board = [coverage({ last_primary_research_on: undefined })]
    const out = needsYou({ rows: [], replies: [], board, viewerId: 'pm', viewerRole: 'portfolio_manager', now: NOW })
    expect(out.stale).toEqual([])
  })

  it('limits stale coverage to names led by the team in a team scope', () => {
    const board = [
      coverage({ id: 'ours', lead_analyst_id: 'aditi' }),
      coverage({ id: 'theirs', lead_analyst_id: 'neha' }),
      coverage({ id: 'unowned', lead_analyst_id: null }),
    ]
    const out = needsYou({
      rows: [], replies: [], board, viewerId: 'pm',
      viewerRole: 'portfolio_manager', scopeUserIds: ['aditi'], now: NOW,
    })
    expect(out.stale.map((s) => s.coverage.id)).toEqual(['ours'])
  })
})

describe('whenLabel', () => {
  it('labels the next few days by weekday', () => {
    expect(whenLabel('2026-09-18', NOW)).toBe('Tomorrow')
    expect(whenLabel('2026-09-19', NOW)).toMatch(/Sat/)
  })
})

describe('stockLens', () => {
  it('counts new research per stock and ignores bookings', () => {
    const board = [coverage({ id: 'bse', last_primary_research_on: '2026-09-15' }),
      coverage({ id: 'quiet', ticker: 'QUIET', lead_analyst_id: 'krishna' })]
    const rows = [
      row({ coverage_id: 'bse', thesis_impact: 'positive', created_at: hoursAgo(1) }),
      row({ coverage_id: 'bse', thesis_impact: 'negative', created_at: hoursAgo(10) }),
      row({ coverage_id: 'bse', is_scheduled: true, event_date: '2026-09-26' }),
    ]
    const [bse, quiet] = stockLens(rows, board, NOW)
    expect(bse).toMatchObject({ ticker: 'BSE.NS', new7d: 2, daysSincePrimary: 2 })
    expect(quiet).toMatchObject({ ticker: 'QUIET', new7d: 0, lastEntry: null, daysSincePrimary: null })
  })
})

describe('lens filters', () => {
  const none: LensFilters = { analystId: null, sector: null, coverageId: null, typeId: null }
  const board = [
    coverage({ id: 'bse', ticker: 'BSE.NS', sector: 'Exchanges', lead_analyst_id: 'krishna' }),
    coverage({ id: 'ncc', ticker: 'NCC.NS', sector: 'Infra', lead_analyst_id: 'aditi' }),
    coverage({ id: 'dlf', ticker: 'DLF.NS', sector: 'Infra', lead_analyst_id: 'krishna' }),
  ]
  const call = row({ coverage_id: 'bse', sector: 'Exchanges', analyst_id: 'krishna', kind: 'concall' })
  const visit = row({
    coverage_id: 'ncc', ticker: 'NCC.NS', sector: 'Infra', analyst_id: 'aditi',
    kind: 'management_meeting', subtype: 'plant_visit',
  })
  const tickers = (f: LensFilters) =>
    filterStocks(stockLens(filterEntries([call, visit], f), board, NOW), f).map((s) => s.ticker).sort()

  it('narrows entries by analyst, sector, stock and activity type', () => {
    const ids = (f: Partial<LensFilters>) =>
      filterEntries([call, visit], { ...none, ...f }).map((r) => r.event_id)
    expect(ids({})).toEqual([call.event_id, visit.event_id])
    expect(ids({ analystId: 'aditi' })).toEqual([visit.event_id])
    expect(ids({ sector: 'Exchanges' })).toEqual([call.event_id])
    expect(ids({ coverageId: 'ncc' })).toEqual([visit.event_id])
    expect(ids({ typeId: 'plant_visit' })).toEqual([visit.event_id])
    expect(ids({ typeId: 'concall', analystId: 'aditi' })).toEqual([])
  })

  it('keeps untouched names under a sector filter', () => {
    expect(tickers({ ...none, sector: 'Infra' })).toEqual(['DLF.NS', 'NCC.NS'])
  })

  it('lists what an analyst leads or logged on', () => {
    expect(tickers({ ...none, analystId: 'krishna' })).toEqual(['BSE.NS', 'DLF.NS'])
  })

  it('lists only names with the chosen activity', () => {
    expect(tickers({ ...none, typeId: 'plant_visit' })).toEqual(['NCC.NS'])
  })
})

describe('awaitingReply', () => {
  it('lists the viewer\'s own pushes until someone else replies', () => {
    const open = row({ analyst_id: 'aditi', created_by: 'aditi', review_requested: true })
    const selfOnly = row({ analyst_id: 'aditi', created_by: 'aditi', review_requested: true })
    const answered = row({ analyst_id: 'aditi', created_by: 'aditi', review_requested: true })
    const notPushed = row({ analyst_id: 'aditi', created_by: 'aditi' })
    const someoneElses = row({ analyst_id: 'rahul', created_by: 'rahul', review_requested: true })
    const out = awaitingReply(
      [open, selfOnly, answered, notPushed, someoneElses],
      [
        { event_id: selfOnly.event_id, author_id: 'aditi' },
        { event_id: answered.event_id, author_id: 'pm' },
      ],
      'aditi',
    )
    expect(out.map((r) => r.event_id).sort()).toEqual([open.event_id, selfOnly.event_id].sort())
  })
})

describe('analystLens', () => {
  it('tallies entries and stocks per person', () => {
    const a = row({ analyst_id: 'aditi', coverage_id: 'bse', created_at: hoursAgo(3) })
    const b = row({ analyst_id: 'aditi', coverage_id: 'cdsl', created_at: hoursAgo(24 * 10) })
    const c = row({ analyst_id: 'aditi', coverage_id: 'cdsl', created_at: hoursAgo(24 * 12) })
    const lens = analystLens([a, b, c], null, NOW)
    expect(lens[0]).toMatchObject({
      userId: 'aditi', entries7d: 1, entries30d: 3, stocks30d: 2,
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
