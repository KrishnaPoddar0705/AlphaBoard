import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type View = 'home' | 'board' | 'matrix' | 'thinking' | 'calendar' | 'activity' | 'diagnostics'

// Not exported: a value export alongside a component breaks Fast Refresh.
const TITLES: Record<View, string> = {
  home: 'Today',
  board: 'Coverage',
  matrix: 'Matrix',
  thinking: 'Thinking Board',
  calendar: 'Calendar',
  activity: 'Activity',
  diagnostics: 'Diagnostics',
}

interface Props {
  /** The view on screen. A stock page passes 'board' -- it lives under Coverage. */
  view: View
  onLog: () => void
  /** Shows "Add stock" when given. */
  onAdd?: () => void
}

/**
 * The title and primary actions above every Command Center view.
 *
 * The views themselves are switched from the app sidebar (AppSidebarNav), which used to
 * be a tab bar here. With no tabs on screen the title names the view, so you can still
 * tell where you are.
 *
 * "Today" has its own greeting header, which carries the Log button; nothing renders here.
 */
export default function CommandCenterChrome({ view, onLog, onAdd }: Props) {
  // Today's own header carries the Log button (HomeHeader), so nothing sits above it.
  if (view === 'home') return null

  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#D7D0C2] pb-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6F6A60]">Command Center</p>
        <h1 className="font-mono text-lg font-semibold text-[#1C1B17]">{TITLES[view]}</h1>
      </div>

      <div className="flex items-center gap-2">
        {onAdd && (
          <Button variant="outline" size="sm" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" /> Add stock
          </Button>
        )}
        <Button size="sm" className="hidden sm:inline-flex" onClick={onLog}>
          Log
        </Button>
      </div>
    </header>
  )
}
