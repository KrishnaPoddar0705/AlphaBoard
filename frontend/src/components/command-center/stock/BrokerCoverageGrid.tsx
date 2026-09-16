import { useMemo, useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import SectionCard from '../shared/SectionCard'
import { RowsSkeleton } from '../shared/Skeleton'
import BrokerBulkUploadDialog from './BrokerBulkUploadDialog'
import { useBrokers, useAddBroker } from '@/hooks/commandCenter/useBrokers'
import { useCoverageEvents } from '@/hooks/commandCenter/useCommandCenterEvents'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import { formatDayShort, relativeDays } from '@/lib/commandCenter/format'
import type { CoverageBoardRow } from '@/lib/commandCenter/types'

/** Category 4: which brokers we hold research from, and how current it is. */
export default function BrokerCoverageGrid({ coverage }: { coverage: CoverageBoardRow }) {
  const { data: brokers = [], isPending: brokersPending } = useBrokers()
  const { data: events = [], isPending: eventsPending } = useCoverageEvents(coverage.id)
  const { role } = useCommandCenterSession()
  const addBroker = useAddBroker()
  const [dialogOpen, setDialogOpen] = useState(false)
  // Bumped on open so the dialog remounts with a clean draft.
  const [session, setSession] = useState(0)

  const latestByBroker = useMemo(() => {
    const map = new Map<string, { date: string; period: string | null }>()
    for (const e of events) {
      if (e.kind !== 'broker_report' || !e.broker_id) continue
      const seen = map.get(e.broker_id)
      if (!seen || e.event_date > seen.date) {
        map.set(e.broker_id, { date: e.event_date, period: e.period_label })
      }
    }
    return map
  }, [events])

  const promptForBroker = () => {
    const name = prompt('Broker name')?.trim()
    if (name) addBroker.mutate(name)
  }

  return (
    <SectionCard
      title="Broker coverage"
      action={
        <span className="flex gap-1">
          {role === 'admin' && (
            <button type="button" onClick={promptForBroker} aria-label="Add a broker"
                    className="rounded p-1 text-[#6F6A60] hover:bg-[rgba(28,27,23,0.06)]">
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => { setSession((n) => n + 1); setDialogOpen(true) }}
            aria-label="Upload broker research"
            className="rounded p-1 text-[#6F6A60] hover:bg-[rgba(28,27,23,0.06)]"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
        </span>
      }
    >
      {brokersPending || eventsPending ? <RowsSkeleton rows={5} /> : (
      <ul className="divide-y divide-[#E3DDCF]">
        {brokers.map((b) => {
          const latest = latestByBroker.get(b.id)
          return (
            <li key={b.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="flex items-center gap-2">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    latest ? 'bg-[#2F8F5B]' : 'bg-[#D7D0C2]'
                  }`}
                  aria-hidden
                />
                <span className="font-mono text-xs text-[#1C1B17]">{b.name}</span>
              </span>
              <span className="font-mono text-[10px] text-[#6F6A60]">
                {latest
                  ? `${latest.period ? `${latest.period} · ` : ''}${formatDayShort(latest.date)} (${relativeDays(latest.date)})`
                  : 'nothing held'}
              </span>
            </li>
          )
        })}
      </ul>
      )}

      <BrokerBulkUploadDialog
        key={session}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        coverage={coverage}
      />
    </SectionCard>
  )
}
