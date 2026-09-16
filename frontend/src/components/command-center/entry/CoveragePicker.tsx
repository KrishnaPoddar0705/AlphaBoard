import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { CoverageBoardRow } from '@/lib/commandCenter/types'

interface Props {
  coverage: CoverageBoardRow[]
  value: string | null
  onChange: (coverageId: string) => void
}

/**
 * Recently-touched names as one-tap chips, search underneath.
 *
 * The stock you are logging against is almost always one you touched recently, so the
 * common case should cost one tap and no typing.
 */
export default function CoveragePicker({ coverage, value, onChange }: Props) {
  const [query, setQuery] = useState('')

  const recent = useMemo(
    () =>
      [...coverage]
        .sort((a, b) => (b.last_interaction_on ?? '').localeCompare(a.last_interaction_on ?? ''))
        .slice(0, 6),
    [coverage]
  )

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return []
    return coverage
      .filter((c) => `${c.ticker} ${c.company_name ?? ''}`.toLowerCase().includes(term))
      .slice(0, 6)
  }, [coverage, query])

  const selected = coverage.find((c) => c.id === value) ?? null

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[#1C1B17] bg-[#F1EEE0] px-3 py-2">
        <span className="min-w-0">
          <span className="block truncate font-mono text-sm text-[#1C1B17]">
            {selected.company_name || selected.ticker}
          </span>
          <span className="block font-mono text-[11px] text-[#6F6A60]">{selected.ticker}</span>
        </span>
        <button
          type="button"
          onClick={() => { onChange(''); setQuery('') }}
          className="shrink-0 font-mono text-[11px] text-[#6F6A60] underline-offset-2 hover:underline"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {recent.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {recent.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              className="rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] px-2.5 py-1.5 font-mono text-[11px] text-[#1C1B17] transition-colors hover:border-[#8B857A] hover:bg-[rgba(28,27,23,0.04)]"
            >
              {c.ticker}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8B857A]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your coverage"
          className="w-full rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] py-2 pl-8 pr-3 font-mono text-sm text-[#1C1B17] placeholder:text-[#8B857A] focus:border-[#8B857A] focus:outline-none"
        />
      </div>

      {matches.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-lg border border-[#D7D0C2] bg-[#FBF7ED]">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => { onChange(c.id); setQuery('') }}
                className="w-full px-3 py-2 text-left transition-colors hover:bg-[rgba(28,27,23,0.04)]"
              >
                <span className="block truncate font-mono text-sm text-[#1C1B17]">
                  {c.company_name || c.ticker}
                </span>
                <span className="block font-mono text-[11px] text-[#6F6A60]">{c.ticker}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim() && matches.length === 0 && (
        <p className="font-mono text-[11px] text-[#6F6A60]">
          Not in your coverage yet -- add it from the board first.
        </p>
      )}
    </div>
  )
}
