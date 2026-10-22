import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { control, type } from './styles'

export interface GroupOption {
  key: string
  label: string
  count: number
}

interface Props {
  /** "Sectors" / "Teams" -- the noun on the button and in the panel. */
  noun: string
  options: GroupOption[]
  /** Chosen keys; empty means everything. */
  selected: string[]
  onChange: (keys: string[]) => void
}

/**
 * A dropdown checklist of sectors or teams. A desk can cover dozens of sectors, which
 * no longer fit as tabs; here they are searchable, multi-select, and stay out of the way
 * until needed. Nothing ticked means everything is shown.
 */
export default function GroupFilter({ noun, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const chosen = useMemo(() => new Set(selected), [selected])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const shown = options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase()))
  const toggle = (key: string) =>
    onChange(chosen.has(key) ? selected.filter((k) => k !== key) : [...selected, key])

  const summary = selected.length === 0
    ? `All ${noun.toLowerCase()}`
    : selected.length === 1
      ? options.find((o) => o.key === selected[0])?.label ?? `1 ${noun.toLowerCase().replace(/s$/, '')}`
      : `${selected.length} ${noun.toLowerCase()}`

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="listbox"
          className={`${control.base} ${control.outline} max-w-[260px] ${selected.length ? 'rounded-r-none border-r-0' : ''}`}>
          <span className="text-(--mx-text-3)">{noun}</span>
          <span className="truncate font-medium">{summary}</span>
          <ChevronDown className={`size-3.5 shrink-0 text-(--mx-text-3) transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </button>
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} aria-label={`Clear ${noun.toLowerCase()}`}
            className={`${control.outline} inline-flex h-(--mx-control-h) w-7 items-center justify-center rounded-r-(--mx-radius) text-(--mx-text-3) hover:text-(--mx-text)`}>
            <X className="size-3" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-72 rounded-(--mx-radius-lg) bg-(--mx-raised) shadow-(--mx-shadow-pop)">
          <div className="border-b border-(--mx-line) p-2">
            <label className="relative block">
              <span className="sr-only">Search {noun.toLowerCase()}</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-(--mx-text-3)" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a ${noun.toLowerCase().replace(/s$/, '')}`}
                className="h-(--mx-control-h) w-full rounded-(--mx-radius) border border-(--mx-line) bg-(--mx-sunken) pl-8 pr-2 text-[12.5px] text-(--mx-text) placeholder:text-(--mx-text-3) focus:border-(--mx-line-strong)" />
            </label>
          </div>

          <ul role="listbox" aria-multiselectable className="mx-scroll max-h-72 overflow-y-auto p-1">
            {shown.map((o) => {
              const on = chosen.has(o.key)
              return (
                <li key={o.key}>
                  <button type="button" role="option" aria-selected={on} onClick={() => toggle(o.key)}
                    className="flex h-8 w-full items-center gap-2.5 rounded-(--mx-radius) px-2 text-left text-[12.5px] text-(--mx-text) hover:bg-(--mx-hover)">
                    <span className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors ${on ? 'border-(--mx-primary) bg-(--mx-primary) text-(--mx-primary-text)' : 'border-(--mx-line-strong)'}`}>
                      {on && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    <span className={type.monoFaint}>{o.count}</span>
                  </button>
                </li>
              )
            })}
            {shown.length === 0 && <li className={`${type.help} px-2 py-3`}>No {noun.toLowerCase()} match “{q}”.</li>}
          </ul>

          <div className="flex items-center justify-between border-t border-(--mx-line) px-2 py-1.5">
            <button type="button" onClick={() => onChange(shown.map((o) => o.key))}
              className={`${control.base} ${control.ghost} h-7 px-2 text-[12px]`}>
              Select {q ? 'matching' : 'all'}
            </button>
            <button type="button" onClick={() => onChange([])} disabled={selected.length === 0}
              className={`${control.base} ${control.ghost} h-7 px-2 text-[12px]`}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
