import { useState } from 'react'
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

/**
 * The desk's research command centre.
 *
 * The app's home. "Today" answers "what matters right now?" -- changes, exceptions and
 * who is doing what -- and the other views go deep: what we cover, what is happening
 * when, and everything everyone has logged. The view lives in the URL so a link to
 * "?view=activity" is shareable.
 */
export default function CommandCenter() {
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View) || 'home'
  const [addOpen, setAddOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  // Bumped on every open so LogEventSheet remounts with fresh state and a fresh event
  // id, instead of clearing a dozen fields in an effect.
  const [logSession, setLogSession] = useState(0)

  const openLog = () => { setLogSession((n) => n + 1); setLogOpen(true) }

  const setView = (next: View) => {
    const p = new URLSearchParams(params)
    // Home-screen scope and matrix tab params mean nothing on the other views.
    for (const k of ['scope', 'lens', 'person', 'group', 'pick']) p.delete(k)
    if (next === 'home') p.delete('view')
    else p.set('view', next)
    setParams(p, { replace: true })
  }

  return (
    // Coverage carries a 260px rail beside the content and the Matrix is a wide grid,
    // so both get more room.
    <div className={[
      'mx-auto w-full px-3 py-4 sm:px-5 sm:py-6',
      view === 'board' || view === 'matrix' ? 'max-w-[1600px]' : 'max-w-7xl',
    ].join(' ')}>
      <CommandCenterChrome
        view={view}
        onLog={openLog}
        onAdd={view === 'board' ? () => setAddOpen(true) : undefined}
        onView={setView}
      />

      <SessionNotice />

      {view === 'home' && <HomeView />}
      {view === 'board' && <CoverageBoard onAdd={() => setAddOpen(true)} />}
      {view === 'matrix' && <MatrixView onAdd={() => setAddOpen(true)} />}
      {view === 'calendar' && <CalendarView />}
      {view === 'activity' && <ActivityView />}
      {view === 'diagnostics' && import.meta.env.DEV && <DevDiagnostics />}

      {/* Thumb-reachable capture on mobile -- the whole point is logging a meeting in
          the sixty seconds after it ends. */}
      <button
        type="button"
        onClick={openLog}
        aria-label="Log an interaction"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-[#1C1B17] bg-[#1C1B17] text-[#F7F2E6] shadow-lg transition-transform active:scale-95 sm:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      <AddCoverageDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <LogEventSheet key={logSession} open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  )
}
