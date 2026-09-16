import { Check } from 'lucide-react'
import { Bone } from '../shared/Skeleton'
import type { EventReview } from '@/lib/commandCenter/types'

interface Props {
  requested: boolean | undefined
  reviews: EventReview[]
  /** Verdicts still loading: hold the slot rather than show a status that may flip. */
  loading?: boolean
}

/**
 * An entry's review state in one word. Any endorsement or rejection makes it Reviewed --
 * the question has been answered either way; who said what is on the entry itself.
 * Otherwise a request shows as pending, and an entry nobody asked about shows nothing.
 */
export default function ReviewStatus({ requested, reviews, loading }: Props) {
  if (reviews.length > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-[#2F8F5B] px-1 font-mono text-[10px] text-[#2F8F5B]">
        <Check className="h-2.5 w-2.5" /> reviewed
      </span>
    )
  }
  if (!requested) return null
  if (loading) return <span className="inline-block w-24"><Bone className="h-4" /></span>
  return (
    <span className="rounded border border-dashed border-[#D06030] px-1 font-mono text-[10px] text-[#B04E22]">
      review requested
    </span>
  )
}
