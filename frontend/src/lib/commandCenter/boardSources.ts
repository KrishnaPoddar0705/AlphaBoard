import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import type { ConnectorId, SourcePayload, SourceId } from './boardTypes'
import {
  PhoneCall, Megaphone, Newspaper, FileBarChart, Receipt, Scale, Banknote,
  LineChart, PieChart, type LucideIcon,
} from 'lucide-react'

/**
 * The Thinking Board's data connectors. Unlike the rest of Command Center these go
 * through FastAPI, because Drishti needs a server-held key and Screener needs scraping.
 * The route verifies the caller's Supabase access token itself (backend/app/auth.py),
 * which is why this sends it -- the existing FastAPI client sends no auth at all.
 */

export interface ConnectorDef {
  id: ConnectorId
  label: string
  /** One line under the label in the rail and the slash menu. */
  hint: string
  icon: LucideIcon
  /** Primary source first; the backend walks the chain until one answers. */
  sources: SourceId[]
  wantsQuarter?: boolean
}

export const CONNECTORS: ConnectorDef[] = [
  { id: 'concall', label: 'Concall', hint: 'Guidance, red flags, transcript',
    icon: PhoneCall, sources: ['drishti', 'screener'], wantsQuarter: true },
  { id: 'events', label: 'Corporate events', hint: 'Exchange announcements & filings',
    icon: Megaphone, sources: ['drishti', 'screener'] },
  { id: 'news', label: 'News', hint: 'Company news with sentiment',
    icon: Newspaper, sources: ['drishti', 'yahoo'] },
  { id: 'results', label: 'Quarterly results', hint: 'Last 12 quarters',
    icon: FileBarChart, sources: ['drishti', 'screener', 'yahoo'], wantsQuarter: true },
  { id: 'pnl', label: 'Income statement', hint: 'Annual P&L, 10+ years',
    icon: Receipt, sources: ['screener', 'yahoo'] },
  { id: 'balance', label: 'Balance sheet', hint: 'Assets, liabilities, reserves',
    icon: Scale, sources: ['screener', 'yahoo'] },
  { id: 'cashflow', label: 'Cash flow', hint: 'Operating, investing, financing',
    icon: Banknote, sources: ['screener', 'yahoo'] },
  { id: 'ratios', label: 'Ratios & history', hint: 'ROCE, working capital days',
    icon: LineChart, sources: ['screener'] },
  { id: 'shareholding', label: 'Shareholding', hint: 'Promoter, FII, DII, public',
    icon: PieChart, sources: ['screener'] },
]

export const CONNECTOR_BY_ID = Object.fromEntries(CONNECTORS.map((c) => [c.id, c])) as
  Record<ConnectorId, ConnectorDef>

/**
 * What makes two pulls "the same data" on one board: the connector, plus the quarter for
 * connectors that take one. Returns null for a legacy card whose quarter was never
 * recorded, so it is never mistaken for a match.
 */
export function pullKey(connector: ConnectorId, quarter: string | null | undefined): string | null {
  if (!CONNECTOR_BY_ID[connector]?.wantsQuarter) return connector
  if (quarter === undefined) return null
  return `${connector}:${quarter || 'latest'}`
}

export const SOURCE_LABELS: Record<SourceId, string> = {
  drishti: 'Drishti',
  screener: 'Screener.in',
  yahoo: 'Yahoo Finance',
}

export interface FetchSourceArgs {
  connector: ConnectorId
  ticker: string
  /** Drishti quarter key, e.g. q2_27. Optional: the backend picks the latest. */
  quarter?: string | null
}

export async function fetchSource(args: FetchSourceArgs, signal?: AbortSignal): Promise<SourcePayload> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Not signed in to the database yet. Reload the page and try again.')
  }
  try {
    const res = await api.get<SourcePayload>(`/api/board/sources/${args.connector}`, {
      params: { ticker: args.ticker, quarter: args.quarter || undefined },
      headers: { Authorization: `Bearer ${session.access_token}` },
      signal,
    })
    return res.data
  } catch (err) {
    const e = err as { response?: { status?: number; data?: { detail?: string; error?: string } } }
    const status = e.response?.status
    const detail = e.response?.data?.detail ?? e.response?.data?.error
    if (status === 401) throw new Error('Your session expired. Reload the page to pull data again.')
    if (status === 429) throw new Error('Too many pulls in a minute. Give it a moment.')
    if (status === 404) throw new Error(detail || 'No source had this data for that stock.')
    if (!e.response) throw new Error('Could not reach the AlphaBoard data service.')
    throw new Error(detail || 'The data source failed. Try again.')
  }
}

/** Last N fiscal quarters as Drishti keys (q2_27 = Q2 FY27, Jul-Sep 2026). */
export function recentQuarters(now = new Date(), count = 8): Array<{ key: string; label: string }> {
  // Indian FY: Apr-Mar. Q1 = Apr-Jun. FY27 starts Apr 2026.
  const m = now.getMonth() // 0 = Jan
  let fy = m >= 3 ? now.getFullYear() + 1 : now.getFullYear()
  let q = m >= 3 ? Math.floor((m - 3) / 3) + 1 : 4
  // Results for the running quarter are not out yet; start from the last completed one.
  q -= 1
  if (q === 0) { q = 4; fy -= 1 }
  const out: Array<{ key: string; label: string }> = []
  for (let i = 0; i < count; i++) {
    const yy = String(fy % 100).padStart(2, '0')
    out.push({ key: `q${q}_${yy}`, label: `Q${q} FY${yy}` })
    q -= 1
    if (q === 0) { q = 4; fy -= 1 }
  }
  return out
}
