import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, FileText, Layers, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import EntryDocument from './EntryDocument'
import { usePrefetchSummaries } from '@/hooks/commandCenter/useEntrySummary'
import { EVENT_TYPES, eventTypeOf, svanRatingOf } from '@/lib/commandCenter/constants'
import { formatDayShort } from '@/lib/commandCenter/format'
import type { MatrixSubject, MatrixTheme } from '@/lib/commandCenter/matrix'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'
import { control, type } from './styles'
// Imported here as well as by MatrixView: the home screen opens this view too.
import './matrix.css'

/**
 * Which cell is open: an activity column by its type id, Source Documents, or 'all' --
 * every log for the subject (the home screen opening a company); optionally one entry in it.
 */
export interface MatrixSelection {
  subject: MatrixSubject
  column: string | 'docs' | 'all'
  eventId?: string
}

interface Props {
  selection: MatrixSelection | null
  /** The cell's entries, newest first. */
  entries: ActivityFeedRow[]
  theme: MatrixTheme
  onClose: () => void
  onOpenEntry: (row: ActivityFeedRow) => void
  /** typeId is absent when logging from 'all' (no column to pre-select). */
  onLog: (coverageId: string | undefined, typeId?: string) => void
}

/**
 * A cell, opened over the grid without leaving it: the cell's entries down the left,
 * the chosen one on the right as a document -- Svan View, takeaways rendered as markdown
 * (tables included), open questions, and its source files previewed inline.
 */
export default function MatrixPopView({ selection, entries, theme, onClose, onOpenEntry, onLog }: Props) {
  const [picked, setPicked] = useState<string | null>(null)
  const subject = selection?.subject
  const stock = subject?.kind === 'stock' ? subject.stock : null
  const column = EVENT_TYPES.find((t) => t.id === selection?.column)
  const all = selection?.column === 'all'
  const ColumnIcon = column?.icon ?? (all ? Layers : FileText)
  // One query for every listed entry's cached AI summary, so switching entries is instant.
  usePrefetchSummaries(selection ? entries : [])
  const current = entries.find((e) => e.event_id === (picked ?? selection?.eventId)) ?? entries[0] ?? null

  return (
    <Dialog open={!!selection} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-theme={theme}
        className="mx flex h-[86vh] max-w-5xl flex-col gap-0 overflow-hidden rounded-(--mx-radius-lg) border-0 bg-(--mx-surface) p-0 shadow-(--mx-shadow-pop) sm:max-w-5xl">
        {subject && (
          <>
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-(--mx-line) px-5 py-3.5 pr-14">
              <span className="inline-flex items-center gap-1.5 text-[12px] text-(--mx-text-2)">
                <ColumnIcon className="size-3.5" />{column?.label ?? (all ? 'All logs' : 'Source documents')}
              </span>
              <span aria-hidden className="h-3.5 w-px bg-(--mx-line-strong)" />
              <DialogTitle className={type.pageTitle}>
                {stock ? (
                  <Link to={`/command-center/stock/${encodeURIComponent(stock.ticker)}`} className="inline-flex items-center gap-1 hover:underline hover:underline-offset-2">
                    {stock.company_name ?? stock.ticker}<ArrowUpRight className="size-3.5 text-(--mx-text-3)" />
                  </Link>
                ) : subject.title}
              </DialogTitle>
              <DialogDescription className={type.help}>
                {stock && <span className="font-mono">{stock.ticker} · </span>}
                {!stock && 'Across companies · '}
                {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}{!all && ' · last 12 months'}
              </DialogDescription>
              {column ? (
                <button type="button" className={`${control.base} ${control.outline} ml-auto`} onClick={() => onLog(stock?.id, column.id)}>
                  <Plus className="size-3.5" /> Log {column.label}
                </button>
              ) : all && stock && (
                <button type="button" className={`${control.base} ${control.outline} ml-auto`} onClick={() => onLog(stock.id)}>
                  <Plus className="size-3.5" /> Log entry
                </button>
              )}
            </header>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <nav aria-label="Entries"
                className="mx-scroll flex shrink-0 gap-1 overflow-x-auto border-b border-(--mx-line) bg-(--mx-sunken) p-2 md:w-64 md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
                {entries.map((e) => {
                  const on = e.event_id === current?.event_id
                  const rating = svanRatingOf(e.svan_rating)
                  return (
                    <button key={e.event_id} type="button" onClick={() => setPicked(e.event_id)} aria-current={on || undefined}
                      className={[
                        'flex shrink-0 items-start gap-2 rounded-(--mx-radius) px-2.5 py-2 text-left transition-colors md:w-full',
                        on ? 'bg-(--mx-raised) shadow-(--mx-shadow)' : 'hover:bg-(--mx-hover)',
                      ].join(' ')}>
                      <span className={`mt-1.5 size-[7px] shrink-0 rounded-full ${e.is_scheduled ? 'ring-1 ring-(--mx-accent) ring-inset' : ''}`}
                        style={e.is_scheduled ? undefined : { backgroundColor: rating?.color ?? 'var(--mx-text-2)' }} />
                      <span className="min-w-0">
                        <span className={`block max-w-[190px] truncate text-[12.5px] ${on ? 'font-medium text-(--mx-text)' : 'text-(--mx-text-2)'}`}>
                          {stock ? (e.period_label ?? e.title) : `${e.ticker.split('.')[0]} · ${e.period_label ?? e.title}`}
                        </span>
                        <span className={type.monoFaint}>
                          {all && <span className="font-sans">{eventTypeOf(e.kind, e.subtype).label} · </span>}
                          {formatDayShort(e.event_date)}{e.is_scheduled && <span className="text-(--mx-accent)"> · next</span>}
                        </span>
                      </span>
                    </button>
                  )
                })}
                {entries.length === 0 && <p className={`${type.help} p-2`}>Nothing logged yet.</p>}
              </nav>

              <article className="mx-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5 md:px-8">
                {current ? <EntryDocument entry={current} onOpenEntry={onOpenEntry} /> : (
                  <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
                    <p className="text-[13px] font-medium text-(--mx-text)">Nothing logged{stock ? ` for ${stock.ticker}` : ''} yet</p>
                    <p className={type.help}>Concalls, meetings and reports logged against it will show up here.</p>
                  </div>
                )}
              </article>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
