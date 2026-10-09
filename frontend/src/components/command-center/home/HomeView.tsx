import { useMemo, useState } from 'react'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import { useCoverageBoard } from '@/hooks/commandCenter/useCoverage'
import { useCommentAuthors, useHomeWindow } from '@/hooks/commandCenter/useHome'
import { useHomeScope } from '@/hooks/commandCenter/useHomeScope'
import { useLensFilters } from '@/hooks/commandCenter/useLensFilters'
import {
  analystLens, awaitingReply, filterEntries, filterStocks, needsYou, stockLens, summarize,
  whatChanged,
} from '@/lib/commandCenter/home'
import { sectorOptions } from '@/lib/commandCenter/sectors'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'
import HomeHeader from './HomeHeader'
import ScopeBar from './ScopeBar'
import TickerTape from './TickerTape'
import NeedsYouPanel from './NeedsYouPanel'
import WhatChangedPanel from './WhatChangedPanel'
import LensBar from './LensBar'
import StockLens from './StockLens'
import AnalystLens from './AnalystLens'
import AnalyticsPanel from './AnalyticsPanel'
import EntryDrawer from './EntryDrawer'
import HomeSkeleton from './HomeSkeleton'
import { EventContactsContext } from '@/hooks/commandCenter/eventContactsContext'
import { useEventContacts } from '@/hooks/commandCenter/useCommandCenterEvents'

const STALE_DAYS = 30

/**
 * "What matters right now?" -- the desk's home screen.
 *
 * Reads one window of entries (the last ~month plus what is booked ahead), the coverage
 * board and the replies to anything pushed, and derives every panel from them in
 * lib/commandCenter/home.ts. Panels are in priority order in the DOM, so a phone reads
 * exceptions first; the desktop grid rearranges nothing.
 */
