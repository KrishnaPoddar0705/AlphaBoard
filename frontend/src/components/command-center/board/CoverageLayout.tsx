import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, List } from 'lucide-react'
import StockSidebar from './StockSidebar'

interface Props {
  /** Highlighted in the rail, and named on the mobile disclosure. */
  selectedTicker?: string
  onAdd?: () => void
  children: ReactNode
}

/**
 * The coverage rail beside whatever stock is open.
 *
 * Desktop gets a fixed 260px rail that scrolls independently of the page, so moving
 * between names never costs a round trip through a board. A phone cannot spare the
 * width, so per CLAUDE.md the rail collapses into a disclosure above the content --
 * closed by default, because on a phone you arrived wanting the stock, not the list.
 */
export default function CoverageLayout({ selectedTicker, onAdd, children }: Props) {
  const [browseOpen, setBrowseOpen] = useState(false)

  return (
    <div className="lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-6">
      {/* Mobile: the rail as a disclosure. */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setBrowseOpen((v) => !v)}
          aria-expanded={browseOpen}
          className="mb-3 inline-flex w-full items-center gap-1.5 rounded-lg border border-[#D7D0C2] bg-[#F7F2E6] px-3 py-2 font-mono text-[11px] text-[#1C1B17]"
        >
          {browseOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <List className="h-3.5 w-3.5" />
          {selectedTicker ? `Coverage · ${selectedTicker}` : 'Browse coverage'}
        </button>
        {browseOpen && (
          <StockSidebar
            selectedTicker={selectedTicker}
            onAdd={onAdd}
            className="mb-4 max-h-[60vh]"
          />
        )}
      </div>

      {/* Desktop: a sticky rail that scrolls on its own. */}
      <StockSidebar
        selectedTicker={selectedTicker}
        onAdd={onAdd}
        className="hidden lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-2rem)]"
      />

      <div className="min-w-0">{children}</div>
    </div>
  )
}
