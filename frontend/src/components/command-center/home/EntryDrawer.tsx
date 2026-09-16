import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import ThesisMarkdown from '@/components/thesis/ThesisMarkdown'
import EventKindBadge from '../shared/EventKindBadge'
import AttachmentList from '../shared/AttachmentList'
import ReviewBar from '../review/ReviewBar'
import EventComments from '../review/EventComments'
import ReviewRequestPanel from '../review/ReviewRequestPanel'
import { useEventAttachments, useEventContacts } from '@/hooks/commandCenter/useCommandCenterEvents'
import MetWith from '../shared/MetWith'
import { Bone, RowsSkeleton } from '../shared/Skeleton'
import { useReviews } from '@/hooks/commandCenter/useHome'
import { formatDay } from '@/lib/commandCenter/format'
import { THESIS_IMPACTS } from '@/lib/commandCenter/constants'
import { ownerName, relativeTime } from '@/lib/commandCenter/home'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

const label = 'font-mono text-[10px] uppercase tracking-[0.12em] text-[#6F6A60]'

/**
 * The whole of one entry, opened from anywhere on the home screen: what was learned,
 * the files, the PM's verdict and the discussion. Endorse / reject / comment live here
 * so the PM never has to leave the home screen to act.
 */
export default function EntryDrawer({ entry, onClose }: { entry: ActivityFeedRow | null; onClose: () => void }) {
  const ids = entry ? [entry.event_id] : []
  const { data: attachments = [], isPending: filesPending } = useEventAttachments(ids)
  const { data: reviews = [], isPending: reviewsPending } = useReviews(ids)
  const met = useEventContacts(entry ? [entry] : [])
  const impact = THESIS_IMPACTS.find((t) => t.value === entry?.thesis_impact)

  return (
    <Sheet open={!!entry} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-[#F7F2E6] sm:max-w-xl">
        {entry && (
          <>
            <SheetHeader className="border-b border-[#D7D0C2]">
              <div className="flex flex-wrap items-center gap-2 pr-6">
                <EventKindBadge kind={entry.kind} subtype={entry.subtype} scheduled={entry.is_scheduled} />
                <Link
                  to={`/command-center/stock/${encodeURIComponent(entry.ticker)}?event=${entry.event_id}`}
                  className="inline-flex items-center gap-0.5 font-mono text-xs font-semibold text-[#1C1B17] hover:underline"
                >
                  {entry.ticker} <ArrowUpRight className="h-3 w-3" />
                </Link>
                {impact && (
                  <span className="font-mono text-[11px]" style={{ color: impact.color }}>● {impact.label}</span>
                )}
              </div>
              <SheetTitle className="font-mono text-base text-[#1C1B17]">{entry.title}</SheetTitle>
              <p className="font-mono text-[11px] text-[#6F6A60]">
                {ownerName(entry)} · {formatDay(entry.event_date)} · logged {relativeTime(entry.created_at)}
                {entry.broker_name ? ` · ${entry.broker_name}` : ''}
              </p>
              <MetWith contacts={met.byEvent.get(entry.event_id)} count={entry.contact_count} loading={met.loading} />
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4 pb-8">
              {entry.review_requested && !entry.is_scheduled && (
                <ReviewRequestPanel event={entry} reviews={reviews} loading={reviewsPending} />
              )}

              <div>
                <p className={label}>Key takeaways</p>
                {entry.kta ? (
                  <div className="mt-1 font-mono text-xs leading-relaxed text-[#1C1B17]">
                    <ThesisMarkdown content={entry.kta} />
                  </div>
                ) : (
                  <p className="mt-1 font-mono text-[11px] text-[#8B857A]">None written.</p>
                )}
              </div>

              {entry.open_questions && (
                <div>
                  <p className={label}>Open questions</p>
                  <p className="mt-1 font-mono text-xs text-[#1C1B17]">{entry.open_questions}</p>
                </div>
              )}

              {/* The feed row already says how many files there are, so the section is
                  laid out before the file list itself arrives. */}
              {entry.attachment_count > 0 && (
                <div>
                  <p className={label}>Files</p>
                  <div className="mt-1">
                    {filesPending ? (
                      <div className="flex flex-col gap-1.5">
                        {Array.from({ length: entry.attachment_count }, (_, i) => (
                          <Bone key={i} className="h-7 w-full rounded-lg" />
                        ))}
                      </div>
                    ) : <AttachmentList items={attachments} />}
                  </div>
                </div>
              )}

              {!entry.is_scheduled && !entry.review_requested && (
                <div className="border-t border-[#D7D0C2] pt-3">
                  <p className={`${label} mb-1.5`}>Review</p>
                  {reviewsPending ? <RowsSkeleton rows={1} /> : <ReviewBar event={entry} reviews={reviews} />}
                  {!reviewsPending && reviews.length === 0 && (
                    <p className="mt-1 font-mono text-[10px] text-[#8B857A]">Not reviewed yet.</p>
                  )}
                </div>
              )}

              <div className="border-t border-[#D7D0C2] pt-3">
                <p className={`${label} mb-1.5`}>Discussion</p>
                <EventComments eventId={entry.event_id} />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
