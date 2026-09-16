import SectionCard from '../shared/SectionCard'
import SessionNotice from '../shared/SessionNotice'
import { Bone, EntryListSkeleton, Loading, RowsSkeleton } from '../shared/Skeleton'

/**
 * The stock page's frame while its coverage row loads: header, filter chips, timeline
 * and the reference rail, all in place. Shown instead of "not in your coverage", which
 * must only ever appear once the lookup has actually come back empty.
 */
export default function StockPageSkeleton() {
  return (
    <Loading label="Loading stock" className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6">
      {/* If the database session never arrives, say so rather than shimmer forever. */}
      <SessionNotice />
      <header className="flex flex-col gap-3 border-b border-[#D7D0C2] pb-4">
        <Bone className="h-3 w-20" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Bone className="h-5 w-44" />
            <Bone className="h-3 w-32" />
          </div>
          <div className="flex gap-2">
            <Bone className="h-8 w-28 rounded-md" />
            <Bone className="h-8 w-16 rounded-md" />
          </div>
        </div>
      </header>

      <div className="mt-4 flex gap-3 border-b border-[#D7D0C2] pb-2 lg:hidden">
        {[64, 52, 70, 56].map((w) => (
          <span key={w} style={{ width: w }}><Bone className="h-4" /></span>
        ))}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {[72, 88, 60, 96, 90, 40, 52].map((w) => (
              <span key={w} style={{ width: w }}><Bone className="h-6 rounded-lg" /></span>
            ))}
          </div>
          <Bone className="h-3 w-28" />
          <EntryListSkeleton count={3} />
        </div>
        <aside className="hidden flex-col gap-3 lg:flex">
          <SectionCard title="Corporate details"><RowsSkeleton rows={4} /></SectionCard>
          <SectionCard title="Contacts"><RowsSkeleton rows={2} /></SectionCard>
          <SectionCard title="Concalls"><PeriodGridSkeleton cells={8} /></SectionCard>
          <SectionCard title="Annual reports"><PeriodGridSkeleton cells={5} /></SectionCard>
        </aside>
      </div>
    </Loading>
  )
}

/** Bare cells, to drop into a 4-column grid (PeriodTracker's groups, or PeriodGrid). */
export function PeriodCellsSkeleton({ cells }: { cells: number }) {
  return <>{Array.from({ length: cells }, (_, i) => <Bone key={i} className="h-12 rounded-lg" />)}</>
}

function PeriodGridSkeleton({ cells }: { cells: number }) {
  return <div className="grid grid-cols-4 gap-1.5"><PeriodCellsSkeleton cells={cells} /></div>
}
