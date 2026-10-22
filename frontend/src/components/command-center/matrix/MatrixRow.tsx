import { memo } from 'react'
import { Link } from 'react-router-dom'
import TimelineCell from './TimelineCell'
import SourceDocsCell from './SourceDocsCell'
import { healthBandFor, HEALTH_COLORS } from '@/lib/commandCenter/constants'
import { relativeDays } from '@/lib/commandCenter/format'
import { documentEntries, rowEntries, type MatrixDensity, type MatrixSubject } from '@/lib/commandCenter/matrix'
import type { EventTypeOption } from '@/lib/commandCenter/constants'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'
import type { MatrixSelection } from './MatrixPopView'
import { table, type } from './styles'

interface Props {
  index: number
  subject: MatrixSubject
  columns: EventTypeOption[]
  byType: Map<string, ActivityFeedRow[]> | undefined
  density: MatrixDensity
  /** This row's cell is open in the pop view. */
  selected: boolean
  onOpen: (sel: MatrixSelection) => void
  /** No coverage id on an analyst row: the Log sheet asks which stock. */
  onLog: (coverageId: string | undefined, typeId: string) => void
}

const ROLE: Record<string, string> = { admin: 'Admin', portfolio_manager: 'Portfolio manager', analyst: 'Analyst' }

function MatrixRow({ index, subject, columns, byType, density, selected, onOpen, onLog }: Props) {
  const isStock = subject.kind === 'stock'
  const pad = density === 'compact' ? 'py-2' : 'py-2.5'
  const cell = `${table.td} ${pad} group/cell relative`

  return (
    <tr className={`${table.row} ${selected ? table.rowSelected : ''}`} aria-selected={selected}>
      <td className={`${table.td} ${pad} sticky left-0 z-10 w-10 bg-inherit text-right ${type.monoFaint}`}>
        {selected && <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-(--mx-accent)" />}
        <span className={selected ? 'text-(--mx-accent)' : ''}>{index}</span>
      </td>
      <td className={`${table.td} ${pad} ${table.frozen} sticky left-10 z-10 w-[240px] max-w-[240px] bg-inherit`}>
        {isStock ? <StockIdentity subject={subject} /> : <AnalystIdentity subject={subject} />}
      </td>
      <td className={`${table.td} ${pad}`}>
        {isStock
          ? <span className={type.meta}>{subject.stock.sector ?? <span className="text-(--mx-text-3)">—</span>}</span>
          : <Companies entries={rowEntries(byType)} />}
      </td>
      <td className={cell}>
        <SourceDocsCell entries={documentEntries(byType)} showTicker={!isStock}
          onOpen={(eventId) => onOpen({ subject, column: 'docs', eventId })} />
      </td>
      {columns.map((c) => (
        <td key={c.id} className={cell}>
          <TimelineCell
            entries={byType?.get(c.id)}
            label={c.label}
            density={density}
            showTicker={!isStock}
            onOpen={(eventId) => onOpen({ subject, column: c.id, eventId })}
            onAdd={() => onLog(isStock ? subject.id : undefined, c.id)}
          />
        </td>
      ))}
    </tr>
  )
}

/** A quiet monogram, the same treatment for every company: no logos to fetch or fake. */
function Monogram({ text, round = false, dot }: { text: string; round?: boolean; dot?: string }) {
  return (
    <span className={`relative flex size-7 shrink-0 items-center justify-center border border-(--mx-line) bg-(--mx-sunken) font-mono text-[10px] font-medium text-(--mx-text-2) ${round ? 'rounded-full' : 'rounded-(--mx-radius)'}`}>
      {text}
      {dot && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-(--mx-surface)" style={{ backgroundColor: dot }} />}
    </span>
  )
}

function StockIdentity({ subject }: { subject: Extract<MatrixSubject, { kind: 'stock' }> }) {
  const { stock } = subject
  const band = healthBandFor(stock.days_since_interaction)
  const base = stock.ticker.split('.')[0]
  return (
    <Link to={`/command-center/stock/${encodeURIComponent(stock.ticker)}`}
      className="group/id flex min-w-0 items-center gap-2.5 rounded-(--mx-radius-sm)"
      title={stock.last_interaction_on ? `Last touched ${relativeDays(stock.last_interaction_on)}` : 'Nothing logged yet'}>
      <Monogram text={base.slice(0, 2)} dot={HEALTH_COLORS[band].dot} />
      <span className="min-w-0">
        <span className={`${type.name} block truncate group-hover/id:underline group-hover/id:decoration-(--mx-line-strong) group-hover/id:underline-offset-2`}>
          {stock.company_name ?? base}
        </span>
        <span className={`${type.help} flex min-w-0 items-center gap-1.5`}>
          <span className="font-mono text-[10.5px] text-(--mx-text-2)">{base}</span>
          {stock.market && <span className="font-mono text-[10.5px]">{stock.market}</span>}
          {stock.lead_analyst_username && <span className="truncate">· {stock.lead_analyst_username}</span>}
        </span>
      </span>
    </Link>
  )
}

function AnalystIdentity({ subject }: { subject: Extract<MatrixSubject, { kind: 'analyst' }> }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Monogram text={subject.title.slice(0, 2).toUpperCase()} round />
      <span className="min-w-0">
        <span className={`${type.name} block truncate`}>{subject.title}</span>
        <span className={`${type.help} block truncate`}>
          {subject.role ? ROLE[subject.role] ?? subject.role : 'Contributor'}
          {subject.teamIds.length > 1 && ` · ${subject.teamIds.length} teams`}
        </span>
      </span>
    </span>
  )
}

/** The companies an analyst worked on this year, most recent first, as plain tickers. */
function Companies({ entries }: { entries: ActivityFeedRow[] }) {
  const tickers = [...new Set(entries.filter((e) => !e.is_scheduled).map((e) => e.ticker))]
  if (tickers.length === 0) return <span className={`${type.monoFaint} opacity-50`}>—</span>
  return (
    <span className="flex max-w-[200px] flex-wrap gap-x-2 gap-y-0.5">
      {tickers.slice(0, 5).map((t) => (
        <Link key={t} to={`/command-center/stock/${encodeURIComponent(t)}`}
          className="font-mono text-[11px] text-(--mx-text-2) hover:text-(--mx-text) hover:underline">
          {t.split('.')[0]}
        </Link>
      ))}
      {tickers.length > 5 && <span className={type.monoFaint}>+{tickers.length - 5}</span>}
    </span>
  )
}

/** Memoised: the grid can be hundreds of rows by ten timelines, and opening a cell should not redraw them. */
export default memo(MatrixRow)
