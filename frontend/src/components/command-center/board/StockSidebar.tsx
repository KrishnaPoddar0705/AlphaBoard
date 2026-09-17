import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useRailFilters } from '@/lib/commandCenter/railFilters'
import { useCoverageBoard } from '@/hooks/commandCenter/useCoverage'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import { useMyTeams, useRoster } from '@/hooks/commandCenter/useHome'
import { stockTeams } from '@/lib/commandCenter/teams'
import { healthBandFor, HEALTH_COLORS } from '@/lib/commandCenter/constants'
import type { HealthBand } from '@/lib/commandCenter/constants'
import { relativeDays } from '@/lib/commandCenter/format'
import type { CoverageBoardRow } from '@/lib/commandCenter/types'
import { Bone, Loading } from '../shared/Skeleton'

interface Props {
  /** The ticker currently open in the detail pane, highlighted in the list. */
  selectedTicker?: string
  onAdd?: () => void
  className?: string
}

/**
 * "Mine" means I am the named lead, or nobody is and I put it on the board.
 * Module scope so the memos depend on `userId` explicitly.
 */
function isMine(r: CoverageBoardRow, userId: string | null): boolean {
  return r.lead_analyst_id === userId || (!r.lead_analyst_id && r.created_by === userId)
}

const selectClass =
  'w-full rounded-md border border-[#D7D0C2] bg-[#FBF7ED] px-2 py-1.5 font-mono text-[11px] ' +
  'text-[#1C1B17] focus:border-[#8B857A] focus:outline-none'

/**
 * A scope count, or a dash holding its place.
 *
 * Reserves a fixed width so the chips do not jump by a character when the number lands.
 */
function Count({ n, pending, active }: { n: number; pending: boolean; active: boolean }) {
  return (
    <span className={`inline-block min-w-[1.6em] text-center tabular-nums ${
      active ? 'text-[#C9C3B4]' : 'text-[#8B857A]'
    }`}>
      ({pending ? '–' : n})
    </span>
  )
}

const BANDS: Array<{ value: HealthBand | 'any'; label: string }> = [
  { value: 'any', label: 'All activity' },
  { value: 'cold', label: 'Needs attention' },
  { value: 'stale', label: 'Going quiet' },
  { value: 'untouched', label: 'Nothing logged' },
]

/**
 * The coverage list, as a navigation rail beside the stock being read.
 *
 * Replaces the card grid: cards forced a round trip through a board page to move between
 * two names, which is the wrong shape for a desk that reads one stock after another. Each
 * row is a real <Link> to /command-center/stock/:ticker, so the address bar stays honest
 * and every row is independently openable in a new tab.
 *
 * It owns its own panel chrome -- a bordered, filled card with a sticky filter head and a
 * scrolling list -- so it reads as a distinct surface rather than text floating beside the
 * research. Filters are stacked because the rail is ~270px wide.
 */
