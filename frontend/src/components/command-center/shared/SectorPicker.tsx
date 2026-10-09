import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useCoverageBoard } from '@/hooks/commandCenter/useCoverage'
import { canonicalSector, sectorOptions } from '@/lib/commandCenter/sectors'

interface Props {
  /** The chosen sector, or '' while none is chosen. */
  value: string
  onChange: (sector: string) => void
}

/**
 * Picks a stock's sector from the ones the desk already uses, or names a new one.
 *
 * A checklist rather than a free-text box: typed sectors drift ("Bank", "Banks",
 * "Banking") and a sector filter is only as good as the tags behind it. A new sector
 * joins the list the moment a stock is saved under it.
 */
export default function SectorPicker({ value, onChange }: Props) {
  const { data: board = [], isPending } = useCoverageBoard()
  const [draft, setDraft] = useState('')
  const known = useMemo(() => sectorOptions(board), [board])
  // A sector just added here is not on any saved stock yet, so it is listed by hand.
  const options = value && !known.includes(value)
    ? [...known, value].sort((a, b) => a.localeCompare(b))
    : known

  const add = () => {
    const name = canonicalSector(draft, known)
    if (!name) return
    onChange(name)
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-1.5">
      {options.length > 0 ? (
        <ul
          role="group"
          aria-label="Sector"
          className="max-h-36 overflow-y-auto rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] text-left"
        >
          {options.map((s) => (
            <li key={s}>
              <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-[rgba(28,27,23,0.04)]">
                <input
                  type="checkbox"
                  checked={value === s}
                  onChange={() => onChange(value === s ? '' : s)}
                  className="h-3.5 w-3.5 shrink-0 accent-[#1C1B17]"
                />
                <span className="min-w-0 truncate font-mono text-xs text-[#1C1B17]">{s}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-left font-mono text-[11px] text-[#8B857A]">
          {isPending ? 'Loading sectors…' : 'No sectors yet. Add the first one below.'}
        </p>
      )}

      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="New sector"
          aria-label="New sector"
          className="min-w-0 flex-1 rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] px-2 py-1 font-mono text-xs text-[#1C1B17] placeholder:text-[#8B857A] focus:border-[#8B857A] focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#1C1B17] px-2 py-1 font-mono text-[11px] text-[#1C1B17] transition-colors hover:bg-[rgba(28,27,23,0.04)] disabled:opacity-40"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
    </div>
  )
}
