import { EVENT_TYPES, eventTypeOf, type EventTypeOption } from './constants'
import { isBoardEntry } from './boardFormat'
import { sectorOptions } from './sectors'
import type { ActivityFeedRow, CoverageBoardRow, RosterMember, TeamOption } from './types'

/**
 * The Matrix: every row of the desk against every kind of work it logs.
 *
 * A row is a "subject" -- a covered stock ("My Company") or an analyst ("By Analyst").
 * Pure helpers only: who a row is, bucketing entries into its cells, and grouping rows
 * into the tabs along the top of the grid.
 */

/** One column per Log-sheet tile, in the same order, so a cell maps to `initialTypeId`. */
export const MATRIX_COLUMNS: EventTypeOption[] = EVENT_TYPES

/**
 * Row density: compressed is one line per cell, default the next event plus the latest
 * two, expanded the latest four with an excerpt of their takeaways. Older entries sit
 * behind "+N earlier" in the cell and in the pop view.
 */
export type MatrixDensity = 'compact' | 'default' | 'expanded'

/** Logged entries a cell shows before "+N earlier", per density. */
export const CELL_LIMIT: Record<MatrixDensity, number> = { compact: 0, default: 2, expanded: 4 }

/** The two surface directions; graphite is a preview of the institutional dark look. */
export type MatrixTheme = 'warm' | 'graphite'

/**
 * A one-line plain-text excerpt of markdown takeaways for a dense cell: no table pipes,
 * heading hashes or emphasis marks, whitespace collapsed. The pop view renders the real
 * markdown.
 */
export function excerpt(md: string | null | undefined, max = 180): string {
  if (!md) return ''
  const text = md
    .replace(/^\s*\|?\s*:?-{2,}.*$/gm, ' ')        // table separator rows
    .replace(/[|#>*_`~]+/g, ' ')                   // table pipes, headings, emphasis
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')        // links -> their text
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

/** Logged entries a cell holds beyond the ones it shows. */
export function hiddenCount(entries: ActivityFeedRow[], limit: number): number {
  return Math.max(0, entries.filter((e) => !e.is_scheduled).length - limit)
}

export type MatrixGrouping = 'sector' | 'team'

export type MatrixSubject =
  | { kind: 'stock'; id: string; title: string; stock: CoverageBoardRow }
  | { kind: 'analyst'; id: string; title: string; role: string | null; teamIds: string[] }

/** The tile an entry belongs under. `site_visit` has no tile of its own; it is a plant visit. */
export function matrixTypeId(row: Pick<ActivityFeedRow, 'kind' | 'subtype'>): string {
  if (row.subtype === 'site_visit') return 'plant_visit'
  return eventTypeOf(row.kind, row.subtype).id
}

/** Whose work an entry is: the analyst it was logged for, else whoever logged it (as ownerName). */
export const ownerId = (row: Pick<ActivityFeedRow, 'analyst_id' | 'created_by'>) =>
  row.analyst_id ?? row.created_by

export type MatrixCells = Map<string, Map<string, ActivityFeedRow[]>>

/** row id -> type id -> entries, newest first (the order the window is read in). */
export function bucketEvents(rows: ActivityFeedRow[], keyOf: (r: ActivityFeedRow) => string): MatrixCells {
  const cells: MatrixCells = new Map()
  for (const row of rows) {
    const key = keyOf(row)
    let byType = cells.get(key)
    if (!byType) cells.set(key, (byType = new Map()))
    const typeId = matrixTypeId(row)
    const list = byType.get(typeId)
    if (list) list.push(row)
    else byType.set(typeId, [row])
  }
  return cells
}

/** Every entry in a row, newest first. */
export function rowEntries(byType: Map<string, ActivityFeedRow[]> | undefined): ActivityFeedRow[] {
  if (!byType) return []
  return [...byType.values()].flat().sort((a, b) => b.event_date.localeCompare(a.event_date))
}

/**
 * Entries of a row that are research artifacts, newest first -- the Source Documents
 * column: anything carrying files, and notes written on the Thinking Board.
 */
export function documentEntries(byType: Map<string, ActivityFeedRow[]> | undefined): ActivityFeedRow[] {
  return rowEntries(byType).filter((r) => r.attachment_count > 0 || isBoardEntry(r.kta))
}

export interface MatrixGroup {
  key: string
  label: string
  rows: MatrixSubject[]
}

export const UNASSIGNED = '__unassigned__'

const byTitle = (a: MatrixSubject, b: MatrixSubject) => a.title.localeCompare(b.title)
const tidy = (s: string | null | undefined) => s?.trim().replace(/\s+/g, ' ').toLowerCase() ?? ''

export function stockSubjects(board: CoverageBoardRow[]): MatrixSubject[] {
  return board.map((stock) => ({ kind: 'stock', id: stock.id, title: stock.ticker, stock }))
}

/**
 * Everyone whose work the viewer can see. The roster is the source of truth; anyone who
 * owns an entry but is missing from it (a solo user, or the team migration not applied)
 * is added from the feed so their work never disappears from the grid.
 */
export function analystSubjects(roster: RosterMember[] | null | undefined, feed: ActivityFeedRow[]): MatrixSubject[] {
  const people = new Map<string, MatrixSubject>()
  for (const m of roster ?? []) {
    people.set(m.user_id, { kind: 'analyst', id: m.user_id, title: m.username ?? 'Unknown', role: m.role, teamIds: m.team_ids })
  }
  for (const r of feed) {
    const id = ownerId(r)
    if (people.has(id)) continue
    const name = (r.analyst_id ? r.analyst_username : r.created_by_username) ?? r.created_by_username ?? 'Unknown'
    people.set(id, { kind: 'analyst', id, title: name, role: null, teamIds: [] })
  }
  return [...people.values()]
}

/** "My Company": one group per sector, as the desk spells it. */
export function groupBySector(rows: MatrixSubject[]): MatrixGroup[] {
  const stocks = rows.filter((r): r is Extract<MatrixSubject, { kind: 'stock' }> => r.kind === 'stock')
  const groups = sectorOptions(stocks.map((s) => s.stock)).map<MatrixGroup>((name) => ({
    key: name,
    label: name,
    rows: stocks.filter((s) => tidy(s.stock.sector) === name.toLowerCase()).sort(byTitle),
  }))
  const loose = stocks.filter((s) => !tidy(s.stock.sector)).sort(byTitle)
  if (loose.length) groups.push({ key: UNASSIGNED, label: 'No sector', rows: loose })
  return groups
}

/** "By Analyst": one group per team. Someone on two teams appears under both. */
export function groupByTeam(rows: MatrixSubject[], teams: TeamOption[] | null | undefined): MatrixGroup[] {
  const groups = (teams ?? [])
    .map<MatrixGroup>((t) => ({
      key: t.id,
      label: t.name,
      rows: rows.filter((r) => r.kind === 'analyst' && r.teamIds.includes(t.id)).sort(byTitle),
    }))
    .filter((g) => g.rows.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label))
  const known = new Set((teams ?? []).map((t) => t.id))
  const loose = rows
    .filter((r) => r.kind === 'analyst' && !r.teamIds.some((id) => known.has(id)))
    .sort(byTitle)
  if (loose.length) groups.push({ key: UNASSIGNED, label: 'No team', rows: loose })
  return groups
}

export function matchesSearch(row: MatrixSubject, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  if (row.title.toLowerCase().includes(needle)) return true
  return row.kind === 'stock' && (row.stock.company_name ?? '').toLowerCase().includes(needle)
}
