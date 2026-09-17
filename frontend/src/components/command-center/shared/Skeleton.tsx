/**
 * Paper-toned loading placeholders for the Command Center.
 *
 * The rule these exist for: never tell the reader "nothing here" before the data has
 * actually arrived. Every panel keeps its real frame (title, borders, spacing) and
 * fills with bones shaped like the rows that will replace them, so nothing jumps when
 * the data lands and an empty state only ever means empty.
 */

/** One grey block. Size it with className; it pulses unless motion is reduced. */
export function Bone({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded bg-[#E3DDCF] motion-reduce:animate-none ${className}`}
    />
  )
}

/** Wraps a loading region so assistive tech hears one "Loading" instead of silence. */
export function Loading({ label = 'Loading', children, className = '' }: {
  label?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

/** A timeline / activity entry card. */
export function EntrySkeleton() {
  return (
    <div className="rounded-xl border border-[#D7D0C2] bg-[#F7F2E6] p-3">
      <div className="flex items-center gap-2">
        <Bone className="h-5 w-20 rounded-full" />
        <Bone className="h-3 w-16" />
        <Bone className="ml-auto h-3 w-14" />
      </div>
      <Bone className="mt-2.5 h-4 w-2/3" />
      <Bone className="mt-2 h-3 w-full" />
      <Bone className="mt-1.5 h-3 w-4/5" />
    </div>
  )
}

export function EntryListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Loading label="Loading entries" className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => <EntrySkeleton key={i} />)}
    </Loading>
  )
}

/** Two-line list rows, for lists inside a SectionCard or TerminalPanel. */
export function RowsSkeleton({ rows = 3, padded = false }: { rows?: number; padded?: boolean }) {
  return (
    <Loading className={`flex flex-col divide-y divide-[#E3DDCF] ${padded ? 'px-3' : ''}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5 py-2">
          <div className="flex items-center gap-2">
            <Bone className="h-3 w-12" />
            <Bone className="h-3 flex-1" />
          </div>
          <Bone className="h-2.5 w-1/2" />
        </div>
      ))}
    </Loading>
  )
}
