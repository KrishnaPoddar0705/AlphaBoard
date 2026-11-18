import { lazy, Suspense, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import SessionNotice from '@/components/command-center/shared/SessionNotice'
import CommandCenterChrome, { type View } from '@/components/command-center/shared/CommandCenterChrome'
import DevDiagnostics from '@/components/command-center/DevDiagnostics'
import CoverageBoard from '@/components/command-center/board/CoverageBoard'
import AddCoverageDialog from '@/components/command-center/board/AddCoverageDialog'
import LogEventSheet from '@/components/command-center/entry/LogEventSheet'
import CalendarView from '@/components/command-center/calendar/CalendarView'
import ActivityView from '@/components/command-center/activity/ActivityView'
import HomeView from '@/components/command-center/home/HomeView'
import MatrixView from '@/components/command-center/matrix/MatrixView'

// Lazy: the editor (TipTap/ProseMirror) and its charts only download when the tab opens.
const ThinkingBoardView = lazy(() => import('@/components/command-center/thinking/ThinkingBoardView'))

/**
 * The desk's research command centre.
 *
 * The app's home. "Today" answers "what matters right now?" -- changes, exceptions and
 * who is doing what -- and the other views go deep: what we cover, what is happening
 * when, and everything everyone has logged. The view lives in the URL so a link to
 * "?view=activity" is shareable.
 */
export default function CommandCenter() {
  const [params] = useSearchParams()
  const view = (params.get('view') as View) || 'home'
  const [addOpen, setAddOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  // Bumped on every open so LogEventSheet remounts with fresh state and a fresh event
  // id, instead of clearing a dozen fields in an effect.
  const [logSession, setLogSession] = useState(0)

  // The stock to pre-select, when logging from a stock's view (the home modal).
  const [logCoverage, setLogCoverage] = useState<string | undefined>()

  const openLog = () => { setLogCoverage(undefined); setLogSession((n) => n + 1); setLogOpen(true) }
  const openLogFor = (coverageId: string) => { setLogCoverage(coverageId); setLogSession((n) => n + 1); setLogOpen(true) }

  return (
    // Today is a dashboard of side-by-side panels, Coverage carries a 260px rail and the
    // Matrix is a wide grid, so all three get more room. The Thinking Board is a canvas and takes the whole width.
    <div className={[
      'mx-auto w-full px-3 py-4 sm:px-5 sm:py-6',
      view === 'thinking' ? 'max-w-none'
        : view === 'home' || view === 'board' || view === 'matrix' ? 'max-w-[1600px]' : 'max-w-7xl',
    ].join(' ')}>
      <CommandCenterChrome
        view={view}
        onLog={openLog}
        onAdd={view === 'board' ? () => setAddOpen(true) : undefined}
      />

      <SessionNotice />

      {view === 'home' && <HomeView onLog={openLog} onLogFor={openLogFor} />}
      {view === 'board' && <CoverageBoard onAdd={() => setAddOpen(true)} />}
      {view === 'matrix' && <MatrixView onAdd={() => setAddOpen(true)} />}
      {view === 'thinking' && (
        <Suspense fallback={<div className="h-[calc(100dvh-11.5rem)] animate-pulse rounded-xl bg-[#EFE9DA]" />}>
          <ThinkingBoardView />
        </Suspense>
      )}
      {view === 'calendar' && <CalendarView />}
      {view === 'activity' && <ActivityView />}
      {view === 'diagnostics' && import.meta.env.DEV && <DevDiagnostics />}

      {/* Thumb-reachable capture on mobile -- the whole point is logging a meeting in
          the sixty seconds after it ends. */}
      {/* Not on the Thinking Board: its connector dock owns the bottom edge there. */}
      {view !== 'thinking' && <button
        type="button"
        onClick={openLog}
        aria-label="Log an interaction"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-[#1C1B17] bg-[#1C1B17] text-[#F7F2E6] shadow-lg transition-transform active:scale-95 sm:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>}

      <AddCoverageDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <LogEventSheet key={logSession} open={logOpen} onClose={() => setLogOpen(false)} coverageId={logCoverage} />
    </div>
  )
}
