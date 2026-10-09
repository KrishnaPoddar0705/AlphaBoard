import { X } from 'lucide-react'
import type { OrgRole } from '@/hooks/useOrganization'
import type { TeamOption } from '@/lib/commandCenter/types'

interface Props {
  role: OrgRole | null
  teams: TeamOption[]
  scope: string
  onScope: (scope: string) => void
  personName: string | null
  onClearPerson: () => void
}

/**
 * Whose work the screen covers. A lens, not a permission: the database has already
 * limited what can be seen. (By stock / by analyst sits above the table, in LensBar.)
 */
export default function ScopeBar({ role, teams, scope, onScope, personName, onClearPerson }: Props) {
  const allLabel = role === 'admin' ? 'All teams' : role === 'portfolio_manager' ? 'All my teams' : 'My team'

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
