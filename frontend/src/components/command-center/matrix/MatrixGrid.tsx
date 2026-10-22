import { Fragment, useState } from 'react'
import { Building2, ChevronRight, FileText, Tag, User, Users } from 'lucide-react'
import MatrixRow from './MatrixRow'
import type { EventTypeOption } from '@/lib/commandCenter/constants'
import type { MatrixCells, MatrixDensity, MatrixGroup, MatrixGrouping } from '@/lib/commandCenter/matrix'
import type { MatrixSelection } from './MatrixPopView'
import { table, type } from './styles'

interface Props {
  grouping: MatrixGrouping
  groups: MatrixGroup[]
  /** Group header rows are shown on the "All" tab only; a single tab is one flat list. */
  showGroupHeaders: boolean
  columns: EventTypeOption[]
  cells: MatrixCells
  density: MatrixDensity
  /** The row whose cell is open in the pop view. */
  selectedId: string | null
  onOpen: (sel: MatrixSelection) => void
  onLog: (coverageId: string | undefined, typeId: string) => void
}

function Head({ icon: Icon, children, className = '' }: { icon: typeof User; children: string; className?: string }) {
  return (
    <th scope="col" className={`${table.th} ${className}`}>
      <span className={`${type.header} inline-flex items-center gap-1.5`}>
        <Icon className="size-3.5 opacity-70" />{children}
      </span>
    </th>
  )
}

/**
 * The grid. A plain table with a sticky header and a frozen identity column; separators
 * run between rows only, so the eye reads across a company rather than down a lattice.
 */
export default function MatrixGrid({
  grouping, groups, showGroupHeaders, columns, cells, density, selectedId, onOpen, onLog,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (key: string) => setCollapsed((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })
  const span = columns.length + 4
  const byAnalyst = grouping === 'team'
  const colW = density === 'compact' ? 'min-w-[168px]' : 'min-w-[236px] w-[236px]'
  let n = 0

  return (
    <div className="mx-scroll max-h-[calc(100vh-250px)] min-h-[320px] overflow-auto">
      <table className="w-max min-w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-20">
          <tr>
            <th scope="col" className={`${table.th} sticky left-0 z-30 w-10`}><span className="sr-only">Row</span></th>
            <Head icon={byAnalyst ? User : Building2} className={`${table.frozen} sticky left-10 z-30 w-[240px] min-w-[240px]`}>
              {byAnalyst ? 'Analyst' : 'Company'}
            </Head>
            <Head icon={byAnalyst ? Building2 : Tag} className="min-w-[140px]">{byAnalyst ? 'Companies' : 'Sector'}</Head>
            <Head icon={FileText} className="min-w-[248px] w-[248px]">Source documents</Head>
            {columns.map((c) => <Head key={c.id} icon={c.icon} className={colW}>{c.label}</Head>)}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const shut = showGroupHeaders && collapsed.has(g.key)
            return (
              <Fragment key={g.key}>
                {showGroupHeaders && (
                  <tr>
                    <td colSpan={span} className="border-b border-(--mx-line) bg-(--mx-canvas) p-0">
                      <button type="button" onClick={() => toggle(g.key)} aria-expanded={!shut}
                        className="sticky left-0 flex h-8 items-center gap-2 px-3 text-left">
                        <ChevronRight className={`size-3.5 text-(--mx-text-3) transition-transform duration-150 ${shut ? '' : 'rotate-90'}`} />
                        {byAnalyst && <Users className="size-3.5 text-(--mx-text-3)" />}
                        <span className="text-[12px] font-medium text-(--mx-text)">{g.label}</span>
                        <span className={type.monoFaint}>{g.rows.length}</span>
                      </button>
                    </td>
                  </tr>
                )}
                {!shut && g.rows.map((subject) => (
                  <MatrixRow
                    key={`${g.key}:${subject.id}`}
                    index={++n}
                    subject={subject}
                    columns={columns}
                    byType={cells.get(subject.id)}
                    density={density}
                    selected={selectedId === subject.id}
                    onOpen={onOpen}
                    onLog={onLog}
                  />
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