export default function HomeView() {
  const { userId, role } = useCommandCenterSession()
  const scope = useHomeScope()
  const { filters, setFilters } = useLensFilters()
  const { data: board = [], isPending: boardPending } = useCoverageBoard()
  const windowQuery = useHomeWindow(scope.userIds, scope.ready)
  const rows = useMemo(() => windowQuery.data ?? [], [windowQuery.data])
  const [drawer, setDrawer] = useState<ActivityFeedRow | null>(null)
  const met = useEventContacts(rows)

  // "Now" is when the data was read, so every relative time on screen agrees with it.
  const updatedAt = windowQuery.dataUpdatedAt
  const now = useMemo(() => new Date(updatedAt || 0), [updatedAt])

  // A push is answered by a reply in the entry's comments, so who has commented on the
  // pushed entries decides what is still waiting -- on the viewer, or on their PM.
  const pushedIds = useMemo(
    () => rows.filter((r) => !r.is_scheduled && (r.review_requested || r.push_to_pm || r.push_to_admin))
      .map((r) => r.event_id),
    [rows]
  )
  const { data: replies = [], isPending: repliesQueryPending } = useCommentAuthors(pushedIds)
  // The query is disabled (and so permanently pending) when nothing was pushed; only
  // wait for it when it will actually run.
  const repliesPending = pushedIds.length > 0 && repliesQueryPending

  const scopeUserIds = scope.userIds
    ?? (role === 'admin' ? null : scope.roster?.map((m) => m.user_id) ?? null)

  const derived = useMemo(() => {
    const needs = needsYou({
      rows, replies, board, viewerId: userId,
      viewerRole: role, scopeUserIds, staleDays: STALE_DAYS, now,
    })
    const waitingOnPm = awaitingReply(rows, replies, userId)
    // The table reads the filtered entries; everything else keeps the whole scope.
    const shown = filterEntries(rows, filters)
    const allStocks = stockLens(rows, board, now, scopeUserIds)
    const lensRoster = filters.analystId
      ? scope.roster?.filter((m) => m.user_id === filters.analystId) ?? null
      : scope.roster
    return {
      summary: summarize(rows, now),
      changes: whatChanged(rows, now),
      needs,
      waitingOnPm,
      stocks: filterStocks(stockLens(shown, board, now, scopeUserIds), filters),
      // Unfiltered: the analytics panel and the filter's own option list read this.
      analysts: analystLens(rows, scope.roster, now),
      lensAnalysts: analystLens(shown, lensRoster, now),
      shown,
      sectors: sectorOptions(allStocks),
      stockOptions: allStocks
        .filter((s) => !filters.sector || s.sector === filters.sector)
        .map((s) => ({ value: s.coverageId, label: s.ticker }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      tape: rows.filter((r) => !r.is_scheduled).slice(0, 24),
    }
  }, [rows, replies, board, userId, role, scopeUserIds, now, scope.roster, filters])

  const isManager = role === 'admin' || role === 'portfolio_manager'

  // Every panel waits for everything it summarises. Rendering early would show "nothing
  // needs you" or "no stale names" and then change its mind a moment later.
  if (!scope.ready || windowQuery.isPending || !updatedAt || boardPending || repliesPending) {
    return <HomeSkeleton isManager={isManager} />
  }
  const lens = isManager ? scope.lens : 'stock'
  const needsCount = derived.needs.total + derived.waitingOnPm.length

  return (
    <EventContactsContext.Provider value={met}>
    <div className="flex flex-col gap-3">
      <HomeHeader
        now={now}
        name={scope.viewerName}
        subject={scope.subject}
        summary={derived.summary}
        needsYou={needsCount}
        updatedAt={updatedAt}
        scopeControls={
          <ScopeBar
            role={role}
            teams={scope.teams}
            scope={scope.scope}
            onScope={scope.setScope}
            personName={scope.personName}
            onClearPerson={() => scope.setPerson(null)}
          />
        }
      />

      {windowQuery.isError && (
        <p className="rounded-md border border-[#B23B2A] px-3 py-2 font-mono text-xs text-[#B23B2A]">
          {windowQuery.error.message}
        </p>
      )}

      <TickerTape rows={derived.tape} now={now} onOpen={setDrawer} />

      <div className="grid gap-3 lg:grid-cols-12">
        <NeedsYouPanel
          className="lg:col-span-5 lg:max-h-[440px]"
          needs={derived.needs}
          waitingOnPm={derived.waitingOnPm}
          isManager={isManager}
          staleDays={STALE_DAYS}
          now={now}
          onOpen={setDrawer}
        />
        <WhatChangedPanel className="lg:col-span-7 lg:max-h-[440px]" items={derived.changes} now={now} onOpen={setDrawer} />

        <div className="flex min-w-0 flex-col gap-2 lg:col-span-12">
          <LensBar
            canToggleLens={isManager}
            lens={lens}
            onLens={scope.setLens}
            filters={filters}
            onFilters={setFilters}
            analysts={derived.analysts.map((a) => ({ value: a.userId, label: a.name }))}
            sectors={derived.sectors}
            stocks={derived.stockOptions}
          />
          {lens === 'analyst' ? (
            <AnalystLens
              className="lg:max-h-[560px]"
              rows={derived.lensAnalysts}
              entries={derived.shown}
              now={now}
              onOpen={setDrawer}
              onFocusPerson={scope.setPerson}
            />
          ) : (
            <StockLens
              className="lg:max-h-[560px]"
              rows={derived.stocks}
              entries={derived.shown}
              now={now}
              onOpen={setDrawer}
            />
          )}
        </div>

        {isManager && (
          <AnalyticsPanel
            className="lg:col-span-12"
            entries={rows}
            analysts={derived.analysts}
            roster={scope.roster}
            teams={role === 'admin' && scope.scope === 'all' && !scope.person ? scope.teams : null}
            now={now}
          />
        )}
      </div>

      <EntryDrawer entry={drawer} onClose={() => setDrawer(null)} />
    </div>
    </EventContactsContext.Provider>
  )
}
