import { useCallback, useMemo, useState } from 'react'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import { useCoverageBoard } from '@/hooks/commandCenter/useCoverage'
import { useHomeWindow, useReviews } from '@/hooks/commandCenter/useHome'
import { useHomeScope } from '@/hooks/commandCenter/useHomeScope'
import {
  analystLens, comingUp, needsYou, ownerOf, stockLens, summarize, teamNow, whatChanged,
} from '@/lib/commandCenter/home'
import type { ActivityFeedRow, EventReview } from '@/lib/commandCenter/types'
import HomeHeader from './HomeHeader'
import ScopeBar from './ScopeBar'
import TickerTape from './TickerTape'
import NeedsYouPanel from './NeedsYouPanel'
import WhatChangedPanel from './WhatChangedPanel'
import ComingUpPanel from './ComingUpPanel'
import TeamNowPanel from './TeamNowPanel'
import StockLens from './StockLens'
import AnalystLens from './AnalystLens'
import AnalyticsPanel from './AnalyticsPanel'
import EntryDrawer from './EntryDrawer'
import HomeSkeleton from './HomeSkeleton'
import { EventContactsContext } from '@/hooks/commandCenter/eventContactsContext'
import { useEventContacts } from '@/hooks/commandCenter/useCommandCenterEvents'

const STALE_DAYS = 30
const MONTH = 30 * 86_400_000

/**
 * "What matters right now?" -- the desk's home screen.
 *
 * Reads one window of entries (the last ~month plus what is booked ahead), the coverage
 * board and the reviews on that window, and derives every panel from them in
 * lib/commandCenter/home.ts. Panels are in priority order in the DOM, so a phone reads
 * exceptions first; the desktop grid rearranges nothing.
 */
export default function HomeView() {
  const { userId, role, canReviewAnything } = useCommandCenterSession()
  const scope = useHomeScope()
  const { data: board = [], isPending: boardPending } = useCoverageBoard()
  const windowQuery = useHomeWindow(scope.userIds, scope.ready)
  const rows = useMemo(() => windowQuery.data ?? [], [windowQuery.data])
  const [drawer, setDrawer] = useState<ActivityFeedRow | null>(null)
  const met = useEventContacts(rows)

  // "Now" is when the data was read, so every relative time on screen agrees with it.
  const updatedAt = windowQuery.dataUpdatedAt
  const now = useMemo(() => new Date(updatedAt || 0), [updatedAt])

  const reviewIds = useMemo(
    () => rows.filter((r) => !r.is_scheduled && now.getTime() - new Date(r.created_at).getTime() <= MONTH)
      .map((r) => r.event_id),
    [rows, now]
  )
  const { data: reviews = [], isPending: reviewsQueryPending } = useReviews(reviewIds)
  // The review query is disabled (and so permanently pending) when there is nothing to
  // review; only wait for it when it will actually run.
  const reviewsPending = reviewIds.length > 0 && reviewsQueryPending
  const reviewsByEvent = useMemo(() => {
    const map = new Map<string, EventReview[]>()
    for (const r of reviews) map.set(r.event_id, [...(map.get(r.event_id) ?? []), r])
    return map
  }, [reviews])
  const reviewsFor = useCallback((id: string) => reviewsByEvent.get(id) ?? [], [reviewsByEvent])

  const scopeUserIds = scope.userIds
    ?? (role === 'admin' ? null : scope.roster?.map((m) => m.user_id) ?? null)

  const derived = useMemo(() => {
    const needs = needsYou({
      rows, reviews, board, viewerId: userId, canReview: canReviewAnything,
      scopeUserIds, staleDays: STALE_DAYS, now,
    })
    const waitingOnPm = rows.filter((r) => r.review_requested && !r.is_scheduled
      && ownerOf(r) === userId && !reviewsByEvent.has(r.event_id))
    return {
      summary: summarize(rows, now),
      changes: whatChanged(rows, now),
      needs,
      waitingOnPm,
      upcoming: comingUp(rows, now),
      people: teamNow(rows, scope.roster, now),
      stocks: stockLens(rows, board, now, scopeUserIds),
      analysts: analystLens(rows, scope.roster, reviews, now),
      tape: rows.filter((r) => !r.is_scheduled).slice(0, 24),
    }
  }, [rows, reviews, board, userId, canReviewAnything, scopeUserIds, now, scope.roster, reviewsByEvent])

  const isManager = role === 'admin' || role === 'portfolio_manager'

  // Every panel waits for everything it summarises. Rendering early would show "nothing
  // needs you" or "no stale names" and then change its mind a moment later.
  if (!scope.ready || windowQuery.isPending || !updatedAt || boardPending || reviewsPending) {
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
            lens={scope.lens}
            onLens={scope.setLens}
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
          reviewsFor={reviewsFor}
          canReview={canReviewAnything}
          staleDays={STALE_DAYS}
          now={now}
          onOpen={setDrawer}
        />
        <WhatChangedPanel className="lg:col-span-4 lg:max-h-[440px]" items={derived.changes} now={now} onOpen={setDrawer} />
        <ComingUpPanel className="lg:col-span-3 lg:max-h-[440px]" items={derived.upcoming} onOpen={setDrawer} />

        {lens === 'analyst' ? (
          <AnalystLens
            className="lg:col-span-8 lg:max-h-[560px]"
            rows={derived.analysts}
            entries={rows}
            reviewsFor={reviewsFor}
            now={now}
            onOpen={setDrawer}
            onFocusPerson={scope.setPerson}
          />
        ) : (
          <StockLens
            className="lg:col-span-8 lg:max-h-[560px]"
            rows={derived.stocks}
            entries={rows}
            reviewsFor={reviewsFor}
            now={now}
            onOpen={setDrawer}
          />
        )}
        <TeamNowPanel
          className="lg:col-span-4 lg:max-h-[560px]"
          people={derived.people}
          now={now}
          selected={scope.person}
          onSelect={scope.setPerson}
          onOpen={setDrawer}
        />

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
