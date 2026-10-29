import type { SourceChart, SourceId, SourcePayload, SourceTable } from './boardTypes'
import { SOURCE_LABELS } from './boardSources'

/** Indian grouping (1,23,456) for the ₹ Cr tables analysts read every day. */
export function formatCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') {
    const abs = Math.abs(value)
    const digits = abs >= 100 || Number.isInteger(value) ? 0 : abs >= 10 ? 1 : 2
    return value.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
  }
  return value
}

/**
 * The most recent `maxPeriods` columns, keeping the label column. Screener P&L runs
 * twelve years wide; a log entry and a card both read better at the latest eight.
 */
export function recentColumns(table: SourceTable, maxPeriods: number): SourceTable {
  const periods = table.columns.length - 1
  if (periods <= maxPeriods) return table
  const start = 1 + periods - maxPeriods
  return {
    columns: [table.columns[0], ...table.columns.slice(start)],
    rows: table.rows.map((r) => [r[0], ...r.slice(start)]),
  }
}

export function formatFetched(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatItemDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function sourceLine(p: SourcePayload): string {
  return `${SOURCE_LABELS[p.source]} · ${formatFetched(p.fetched_at)}`
}

/** Ink first, then forest, ochre, ink-blue: legible on paper, distinct in greyscale. */
export const SERIES_COLORS = ['#1C1B17', '#2F8F5B', '#B7862B', '#2C4F7C']

export const SOURCE_COLORS: Record<SourceId, string> = {
  drishti: '#2E5E4E',
  screener: '#2C4F7C',
  yahoo: '#5B3E8E',
}

/** 'Mar 2026', 'Q1 FY27', 'FY26' are periods; 'TTM', 'YoY %' and 'QoQ %' are not. */
const PERIOD_RE = /^(?:[A-Z][a-z]{2} \d{4}|Q[1-4] FY\d{2}|FY\d{2})$/
const MIN_CHART_PERIODS = 3

export interface ChartPlan {
  type: 'bar' | 'line'
  periods: string[]
  series: Array<{ label: string; values: Array<number | null> }>
}

/**
 * Whether a dataset deserves a chart, and which one. A chart is drawn only over a time
 * axis of three or more periods, for series with real numbers in at least three of them,
 * and with one unit per chart (a % series never shares an axis with ₹ Cr or days).
 * Everything else is better read as a table, so this returns null.
 */
export function chartPlan(table: SourceTable | null | undefined, chart: SourceChart | null | undefined,
  maxPeriods = 12): ChartPlan | null {
  if (!table || !chart || !chart.series.length) return null
  const cols = table.columns.map(String)
  let periods = (chart.periods?.length ? chart.periods : cols.slice(1).filter((c) => PERIOD_RE.test(c)))
    .filter((p) => cols.includes(p))
  periods = periods.slice(-maxPeriods)
  if (periods.length < MIN_CHART_PERIODS) return null
  const idx = periods.map((p) => cols.indexOf(p))

  let series = chart.series.flatMap((label) => {
    const row = table.rows.find((r) => r[0] === label)
    if (!row) return []
    const values = idx.map((i) => (typeof row[i] === 'number' ? (row[i] as number) : null))
    const real = values.filter((v): v is number => v !== null)
    return real.length >= MIN_CHART_PERIODS && real.some((v) => v !== 0) ? [{ label, values }] : []
  })
  const pct = series.filter((s) => s.label.includes('%'))
  if (pct.length && pct.length < series.length) series = pct
  if (!series.length) return null

  return { type: pct.length ? 'line' : chart.type, periods, series }
}

/** "Sep 2024" -> "Sep '24"; quarter labels pass through. */
export function shortPeriod(p: string): string {
  return p.replace(/^(\w{3}) \d{2}(\d{2})$/, "$1 '$2")
}

// ---------------------------------------------------------------------------
// Charts inside published markdown
// ---------------------------------------------------------------------------
// A published note is markdown in cc_events.kta, shown by ThesisMarkdown. Each data
// block carries its chart as an HTML comment just above its table:
//
//   <!-- alphaboard:chart {"type":"bar","periods":[...],"series":[...]} -->
//
// react-markdown drops raw HTML, so any renderer that does not know the marker shows
// the table alone, and stripMarkdown removes it from previews. No schema change needed.


export function chartMarker(plan: ChartPlan): string {
  // '>' escaped so no label can ever close the comment early.
  return `<!-- alphaboard:chart ${JSON.stringify(plan).replace(/>/g, '\\u003e')} -->`
}

export type MarkdownPart =
  | { kind: 'markdown'; text: string }
  | { kind: 'chart'; plan: ChartPlan }
  | { kind: 'fold'; title: string; text: string }

/** A fold ("Full analysis") in published markdown: start and end markers around its text. */
export function foldMarkers(title: string): { start: string; end: string } {
  return {
    start: `<!-- alphaboard:fold ${JSON.stringify({ title }).replace(/>/g, '\\u003e')} -->`,
    end: '<!-- alphaboard:endfold -->',
  }
}

// Any other board marker (e.g. <!-- alphaboard:board -->): metadata, never displayed.
const OTHER_MARKER = /<!-- alphaboard:[a-z]+(?: \{[\s\S]*?\})? -->/g
const TOKEN = /<!-- alphaboard:chart (\{[\s\S]*?\}) -->|<!-- alphaboard:fold (\{[\s\S]*?\}) -->([\s\S]*?)<!-- alphaboard:endfold -->/g

/**
 * Splits published markdown into prose, chart and fold parts, removing every board
 * marker. Must run on the RAW text: the thesis renderer escapes '<' afterwards, which
 * would turn a marker into visible text. Malformed markers degrade to plain text parts.
 */
export function splitChartMarkers(markdown: string): MarkdownPart[] {
  if (!markdown.includes('alphaboard:')) return [{ kind: 'markdown', text: markdown }]
  const parts: MarkdownPart[] = []
  const prose = (t: string) => {
    const text = t.replace(OTHER_MARKER, '').replace(/<!-- alphaboard:[\s\S]*?-->/g, '')
    if (text.trim()) parts.push({ kind: 'markdown', text })
  }
  let last = 0
  let m: RegExpExecArray | null
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(markdown))) {
    prose(markdown.slice(last, m.index))
    last = m.index + m[0].length
    try {
      if (m[1]) {
        const plan = JSON.parse(m[1]) as ChartPlan
        if (Array.isArray(plan.periods) && Array.isArray(plan.series) && plan.series.length) parts.push({ kind: 'chart', plan })
      } else {
        const { title } = JSON.parse(m[2]) as { title?: string }
        const text = m[3].replace(/<!-- alphaboard:[\s\S]*?-->/g, '')
        if (text.trim()) parts.push({ kind: 'fold', title: title || 'Full analysis', text })
      }
    } catch { /* a hand-edited or truncated marker: skip it, keep the prose around it */ }
  }
  prose(markdown.slice(last))
  return parts
}

/**
 * Tags a log entry as written on the Thinking Board. Hidden like the chart markers, and
 * read by the Matrix to list board notes under Source documents. Team-visible because
 * it travels in the entry itself -- the board behind it stays private to its author.
 */
export const BOARD_MARKER = '<!-- alphaboard:board -->'

export function isBoardEntry(kta: string | null | undefined): boolean {
  return !!kta && kta.includes('<!-- alphaboard:')
}
