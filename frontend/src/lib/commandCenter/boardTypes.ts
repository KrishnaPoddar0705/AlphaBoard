/**
 * Thinking Board types (database/migration_command_center_thinking_board.sql) and the
 * normalised connector payload the backend returns from GET /api/board/sources/*.
 */

export type ConnectorId =
  | 'concall' | 'events' | 'news' | 'results'
  | 'pnl' | 'balance' | 'cashflow' | 'ratios' | 'shareholding'

export type SourceId = 'drishti' | 'screener' | 'yahoo'

export interface SourceTable {
  /** First column is the row label; the rest are periods (Mar 2024, Sep 2026 ...). */
  columns: string[]
  rows: Array<Array<string | number | null>>
}

export interface SourceChart {
  type: 'bar' | 'line'
  /** Row labels in `table` to plot, one series each. */
  series: string[]
  /** Columns that form the time axis, oldest first. Absent on older snapshots. */
  periods?: string[]
}

export interface SourceItem {
  date: string | null
  title: string
  summary?: string | null
  url?: string | null
  tag?: string | null
  sentiment?: 'positive' | 'negative' | 'neutral' | null
}

export interface SourceSection {
  heading: string
  bullets: string[]
  /** Long-form analysis (markdown) behind the bullets, e.g. a concall's full Q&A write-up. */
  markdown?: string | null
}

export interface SourcePayload {
  connector: ConnectorId
  source: SourceId
  source_url: string | null
  fetched_at: string
  title: string
  subtitle?: string | null
  /** Why the primary source was passed over, e.g. "Drishti answered 401 (key rejected)". */
  fallback_note?: string | null
  table?: SourceTable | null
  chart?: SourceChart | null
  items?: SourceItem[] | null
  sections?: SourceSection[] | null
}

/** A connector result floating on the canvas, before (or after) it goes in the doc. */
export interface BoardCard {
  id: string
  payload: SourcePayload
  /**
   * The quarter it was pulled for: a Drishti key, or null for "Latest". Only meaningful
   * for quarter-aware connectors. Undefined on cards saved before this was recorded.
   */
  quarter?: string | null
  side: 'left' | 'right'
  collapsed?: boolean
}

export interface BoardFolder {
  id: string
  coverage_id: string
  parent_id: string | null
  name: string
  position: number
  created_at: string
}

/** TipTap JSONContent, kept loose here so lib code does not import the editor. */
export interface DocNode {
  type?: string
  attrs?: Record<string, unknown>
  content?: DocNode[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  text?: string
}

export interface Board {
  id: string
  coverage_id: string
  folder_id: string | null
  title: string
  doc: DocNode
  doc_markdown: string
  cards: BoardCard[]
  published_event_id: string | null
  last_published_at: string | null
  created_at: string
  updated_at: string
}

/** Tree listing: everything but the heavy document body. */
export type BoardSummary = Pick<Board,
  'id' | 'coverage_id' | 'folder_id' | 'title' | 'published_event_id' |
  'last_published_at' | 'updated_at'>

export const EMPTY_DOC: DocNode = { type: 'doc', content: [{ type: 'paragraph' }] }

/** The outline most desk notes end up with. Empty sections, so nothing has to be deleted. */
export const STARTER_DOC: DocNode = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Thesis' }] },
    { type: 'paragraph' },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'What changed' }] },
    { type: 'paragraph' },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'The numbers' }] },
    { type: 'paragraph' },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Risks' }] },
    { type: 'paragraph' },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Open questions' }] },
    { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] },
  ],
}

/** "ADANIPORTS research note" -- the exchange suffix is noise in a title. */
export function starterTitle(ticker: string | null | undefined): string {
  return `${(ticker ?? '').replace(/\.(NS|BO)$/, '')} research note`.trim()
}
