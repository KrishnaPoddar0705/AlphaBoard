import { useMemo, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'
import SectionCard from '../shared/SectionCard'
import PeriodCell, { type CellState } from './PeriodCell'
import { PeriodCellsSkeleton } from './StockPageSkeleton'
import { Loading } from '../shared/Skeleton'
import { useCoverageEvents } from '@/hooks/commandCenter/useCommandCenterEvents'
import {
  latestCompletedKey, periodKey, periodLabels, type PeriodKind,
} from '@/lib/commandCenter/periods'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

export type { PeriodKind }

/** How much history shows before "Show older": two years of concalls, five of reports. */
const RECENT: Record<PeriodKind, number> = { concall: 8, annual_report: 5 }

interface Props {
  coverageId: string
  kind: PeriodKind
  /** A period with an entry behind it: show that entry. */
  onOpenEvent: (eventId: string) => void
  /** A period with nothing logged: start logging it, or scheduling it if still ahead. */
  onLogPeriod: (kind: PeriodKind, periodLabel: string, upcoming: boolean) => void
}

/**
 * Concalls or annual reports for one company, one cell per period.
 *
 * The grid leads with what is coming (the period in progress, plus anything already
 * booked further out), then the recent history, then everything older on demand. Each
 * cell is a way into that period's timeline entry; the detail lives there, not here.
 */
export default function PeriodTracker({ coverageId, kind, onOpenEvent, onLogPeriod }: Props) {
  const { data: events = [], isPending } = useCoverageEvents(coverageId)
  const [expanded, setExpanded] = useState(false)
  const isConcall = kind === 'concall'
  const latest = latestCompletedKey(kind)

  // One entry per period: the latest one that happened, else the latest one booked.
  const byPeriod = useMemo(() => {
    const map = new Map<string, ActivityFeedRow>()
    for (const e of events) {
      if (e.kind !== kind || periodKey(kind, e.period_label) === null) continue
      const current = map.get(e.period_label!)
      if (!current || rank(e) > rank(current)) map.set(e.period_label!, e)
    }
    return map
  }, [events, kind])

  const { upcoming, recent, older } = useMemo(() => {
    const keys = [...byPeriod.keys()].map((l) => periodKey(kind, l)!)
    const newest = Math.max(latest + 1, ...keys)
    const recentEnd = latest - RECENT[kind] + 1
    // "All history": back to the oldest entry, and never less than another stretch the
    // size of the default, so older gaps can be backfilled even on a fresh name.
    const oldest = Math.min(recentEnd - RECENT[kind], ...keys)
    return {
      upcoming: periodLabels(kind, newest, latest + 1),
      recent: periodLabels(kind, latest, recentEnd),
      older: periodLabels(kind, recentEnd - 1, oldest),
    }
  }, [byPeriod, kind, latest])

  const stateOf = (label: string, isAhead: boolean): CellState => {
    const e = byPeriod.get(label)
    if (e) return e.is_scheduled ? 'upcoming' : 'logged'
    return isAhead ? 'next' : 'empty'
  }

  // Only periods that exist or are the one in progress; a blank far-future cell is noise.
  const ahead = upcoming.filter((l, i) => byPeriod.has(l) || i === upcoming.length - 1)
  const loggedRecent = recent.filter((l) => byPeriod.get(l)?.is_scheduled === false).length
  const olderLogged = older.filter((l) => byPeriod.has(l)).length

  const cell = (label: string, isAhead: boolean) => {
    const event = byPeriod.get(label)
    return (
      <PeriodCell
        key={label}
        label={label}
        state={stateOf(label, isAhead)}
        event={event}
        onClick={() => (event ? onOpenEvent(event.event_id) : onLogPeriod(kind, label, isAhead))}
      />
    )
  }

  // The header "+": the newest finished period if it is still missing, else book the next.
  const quickAdd = () => {
    const due = recent[0]
    if (!byPeriod.has(due)) onLogPeriod(kind, due, false)
    else onLogPeriod(kind, upcoming[upcoming.length - 1], true)
  }

  return (
    <SectionCard
      title={isConcall ? 'Concalls' : 'Annual reports'}
      action={
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[#8B857A]">
            {isPending ? '–' : loggedRecent}/{recent.length}
          </span>
          <button
            type="button"
            onClick={quickAdd}
            // Until entries load, "which period is missing" is unknown.
            disabled={isPending}
            aria-label={isConcall ? 'Log or schedule a concall' : 'Log or schedule an annual report'}
            className="rounded p-1 text-[#6F6A60] hover:bg-[rgba(28,27,23,0.06)] disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </span>
      }
    >
      {isPending ? (
        // Same groups and cell grid as the loaded state, so nothing shifts when it lands.
        <Loading label="Loading periods" className="flex flex-col gap-3">
          <Group title="Next"><PeriodCellsSkeleton cells={1} /></Group>
          <Group title={isConcall ? 'Last 8 quarters' : 'Last 5 years'}>
            <PeriodCellsSkeleton cells={recent.length} />
          </Group>
        </Loading>
      ) : (
      <div className="flex flex-col gap-3">
        {ahead.length > 0 && (
          <Group title="Next">{ahead.map((l) => cell(l, true))}</Group>
        )}
        <Group title={isConcall ? 'Last 8 quarters' : 'Last 5 years'}>
          {recent.map((l) => cell(l, false))}
        </Group>
        {expanded && <Group title="Earlier">{older.map((l) => cell(l, false))}</Group>}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex items-center justify-center gap-1 rounded-lg py-1 font-mono text-[11px] text-[#6F6A60] hover:bg-[rgba(28,27,23,0.04)] hover:text-[#1C1B17]"
        >
          {expanded ? 'Show less' : `Show older${olderLogged ? ` (${olderLogged} logged)` : ''}`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      )}
    </SectionCard>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[#8B857A]">{title}</span>
      <div className="grid grid-cols-4 gap-1.5">{children}</div>
    </div>
  )
}

/** Held beats booked; within the same kind, the later date wins. */
function rank(e: ActivityFeedRow): string {
  return `${e.is_scheduled ? 0 : 1}${e.event_date}`
}
