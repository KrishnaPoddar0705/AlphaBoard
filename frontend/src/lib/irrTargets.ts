/**
 * IRR Targets
 *
 * Analysts publish an expected IRR (annualised %) paired with a horizon bucket,
 * not an absolute price target. The horizon is a *range* of months rather than a
 * single date, so it is stored as an inclusive-exclusive [start, end) month pair.
 *
 * This module is the single source of truth for those buckets — the modals, the
 * timeline, the admin dashboard and the backend validation all key off it.
 */

export interface IrrTimeframe {
  /** Stable value used in <Select> and sent to the API. */
  value: string
  /** Human label, e.g. "12–18 months". */
  label: string
  startMonths: number
  endMonths: number
}

const BOUNDARIES = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60] as const

export const IRR_TIMEFRAMES: IrrTimeframe[] = BOUNDARIES.slice(0, -1).map((start, i) => {
  const end = BOUNDARIES[i + 1]
  return {
    value: `${start}-${end}`,
    label: `${start}–${end} months`,
    startMonths: start,
    endMonths: end,
  }
})

export const DEFAULT_IRR_TIMEFRAME = IRR_TIMEFRAMES[1].value // 6–12 months

export function getTimeframe(value: string | null | undefined): IrrTimeframe | null {
  if (!value) return null
  return IRR_TIMEFRAMES.find((t) => t.value === value) ?? null
}

/** Rebuild a bucket from the month bounds the API returns. */
export function timeframeFromMonths(
  startMonths: number | null | undefined,
  endMonths: number | null | undefined
): IrrTimeframe | null {
  if (startMonths === null || startMonths === undefined) return null
  if (endMonths === null || endMonths === undefined) return null
  return (
    IRR_TIMEFRAMES.find((t) => t.startMonths === startMonths && t.endMonths === endMonths) ?? {
      value: `${startMonths}-${endMonths}`,
      label: `${startMonths}–${endMonths} months`,
      startMonths,
      endMonths,
    }
  )
}

/** "18.5% IRR" — keeps trailing-zero noise out of whole numbers. */
export function formatIrr(irr: number | null | undefined): string {
  if (irr === null || irr === undefined || Number.isNaN(irr)) return '—'
  const rounded = Math.round(irr * 100) / 100
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}%`
}

/**
 * Analysts type IRR as a percentage. Anything outside this band is almost
 * certainly a typo (e.g. a price pasted into the IRR field).
 */
export const IRR_MIN = -100
export const IRR_MAX = 1000

export function validateIrr(raw: string): { value: number } | { error: string } {
  if (!raw.trim()) return { error: 'Please enter an IRR target' }
  const value = parseFloat(raw)
  if (Number.isNaN(value)) return { error: 'IRR target must be a number' }
  if (value < IRR_MIN || value > IRR_MAX) {
    return { error: `IRR target must be between ${IRR_MIN}% and ${IRR_MAX}%` }
  }
  return { value }
}
