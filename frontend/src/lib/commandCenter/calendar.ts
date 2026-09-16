import { parseDay, toDayString } from './format'

/**
 * Month-grid arithmetic for the hand-rolled calendar.
 *
 * Pure and dependency-free, which is the point: a calendar library would cost ~200KB
 * and then need theme overrides to stop looking foreign next to the paper UI, for a
 * month view and an agenda list.
 */

export interface CalendarCell {
  /** 'YYYY-MM-DD' */
  day: string
  inMonth: boolean
  isToday: boolean
}

/** Sunday = 0, matching Date#getDay. */
export type WeekStart = 0 | 1

export const WEEKDAY_LABELS: Record<WeekStart, string[]> = {
  0: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  1: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
}

/**
 * Six weeks of cells covering `month`, including the leading and trailing days needed
 * to fill whole weeks.
 *
 * Always 42 cells, never 35: a variable row count makes the grid jump height as the
 * user pages through months, which reads as a layout bug.
 */
export function monthGrid(month: Date, weekStart: WeekStart = 1, now = new Date()): CalendarCell[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() - weekStart + 7) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - offset)

  const todayString = toDayString(now)
  const cells: CalendarCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const day = toDayString(d)
    cells.push({
      day,
      inMonth: d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear(),
      isToday: day === todayString,
    })
  }
  return cells
}

export function addMonths(month: Date, delta: number): Date {
  // Day 1 on purpose: `new Date(2026, 0, 31)` plus one month is 3 March, not February.
  return new Date(month.getFullYear(), month.getMonth() + delta, 1)
}

/** The inclusive day range a month grid covers, for one bounded query. */
export function gridRange(month: Date, weekStart: WeekStart = 1): { from: string; to: string } {
  const cells = monthGrid(month, weekStart)
  return { from: cells[0].day, to: cells[cells.length - 1].day }
}

/** Buckets rows by their event_date, for O(1) lookup per cell. */
export function bucketByDay<T extends { event_date: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const list = map.get(row.event_date)
    if (list) list.push(row)
    else map.set(row.event_date, [row])
  }
  return map
}

export function isPast(day: string, now = new Date()): boolean {
  return parseDay(day) < new Date(now.getFullYear(), now.getMonth(), now.getDate())
}
