import { describe, it, expect } from 'vitest'
import { monthGrid, addMonths, gridRange, bucketByDay, WEEKDAY_LABELS } from './calendar'

describe('monthGrid', () => {
  // A variable row count makes the grid change height while paging, which looks broken.
  it('always returns six weeks', () => {
    expect(monthGrid(new Date(2026, 1, 1))).toHaveLength(42)   // Feb 2026, 28 days
    expect(monthGrid(new Date(2026, 7, 1))).toHaveLength(42)   // Aug 2026, 31 days
  })

  it('pads the start of the month back to the week start', () => {
    // 1 Sep 2026 is a Tuesday, so a Monday-start grid begins Mon 31 Aug.
    const cells = monthGrid(new Date(2026, 8, 1), 1)
    expect(cells[0].day).toBe('2026-08-31')
    expect(cells[0].inMonth).toBe(false)
    expect(cells[1].day).toBe('2026-09-01')
    expect(cells[1].inMonth).toBe(true)
  })

  it('honours a Sunday week start', () => {
    const cells = monthGrid(new Date(2026, 8, 1), 0)
    expect(cells[0].day).toBe('2026-08-30')   // the Sunday before
  })

  it('marks today, and only today', () => {
    const now = new Date(2026, 8, 12)
    const cells = monthGrid(new Date(2026, 8, 1), 1, now)
    expect(cells.filter((c) => c.isToday).map((c) => c.day)).toEqual(['2026-09-12'])
  })

  it('has a weekday label per column', () => {
    expect(WEEKDAY_LABELS[1]).toHaveLength(7)
    expect(WEEKDAY_LABELS[1][0]).toBe('Mon')
  })
})

describe('addMonths', () => {
  // new Date(2026, 0, 31) + 1 month overflows into March; normalising to day 1 avoids it.
  it('does not skip February when starting from the 31st', () => {
    const next = addMonths(new Date(2026, 0, 31), 1)
    expect(next.getMonth()).toBe(1)
    expect(next.getFullYear()).toBe(2026)
  })

  it('crosses a year boundary in both directions', () => {
    expect(addMonths(new Date(2026, 11, 1), 1).getFullYear()).toBe(2027)
    expect(addMonths(new Date(2026, 0, 1), -1).getFullYear()).toBe(2025)
  })
})

describe('gridRange', () => {
  it('spans the whole visible grid, not just the month', () => {
    const { from, to } = gridRange(new Date(2026, 8, 1), 1)
    expect(from).toBe('2026-08-31')
    expect(to).toBe('2026-10-11')
  })
})

describe('bucketByDay', () => {
  it('groups rows sharing a date', () => {
    const map = bucketByDay([
      { event_date: '2026-09-01', id: 'a' },
      { event_date: '2026-09-01', id: 'b' },
      { event_date: '2026-09-03', id: 'c' },
    ])
    expect(map.get('2026-09-01')?.map((r) => r.id)).toEqual(['a', 'b'])
    expect(map.get('2026-09-03')).toHaveLength(1)
    expect(map.get('2026-09-02')).toBeUndefined()
  })
})