export default function StockSidebar({ selectedTicker, onAdd, className }: Props) {
  const { data, isPending } = useCoverageBoard()
  const { userId, organizationId, role } = useCommandCenterSession()
  const { data: teams = [] } = useMyTeams()
  const { data: roster } = useRoster(null)

  // Outside React, so picking a stock -- which crosses a route boundary and remounts
  // this component -- does not discard the analyst's filters. See railFilters.ts.
  const [{ query, scope, team, sector, band }, setFilters] = useRailFilters()

  const rows = useMemo(() => data ?? [], [data])

  const teamsByRow = useMemo(() => {
    const map = new Map<string, ReturnType<typeof stockTeams>>()
    for (const r of rows) map.set(r.id, stockTeams(r, roster, teams))
    return map
  }, [rows, roster, teams])

  const sectors = useMemo(
    () => [...new Set(rows.map((r) => r.sector).filter(Boolean) as string[])].sort(),
    [rows]
  )

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (scope === 'mine' && !isMine(r, userId)) return false
      if (team && !teamsByRow.get(r.id)?.some((t) => t.id === team)) return false
      if (sector && r.sector !== sector) return false
      if (band !== 'any' && healthBandFor(r.days_since_interaction) !== band) return false
      if (term && !`${r.ticker} ${r.company_name ?? ''}`.toLowerCase().includes(term)) return false
      return true
    })
  }, [rows, query, scope, team, sector, band, userId, teamsByRow])

  const counts = useMemo(
    () => ({ mine: rows.filter((r) => isMine(r, userId)).length, all: rows.length }),
    [rows, userId]
  )

  const chip = (active: boolean) =>
    [
      'flex-1 rounded-md border px-2 py-1 font-mono text-[10px] transition-colors',
      active
        ? 'border-[#1C1B17] bg-[#1C1B17] text-[#F7F2E6]'
        : 'border-[#D7D0C2] bg-[#FBF7ED] text-[#6F6A60] hover:text-[#1C1B17]',
    ].join(' ')

  return (
    <aside
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#D7D0C2] bg-[#F7F2E6] ${className ?? ''}`}
    >
      {/* Head: identity, count, and the filters. Visually separated from the list by a
          full-width rule so the rail reads as two zones, not one long column. */}
      <div className="flex flex-col gap-2.5 border-b border-[#D7D0C2] bg-[#F1EEE0] px-3 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6F6A60]">
            Coverage
          </h2>
          <div className="flex items-center gap-2">
            {isPending ? (
              <Bone className="h-3 w-8 rounded" />
            ) : (
              <span className="font-mono text-[10px] tabular-nums text-[#8B857A]">
                {visible.length}{visible.length !== counts.all ? ` / ${counts.all}` : ''}
              </span>
            )}
            {onAdd && (
              <button
                type="button"
                onClick={onAdd}
                className="inline-flex items-center gap-0.5 rounded-md border border-[#D7D0C2] bg-[#FBF7ED] px-1.5 py-0.5 font-mono text-[10px] text-[#6F6A60] transition-colors hover:border-[#8B857A] hover:text-[#1C1B17]"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8B857A]" />
          <input
            value={query}
            onChange={(e) => setFilters({ query: e.target.value })}
            placeholder="Name or ticker"
            className="w-full rounded-md border border-[#D7D0C2] bg-[#FBF7ED] py-1.5 pl-8 pr-2.5 font-mono text-[11px] text-[#1C1B17] placeholder:text-[#8B857A] focus:border-[#8B857A] focus:outline-none"
          />
        </div>

        {/*
          The scope chips render before the board query resolves -- they are how you
          navigate, so hiding them would be worse than showing them. Only the counts
          wait: `rows` is [] while pending, and "Mine (0)" is a claim, not a placeholder.
        */}
        {(organizationId || isPending) && (
          <div className="flex gap-1.5">
            <button type="button" className={chip(scope === 'mine')}
                    onClick={() => setFilters({ scope: 'mine' })}>
              Mine <Count n={counts.mine} pending={isPending} active={scope === 'mine'} />
            </button>
            <button type="button" className={chip(scope === 'all')}
                    onClick={() => setFilters({ scope: 'all' })}>
              {role === 'admin' ? 'All desk' : 'My teams'}{' '}
              <Count n={counts.all} pending={isPending} active={scope === 'all'} />
            </button>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {teams.length > 0 && (
            <select value={team} onChange={(e) => setFilters({ team: e.target.value })}
                    aria-label="Team" className={selectClass}>
              <option value="">All teams</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          {sectors.length > 0 && (
            <select value={sector} onChange={(e) => setFilters({ sector: e.target.value })}
                    aria-label="Sector" className={selectClass}>
              <option value="">All sectors</option>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select value={band} onChange={(e) => setFilters({ band: e.target.value as HealthBand | 'any' })}
                  aria-label="Activity" className={selectClass}>
            {BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {isPending ? (
          <Loading label="Loading coverage" className="flex flex-col gap-1.5">
            {Array.from({ length: 7 }, (_, i) => <Bone key={i} className="h-12 w-full rounded-lg" />)}
          </Loading>
        ) : visible.length === 0 ? (
          <p className="px-2 py-4 font-mono text-[11px] leading-relaxed text-[#8B857A]">
            {rows.length === 0
              ? 'No stocks tracked yet.'
              : scope === 'mine'
                ? 'Nothing matches. You may not be the lead — try “All”.'
                : 'Nothing matches those filters.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {visible.map((r) => {
              const active = r.ticker === selectedTicker
              const { dot } = HEALTH_COLORS[healthBandFor(r.days_since_interaction)]
              return (
                <li key={r.id}>
                  <Link
                    to={`/command-center/stock/${encodeURIComponent(r.ticker)}`}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors',
                      active
                        ? 'border-[#1C1B17] bg-[#1C1B17]'
                        : 'border-transparent hover:border-[#D7D0C2] hover:bg-[#FBF7ED]',
                    ].join(' ')}
                  >
                    <span className="mt-0.5 inline-block h-2 w-2 shrink-0 self-start rounded-full"
                          style={{ backgroundColor: dot }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate font-mono text-xs font-semibold ${
                          active ? 'text-[#F7F2E6]' : 'text-[#1C1B17]'
                        }`}>
                          {r.ticker}
                        </span>
                        <span className={`shrink-0 font-mono text-[10px] tabular-nums ${
                          active ? 'text-[#A9A395]' : 'text-[#8B857A]'
                        }`}>
                          {r.last_interaction_on ? relativeDays(r.last_interaction_on) : '—'}
                        </span>
                      </span>
                      <span className={`mt-0.5 block truncate font-mono text-[10px] ${
                        active ? 'text-[#C9C3B4]' : 'text-[#6F6A60]'
                      }`}>
                        {r.company_name ?? '—'}{r.sector ? ` · ${r.sector}` : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
