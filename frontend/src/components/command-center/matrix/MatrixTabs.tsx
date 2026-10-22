import { Building2, Users } from 'lucide-react'
import GroupFilter, { type GroupOption } from './GroupFilter'
import type { MatrixGrouping } from '@/lib/commandCenter/matrix'
import { control } from './styles'

interface Props {
  grouping: MatrixGrouping
  onGrouping: (g: MatrixGrouping) => void
  /** Sectors ("My Company") or teams ("By Analyst"), with row counts. */
  options: GroupOption[]
  selected: string[]
  onSelect: (keys: string[]) => void
}

const LENSES = [
  { id: 'sector', label: 'My Company', icon: Building2 },
  { id: 'team', label: 'By Analyst', icon: Users },
] as const

/**
 * Matrix navigation, one level below the page tabs: which lens (companies by sector, or
 * analysts by team), then which sectors or teams -- a checklist, since a desk can cover
 * far more sectors than fit across the page.
 */
export default function MatrixTabs({ grouping, onGrouping, options, selected, onSelect }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className={control.segment} role="radiogroup" aria-label="Matrix lens">
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
      <GroupFilter
        key={grouping}
        noun={grouping === 'team' ? 'Teams' : 'Sectors'}
        options={options}
        selected={selected}
        onChange={onSelect}
      />
    </div>
  )
}
