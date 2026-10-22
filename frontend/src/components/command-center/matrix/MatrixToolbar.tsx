import { useEffect, useRef, useState } from 'react'
import { Columns3, Moon, Plus, Rows2, Rows3, Rows4, Search, Sparkles, Sun, X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MATRIX_COLUMNS, type MatrixDensity, type MatrixTheme } from '@/lib/commandCenter/matrix'
import { control, type } from './styles'

const DENSITIES = [
  { id: 'compact', label: 'Compressed', icon: Rows4 },
  { id: 'default', label: 'Default', icon: Rows3 },
  { id: 'expanded', label: 'Expanded', icon: Rows2 },
] as const

interface Props {
  /** "42 companies · 318 entries" -- what the table currently holds. */
  summary: string
  query: string
  onQuery: (q: string) => void
  density: MatrixDensity
  onDensity: (d: MatrixDensity) => void
  theme: MatrixTheme
  onTheme: (t: MatrixTheme) => void
  hidden: Set<string>
  onToggleColumn: (id: string) => void
  onAdd: () => void
  onEnrich: () => void
}

/**
 * The table's own toolbar: find on the left; view controls, then the actions on the
 * right. Secondary controls are icon-weight; "Add row" is the one primary button.
 */
export default function MatrixToolbar({
  summary, query, onQuery, density, onDensity, theme, onTheme, hidden, onToggleColumn, onAdd, onEnrich,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-(--mx-line) px-3 py-2">
      <label className="relative w-full sm:w-60">
        <span className="sr-only">Search</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-(--mx-text-3)" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Filter by name or ticker"
          className="h-(--mx-control-h) w-full rounded-(--mx-radius) border border-(--mx-line) bg-(--mx-sunken) pl-8 pr-7 text-[12.5px] text-(--mx-text) transition-colors placeholder:text-(--mx-text-3) hover:border-(--mx-line-strong) focus:border-(--mx-line-strong) focus:bg-(--mx-raised)"
        />
        {query && (
          <button type="button" onClick={() => onQuery('')} aria-label="Clear search"
            className="absolute right-1.5 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-(--mx-text-3) hover:text-(--mx-text)">
            <X className="size-3" />
          </button>
        )}
      </label>
      <span className={`${type.help} hidden md:inline`}>{summary}</span>

      <div className="ml-auto flex items-center gap-1">
        <ColumnsMenu hidden={hidden} onToggle={onToggleColumn} />

        <div className={control.segment} role="radiogroup" aria-label="Row density">
          {DENSITIES.map((d) => (
            <Tip key={d.id} label={d.label}>
              <button type="button" role="radio" aria-checked={density === d.id} aria-label={d.label}
                onClick={() => onDensity(d.id)}
                className={`${control.segmentItem} px-1.5 ${density === d.id ? control.segmentOn : control.segmentOff}`}>
                <d.icon className="size-3.5" />
              </button>
            </Tip>
          ))}
        </div>

        <Tip label={theme === 'warm' ? 'Preview graphite' : 'Back to warm'}>
          <button type="button" aria-label="Switch surface theme" onClick={() => onTheme(theme === 'warm' ? 'graphite' : 'warm')}
            className={control.icon}>
            {theme === 'warm' ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
          </button>
        </Tip>

        <span aria-hidden className="mx-1 h-4 w-px bg-(--mx-line-strong)" />

        <Tip label="Coming soon: enrich each company with news, filings and analyst reports from data providers, and ask across your source documents.">
          {/* Not `disabled`: a disabled button swallows hover, so the tooltip would never
              explain what is coming. The click is only counted, as a demand signal. */}
          <button type="button" onClick={onEnrich} aria-disabled className={`${control.base} ${control.ghost} cursor-default`}>
            <Sparkles className="size-3.5" />
            <span className="hidden lg:inline">Enrich</span>
            <span className="rounded-[3px] bg-(--mx-sunken) px-1 font-mono text-[9.5px] uppercase tracking-wider text-(--mx-text-3) ring-1 ring-(--mx-line) ring-inset">Soon</span>
          </button>
        </Tip>
        <button type="button" onClick={onAdd} className={`${control.base} ${control.primary}`}>
          <Plus className="size-3.5" /> Add row
        </button>
      </div>
    </div>
  )
}

function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-[11.5px]">{label}</TooltipContent>
    </Tooltip>
  )
}

function ColumnsMenu({ hidden, onToggle }: { hidden: Set<string>; onToggle: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const shown = MATRIX_COLUMNS.length - hidden.size
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="true"
        className={`${control.base} ${control.ghost} ${open ? 'bg-(--mx-hover) text-(--mx-text)' : ''}`}>
        <Columns3 className="size-3.5" />
        <span className="hidden sm:inline">Columns</span>
        {hidden.size > 0 && <span className={type.monoFaint}>{shown}/{MATRIX_COLUMNS.length}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-56 rounded-(--mx-radius-lg) bg-(--mx-raised) p-1 shadow-(--mx-shadow-pop)">
          <p className={`${type.label} px-2 pb-1 pt-1.5`}>Activity columns</p>
          {MATRIX_COLUMNS.map((c) => (
            <label key={c.id} className="flex h-8 cursor-pointer items-center gap-2.5 rounded-(--mx-radius) px-2 text-[12.5px] text-(--mx-text) hover:bg-(--mx-hover)">
              <input type="checkbox" checked={!hidden.has(c.id)} onChange={() => onToggle(c.id)}
                className="size-3.5 accent-(--mx-text)" />
              <c.icon className="size-3.5 text-(--mx-text-3)" />{c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
