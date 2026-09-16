import TerminalPanel from './TerminalPanel'
import { Bone, Loading, RowsSkeleton } from '../shared/Skeleton'

const KPI_LABELS = ['Entries · 24h', 'Companies · 24h', 'Thesis changes · 7d', 'Need you']

/**
 * The home screen's frame while the desk loads: the same header, KPI strip, tape and
 * panel grid as the real thing, with bones where numbers and rows will land. Panel
 * titles are real -- they do not depend on data -- so the layout reads immediately and
 * nothing moves when the data arrives.
 */
export default function HomeSkeleton({ isManager }: { isManager: boolean }) {
  return (
    <Loading label="Loading the desk" className="flex flex-col gap-3">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 border-b border-[#1C1B17] pb-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1C1B17]">
            Command Center
          </span>
          <Bone className="h-3 w-20" />
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            <Bone className="h-7 w-64" />
            <Bone className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Bone className="h-7 w-32 rounded-md" />
            {isManager && <Bone className="h-7 w-44 rounded-md" />}
          </div>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-md border border-[#1C1B17] sm:grid-cols-4">
          {KPI_LABELS.map((label, i) => (
            <div
              key={label}
              className={[
                'bg-[#FBF7ED] px-3 py-2',
                i % 2 === 1 ? 'border-l border-[#D7D0C2]' : '',
                i >= 2 ? 'border-t border-[#D7D0C2] sm:border-t-0' : '',
                i === 2 ? 'sm:border-l' : '',
              ].join(' ')}
            >
              <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[#6F6A60]">{label}</span>
              <Bone className="mt-1.5 h-7 w-12 sm:h-8" />
            </div>
          ))}
        </div>
      </header>

      <div className="h-[30px] rounded-md bg-[#1C1B17]" />

      <div className="grid gap-3 lg:grid-cols-12">
        <TerminalPanel code="ATTN" title="Needs your attention" className="lg:col-span-5 lg:h-[440px]">
          <RowsSkeleton rows={5} padded />
        </TerminalPanel>
        <TerminalPanel code="CHG" title="What changed · 7d" className="lg:col-span-4 lg:h-[440px]">
          <RowsSkeleton rows={5} padded />
        </TerminalPanel>
        <TerminalPanel code="CAL" title="Coming up · 14d" className="lg:col-span-3 lg:h-[440px]">
          <RowsSkeleton rows={5} padded />
        </TerminalPanel>
        <TerminalPanel code="STK" title="By stock" className="lg:col-span-8 lg:h-[420px]">
          <RowsSkeleton rows={6} padded />
        </TerminalPanel>
        <TerminalPanel code="TEAM" title="Team right now" className="lg:col-span-4 lg:h-[420px]">
          <RowsSkeleton rows={5} padded />
        </TerminalPanel>
        {isManager && (
          <TerminalPanel code="STAT" title="Desk analytics" className="lg:col-span-12">
            <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,2fr)]">
              <Bone className="h-[200px] w-full" />
              <div className="flex flex-col gap-2">{[1, 2, 3, 4].map((i) => <Bone key={i} className="h-3 w-full" />)}</div>
              <Bone className="h-16 w-full" />
            </div>
          </TerminalPanel>
        )}
      </div>
    </Loading>
  )
}
