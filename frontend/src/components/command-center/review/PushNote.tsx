import type { ActivityFeedRow } from '@/lib/commandCenter/types'

interface Props {
  event: Pick<ActivityFeedRow, 'push_to_pm' | 'push_to_admin' | 'review_note'>
}

/**
 * The analyst's question to their PM or admin, shown on the entry it was asked about.
 * There is no verdict to give -- the answer is a reply in the entry's comments.
 */
export default function PushNote({ event }: Props) {
  const to = [event.push_to_pm && 'PM', event.push_to_admin && 'Admin'].filter(Boolean).join(' and ')
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-dashed border-[#D06030] bg-[rgba(208,96,48,0.04)] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#B04E22]">
        Pushed{to ? ` to ${to}` : ''}
      </p>
      <p className="font-mono text-xs text-[#1C1B17]">
        <span className="text-[#6F6A60]">Asked: </span>{event.review_note || 'Their view on this entry.'}
      </p>
      <p className="font-mono text-[10px] text-[#8B857A]">Reply in the comments.</p>
    </div>
  )
}
