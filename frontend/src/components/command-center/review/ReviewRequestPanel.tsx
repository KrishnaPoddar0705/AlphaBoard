import { useState } from 'react'
import { Check, X } from 'lucide-react'
import ReviewBar from './ReviewBar'
import { Bone } from '../shared/Skeleton'
import { useCanReview } from '@/hooks/commandCenter/useCanReview'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import { relativeTime } from '@/lib/commandCenter/home'
import type { ActivityFeedRow, EventReview } from '@/lib/commandCenter/types'

interface Props {
  event: Pick<ActivityFeedRow, 'event_id' | 'created_by' | 'analyst_id' | 'is_scheduled' | 'review_note'>
  reviews: EventReview[]
  loading?: boolean
}

/**
 * The analyst's question to their PM, and its answer.
 *
 *   waiting   -> the question, plus Endorse / Reject with a note for whoever may review;
 *                everyone else (including the analyst who asked) sees that it is pending
 *   reviewed  -> the question, then each verdict with its note, and a way for a reviewer
 *                to change theirs
 *
 * Longer back-and-forth belongs in the entry's comments, just below.
 */
export default function ReviewRequestPanel({ event, reviews, loading }: Props) {
  const canReview = useCanReview()
  const { userId } = useCommandCenterSession()
  const [changing, setChanging] = useState(false)
  const mayReview = canReview(event)
  const reviewed = reviews.length > 0

  if (loading || canReview.pending) return <Bone className="h-[64px] w-full rounded-lg" />

  const question = (
    <p className="font-mono text-xs text-[#1C1B17]">
      <span className="text-[#6F6A60]">Asked: </span>{event.review_note || 'Their view on this entry.'}
    </p>
  )

  if (!reviewed) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[#D06030] bg-[rgba(208,96,48,0.04)] px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#B04E22]">Review requested</p>
        {question}
        {mayReview ? (
          <>
            <ReviewBar event={event} reviews={reviews} hideSummary />
            <p className="font-mono text-[10px] text-[#8B857A]">
              Your verdict and note mark this reviewed. Use comments below to discuss.
            </p>
          </>
        ) : (
          <p className="font-mono text-[10px] text-[#8B857A]">Waiting for a portfolio manager to review.</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#2F8F5B] bg-[rgba(47,143,91,0.04)] px-3 py-2">
      <p className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#2F8F5B]">
        <Check className="h-3 w-3" /> Reviewed
      </p>
      {question}
      <ul className="flex flex-col gap-1.5">
        {reviews.map((r) => {
          const endorse = r.verdict === 'endorse'
          return (
            <li key={r.id} className="border-l-2 pl-2" style={{ borderColor: endorse ? '#2F8F5B' : '#B23B2A' }}>
              <p className="inline-flex flex-wrap items-center gap-1 font-mono text-[11px]" style={{ color: endorse ? '#2F8F5B' : '#B23B2A' }}>
                {endorse ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {endorse ? 'Endorsed' : 'Rejected'} by {r.reviewer_username ?? 'a reviewer'}
                <span className="text-[#8B857A]">· {relativeTime(r.updated_at)}</span>
              </p>
              {r.note && <p className="font-mono text-xs text-[#1C1B17]">{r.note}</p>}
            </li>
          )
        })}
      </ul>
      {mayReview && (changing ? (
        <ReviewBar event={event} reviews={reviews} hideSummary onDone={() => setChanging(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setChanging(true)}
          className="self-start font-mono text-[10px] uppercase tracking-[0.1em] text-[#6F6A60] hover:text-[#1C1B17]"
        >
          {reviews.some((r) => r.reviewer_id === userId) ? 'Change your verdict' : 'Add your verdict'}
        </button>
      ))}
    </div>
  )
}
