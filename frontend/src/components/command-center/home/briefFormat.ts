import type { Brief } from '@/lib/commandCenter/types'

const IST = 'Asia/Kolkata'

/** "Fri 20 Nov" for a daily brief, "16–23 Nov" for a weekly one -- always in IST. */
export function briefDateLabel(brief: Brief): string {
  if (brief.kind === 'daily') {
    // brief_date is a calendar date; noon UTC keeps it the same day in any zone.
    return new Date(`${brief.brief_date}T12:00:00Z`).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
    })
  }
  const fmt = (iso: string, withMonth: boolean) => new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', ...(withMonth ? { month: 'short' } : {}), timeZone: IST,
  })
  const start = new Date(brief.period_start), end = new Date(brief.period_end)
  const sameMonth = start.toLocaleString('en-GB', { month: 'short', timeZone: IST })
    === end.toLocaleString('en-GB', { month: 'short', timeZone: IST })
  return `${fmt(brief.period_start, !sameMonth)}–${fmt(brief.period_end, true)}`
}

export function durationLabel(seconds: number | null): string | null {
  if (!seconds) return null
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
