import type { ReactNode } from 'react'

/**
 * Contextual cell actions, revealed on cell hover or keyboard focus and pinned to the
 * cell's top-right corner, so they never take space from the data.
 */
function CellActions({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute -top-0.5 right-0 z-[2] flex gap-0.5 rounded-(--mx-radius) bg-(--mx-raised) p-0.5 opacity-0 shadow-(--mx-shadow-pop) transition-opacity duration-150 group-hover/cell:pointer-events-auto group-hover/cell:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
      {children}
    </div>
  )
}

function ActionButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="inline-flex size-6 items-center justify-center rounded-[5px] text-(--mx-text-2) transition-colors hover:bg-(--mx-hover) hover:text-(--mx-text)">
      {children}
    </button>
  )
}

CellActions.Button = ActionButton

export default CellActions
