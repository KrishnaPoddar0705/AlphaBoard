import { Search, X } from 'lucide-react'
import { KIND_LABELS } from '@/lib/commandCenter/constants'
import type { ActivityFilters, EventKind } from '@/lib/commandCenter/types'
import type { DeskMember } from '@/lib/commandCenter/api'

interface Props {
  value: ActivityFilters
  onChange: (next: ActivityFilters) => void
  members: DeskMember[]
  showAnalyst: boolean
}

const KINDS = Object.keys(KIND_LABELS) as EventKind[]

const selectClass =
  'rounded-lg border border-[#D7D0C2] bg-[#F7F2E6] px-2 py-1 font-mono text-[11px] text-[#1C1B17] focus:outline-none'

export default function ActivityFilterBar({ value, onChange, members, showAnalyst }: Props) {
  const set = (patch: Partial<ActivityFilters>) => onChange({ ...value, ...patch })
  const active = !!(value.analystId || value.kinds?.length || value.from || value.to || value.search)

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8B857A]" />
        <input
          value={value.search ?? ''}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search takeaways, questions and titles"
          className="w-full rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] py-1.5 pl-8 pr-3 font-mono text-xs text-[#1C1B17] placeholder:text-[#8B857A] focus:border-[#8B857A] focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {showAnalyst && (
          <select
            value={value.analystId ?? ''}
            onChange={(e) => set({ analystId: e.target.value || null })}
            className={selectClass}
          >
            <option value="">Everyone</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.username ?? m.id.slice(0, 8)}</option>
            ))}
          </select>
        )}

        <select
          value={value.kinds?.[0] ?? ''}
          onChange={(e) => set({ kinds: e.target.value ? [e.target.value as EventKind] : undefined })}
          className={selectClass}
        >
          <option value="">All types</option>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </select>

        <input
          type="date"
          value={value.from ?? ''}
          onChange={(e) => set({ from: e.target.value || null })}
          aria-label="From date"
          className={selectClass}
        />
        <span className="font-mono text-[11px] text-[#8B857A]">to</span>
        <input
          type="date"
          value={value.to ?? ''}
          onChange={(e) => set({ to: e.target.value || null })}
          aria-label="To date"
          className={selectClass}
        />

        {active && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-[#6F6A60] hover:text-[#1C1B17]"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
    </div>
  )
}
