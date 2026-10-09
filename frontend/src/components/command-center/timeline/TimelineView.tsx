import { useMemo, useState } from 'react'
import { ScrollText } from 'lucide-react'
import { useCoverageEvents, useEventAttachments, useEventContacts }
  from '@/hooks/commandCenter/useCommandCenterEvents'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import { groupByMonth } from '@/lib/commandCenter/format'
import { KIND_LABELS } from '@/lib/commandCenter/constants'
import type { EventKind } from '@/lib/commandCenter/types'
import TimelineEntry from './TimelineEntry'
import EmptyState from '../shared/EmptyState'
import { Bone, EntryListSkeleton } from '../shared/Skeleton'

const KINDS = Object.keys(KIND_LABELS) as EventKind[]

interface Props {
  coverageId: string
  /** An entry to bring into view, expanded and highlighted. */
  focusEventId?: string | null
  focusKey?: string
}

export default function TimelineView({ coverageId, focusEventId, focusKey }: Props) {
  const { data: events = [], isPending } = useCoverageEvents(coverageId)
  const { userId, role } = useCommandCenterSession()
  const [kind, setKind] = useState<EventKind | 'all'>('all')

  // A filter left on "Broker Report" would hide the concall the analyst just asked for.
  // Checked once per navigation, after the events have loaded.
  const focusKind = events.find((e) => e.event_id === focusEventId)?.kind
  const [filterResetFor, setFilterResetFor] = useState<string | undefined>()
  if (focusKind && focusKey !== filterResetFor) {
    setFilterResetFor(focusKey)
    if (kind !== 'all' && kind !== focusKind) setKind('all')
  }

  const filtered = useMemo(
    () => (kind === 'all' ? events : events.filter((e) => e.kind === kind)),
    [events, kind]
  )

  const { data: attachments = [] } = useEventAttachments(filtered.map((e) => e.event_id))
  const met = useEventContacts(filtered)

  const byEvent = useMemo(() => {
    const map = new Map<string, typeof attachments>()
    for (const a of attachments) {
      const list = map.get(a.event_id)
      if (list) list.push(a)
      else map.set(a.event_id, [a])
    }
    return map
  }, [attachments])

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {[76, 92, 64, 104, 96, 44, 56].map((w) => (
            <span key={w} style={{ width: w }}><Bone className="h-6 rounded-lg" /></span>
          ))}
        </div>
        <Bone className="h-3 w-28" />
        <EntryListSkeleton count={3} />
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="Nothing logged for this name yet"
        hint="Use Log to record a meeting, concall, annual report or broker note. Everything you add shows up here in date order."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {(['all', ...KINDS] as Array<EventKind | 'all'>).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={[
              'rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors',
              kind === k
                ? 'border-[#1C1B17] bg-[#1C1B17] text-[#F7F2E6]'
                : 'border-[#D7D0C2] bg-[#F7F2E6] text-[#1C1B17] hover:bg-[rgba(28,27,23,0.04)]',
            ].join(' ')}
          >
            {k === 'all' ? 'Everything' : KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={`No ${kind === 'all' ? '' : KIND_LABELS[kind as EventKind]} entries`} />
      ) : (
        groupByMonth(filtered).map((group) => (
          <section key={group.key} className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-[#8B857A]">
              {group.label}
            </h3>
            {group.rows.map((e) => (
              <div key={e.event_id} className="group">
                <TimelineEntry
                  event={e}
                  attachments={byEvent.get(e.event_id) ?? []}
                  metWith={met.byEvent.get(e.event_id)}
                  metLoading={met.loading}
                  // RLS is the real gate; this only hides a control that would fail.
                  canDelete={e.created_by === userId || role === 'admin'}
                  focused={e.event_id === focusEventId}
                  focusKey={focusKey}
                />
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  )
}
