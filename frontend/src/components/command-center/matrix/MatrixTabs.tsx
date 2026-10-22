import { Building2, Users } from 'lucide-react'
import type { MatrixGrouping } from '@/lib/commandCenter/matrix'
import { control } from './styles'

export interface MatrixTab {
  key: string
  label: string
  count: number
}

interface Props {
  grouping: MatrixGrouping
  onGrouping: (g: MatrixGrouping) => void
  tabs: MatrixTab[]
  active: string
  onChange: (key: string) => void
}

const LENSES = [
  { id: 'sector', label: 'My Company', icon: Building2 },
  { id: 'team', label: 'By Analyst', icon: Users },
] as const

/**
 * Matrix navigation, one level below the page tabs: which lens (companies by sector, or
 * analysts by team), then which sector or team. Underlined tabs rather than pills, so it
 * reads as navigation and not as another row of controls.
 */
export default function MatrixTabs({ grouping, onGrouping, tabs, active, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
      <div className={`${control.segment} self-start sm:mb-1.5`} role="radiogroup" aria-label="Matrix lens">
        {LENSES.map((l) => {
          const on = grouping === l.id
          return (
            <button key={l.id} type="button" role="radio" aria-checked={on} onClick={() => onGrouping(l.id)}
              className={`${control.segmentItem} ${on ? control.segmentOn : control.segmentOff}`}>
              <l.icon className="size-3.5" />{l.label}
            </button>
          )
        })}
      </div>

      <div role="tablist" aria-label={grouping === 'team' ? 'Teams' : 'Sectors'}
        className="mx-scroll -mb-px flex min-w-0 flex-1 items-end gap-5 overflow-x-auto">
        {tabs.map((t) => {
          const on = t.key === active
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => onChange(t.key)}
              className={[
                'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-[13px] transition-colors duration-150',
                on
                  ? 'border-(--mx-text) font-medium text-(--mx-text)'
                  : 'border-transparent text-(--mx-text-2) hover:text-(--mx-text)',
              ].join(' ')}
            >
              {t.label}
              <span className="font-mono text-[10.5px] tabular-nums text-(--mx-text-3)">{t.count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
