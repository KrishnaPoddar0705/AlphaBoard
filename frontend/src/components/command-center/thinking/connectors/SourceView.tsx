import { ArrowUpRight, Info, X } from 'lucide-react'
import { editKey, type Trim } from '@/lib/commandCenter/payloadToDoc'
import type { SourcePayload, SourceTable, SourceItem, SourceSection } from '@/lib/commandCenter/boardTypes'
import {
  formatCell, recentColumns, formatItemDate, chartPlan, SERIES_COLORS, type ChartPlan,
} from '@/lib/commandCenter/boardFormat'
import ThesisMarkdown from '@/components/thesis/ThesisMarkdown'
import TrendChart from './TrendChart'

export type SourceMode = 'chart' | 'table'

interface Props {
  payload: SourcePayload
  mode: SourceMode
  /** Cards are narrow and show fewer periods than the document does. */
  dense?: boolean
  /** Lets each news item or filing be inserted on its own. */
  onInsertItem?: (item: SourceItem) => void
  /** In the note: what the analyst has hidden, and how to change it. Enables the × controls. */
  trim?: Trim
  onTrim?: (next: Trim) => void
}

const hideBtn = 'flex h-5 w-5 flex-none items-center justify-center rounded text-[#A39D90] opacity-0 transition-opacity hover:bg-[#EFE9DA] hover:text-[#B23B2A] focus:opacity-100 group-hover/hide:opacity-100'

const SENTIMENT: Record<string, string> = { positive: '#2F8F5B', negative: '#B23B2A', neutral: '#8B857A' }

