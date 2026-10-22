import { ChevronRight, FileText } from 'lucide-react'
import { healthBandFor, HEALTH_COLORS } from '@/lib/commandCenter/constants'
import { formatDayShort } from '@/lib/commandCenter/format'
import { documentEntries, type MatrixCells, type MatrixGroup } from '@/lib/commandCenter/matrix'
import type { EventTypeOption } from '@/lib/commandCenter/constants'
import type { MatrixSelection } from './MatrixPopView'
import { type } from './styles'

interface Props {
  groups: MatrixGroup[]
  showGroupHeaders: boolean
  columns: EventTypeOption[]
  cells: MatrixCells
  onOpen: (sel: MatrixSelection) => void
}

/**
 * The Matrix on a phone. Ten timelines side by side do not fit in 390px, so each row
 * (a stock, or an analyst) becomes a card: identity, the next scheduled event, and one
 * quiet chip per kind of work -- each opens the same pop view as the desktop grid.
 */
export default function MatrixMobileList({ groups, showGroupHeaders, columns, cells, onOpen }: Props) {
  return (
    <div>
      {groups.map((g) => (
        <section key={g.key}>
          {showGroupHeaders && (
            <h3 className="flex h-8 items-center gap-2 border-b border-(--mx-line) bg-(--mx-canvas) px-4 text-[12px] font-medium text-(--mx-text)">
              {g.label}<span className={type.monoFaint}>{g.rows.length}</span>
            </h3>
          )}
          <ul className="divide-y divide-(--mx-line)">
            {g.rows.map((subject) => {
              const byType = cells.get(subject.id)
              const docs = documentEntries(byType).length
              const active = columns.filter((c) => byType?.get(c.id)?.length)
              const next = [...(byType?.values() ?? [])].flat()
                .filter((e) => e.is_scheduled)
                .sort((a, b) => a.event_date.localeCompare(b.event_date))[0]
              const stock = subject.kind === 'stock' ? subject.stock : null
              const dot = stock ? HEALTH_COLORS[healthBandFor(stock.days_since_interaction)].dot : null
              return (
                <li key={`${g.key}:${subject.id}`} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {dot && <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
                    <span className={`${type.name} truncate`}>{stock?.company_name ?? subject.title}</span>
                    {stock && <span className={type.monoFaint}>{stock.ticker.split('.')[0]}</span>}
                  </div>
                  {next && (
                    <p className="mt-1 truncate text-[12px] text-(--mx-accent)">
                      Next: {next.title} · <span className="font-mono">{formatDayShort(next.event_date)}</span>
                    </p>
                  )}
                  <div className="mx-scroll -mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-0.5">
                    {docs > 0 && (
                      <Chip onClick={() => onOpen({ subject, column: 'docs' })}>
                        <FileText className="size-3" />Docs<span className={type.monoFaint}>{docs}</span>
                      </Chip>
                    )}
                    {active.map((c) => (
                      <Chip key={c.id} onClick={() => onOpen({ subject, column: c.id })}>
                        <c.icon className="size-3" />{c.label}
                        <span className={type.monoFaint}>{byType?.get(c.id)?.length}</span>
                      </Chip>
                    ))}
                    {active.length === 0 && docs === 0 && <span className={type.help}>Nothing logged in the last 12 months</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-(--mx-radius) border border-(--mx-line) bg-(--mx-sunken) px-2 text-[12px] text-(--mx-text-2) active:bg-(--mx-hover)">
      {children}
      <ChevronRight className="size-3 text-(--mx-text-3)" />
    </button>
  )
}
