import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, Gauge, LayoutGrid, Plus, Radio, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SessionNotice from '@/components/command-center/shared/SessionNotice'
import DevDiagnostics from '@/components/command-center/DevDiagnostics'
import CoverageBoard from '@/components/command-center/board/CoverageBoard'
import AddCoverageDialog from '@/components/command-center/board/AddCoverageDialog'
import LogEventSheet from '@/components/command-center/entry/LogEventSheet'
import CalendarView from '@/components/command-center/calendar/CalendarView'
import ActivityView from '@/components/command-center/activity/ActivityView'
import HomeView from '@/components/command-center/home/HomeView'

type View = 'home' | 'board' | 'calendar' | 'activity' | 'diagnostics'

const VIEWS: Array<{ id: View; label: string; icon: typeof LayoutGrid }> = [
  { id: 'home', label: 'Today', icon: Gauge },
  { id: 'board', label: 'Coverage', icon: LayoutGrid },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'activity', label: 'Activity', icon: Radio },
  // Stripped from production builds: import.meta.env.DEV is statically replaced, so
  // the tab and the component behind it are dropped by dead-code elimination.
  ...(import.meta.env.DEV
    ? [{ id: 'diagnostics' as const, label: 'Diagnostics', icon: Stethoscope }]
    : []),
]

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
    // Home-screen scope params mean nothing on the other views.
    for (const k of ['scope', 'lens', 'person']) p.delete(k)
    if (next === 'home') p.delete('view')
    else p.set('view', next)
    setParams(p, { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6">
      {view !== 'home' && (
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-lg font-semibold text-[#1C1B17]">Command Center</h1>
          <p className="font-mono text-[11px] text-[#6F6A60]">
            Every stock, every meeting, every takeaway.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {view === 'board' && (
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add stock
            </Button>
          )}
          {/* Desktop only: mobile gets the floating action button below, which is
              reachable with a thumb. */}
          <Button size="sm" className="hidden sm:inline-flex" onClick={openLog}>
            Log
          </Button>
        </div>
      </header>
      )}

      <SessionNotice />

      <nav className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-[#D7D0C2]">
        {VIEWS.map((v) => {
          const Icon = v.icon
          const active = view === v.id
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-current={active ? 'page' : undefined}
              className={[
                '-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 font-mono text-xs transition-colors',
                active
                  ? 'border-[#1C1B17] text-[#1C1B17]'
                  : 'border-transparent text-[#6F6A60] hover:text-[#1C1B17]',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5" />{v.label}
            </button>
          )
        })}
        {view === 'home' && (
          <Button size="sm" className="mb-1 ml-auto hidden sm:inline-flex" onClick={openLog}>
            Log
          </Button>
        )}
      </nav>

      {view === 'home' && <HomeView />}
      {view === 'board' && <CoverageBoard onAdd={() => setAddOpen(true)} />}
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
