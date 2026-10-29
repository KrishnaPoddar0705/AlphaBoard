import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, MessageSquare, Trash2 } from 'lucide-react'
import ThesisMarkdown from '@/components/thesis/ThesisMarkdown'
import EventKindBadge from '../shared/EventKindBadge'
import AttachmentList from '../shared/AttachmentList'
import EventComments from '../review/EventComments'
import PushNote from '../review/PushNote'
import PushControl from '../review/PushControl'
import MetWith from '../shared/MetWith'
import SvanView from '../shared/SvanView'
import BoardLink from '../shared/BoardLink'
import type { EventContactTag } from '@/lib/commandCenter/api'
import { formatDay } from '@/lib/commandCenter/format'
import { THESIS_IMPACTS, svanRatingOf } from '@/lib/commandCenter/constants'
import { useDeleteEvent } from '@/hooks/commandCenter/useCommandCenterEvents'
import type { ActivityFeedRow, EventAttachment } from '@/lib/commandCenter/types'

interface Props {
  event: ActivityFeedRow
  attachments: EventAttachment[]
  metWith?: EventContactTag['contact'][]
  metLoading?: boolean
  canDelete: boolean
  /** Set when a link (e.g. a concall cell) pointed at this entry. */
  focused?: boolean
  /** Changes on every navigation, so pointing at the same entry again re-scrolls. */
  focusKey?: string
}

export default function TimelineEntry({
  event, attachments, metWith, metLoading, canDelete, focused, focusKey,
}: Props) {
  // Entries with a body start collapsed so a long timeline stays scannable.
  const hasBody = !!(event.kta || event.open_questions || event.svan_view || event.svan_rating)
  const [open, setOpen] = useState(!hasBody)
  const deleteEvent = useDeleteEvent()
  const ref = useRef<HTMLElement>(null)

  // Expand on each new "go to this entry", but leave the analyst free to collapse it.
  // Adjusted during render rather than in an effect, so it lands in the same paint.
  const [expandedFor, setExpandedFor] = useState<string | undefined>()
  const [discussOpen, setDiscussOpen] = useState(false)
  if (focused && focusKey !== expandedFor) {
    setExpandedFor(focusKey)
    setOpen(true)
    setDiscussOpen(true)
  }
  const commentCount = event.comment_count ?? 0

  useEffect(() => {
    if (!focused) return
    // The desktop and mobile timelines are both mounted; only scroll the visible one.
    const el = ref.current
    if (el && el.offsetParent !== null) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focused, focusKey])

  const impact = THESIS_IMPACTS.find((t) => t.value === event.thesis_impact)
  const svan = svanRatingOf(event.svan_rating)

  return (
    <article
      ref={ref}
      className={[
        'relative scroll-mt-24 rounded-xl border bg-[#F7F2E6] p-3 transition-shadow',
        focused ? 'border-[#1C1B17] ring-2 ring-[#1C1B17]/15' : 'border-[#D7D0C2]',
      ].join(' ')}
    >
      <header className="flex flex-wrap items-center gap-2">
        <EventKindBadge kind={event.kind} subtype={event.subtype} scheduled={event.is_scheduled} />
        <span className="font-mono text-[11px] text-[#6F6A60]">{formatDay(event.event_date)}</span>
        {event.period_label && (
          <span className="rounded border border-[#D7D0C2] px-1.5 font-mono text-[10px] text-[#6F6A60]">
            {event.period_label}
          </span>
        )}
        {event.broker_name && (
          <span className="font-mono text-[11px] text-[#6F6A60]">{event.broker_name}</span>
        )}
        {impact && (
          <span className="inline-flex items-center gap-1 font-mono text-[10px]" style={{ color: impact.color }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: impact.color }} />
            {impact.label}
          </span>
        )}
        {svan && (
          <span className="rounded px-1.5 font-mono text-[10px] text-[#F7F2E6]" style={{ backgroundColor: svan.color }}>
            {svan.label}
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-[#6F6A60]">
          {event.analyst_username ?? event.created_by_username ?? ''}
        </span>
      </header>

      <div className="mt-1.5 flex items-start gap-2">
        {hasBody && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-0.5 text-[#6F6A60] hover:text-[#1C1B17]"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
        <h3 className="font-mono text-sm text-[#1C1B17]">{event.title}</h3>
      </div>
      <MetWith contacts={metWith} count={event.contact_count} loading={metLoading} className="mt-1 pl-6" />

      {open && (
        <div className="mt-2 flex flex-col gap-2 pl-6">
          <SvanView event={event} />
          <BoardLink eventId={event.event_id} />
          {event.kta && (
            <div className="font-mono text-xs leading-relaxed text-[#1C1B17]">
              <ThesisMarkdown content={event.kta} />
            </div>
          )}
          {event.open_questions && (
            <div className="rounded-lg border border-dashed border-[#D06030] px-2.5 py-1.5">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#D06030]">
                Open questions
              </p>
              <p className="font-mono text-xs text-[#1C1B17]">{event.open_questions}</p>
            </div>
          )}
          <AttachmentList items={attachments} />
        </div>
      )}

      {event.review_requested && !event.is_scheduled && (
        <div className="mt-2">
          <PushNote event={event} />
        </div>
      )}

      {!event.is_scheduled && (
        <footer className="mt-2 flex flex-col gap-2 border-t border-[#E3DDCF] pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <PushControl event={event} compact />
            <button
              type="button"
              onClick={() => setDiscussOpen((v) => !v)}
              aria-expanded={discussOpen}
              className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-[#6F6A60] hover:text-[#1C1B17]"
            >
              <MessageSquare className="h-3 w-3" />
              {commentCount > 0 ? `${commentCount} comment${commentCount === 1 ? '' : 's'}` : 'Comment'}
            </button>
          </div>
          {discussOpen && <EventComments eventId={event.event_id} />}
        </footer>
      )}

      {canDelete && (
        <button
          type="button"
          onClick={() => {
            if (confirm(`Delete "${event.title}"? This cannot be undone.`)) {
              deleteEvent.mutate(event.event_id)
            }
          }}
          aria-label="Delete entry"
          className="absolute right-2 top-2 hidden rounded p-1 text-[#8B857A] hover:bg-[rgba(178,59,42,0.1)] hover:text-[#B23B2A] group-hover:block"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </article>
  )
}
