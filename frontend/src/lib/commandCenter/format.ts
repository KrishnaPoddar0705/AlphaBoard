/**
 * Date formatting for Command Center.
 *
 * Everything here treats a date as a plain calendar day. `event_date` is a Postgres
 * DATE, so it arrives as 'YYYY-MM-DD' with no timezone -- passing that straight to
 * `new Date()` parses it as UTC midnight, which renders as the PREVIOUS day for anyone
 * west of Greenwich. `parseDay` avoids that by constructing from the parts.
 */

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** 'YYYY-MM-DD' for a local date, which is what the database columns expect. */
export function toDayString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const today = (): string => toDayString(new Date())

export function addDays(iso: string, days: number): string {
  const d = parseDay(iso)
  d.setDate(d.getDate() + days)
  return toDayString(d)
}

/** '14 Mar 2026' */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return '--'
  return parseDay(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/** '14 Mar' -- for dense lists where the year is implied by the grouping. */
export function formatDayShort(iso: string | null | undefined): string {
  if (!iso) return '--'
  return parseDay(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** 'March 2026' */
export function formatMonth(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function daysBetween(iso: string, from: Date = new Date()): number {
  const a = parseDay(iso)
  const b = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * '12d ago' / 'today' / 'in 5d'. Deliberately terse: these sit inside dense cards where
 * "12 days ago" would wrap.
 */
export function relativeDays(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const diff = daysBetween(iso)
  if (diff === 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff === -1) return 'tomorrow'
  if (diff > 0) return diff < 365 ? `${diff}d ago` : `${Math.floor(diff / 365)}y ago`
  const ahead = -diff
  return ahead < 365 ? `in ${ahead}d` : `in ${Math.floor(ahead / 365)}y`
}

/** Groups timeline rows into month buckets, newest first, preserving row order. */
export function groupByMonth<T extends { event_date: string }>(
  rows: T[]
): Array<{ key: string; label: string; rows: T[] }> {
  const buckets = new Map<string, T[]>()
  for (const row of rows) {
    const key = row.event_date.slice(0, 7)   // YYYY-MM
    const list = buckets.get(key)
    if (list) list.push(row)
    else buckets.set(key, [row])
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, rows]) => ({
      key,
      label: formatMonth(parseDay(`${key}-01`)),
      rows,
    }))
}
