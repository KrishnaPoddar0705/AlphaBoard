import { X } from 'lucide-react'
import type { OrgRole } from '@/hooks/useOrganization'
import type { TeamOption } from '@/lib/commandCenter/types'

export type Lens = 'stock' | 'analyst'

interface Props {
  role: OrgRole | null
  teams: TeamOption[]
  scope: string
  onScope: (scope: string) => void
  lens: Lens
  onLens: (lens: Lens) => void
  personName: string | null
  onClearPerson: () => void
}

const seg = (on: boolean) => [
  'px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
  on ? 'bg-[#1C1B17] text-[#F1EEE0]' : 'bg-[#FBF7ED] text-[#1C1B17] hover:bg-[#F1EEE0]',
].join(' ')

/**
 * Whose work the screen covers, and whether to read it by stock or by analyst.
 * A lens, not a permission: the database has already limited what can be seen.
 */
export default function ScopeBar({ role, teams, scope, onScope, lens, onLens, personName, onClearPerson }: Props) {
  const allLabel = role === 'admin' ? 'All teams' : role === 'portfolio_manager' ? 'All my teams' : 'My team'
  const canToggleLens = role === 'admin' || role === 'portfolio_manager'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={scope}
        onChange={(e) => onScope(e.target.value)}
        aria-label="Scope"
        className="rounded-md border border-[#1C1B17] bg-[#FBF7ED] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[#1C1B17] focus:outline-none"
      >
        <option value="all">{allLabel}</option>
        {teams.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.member_count}</option>)}
        <option value="mine">Just me</option>
      </select>

      {canToggleLens && (
        <div className="inline-flex overflow-hidden rounded-md border border-[#1C1B17]" role="group" aria-label="View by">
          <button type="button" className={seg(lens === 'stock')} onClick={() => onLens('stock')} aria-pressed={lens === 'stock'}>
            By stock
          </button>
          <button type="button" className={`${seg(lens === 'analyst')} border-l border-[#1C1B17]`} onClick={() => onLens('analyst')} aria-pressed={lens === 'analyst'}>
            By analyst
          </button>
        </div>
      )}

      {personName && (
        <button
          type="button"
          onClick={onClearPerson}
          className="inline-flex items-center gap-1 rounded-md border border-[#D06030] bg-[rgba(208,96,48,0.08)] px-2 py-1 font-mono text-[11px] text-[#B04E22]"
        >
          {personName} <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
