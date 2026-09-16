import { useState } from 'react'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import { useDeskMembers } from '@/hooks/commandCenter/useActivityFeed'
import { useRoster } from '@/hooks/commandCenter/useHome'
import type { ActivityFilters } from '@/lib/commandCenter/types'
import ActivityFilterBar from './ActivityFilterBar'
import ActivityFeed from './ActivityFeed'
import CoverageGapsPanel from './CoverageGapsPanel'
import AnalystHeatmap from './AnalystHeatmap'
import { Bone, EntryListSkeleton, Loading } from '../shared/Skeleton'

type Pane = 'stream' | 'gaps'

/**
 * What the desk has been doing, and what it has not.
 *
 * Admins and portfolio managers land on everyone's activity; an analyst lands on their
 * own, because that is the view each actually wants first. Either can switch.
 */
export default function ActivityView() {
  const { resolved } = useCommandCenterSession()
  // The starting filter (everyone vs. just me) and whether there is an analyst picker at
  // all both depend on the role, so nothing renders until it is known -- otherwise an
  // admin briefly lands on their own entries and the picker pops in.
  if (!resolved) {
    return (
      <Loading label="Loading activity" className="flex flex-col gap-4">
        <div className="flex gap-1.5">
          <span style={{ width: 72 }}><Bone className="h-7 rounded-lg" /></span>
          <span style={{ width: 52 }}><Bone className="h-7 rounded-lg" /></span>
        </div>
        <Bone className="h-[190px] w-full rounded-xl" />
        <Bone className="h-8 w-full rounded-lg" />
        <div className="flex gap-2">
          {[140, 120, 110, 110].map((w, i) => <span key={i} style={{ width: w }}><Bone className="h-6 rounded-lg" /></span>)}
        </div>
        <EntryListSkeleton count={4} />
      </Loading>
    )
  }
  return <ActivityViewLoaded />
}

function ActivityViewLoaded() {
  const { userId, organizationId, seesWholeDesk } = useCommandCenterSession()
  const { data: deskMembers = [] } = useDeskMembers()
  // Only the people whose entries this user can actually see; the whole org as a
  // fallback until the home migration adds the roster function.
  const { data: roster } = useRoster(null)
  const members = roster
    ? roster.map((m) => ({ id: m.user_id, username: m.username, role: m.role }))
    : deskMembers
  const [pane, setPane] = useState<Pane>('stream')
  const [filters, setFilters] = useState<ActivityFilters>(
    () => (seesWholeDesk ? {} : { analystId: userId })
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5">
        {(['stream', 'gaps'] as Pane[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPane(p)}
            className={[
              'rounded-lg border px-3 py-1.5 font-mono text-[11px] transition-colors',
              pane === p
                ? 'border-[#1C1B17] bg-[#1C1B17] text-[#F7F2E6]'
                : 'border-[#D7D0C2] bg-[#F7F2E6] text-[#1C1B17] hover:bg-[rgba(28,27,23,0.04)]',
            ].join(' ')}
          >
            {p === 'stream' ? 'Activity' : 'Gaps'}
          </button>
        ))}
      </div>

      {pane === 'gaps' ? (
        <CoverageGapsPanel />
      ) : (
        <>
          <AnalystHeatmap analystId={filters.analystId} />
          <ActivityFilterBar
            value={filters}
            onChange={setFilters}
            members={members}
            showAnalyst={!!organizationId}
          />
          <ActivityFeed filters={filters} />
        </>
      )}
    </div>
  )
}
