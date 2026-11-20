import { useState } from 'react'
import TerminalPanel, { PanelEmpty } from './TerminalPanel'
import BriefCard from './BriefCard'
import BriefDetail from './BriefDetail'
import { useBriefs } from '@/hooks/commandCenter/useBriefs'
import BriefsSkeleton, { BriefsBody } from './BriefsSkeleton'

/**
 * Admins' morning read: the last five daily briefs then the latest weekly one as a strip of
 * cards, with the chosen one open underneath (podcast, bullets, counts). Briefs are made
 * by the backend at 08:00 IST (weekly on Mondays); a slot with no new logs has none.
 *
 * Renders nothing for anyone but an org admin.
 */
export default function BriefsPanel({ className = '' }: { className?: string }) {
  const { data, isPending, enabled, generate, polling, roleKnown } = useBriefs()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Hold the space until we know who is looking: popping the panel in late shoves the
  // whole page down.
  if (!roleKnown) return <BriefsSkeleton />
  if (!enabled) return null

  // Dailies first (newest to oldest), then the weekly.
  const briefs = data ? [...data.daily, ...(data.weekly ? [data.weekly] : [])] : []
  // Default to the newest daily: the one made this morning.
  const selected = briefs.find((b) => b.id === selectedId) ?? data?.daily[0] ?? briefs[0] ?? null

  return (
    <TerminalPanel code="BRF" title="Briefs" count={isPending ? undefined : briefs.length} className={className} id="cc-briefs">
      {isPending ? (
        <BriefsBody />
      ) : briefs.length === 0 ? (
        <div className="flex flex-col gap-2 pb-3">
          <PanelEmpty>
            {polling
              ? 'Writing the brief and recording the podcast. This takes a minute or two.'
              : 'No briefs yet. They arrive at 8:00 IST each morning (the weekly on Mondays) when the desk has logged something.'}
          </PanelEmpty>
          {!polling && (
            <div className="flex flex-wrap gap-2 px-3">
              {(['daily', 'weekly'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  disabled={generate.isPending}
                  onClick={() => generate.mutate(kind)}
                  className="rounded-md border border-[#1C1B17] px-2 py-1 font-mono text-[11px] text-[#1C1B17] hover:bg-[#1C1B17] hover:text-[#F1EEE0] disabled:opacity-50"
                >
                  Make the {kind} brief now
                </button>
              ))}
            </div>
          )}
          {generate.isError && <p className="px-3 font-mono text-[11px] text-[#B23B2A]">{generate.error.message}</p>}
        </div>
      ) : (
        <>
          <div className="flex snap-x gap-2 overflow-x-auto px-3 py-3">
            {briefs.map((b) => (
              <BriefCard key={b.id} brief={b} selected={b.id === selected?.id} onSelect={() => setSelectedId(b.id)} />
            ))}
          </div>
          {selected && <BriefDetail key={selected.id} brief={selected} />}
        </>
      )}
    </TerminalPanel>
  )
}
