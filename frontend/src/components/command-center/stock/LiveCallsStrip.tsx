import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddRecommendationModal } from '@/components/recommendations/AddRecommendationModal'
import SectionCard from '../shared/SectionCard'
import { listLiveCalls, type LiveCall } from '@/lib/commandCenter/api'
import { ccKeys } from '@/hooks/commandCenter/useCoverage'
import { useCommandCenterSession } from '@/hooks/commandCenter/useCommandCenterSession'
import { formatDayShort } from '@/lib/commandCenter/format'

function returnPct(c: LiveCall): number | null {
  if (!c.entry_price || !c.current_price) return null
  return ((c.current_price - c.entry_price) / c.entry_price) * 100
}

/**
 * The desk's open calls on this name, beside the research that informed them.
 *
 * This is what makes "see all the research before making an investment decision" real:
 * the thesis, the meetings and the position live on one screen. Read-only -- these rows
 * are already visible to every member under the existing recommendations policy, so
 * this is a query, not a new grant.
 */
export default function LiveCallsStrip({ ticker }: { ticker: string }) {
  const { ready } = useCommandCenterSession()
  const [modalOpen, setModalOpen] = useState(false)
  const [session, setSession] = useState(0)

  const { data: calls = [], refetch } = useQuery<LiveCall[]>({
    queryKey: [...ccKeys.all, 'live-calls', ticker],
    queryFn: () => listLiveCalls(ticker),
    enabled: ready && !!ticker,
    staleTime: 60_000,
  })

  return (
    <SectionCard
      title="Open calls"
      action={
        <button
          type="button"
          onClick={() => { setSession((n) => n + 1); setModalOpen(true) }}
          aria-label="Raise a recommendation"
          className="rounded p-1 text-[#6F6A60] hover:bg-[rgba(28,27,23,0.06)]"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      }
    >
      {calls.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="font-mono text-xs text-[#6F6A60]">Nobody has a live call on this name.</p>
          <Button variant="outline" size="sm"
                  onClick={() => { setSession((n) => n + 1); setModalOpen(true) }}>
            <TrendingUp className="h-3.5 w-3.5" /> Raise a recommendation
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-[#E3DDCF]">
          {calls.map((c) => {
            const ret = returnPct(c)
            return (
              <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs text-[#1C1B17]">
                    {c.username ?? 'Analyst'} · {c.action}
                  </span>
                  <span className="block font-mono text-[10px] text-[#6F6A60]">
                    {c.entry_price != null ? `entry ${c.entry_price.toFixed(2)}` : ''}
                    {c.target_irr != null ? ` · IRR ${c.target_irr}%` : ''}
                    {c.entry_date ? ` · ${formatDayShort(c.entry_date)}` : ''}
                  </span>
                </span>
                {ret != null && (
                  <span
                    className="shrink-0 font-mono text-xs"
                    style={{ color: ret >= 0 ? '#2F8F5B' : '#B23B2A' }}
                  >
                    {ret >= 0 ? '+' : ''}{ret.toFixed(1)}%
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <AddRecommendationModal
        key={session}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); void refetch() }}
        initialTicker={ticker}
      />
    </SectionCard>
  )
}
