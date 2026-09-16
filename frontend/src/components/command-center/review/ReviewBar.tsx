import { useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import { useCanReview } from '@/hooks/commandCenter/useCanReview'
import { useSetReview } from '@/hooks/commandCenter/useHome'
import type { ActivityFeedRow, EventReview } from '@/lib/commandCenter/types'

interface Props {
  event: Pick<ActivityFeedRow, 'event_id' | 'created_by' | 'analyst_id' | 'is_scheduled'>
  reviews: EventReview[]
  /** Compact: verdict chips and buttons on one line, no note field. */
  compact?: boolean
  /** Full mode only: hide the existing verdicts (the caller already lists them). */
  hideSummary?: boolean
  onDone?: () => void
}

/** Who endorsed or rejected an entry, and -- for a PM or admin -- the buttons to do so. */
export function ReviewSummary({ reviews }: { reviews: EventReview[] }) {
  if (reviews.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {reviews.map((r) => (
        <span
          key={r.id}
          title={r.note ?? undefined}
          className={[
            'inline-flex items-center gap-0.5 rounded border px-1 font-mono text-[10px]',
            r.verdict === 'endorse'
              ? 'border-[#2F8F5B] text-[#2F8F5B]'
              : 'border-[#B23B2A] text-[#B23B2A]',
          ].join(' ')}
        >
          {r.verdict === 'endorse' ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
          {r.reviewer_username ?? 'Reviewer'}
        </span>
      ))}
    </span>
  )
}

export default function ReviewBar({ event, reviews, compact, hideSummary, onDone }: Props) {
  const { userId } = useCommandCenterSession()
  const canReview = useCanReview()
  const setReview = useSetReview()
  const [note, setNote] = useState('')
  const mine = reviews.find((r) => r.reviewer_id === userId)

  // Mirrors the database rule (no self-review; admins, or PMs sharing a team), so the
  // buttons only appear where a verdict would actually be accepted.
  const canAct = canReview(event)

  const act = (verdict: 'endorse' | 'reject') => {
    setReview.mutate(
      { eventId: event.event_id, verdict: mine?.verdict === verdict ? null : verdict, note: note || null },
      { onSuccess: () => { setNote(''); onDone?.() } }
    )
  }

  const btn = (verdict: 'endorse' | 'reject') => {
    const on = mine?.verdict === verdict
    const tone = verdict === 'endorse' ? '#2F8F5B' : '#B23B2A'
    return (
      <button
        type="button"
        disabled={setReview.isPending}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); act(verdict) }}
        title={on ? 'Withdraw' : verdict === 'endorse' ? 'Endorse' : 'Reject'}
        className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50"
        style={on
          ? { backgroundColor: tone, borderColor: tone, color: '#F7F2E6' }
          : { borderColor: tone, color: tone }}
      >
        {setReview.isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
          : verdict === 'endorse' ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
        {verdict === 'endorse' ? 'Endorse' : 'Reject'}
      </button>
    )
  }

  if (!canAct) return <ReviewSummary reviews={reviews} />

  if (compact) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <ReviewSummary reviews={reviews.filter((r) => r.reviewer_id !== userId)} />
        {btn('endorse')}
        {btn('reject')}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {!hideSummary && <ReviewSummary reviews={reviews} />}
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={mine ? 'Change your note (optional)' : 'Why? (optional)'}
          className="min-w-0 flex-1 rounded border border-[#D7D0C2] bg-[#FBF7ED] px-2 py-1 font-mono text-[11px] text-[#1C1B17] focus:border-[#8B857A] focus:outline-none"
        />
        {btn('endorse')}
        {btn('reject')}
      </div>
    </div>
  )
}
