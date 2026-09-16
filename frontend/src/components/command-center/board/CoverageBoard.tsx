import { useMemo, useState } from 'react'
import { Radar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCoverageBoard } from '@/hooks/commandCenter/useCoverage'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import { useMyTeams, useRoster } from '@/hooks/commandCenter/useHome'
import { stockTeams, type StockTeam } from '@/lib/commandCenter/teams'
import { healthBandFor } from '@/lib/commandCenter/constants'
import type { CoverageBoardRow } from '@/lib/commandCenter/types'
import CoverageCard from './CoverageCard'
import BoardFilters, { type BoardFilterState } from './BoardFilters'
import EmptyState from '../shared/EmptyState'
import { Bone, CoverageCardSkeleton, Loading } from '../shared/Skeleton'

/**
 * "Mine" means I am the named lead, or nobody is and I put it on the board. Module
 * scope so the memos below depend on `userId` explicitly rather than on a function
 * identity that changes every render.
 */
function isMine(r: CoverageBoardRow, userId: string | null): boolean {
  return r.lead_analyst_id === userId || (!r.lead_analyst_id && r.created_by === userId)
}

export default function CoverageBoard({ onAdd }: { onAdd: () => void }) {
  const { data, isPending, isError, error } = useCoverageBoard()
  const { userId, organizationId, role, resolved } = useCommandCenterSession()
  const { data: teams = [], isPending: teamsPending } = useMyTeams()
  const { data: roster, isPending: rosterPending } = useRoster(null)

  const [filters, setFilters] = useState<BoardFilterState>({
    // Analysts land on their own names; the toggle to the whole desk is one click.
    scope: 'mine', team: '', sector: '', band: 'any', query: '',
  })

  const rows = useMemo(() => data ?? [], [data])

  const teamsByRow = useMemo(() => {
    const map = new Map<string, StockTeam[]>()
    for (const r of rows) map.set(r.id, stockTeams(r, roster, teams))
    return map
  }, [rows, roster, teams])

  const sectors = useMemo(
    () => [...new Set(rows.map((r) => r.sector).filter(Boolean) as string[])].sort(),
    [rows]
  )

  const visible = useMemo(() => {
    const term = filters.query.trim().toLowerCase()
    return rows.filter((r) => {
      if (filters.scope === 'mine' && !isMine(r, userId)) return false
      if (filters.team && !teamsByRow.get(r.id)?.some((t) => t.id === filters.team)) return false
      if (filters.sector && r.sector !== filters.sector) return false
      if (filters.band !== 'any' && healthBandFor(r.days_since_interaction) !== filters.band) return false
      if (term && !`${r.ticker} ${r.company_name ?? ''}`.toLowerCase().includes(term)) return false
      return true
    })
  }, [rows, filters, userId, teamsByRow])

  const counts = useMemo(
    () => ({ mine: rows.filter((r) => isMine(r, userId)).length, all: rows.length }),
    [rows, userId]
  )

  // Everything the filter bar and cards depend on, not just the rows: the board is often
  // served from cache while the role and team roster are still resolving, and the scope
  // chips and team lines used to pop in a moment after the cards.
  const solo = resolved && !organizationId
  if (isPending || !resolved || (!solo && (teamsPending || rosterPending))) {
    return (
      <Loading label="Loading coverage" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2.5">
          <Bone className="h-9 w-full rounded-lg" />
          <div className="flex flex-wrap gap-1.5">
            {[112, 64, 40, 124, 92, 110, 100].map((w) => (
              <span key={w} style={{ width: w }}><Bone className="h-7 rounded-lg" /></span>
            ))}
          </div>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <CoverageCardSkeleton key={i} />)}
        </div>
      </Loading>
    )
  }

  if (isError) {
    return (
      <EmptyState
        title="Couldn't load coverage"
        hint={error instanceof Error ? error.message : undefined}
      />
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Radar}
        title="No stocks tracked yet"
        hint="Add the names in your sector. Everything you log against them -- meetings, concalls, broker reports -- lives on their page."
        action={<Button size="sm" onClick={onAdd}>Add a stock</Button>}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <BoardFilters
        value={filters}
        onChange={setFilters}
        sectors={sectors}
        showScope={!!organizationId}
        counts={counts}
        teams={teams}
        // Coverage is team-scoped in the database; only an admin's "all" is the whole desk.
        allLabel={role === 'admin' ? 'All desk' : 'My teams'}
      />

      {visible.length === 0 ? (
        <EmptyState
          title="Nothing matches those filters"
          hint={filters.scope === 'mine'
            ? 'You may not be the lead analyst on these names -- try "All".'
            : undefined}
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((row) => <CoverageCard key={row.id} row={row} teams={teamsByRow.get(row.id)} />)}
        </div>
      )}
    </div>
  )
}
