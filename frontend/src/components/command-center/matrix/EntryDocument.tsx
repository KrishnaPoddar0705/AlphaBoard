import { MessageSquare, RotateCw, Sparkles } from 'lucide-react'
import ThesisMarkdown from '@/components/thesis/ThesisMarkdown'
import { Bone } from '../shared/Skeleton'
import AttachmentPreview from './AttachmentPreview'
import BoardLink from '../shared/BoardLink'
import { useEventAttachments } from '@/hooks/commandCenter/useCommandCenterEvents'
import { useEntrySummary } from '@/hooks/commandCenter/useEntrySummary'
import { useViewLabel } from '@/hooks/commandCenter/useViewLabel'
import { eventTypeOf, svanRatingOf } from '@/lib/commandCenter/constants'
import { formatDay, relativeDays } from '@/lib/commandCenter/format'
import { ownerName } from '@/lib/commandCenter/home'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'
import { control, type } from './styles'

/**
 * One entry, read as a document: the desk's view ("<Org> View"), an AI summary of the takeaways, the
 * takeaways themselves as markdown (tables included), open questions, and its source
 * files previewed inline. Shared by the Matrix cell view and the home screen.
 */
export default function EntryDocument({ entry, onOpenEntry }: { entry: ActivityFeedRow; onOpenEntry: (row: ActivityFeedRow) => void }) {
  const { data: files = [], isPending } = useEventAttachments(entry.attachment_count > 0 ? [entry.event_id] : [])
  const kind = eventTypeOf(entry.kind, entry.subtype)
  const rating = svanRatingOf(entry.svan_rating)
  const viewLabel = useViewLabel()

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
            {viewLabel}
            {rating && <span className="normal-case tracking-normal" style={{ color: rating.color }}>● {rating.label}</span>}
          </p>
          {entry.svan_view && <p className={`${type.body} mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed`}>{entry.svan_view}</p>}
        </section>
      )}

      <AiSummary entry={entry} />

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

/**
 * 3-4 bullets condensing the takeaways, generated on first open and cached by the
 * backend. Nothing renders for takeaways too short to need it.
 */
function AiSummary({ entry }: { entry: ActivityFeedRow }) {
  const { data, isPending, error, refetch, isFetching, eligible } = useEntrySummary(entry)
  if (!eligible || (data && !data.bullets)) return null

  return (
    <section className="rounded-(--mx-radius-lg) bg-(--mx-sunken) px-4 py-3.5 ring-1 ring-(--mx-line) ring-inset">
      <h3 className={`${type.label} flex items-center gap-1.5`}>
        <Sparkles className="size-3" /> AI summary
      </h3>
      {isPending ? (
        <div className="mt-2.5 space-y-2" aria-busy="true" aria-label="Summarising the takeaways">
          <Bone className="h-3.5 w-[92%]" />
          <Bone className="h-3.5 w-[84%]" />
          <Bone className="h-3.5 w-[88%]" />
        </div>
      ) : error ? (
        <p className={`${type.help} mt-2 flex items-center gap-2`}>
          {error.message}
          <button type="button" onClick={() => refetch()} disabled={isFetching}
            className="inline-flex items-center gap-1 text-(--mx-text-2) hover:text-(--mx-text) disabled:opacity-50">
            <RotateCw className={`size-3 ${isFetching ? 'animate-spin' : ''}`} /> Retry
          </button>
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {data?.bullets?.map((b, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-(--mx-text)">
              <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-(--mx-text-2)" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      <p className={`${type.help} mt-2.5`}>Generated from the takeaways below. Check figures against the source.</p>
    </section>
  )
}
