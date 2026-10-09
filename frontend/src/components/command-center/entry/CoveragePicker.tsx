import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { useAddCoverage } from '@/hooks/commandCenter/useCoverage'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import type { CoverageBoardRow } from '@/lib/commandCenter/types'
import SectorPicker from '../shared/SectorPicker'

interface Props {
  coverage: CoverageBoardRow[]
  value: string | null
  onChange: (coverageId: string) => void
}

/** A ticker, roughly: letters and digits, optionally dot-suffixed (BSE.NS, 500325.BO). */
const TICKER = /^[A-Za-z0-9]{1,12}(\.[A-Za-z]{1,4})?$/

/**
 * Recently-touched names as one-tap chips, search underneath.
 *
 * The stock you are logging against is almost always one you touched recently, so the
 * common case should cost one tap and no typing. When it is a name the desk does not
 * cover yet, it is added from here: making someone abandon a half-written log, go to the
 * board, add the stock and start again is how meetings go unlogged.
 */
export default function CoveragePicker({ coverage, value, onChange }: Props) {
  const [query, setQuery] = useState('')
  const addCoverage = useAddCoverage()
  const { userId } = useCommandCenterSession()

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

  /**
   * A name added from here is selected before the board query has refetched, so it is
   * not in `coverage` yet. Remembering it locally keeps the picker showing the chosen
   * stock through that gap instead of snapping back to an empty search.
   */
  const [justAdded, setJustAdded] = useState<{ id: string; ticker: string } | null>(null)
  /** A new name needs a sector before it can be added; asked for once Add is tapped. */
  const [askingSector, setAskingSector] = useState(false)
  const [sector, setSector] = useState('')

  const row = coverage.find((c) => c.id === value) ?? null
  const selected = row
    ? { ticker: row.ticker, name: row.company_name || row.ticker }
    : justAdded?.id === value
      ? { ticker: justAdded.ticker, name: justAdded.ticker }
      : null

  /** The typed text as a ticker, when it looks like one and is not already covered. */
  const candidate = useMemo(() => {
    const raw = query.trim().toUpperCase()
    if (!TICKER.test(raw)) return null
    return coverage.some((c) => c.ticker.toUpperCase() === raw) ? null : raw
  }, [query, coverage])

  /**
   * Adds the name, then selects it. `addCoverage` revives a previously-removed ticker
   * rather than failing, so this is also the path back for an archived name. The row it
   * returns is a cc_coverage row, not a board row, but only its id is needed here -- the
   * board query is invalidated by the mutation and repaints the chips behind it.
   */
  const addAndSelect = async () => {
    if (!candidate || !sector) return
    try {
      const added = await addCoverage.mutateAsync({ ticker: candidate, sector, lead_analyst_id: userId })
      setJustAdded({ id: added.id, ticker: added.ticker })
      onChange(added.id)
      setQuery(''); setAskingSector(false); setSector('')
    } catch {
      // useAddCoverage already surfaces the reason as a toast (already covered by another
      // team, no session, and so on); leave the query so it can be corrected.
    }
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-[#1C1B17] bg-[#F1EEE0] px-3 py-2">
        <span className="min-w-0">
          <span className="block truncate font-mono text-sm text-[#1C1B17]">
            {selected.name}
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
          placeholder="Search coverage, or type a new ticker"
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
        candidate && askingSector ? (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[#1C1B17] bg-[#FBF7ED] p-3">
            <p className="font-mono text-[11px] text-[#1C1B17]">
              Which sector is <span className="font-semibold">{candidate}</span> in?
            </p>
            <SectorPicker value={sector} onChange={setSector} />
            <button
              type="button"
              onClick={addAndSelect}
              disabled={!sector || addCoverage.isPending}
              className="self-start rounded-lg border border-[#1C1B17] bg-[#1C1B17] px-2.5 py-1 font-mono text-[11px] text-[#F7F2E6] disabled:opacity-40"
            >
              {addCoverage.isPending ? `Adding ${candidate}…` : `Add ${candidate} and log against it`}
            </button>
          </div>
        ) : candidate ? (
          <button
            type="button"
            onClick={() => setAskingSector(true)}
            disabled={addCoverage.isPending}
            className="flex items-center gap-2 rounded-lg border border-dashed border-[#1C1B17] bg-[#FBF7ED] px-3 py-2 text-left font-mono text-[11px] text-[#1C1B17] transition-colors hover:bg-[rgba(28,27,23,0.04)] disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>
              Add <span className="font-semibold">{candidate}</span> to coverage and log against it
            </span>
          </button>
        ) : (
          <p className="font-mono text-[11px] text-[#6F6A60]">
            No match. Type a ticker to add a new name.
          </p>
        )
      )}
    </div>
  )
}
