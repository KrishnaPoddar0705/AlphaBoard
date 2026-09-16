import { useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useCoverage } from '@/hooks/commandCenter/useCoverage'
import StockHeader from '@/components/command-center/stock/StockHeader'
import CorporateDetailsPanel from '@/components/command-center/stock/CorporateDetailsPanel'
import ContactsPanel from '@/components/command-center/stock/ContactsPanel'
import PeriodTracker, { type PeriodKind } from '@/components/command-center/stock/PeriodTracker'
import BrokerCoverageGrid from '@/components/command-center/stock/BrokerCoverageGrid'
import TimelineView from '@/components/command-center/timeline/TimelineView'
import LogEventSheet from '@/components/command-center/entry/LogEventSheet'
import EmptyState from '@/components/command-center/shared/EmptyState'
import StockPageSkeleton from '@/components/command-center/stock/StockPageSkeleton'
import SessionNotice from '@/components/command-center/shared/SessionNotice'

type MobileTab = 'timeline' | 'details' | 'contacts' | 'brokers'

const TABS: Array<{ id: MobileTab; label: string }> = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'details', label: 'Details' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'brokers', label: 'Brokers' },
]

/**
 * Everything the desk knows about one company.
 *
 * Desktop puts the timeline in the main column with the reference panels in a right
 * rail; a phone gets tabs instead, because a dense two-column layout at 375px is
 * unreadable and CLAUDE.md asks for tabs for secondary content on small screens.
 */
export default function CommandCenterStock() {
  const { ticker } = useParams<{ ticker: string }>()
  // isPending, not isLoading: the query is disabled until the Supabase session exists,
  // and a disabled query reports isLoading=false with no data -- which used to render
  // "not in your coverage" for a stock that was.
  const { data: coverage, isPending, isError, error } = useCoverage(ticker)
  const [tab, setTab] = useState<MobileTab>('timeline')
  const [logOpen, setLogOpen] = useState(false)
  const [logSession, setLogSession] = useState(0)
  const [logPreset, setLogPreset] = useState<{ typeId: string; period: string; upcoming: boolean } | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const focusEventId = searchParams.get('event')

  const openLog = () => { setLogPreset(null); setLogSession((n) => n + 1); setLogOpen(true) }

  // A concall / annual-report cell leads to that period's entry on the timeline. On a
  // phone the timeline is its own tab, so switch to it first.
  const openEvent = (eventId: string) => {
    setTab('timeline')
    setSearchParams({ event: eventId }, { replace: true })
  }

  const logPeriod = (kind: PeriodKind, period: string, upcoming: boolean) => {
    setLogPreset({ typeId: kind, period, upcoming })
    setLogSession((n) => n + 1)
    setLogOpen(true)
  }

  if (isPending) return <StockPageSkeleton />

  if (isError) {
    return (
      <div className="mx-auto max-w-lg py-20">
        <EmptyState
          title={`Couldn't load ${ticker}`}
          hint={error instanceof Error ? error.message : undefined}
          action={<Button size="sm" onClick={() => window.location.reload()}>Retry</Button>}
        />
      </div>
    )
  }

  if (!coverage) {
    return (
      <div className="mx-auto max-w-lg py-20">
        <EmptyState
          title={`${ticker} is not in your coverage`}
          hint="Add it from the coverage board, then everything you log against it lives here."
          action={<Button size="sm" asChild><Link to="/command-center">Go to coverage</Link></Button>}
        />
      </div>
    )
  }

  const panels = (
    <>
      <CorporateDetailsPanel coverage={coverage} />
      <ContactsPanel coverageId={coverage.id} />
      <PeriodTracker coverageId={coverage.id} kind="concall" onOpenEvent={openEvent} onLogPeriod={logPeriod} />
      <PeriodTracker coverageId={coverage.id} kind="annual_report" onOpenEvent={openEvent} onLogPeriod={logPeriod} />
      <BrokerCoverageGrid coverage={coverage} />
    </>
  )

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6">
      <StockHeader coverage={coverage} onLog={openLog} />

      <SessionNotice />

      {/* Mobile: tabs. */}
      <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-[#D7D0C2] lg:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={[
              '-mb-px shrink-0 border-b-2 px-3 py-2 font-mono text-xs transition-colors',
              tab === t.id
                ? 'border-[#1C1B17] text-[#1C1B17]'
                : 'border-transparent text-[#6F6A60] hover:text-[#1C1B17]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-4 lg:hidden">
        {tab === 'timeline' && <TimelineView coverageId={coverage.id} focusEventId={focusEventId} focusKey={location.key} />}
        {tab === 'details' && (
          <div className="flex flex-col gap-3">
            <CorporateDetailsPanel coverage={coverage} />
            <PeriodTracker coverageId={coverage.id} kind="concall" onOpenEvent={openEvent} onLogPeriod={logPeriod} />
            <PeriodTracker coverageId={coverage.id} kind="annual_report" onOpenEvent={openEvent} onLogPeriod={logPeriod} />
          </div>
        )}
        {tab === 'contacts' && <ContactsPanel coverageId={coverage.id} />}
        {tab === 'brokers' && <BrokerCoverageGrid coverage={coverage} />}
      </div>

      {/* Desktop: timeline plus a reference rail. */}
      <div className="mt-4 hidden gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <TimelineView coverageId={coverage.id} focusEventId={focusEventId} focusKey={location.key} />
        <aside className="flex flex-col gap-3">{panels}</aside>
      </div>

      <button
        type="button"
        onClick={openLog}
        aria-label="Log an interaction"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-[#1C1B17] bg-[#1C1B17] text-2xl text-[#F7F2E6] shadow-lg transition-transform active:scale-95 sm:hidden"
      >
        +
      </button>

      <LogEventSheet
        key={logSession}
        open={logOpen}
        onClose={() => setLogOpen(false)}
        coverageId={coverage.id}
        initialTypeId={logPreset?.typeId}
        initialPeriod={logPreset?.period}
        initialScheduled={logPreset?.upcoming}
      />
    </div>
  )
}
