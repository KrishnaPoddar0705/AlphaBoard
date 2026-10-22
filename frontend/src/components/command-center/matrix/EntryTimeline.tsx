import {
  Timeline, TimelineContent, TimelineHeader, TimelineIndicator, TimelineItem,
  TimelineSeparator, TimelineTitle,
} from '@/components/reui/timeline'
import { svanRatingOf } from '@/lib/commandCenter/constants'
import { formatDay, formatDayShort } from '@/lib/commandCenter/format'
import { ownerName } from '@/lib/commandCenter/home'
import { excerpt } from '@/lib/commandCenter/matrix'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'
import { type } from './styles'

interface Props {
  /** Logged entries to draw, newest first. */
  logged: ActivityFeedRow[]
  /** Expanded density: one line of takeaways and the owner under each step. */
  detailed: boolean
  /** Name the company on each step (By Analyst rows) rather than the period or title. */
  showTicker: boolean
  onOpenEntry: (row: ActivityFeedRow) => void
}

/**
 * Logged work as a quiet vertical timeline (ReUI timeline primitives), newest first.
 *
 * One visual language for every kind of event: a dot (tinted by the Svan View rating
 * when there is one), the title, and a mono date. Owner, rating and files are in the
 * tooltip -- and in the excerpt line when expanded -- rather than repeated as chips.
 */
export default function EntryTimeline({ logged, detailed, showTicker, onOpenEntry }: Props) {
  return (
    <Timeline value={logged.length} className="w-full">
      {logged.map((e, i) => {
        const rating = svanRatingOf(e.svan_rating)
        const title = showTicker ? e.ticker : (e.period_label ?? e.title)
        const tip = [
          `${formatDay(e.event_date)} · ${e.title}`,
          ownerName(e),
          rating && `Svan View: ${rating.label}`,
          e.attachment_count > 0 && `${e.attachment_count} file${e.attachment_count === 1 ? '' : 's'}`,
        ].filter(Boolean).join('\n')
        const note = detailed ? excerpt(e.kta ?? e.svan_view, 120) : ''

        return (
          <TimelineItem key={e.event_id} step={i + 1}
            className="ms-4 group-data-[orientation=vertical]/timeline:not-last:pb-1.5">
            <TimelineHeader>
              <TimelineSeparator className="bg-(--mx-line) group-data-[orientation=vertical]/timeline:-left-3 group-data-[orientation=vertical]/timeline:h-[calc(100%-6px)] group-data-[orientation=vertical]/timeline:translate-y-[13px]" />
              <TimelineIndicator
                className="size-[7px] border-0 group-data-[orientation=vertical]/timeline:-left-3 group-data-[orientation=vertical]/timeline:top-[6px]"
                style={{ backgroundColor: rating?.color ?? 'var(--mx-text-2)' }}
              />
              <TimelineTitle
                render={<button type="button" title={tip} onClick={() => onOpenEntry(e)} />}
                className="flex w-full min-w-0 items-baseline gap-2 rounded-(--mx-radius-sm) text-left font-normal"
              >
                <span className={`${type.body} min-w-0 flex-1 truncate group-hover/row:text-(--mx-text) hover:underline hover:decoration-(--mx-line-strong) hover:underline-offset-2`}>
                  {title}
                </span>
                <span className={`${type.monoFaint} shrink-0`}>{formatDayShort(e.event_date)}</span>
              </TimelineTitle>
            </TimelineHeader>
            {detailed && (
              <TimelineContent className="mt-0.5 pb-1">
                <p className={`${type.help} line-clamp-2`}>
                  <span className="text-(--mx-text-2)">{showTicker ? e.title : ownerName(e)}</span>
                  {note && <> — {note}</>}
                </p>
              </TimelineContent>
            )}
          </TimelineItem>
        )
      })}
    </Timeline>
  )
}
