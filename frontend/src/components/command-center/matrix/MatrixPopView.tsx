import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, FileText, MessageSquare, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import ThesisMarkdown from '@/components/thesis/ThesisMarkdown'
import { Bone } from '../shared/Skeleton'
import AttachmentPreview from './AttachmentPreview'
import BoardLink from '../shared/BoardLink'
import { useEventAttachments } from '@/hooks/commandCenter/useCommandCenterEvents'
import { EVENT_TYPES, eventTypeOf, svanRatingOf } from '@/lib/commandCenter/constants'
import { formatDay, formatDayShort, relativeDays } from '@/lib/commandCenter/format'
import { ownerName } from '@/lib/commandCenter/home'
import type { MatrixSubject, MatrixTheme } from '@/lib/commandCenter/matrix'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'
import { control, type } from './styles'

/** Which cell is open: an activity column by its type id, or Source Documents; optionally one entry in it. */
export interface MatrixSelection {
  subject: MatrixSubject
  column: string | 'docs'
  eventId?: string
}

interface Props {
  selection: MatrixSelection | null
  /** The cell's entries, newest first. */
  entries: ActivityFeedRow[]
  theme: MatrixTheme
  onClose: () => void
  onOpenEntry: (row: ActivityFeedRow) => void
  onLog: (coverageId: string | undefined, typeId: string) => void
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
  const ColumnIcon = column?.icon ?? FileText
  const current = entries.find((e) => e.event_id === (picked ?? selection?.eventId)) ?? entries[0] ?? null

  return (
    <Dialog open={!!selection} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-theme={theme}
        className="mx flex h-[86vh] max-w-5xl flex-col gap-0 overflow-hidden rounded-(--mx-radius-lg) border-0 bg-(--mx-surface) p-0 shadow-(--mx-shadow-pop) sm:max-w-5xl">
        {subject && (
          <>
            <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-(--mx-line) px-5 py-3.5 pr-14">
              <span className="inline-flex items-center gap-1.5 text-[12px] text-(--mx-text-2)">
                <ColumnIcon className="size-3.5" />{column?.label ?? 'Source documents'}
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
                {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} · last 12 months
              </DialogDescription>
              {column && (
                <button type="button" className={`${control.base} ${control.outline} ml-auto`} onClick={() => onLog(stock?.id, column.id)}>
                  <Plus className="size-3.5" /> Log {column.label}
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
                          {formatDayShort(e.event_date)}{e.is_scheduled && <span className="text-(--mx-accent)"> · next</span>}
                        </span>
                      </span>
                    </button>
                  )
                })}
                {entries.length === 0 && <p className={`${type.help} p-2`}>Nothing logged yet.</p>}
              </nav>

              <article className="mx-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5 md:px-8">
                {current && <EntryDocument entry={current} onOpenEntry={onOpenEntry} />}
              </article>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function EntryDocument({ entry, onOpenEntry }: { entry: ActivityFeedRow; onOpenEntry: (row: ActivityFeedRow) => void }) {
  const { data: files = [], isPending } = useEventAttachments(entry.attachment_count > 0 ? [entry.event_id] : [])
  const kind = eventTypeOf(entry.kind, entry.subtype)
  const rating = svanRatingOf(entry.svan_rating)

  return (
    <div className="mx-auto max-w-[680px] space-y-6">
      <div className="space-y-1.5">
        <p className={type.label}>
          {kind.label}{entry.is_scheduled && ' · scheduled'} · <span className="font-mono normal-case tracking-normal">{formatDay(entry.event_date)}</span> · {relativeDays(entry.event_date)}
        </p>
        <h2 className="text-[19px] font-semibold leading-snug tracking-[-0.01em] text-(--mx-text)">{entry.title}</h2>
        <p className={type.meta}>
          <span className="font-mono">{entry.ticker}</span> · {entry.is_scheduled ? 'Scheduled' : ownerName(entry)}
          {entry.period_label && <> · {entry.period_label}</>}
          {entry.broker_name && <> · {entry.broker_name}</>}
        </p>
      </div>

      {(entry.svan_view || rating) && (
        <section className="border-l-2 pl-4" style={{ borderColor: rating?.color ?? 'var(--mx-line-strong)' }}>
          <p className={`${type.label} flex items-center gap-2`}>
            Svan View
            {rating && <span className="normal-case tracking-normal" style={{ color: rating.color }}>● {rating.label}</span>}
          </p>
          {entry.svan_view && <p className={`${type.body} mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed`}>{entry.svan_view}</p>}
        </section>
      )}

      <section>
        <h3 className={type.label}>Key takeaways</h3>
        <BoardLink eventId={entry.event_id} className="mt-2" />
        <div className="mt-2 text-[13px] leading-relaxed text-(--mx-text)">
          {entry.kta ? <ThesisMarkdown content={entry.kta} /> : <p className="text-(--mx-text-3)">None written.</p>}
        </div>
      </section>

      {entry.open_questions && (
        <section>
          <h3 className={type.label}>Open questions</h3>
          <div className="mt-2 text-[13px] leading-relaxed text-(--mx-text)"><ThesisMarkdown content={entry.open_questions} /></div>
        </section>
      )}

      {entry.attachment_count > 0 && (
        <section>
          <h3 className={type.label}>Source documents <span className="font-mono">{entry.attachment_count}</span></h3>
          <div className="mt-2">
            {isPending ? <Bone className="h-10 w-full" /> : <AttachmentPreview key={entry.event_id} items={files} />}
          </div>
        </section>
      )}

      <div className="border-t border-(--mx-line) pt-4">
        <button type="button" onClick={() => onOpenEntry(entry)} className={`${control.base} ${control.ghost} -ml-2.5`}>
          <MessageSquare className="size-3.5" /> Comments, contacts and push
        </button>
      </div>
    </div>
  )
}
