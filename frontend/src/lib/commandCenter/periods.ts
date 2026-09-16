/**
 * Indian fiscal-period arithmetic for the concall and annual-report trackers.
 *
 * FY26 runs 1 Apr 2025 - 31 Mar 2026, and a fiscal year is named for the calendar year
 * it ENDS in. Quarters follow: Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar.
 *
 * Labels produced here must satisfy the `cc_events_period_label_format` CHECK in
 * database/migration_add_command_center.sql: /^(Q[1-4] )?(FY|CY)[0-9]{2}([0-9]{2})?$/.
 */

/** April, zero-indexed, is where a fiscal year starts. */
const FY_START_MONTH = 3

export interface FiscalQuarter {
  /** 1-4 */
  quarter: number
  /** Four-digit year the fiscal year ends in, e.g. 2026 for FY26. */
  fyYear: number
}

export function fiscalQuarterOf(date: Date): FiscalQuarter {
  const month = date.getMonth()
  const quarter = Math.floor(((month - FY_START_MONTH + 12) % 12) / 3) + 1
  const fyYear = month >= FY_START_MONTH ? date.getFullYear() + 1 : date.getFullYear()
  return { quarter, fyYear }
}

/** 'Q2 FY26' */
export function formatQuarterLabel({ quarter, fyYear }: FiscalQuarter): string {
  return `Q${quarter} FY${String(fyYear).slice(-2)}`
}

/** 'FY25' */
export function formatFyLabel(fyYear: number): string {
  return `FY${String(fyYear).slice(-2)}`
}

/** The first day of a fiscal quarter, which is what the calendar sorts on. */
export function startOfFiscalQuarter({ quarter, fyYear }: FiscalQuarter): Date {
  const monthIndex = (FY_START_MONTH + (quarter - 1) * 3) % 12
  // Q1-Q3 sit in the previous calendar year; Q4 (Jan-Mar) lands in the naming year.
  const calendarYear = monthIndex >= FY_START_MONTH ? fyYear - 1 : fyYear
  return new Date(calendarYear, monthIndex, 1)
}

function previousQuarter({ quarter, fyYear }: FiscalQuarter): FiscalQuarter {
  return quarter === 1 ? { quarter: 4, fyYear: fyYear - 1 } : { quarter: quarter - 1, fyYear }
}

/**
 * The most recent COMPLETED fiscal quarters, newest first.
 *
 * Completed, not current: a company reports Q2 results weeks after September ends, so
 * showing the in-progress quarter in the concall tracker would put a permanently empty
 * cell at the front and train people to ignore the first column.
 */
export function recentQuarters(count = 8, asOf: Date = new Date()): FiscalQuarter[] {
  let cursor = previousQuarter(fiscalQuarterOf(asOf))
  const out: FiscalQuarter[] = []
  for (let i = 0; i < count; i++) {
    out.push(cursor)
    cursor = previousQuarter(cursor)
  }
  return out
}

/**
 * The most recent COMPLETED fiscal years, newest first. A fiscal year ends 31 March, so
 * between January and March the year in progress is not yet reportable.
 */
export function recentFiscalYears(count = 5, asOf: Date = new Date()): number[] {
  const current = fiscalQuarterOf(asOf).fyYear
  const lastComplete = current - 1
  return Array.from({ length: count }, (_, i) => lastComplete - i)
}

/** Parses 'Q2 FY26' / 'FY25' back into something sortable. Null when unrecognised. */
export function parsePeriodLabel(label: string | null | undefined): FiscalQuarter | null {
  if (!label) return null
  const match = /^(?:Q([1-4])\s+)?(?:FY|CY)(\d{2}(?:\d{2})?)$/.exec(label.trim())
  if (!match) return null
  const [, q, rawYear] = match
  const fyYear = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)
  return { quarter: q ? Number(q) : 4, fyYear }
}

/**
 * The trackers step through periods as plain integers so "older", "newer" and "how
 * far back" are arithmetic: a quarter is fyYear * 4 + (quarter - 1), a year is fyYear.
 */
export type PeriodKind = 'concall' | 'annual_report'

/** The key for a label of this kind, or null when the label is the other shape. */
export function periodKey(kind: PeriodKind, label: string | null | undefined): number | null {
  const parsed = parsePeriodLabel(label)
  if (!parsed) return null
  const isQuarter = /^Q[1-4]\s/.test(label!.trim())
  if (kind === 'concall') return isQuarter ? parsed.fyYear * 4 + parsed.quarter - 1 : null
  return isQuarter ? null : parsed.fyYear
}

export function periodLabelOf(kind: PeriodKind, key: number): string {
  return kind === 'concall'
    ? formatQuarterLabel({ quarter: (key % 4) + 1, fyYear: Math.floor(key / 4) })
    : formatFyLabel(key)
}

/** The newest period that has finished, so its concall or annual report is due. */
export function latestCompletedKey(kind: PeriodKind, asOf: Date = new Date()): number {
  return kind === 'concall'
    ? periodKey('concall', formatQuarterLabel(recentQuarters(1, asOf)[0]))!
    : recentFiscalYears(1, asOf)[0]
}

/** Labels from `newestKey` back through `oldestKey`, newest first. */
export function periodLabels(kind: PeriodKind, newestKey: number, oldestKey: number): string[] {
  const out: string[] = []
  for (let k = newestKey; k >= oldestKey; k--) out.push(periodLabelOf(kind, k))
  return out
}
