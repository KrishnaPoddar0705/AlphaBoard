import { describe, it, expect } from 'vitest'
import {
  parseDay, toDayString, addDays, daysBetween, relativeDays, groupByMonth,
} from './format'

describe('parseDay', () => {
  // The bug this exists to prevent: new Date('2026-03-14') is UTC midnight, which is
  // 13 March for anyone west of Greenwich.
  it('reads a DATE string as a local calendar day, not UTC', () => {
    const d = parseDay('2026-03-14')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2)
    expect(d.getDate()).toBe(14)
  })

  it('round-trips through toDayString', () => {
    expect(toDayString(parseDay('2026-01-05'))).toBe('2026-01-05')
  })
})

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02')
  })

  it('goes backwards across a year boundary', () => {
    expect(addDays('2026-01-02', -3)).toBe('2025-12-30')
  })

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('daysBetween / relativeDays', () => {
  const from = new Date(2026, 8, 12)   // 12 Sep 2026

  it('counts whole days back', () => {
    expect(daysBetween('2026-08-31', from)).toBe(12)
  })

  it('is zero for the same day regardless of clock time', () => {
    expect(daysBetween('2026-09-12', new Date(2026, 8, 12, 23, 59))).toBe(0)
  })

  it('is negative for a future date', () => {
    expect(daysBetween('2026-09-20', from)).toBe(-8)
  })

  it('says never when nothing is logged', () => {
    expect(relativeDays(null)).toBe('never')
  })
})

describe('groupByMonth', () => {
  it('buckets by month, newest month first, keeping row order inside', () => {
    const rows = [
      { event_date: '2026-09-10', id: 'a' },
      { event_date: '2026-09-02', id: 'b' },
      { event_date: '2026-07-20', id: 'c' },
    ]
    const groups = groupByMonth(rows)
    expect(groups.map((g) => g.key)).toEqual(['2026-09', '2026-07'])
    expect(groups[0].rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(groups[1].rows.map((r) => r.id)).toEqual(['c'])
  })

  it('returns nothing for no rows', () => {
    expect(groupByMonth([])).toEqual([])
  })
})
