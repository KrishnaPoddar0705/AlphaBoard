import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Radio } from 'lucide-react'
import EventKindBadge from '../shared/EventKindBadge'
import EmptyState from '../shared/EmptyState'
import { EntryListSkeleton } from '../shared/Skeleton'
import ReviewStatus from '../review/ReviewStatus'
import { useReviews } from '@/hooks/commandCenter/useHome'
import { AttachmentCount } from '../shared/AttachmentList'
import Snippet from '../shared/Snippet'
import { formatDay, groupByMonth } from '@/lib/commandCenter/format'
import { THESIS_IMPACTS } from '@/lib/commandCenter/constants'
import { useActivityFeed, useEventSearch } from '@/hooks/commandCenter/useActivityFeed'
import { useEventContacts } from '@/hooks/commandCenter/useCommandCenterEvents'
import MetWith from '../shared/MetWith'
import type { ActivityFilters, EventReview } from '@/lib/commandCenter/types'

function ImpactDot({ impact }: { impact: string | null }) {
  if (!impact) return null
  const tone = THESIS_IMPACTS.find((t) => t.value === impact)
  if (!tone) return null
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px]" style={{ color: tone.color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.color }} />
      {tone.label}
    </span>
  )
}

/**
 * Everything the desk has logged, newest first.
 *
 * When a search term is present this switches to the ranked RPC, which returns
 * relevance-ordered hits with the matching words highlighted -- a plain filter would
 * bury the note you were looking for under whatever happened most recently.
 */
export default function ActivityFeed({ filters }: { filters: ActivityFilters }) {
  const searching = (filters.search?.trim().length ?? 0) > 1
  const feed = useActivityFeed(filters)
  const search = useEventSearch(filters)

  // Verdicts for the rows on screen, so a requested review reads "reviewed" once answered.
  const reviewIds = useMemo(() => (feed.data?.rows ?? []).map((r) => r.event_id), [feed.data])
  const { data: reviews, isPending: reviewsPending } = useReviews(reviewIds)
  const met = useEventContacts(feed.data?.rows ?? [])
  const reviewsLoading = reviewIds.length > 0 && reviewsPending
  const reviewsByEvent = useMemo(() => {
    const map = new Map<string, EventReview[]>()
    for (const r of reviews ?? []) map.set(r.event_id, [...(map.get(r.event_id) ?? []), r])
    return map
  }, [reviews])

  if (searching ? search.isPending : feed.isPending) {
    return <EntryListSkeleton count={5} />
  }

  if (searching) {
    const hits = search.data ?? []
    if (hits.length === 0) {
      return <EmptyState title="No entries match that search" hint="Try fewer words." />
    }
    return (
      <ul className="flex flex-col gap-1.5">
        {hits.map((h) => (
          <li key={h.event_id}>
            <Link
              to={`/command-center/stock/${encodeURIComponent(h.ticker)}?event=${h.event_id}`}
              className="flex flex-col gap-1.5 rounded-xl border border-[#D7D0C2] bg-[#F7F2E6] p-3 transition-colors hover:border-[#8B857A]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <EventKindBadge kind={h.kind} />
                <span className="font-mono text-[11px] text-[#6F6A60]">
                  {h.ticker} · {formatDay(h.event_date)}
                  {h.analyst_username ? ` · ${h.analyst_username}` : ''}
                </span>
              </div>
              <p className="font-mono text-sm text-[#1C1B17]">{h.title}</p>
              {h.snippet && (
                <p className="font-mono text-[11px] leading-relaxed text-[#6F6A60]">
                  <Snippet text={h.snippet} />
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  const rows = feed.data?.rows ?? []
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Radio}
        title="Nothing logged yet"
        hint="Entries appear here the moment anyone on the desk logs a meeting, call or report."
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {groupByMonth(rows).map((group) => (
        <section key={group.key}>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[#8B857A]">
            {group.label}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {group.rows.map((e) => (
              <li key={e.event_id}>
                <Link
                  to={`/command-center/stock/${encodeURIComponent(e.ticker)}?event=${e.event_id}`}
                  className="flex flex-col gap-1.5 rounded-xl border border-[#D7D0C2] bg-[#F7F2E6] p-3 transition-colors hover:border-[#8B857A]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <EventKindBadge kind={e.kind} subtype={e.subtype} />
                    <span className="font-mono text-[11px] text-[#6F6A60]">
                      {e.ticker} · {formatDay(e.event_date)}
                    </span>
                    <ImpactDot impact={e.thesis_impact} />
                    <span className="ml-auto flex items-center gap-2">
                      <ReviewStatus
                        requested={e.review_requested}
                        reviews={reviewsByEvent.get(e.event_id) ?? []}
                        loading={reviewsLoading}
                      />
                      {(e.comment_count ?? 0) > 0 && (
                        <span className="font-mono text-[10px] text-[#6F6A60]">{e.comment_count} comments</span>
                      )}
                      <AttachmentCount count={e.attachment_count} />
                      <span className="font-mono text-[11px] text-[#6F6A60]">
                        {e.analyst_username ?? e.created_by_username ?? ''}
                      </span>
                    </span>
                  </div>
                  <p className="font-mono text-sm text-[#1C1B17]">{e.title}</p>
                  <MetWith contacts={met.byEvent.get(e.event_id)} count={e.contact_count} loading={met.loading} />
                  {e.kta && (
                    <p className="line-clamp-2 font-mono text-[11px] leading-relaxed text-[#6F6A60]">
                      {e.kta}
                    </p>
                  )}
                  {e.open_questions && (
                    <p className="font-mono text-[11px] text-[#D06030]">
                      Open: {e.open_questions}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
