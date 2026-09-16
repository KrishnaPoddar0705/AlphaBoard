import { Search } from 'lucide-react'
import type { HealthBand } from '@/lib/commandCenter/constants'

export interface BoardFilterState {
  scope: 'mine' | 'all'
  /** A team id, or '' for every team. */
  team: string
  sector: string
  band: HealthBand | 'any'
  query: string
}

interface Props {
  value: BoardFilterState
  onChange: (next: BoardFilterState) => void
  sectors: string[]
  /** Hidden when the user has no organization -- "mine vs all" means nothing then. */
  showScope: boolean
  counts: { mine: number; all: number }
  /** What "all" covers for this user: the whole desk for an admin, their teams otherwise. */
  allLabel?: string
  /** Teams the viewer can see; the team filter is hidden when there are none. */
  teams?: Array<{ id: string; name: string }>
}

const BANDS: Array<{ value: HealthBand | 'any'; label: string }> = [
  { value: 'any', label: 'All' },
  { value: 'cold', label: 'Needs attention' },
  { value: 'stale', label: 'Going quiet' },
  { value: 'untouched', label: 'Nothing logged' },
]

const chip = (active: boolean) =>
  [
    'rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors',
    active
      ? 'border-[#1C1B17] bg-[#1C1B17] text-[#F7F2E6]'
      : 'border-[#D7D0C2] bg-[#F7F2E6] text-[#1C1B17] hover:bg-[rgba(28,27,23,0.04)]',
  ].join(' ')

export default function BoardFilters({
  value, onChange, sectors, showScope, counts, allLabel = 'All', teams = [],
}: Props) {
  const set = (patch: Partial<BoardFilterState>) => onChange({ ...value, ...patch })

  return (
    <div className="flex flex-col gap-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8B857A]" />
        <input
          value={value.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Filter by name or ticker"
          className="w-full rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] py-1.5 pl-8 pr-3 font-mono text-xs text-[#1C1B17] placeholder:text-[#8B857A] focus:border-[#8B857A] focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {showScope && (
          <>
            <button type="button" className={chip(value.scope === 'mine')}
                    onClick={() => set({ scope: 'mine' })}>
              My coverage ({counts.mine})
            </button>
            <button type="button" className={chip(value.scope === 'all')}
                    onClick={() => set({ scope: 'all' })}>
              {allLabel} ({counts.all})
            </button>
            <span className="mx-1 h-4 w-px bg-[#D7D0C2]" aria-hidden />
          </>
        )}

        {BANDS.map((b) => (
          <button key={b.value} type="button" className={chip(value.band === b.value)}
                  onClick={() => set({ band: b.value })}>
            {b.label}
          </button>
        ))}

        {teams.length > 0 && (
          <select
            value={value.team}
            onChange={(e) => set({ team: e.target.value })}
            aria-label="Team"
            className="rounded-lg border border-[#D7D0C2] bg-[#F7F2E6] px-2 py-1 font-mono text-[11px] text-[#1C1B17] focus:outline-none"
          >
            <option value="">All teams</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        {sectors.length > 0 && (
          <select
            value={value.sector}
            onChange={(e) => set({ sector: e.target.value })}
            className="rounded-lg border border-[#D7D0C2] bg-[#F7F2E6] px-2 py-1 font-mono text-[11px] text-[#1C1B17] focus:outline-none"
          >
            <option value="">All sectors</option>
            {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}
