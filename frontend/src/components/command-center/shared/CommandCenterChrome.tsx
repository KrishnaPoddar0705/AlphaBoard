import { useNavigate } from 'react-router-dom'
import { CalendarDays, Gauge, LayoutGrid, Plus, Radio, Stethoscope, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type View = 'home' | 'board' | 'matrix' | 'calendar' | 'activity' | 'diagnostics'

// Not exported: a value export alongside a component breaks Fast Refresh, and nothing
// outside this file needs the list. The `View` type is erased, so it may stay.
const VIEWS: Array<{ id: View; label: string; icon: typeof LayoutGrid }> = [
  { id: 'home', label: 'Today', icon: Gauge },
  { id: 'board', label: 'Coverage', icon: LayoutGrid },
  { id: 'matrix', label: 'Matrix', icon: Table2 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'activity', label: 'Activity', icon: Radio },
  // Stripped from production builds: import.meta.env.DEV is statically replaced, so
  // the tab and the component behind it are dropped by dead-code elimination.
  ...(import.meta.env.DEV
    ? [{ id: 'diagnostics' as const, label: 'Diagnostics', icon: Stethoscope }]
    : []),
]

interface Props {
  /** The tab to mark current. A stock page passes 'board' -- it lives under Coverage. */
  view: View
  onLog: () => void
  /** Shows "Add stock" when given. */
  onAdd?: () => void
  /**
   * How to switch tabs. CommandCenter rewrites its own search params so the change is
   * a replace rather than a history entry; anywhere else falls back to navigation.
   */
  onView?: (next: View) => void
}

/**
 * The title, primary actions and tab bar that sit above every Command Center view.
 *
 * Shared rather than owned by pages/CommandCenter because a stock page is a different
 * route: rendering this only there meant the header and tabs vanished the moment you
 * picked a name from the rail, which read as landing somewhere else entirely. The tabs
 * are the app's primary navigation, so they belong on both.
 *
 * "Today" keeps its own greeting header, so the title block is suppressed there and the
 * Log button moves into the tab row instead.
 */
export default function CommandCenterChrome({ view, onLog, onAdd, onView }: Props) {
  const navigate = useNavigate()

  const go = (next: View) => {
    if (onView) return onView(next)
    navigate(next === 'home' ? '/command-center' : `/command-center?view=${next}`)
  }

  return (
    <>
      {view !== 'home' && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-mono text-lg font-semibold text-[#1C1B17]">Command Center</h1>
            <p className="font-mono text-[11px] text-[#6F6A60]">
              Every stock, every meeting, every takeaway.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onAdd && (
              <Button variant="outline" size="sm" onClick={onAdd}>
                <Plus className="h-3.5 w-3.5" /> Add stock
              </Button>
            )}
            {/* Desktop only: mobile gets the floating action button, which is
                reachable with a thumb. */}
            <Button size="sm" className="hidden sm:inline-flex" onClick={onLog}>
              Log
            </Button>
          </div>
        </header>
      )}

      <nav className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-[#D7D0C2]">
        {VIEWS.map((v) => {
          const Icon = v.icon
          const active = view === v.id
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => go(v.id)}
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
          <Button size="sm" className="mb-1 ml-auto hidden sm:inline-flex" onClick={onLog}>
            Log
          </Button>
        )}
      </nav>
    </>
  )
}