function DataTable({ table, dense, series }: { table: SourceTable; dense?: boolean; series: string[] }) {
  // Eight periods fit the page at a readable size; older years stay one scroll away.
  const t = recentColumns(table, dense ? 5 : 8)
  return (
    <div className="tb-data -mx-1 overflow-x-auto [scrollbar-width:thin]">
      <table className={['tb-datatable', dense ? 'text-[11px]' : 'text-[12px]'].join(' ')}>
        <thead>
          <tr>
            {t.columns.map((c, i) => (
              <th key={i} className={[
                'whitespace-nowrap py-1.5 font-medium text-[#8B857A]',
                dense ? 'px-1.5' : 'px-2.5',
                i === 0 ? 'tb-pin text-left' : 'text-right',
              ].join(' ')}>{i === 0 ? '' : c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, ri) => {
            const si = series.indexOf(String(r[0]))
            return (
              <tr key={ri}>
                {r.map((cell, ci) => (
                  <td key={ci} className={[
                    dense ? 'px-1.5 py-[5px]' : 'px-2.5 py-1.5',
                    ci === 0
                      ? ['tb-pin truncate text-left text-[#3F3C35]', dense ? 'max-w-[150px]' : 'min-w-[150px] max-w-[220px]'].join(' ')
                      : 'whitespace-nowrap text-right text-[#1C1B17]',
                    ci === 0 && si >= 0 ? 'font-medium' : '',
                    typeof cell === 'number' && cell < 0 ? 'text-[#B23B2A]' : '',
                  ].join(' ')} title={ci === 0 ? String(cell) : undefined}>
                    {ci === 0 && si >= 0 && (
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                        style={{ background: SERIES_COLORS[si] }} />
                    )}
                    {ci === 0 ? String(cell ?? '') : formatCell(cell)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Legend({ plan }: { plan: ChartPlan }) {
  return (
    <div className="tb-data flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#6F6A60]">
      {plan.series.map((s, i) => (
        <span key={s.label} className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: SERIES_COLORS[i] }} />{s.label}
        </span>
      ))}
    </div>
  )
}

function ItemList({ items, dense, onInsertItem, hidden, onHide }: {
  items: SourceItem[]; dense?: boolean; onInsertItem?: (i: SourceItem) => void
  hidden?: Set<number>; onHide?: (index: number) => void
}) {
  // Indices stay those of the snapshot, so hiding survives the list being re-rendered.
  const shown = items.map((it, i) => ({ it, i })).filter(({ i }) => !hidden?.has(i)).slice(0, dense ? 8 : 30)
  return (
    <ul className="divide-y divide-[#ECE6D6]">
      {shown.map(({ it, i }) => (
        <li key={i} className="group group/hide flex gap-2.5 py-2">
          {it.sentiment && (
            <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full" style={{ background: SENTIMENT[it.sentiment] }}
              title={`${it.sentiment} sentiment`} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] leading-snug text-[#1C1B17]">
              {it.url ? (
                <a href={it.url} target="_blank" rel="noopener noreferrer"
                  className="decoration-[#C9C1AF] underline-offset-2 hover:underline">{it.title}</a>
              ) : it.title}
            </p>
            {it.summary && !dense && <p className="mt-0.5 text-[12px] leading-snug text-[#6F6A60]">{it.summary}</p>}
            <p className="tb-data mt-0.5 text-[10px] text-[#8B857A]">
              {[formatItemDate(it.date), it.tag].filter(Boolean).join('  /  ')}
            </p>
          </div>
          {onInsertItem && (
            <button type="button" onClick={() => onInsertItem(it)}
              className="tb-data h-6 flex-none self-center rounded-md border border-[#D7D0C2] px-1.5 text-[10px] text-[#6F6A60] opacity-0 transition-opacity hover:border-[#1C1B17] hover:text-[#1C1B17] focus:opacity-100 group-hover:opacity-100">
              Cite
            </button>
          )}
          {onHide && (
            <button type="button" onClick={() => onHide(i)} className={`${hideBtn} self-center`}
              aria-label="Hide this item" title="Hide from the note">
              <X className="h-3 w-3" />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * One bullet, editable in place when `onEdit` is given: same typography as the read-only
 * text, so editing never changes the look. Plain text only (no formatting), committed on
 * blur or Enter; clearing it removes the bullet. ProseMirror ignores keystrokes here
 * because TipTap stops events that start inside an editable element of a node view.
 */
function Bullet({ text, onEdit }: { text: string; onEdit?: (next: string) => void }) {
  const commit = (el: HTMLElement) => {
    const next = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (next !== text) onEdit?.(next)
  }
  return (
    <li className="flex gap-2 text-[12.5px] leading-snug text-[#1C1B17]">
      <span className="mt-[8px] h-[3px] w-[3px] flex-none rounded-full bg-[#8B857A]" />
      {onEdit ? (
        <span
          contentEditable="plaintext-only"
          suppressContentEditableWarning
          spellCheck
          role="textbox"
          aria-label="Edit this point"
          onBlur={(e) => commit(e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
            if (e.key === 'Escape') { e.currentTarget.textContent = text; e.currentTarget.blur() }
          }}
          className="-mx-1 min-w-0 flex-1 cursor-text rounded px-1 outline-none transition-colors hover:bg-[#F3EEE1] focus:bg-[#FBF7ED] focus:shadow-[inset_0_0_0_1px_#C9C1AF]"
        >{text}</span>
      ) : <span className="min-w-0 flex-1">{text}</span>}
    </li>
  )
}

function Section({ s, dense, onHide, edits, onEdit }: {
  s: SourceSection; dense?: boolean; onHide?: () => void
  edits?: Record<string, string>; onEdit?: (index: number, next: string) => void
}) {
  // Original indices are kept so an edit stays attached to its bullet.
  const bullets = s.bullets
    .map((b, i) => ({ i, text: edits?.[editKey(s.heading, i)] ?? b }))
    .filter((b) => b.text.trim() !== '')
    .slice(0, dense ? 3 : 8)
  if (!bullets.length && (dense || !s.markdown)) return null
  return (
    <div className="group/hide">
      <div className="mb-1 flex items-center gap-1">
        <p className="tb-data text-[10.5px] font-medium text-[#6F6A60]">{s.heading}</p>
        {onHide && (
          <button type="button" onClick={onHide} className={hideBtn}
            aria-label={`Hide ${s.heading}`} title="Hide this section from the note">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {bullets.length > 0 && (
        <ul className="flex flex-col gap-1">
          {bullets.map((b) => (
            <Bullet key={b.i} text={b.text} onEdit={onEdit ? (next) => onEdit(b.i, next) : undefined} />
          ))}
        </ul>
      )}
      {!dense && s.markdown && (
        <details className="group mt-1.5">
          <summary className="tb-data cursor-pointer select-none text-[10.5px] text-[#2C4F7C] hover:underline">
            Full analysis
          </summary>
          <div className="mt-2 rounded-lg border border-[#ECE6D6] bg-[#FBF7ED] px-3 py-2 text-[13px] text-[#1C1B17]">
            <ThesisMarkdown content={s.markdown} />
          </div>
        </details>
      )}
    </div>
  )
}

/** Renders any connector payload: chart or table, analysis sections, and a list of filings or stories. */
export default function SourceView({ payload, mode, dense, onInsertItem, trim, onTrim }: Props) {
  const { table, items, sections } = payload
  const hiddenSections = new Set(trim?.hiddenSections ?? [])
  const hiddenItems = new Set(trim?.hiddenItems ?? [])
  const hiddenCount = hiddenSections.size + hiddenItems.size
  const edits = trim?.edits ?? {}
  const editCount = Object.keys(edits).length
  const plan = chartPlan(payload.table, payload.chart, dense ? 8 : 12)
  const showChart = mode === 'chart' && !!plan
  return (
    <div className="flex flex-col gap-3">
      {payload.fallback_note && (
        <p className="tb-data flex gap-1.5 rounded-md bg-[#F3EEE1] px-2 py-1.5 text-[10.5px] leading-snug text-[#6F6A60]">
          <Info className="mt-[1px] h-3 w-3 flex-none" />{payload.fallback_note}
        </p>
      )}
      {showChart && (
        <div className="flex flex-col gap-1.5">
          <TrendChart plan={plan} height={dense ? 170 : 230} maxTicks={dense ? 4 : 8} />
          <Legend plan={plan} />
        </div>
      )}
      {table && (!showChart || !dense) && (
        <DataTable table={table} dense={dense} series={plan?.series.map((s) => s.label) ?? []} />
      )}

      {sections?.filter((s) => !hiddenSections.has(s.heading)).map((s, i) => (
        <Section key={i} s={s} dense={dense} edits={edits}
          onHide={onTrim ? () => onTrim({ ...trim, hiddenSections: [...hiddenSections, s.heading] }) : undefined}
          onEdit={onTrim ? (idx, next) => {
            const key = editKey(s.heading, idx)
            const original = s.bullets[idx]
            const rest = { ...edits }
            if (next === original) delete rest[key]; else rest[key] = next
            onTrim({ ...trim, edits: rest })
          } : undefined} />
      ))}

      {items && items.length > 0 && (
        <ItemList items={items} dense={dense} onInsertItem={onInsertItem} hidden={hiddenItems}
          onHide={onTrim ? (i) => onTrim({ ...trim, hiddenItems: [...hiddenItems, i] }) : undefined} />
      )}

      {onTrim && (hiddenCount > 0 || editCount > 0) && (
        <div className="tb-data flex gap-3 text-[10.5px]">
          {hiddenCount > 0 && (
            <button type="button" onClick={() => onTrim({ ...trim, hiddenSections: [], hiddenItems: [] })}
              className="text-[#2C4F7C] hover:underline">
              Show {hiddenCount} hidden {hiddenCount === 1 ? 'part' : 'parts'}
            </button>
          )}
          {editCount > 0 && (
            <button type="button" onClick={() => onTrim({ ...trim, edits: {} })}
              className="text-[#2C4F7C] hover:underline">
              Reset {editCount} {editCount === 1 ? 'edit' : 'edits'} to the source wording
            </button>
          )}
        </div>
      )}

      {payload.source_url && !dense && (
        <a href={payload.source_url} target="_blank" rel="noopener noreferrer"
          className="tb-data inline-flex items-center gap-1 self-start text-[10.5px] text-[#2C4F7C] hover:underline">
          Open the source <ArrowUpRight className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}
