import { useUpdateEvent } from '@/hooks/commandCenter/useCommandCenterEvents'
import type { ActivityFeedRow } from '@/lib/commandCenter/types'

interface Props {
  event: ActivityFeedRow
  /** Drops the label and tightens the buttons, for inline use in a row footer. */
  compact?: boolean
}

function Toggle({ label, on, busy, compact, onClick }: {
  label: string; on: boolean; busy: boolean; compact: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={on}
      className={`rounded-lg border font-mono transition-colors disabled:opacity-50 ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[10px]'
      } ${
        on
          ? 'border-[#1C1B17] bg-[#1C1B17] text-[#F1EEE0]'
          : 'border-[#D7D0C2] bg-[#FBF7ED] text-[#6F6A60] hover:border-[#8B857A] hover:text-[#1C1B17]'
      }`}
    >
      {on ? '✓ ' : '+ '}{label}
    </button>
  )
}

/**
 * Push an already-logged entry to a PM or an admin after the fact.
 *
 * Significance often shows up later than the log does -- a throwaway plant visit matters
 * once the quarter lands -- so escalation cannot be creation-only. This sits on every
 * logged entry: the stock timeline, the activity feed and the home drawer.
 *
 * Toggling off withdraws the push, which is why review_requested is recomputed from both
 * targets rather than simply cleared. A plan has nothing to ask about yet, so scheduled
 * entries render nothing.
 */
export default function PushControl({ event, compact = false }: Props) {
  const update = useUpdateEvent()
  const pm = event.push_to_pm === true
  const admin = event.push_to_admin === true

  if (event.is_scheduled) return null

  const push = (patch: { push_to_pm?: boolean; push_to_admin?: boolean }) => {
    const next = { push_to_pm: pm, push_to_admin: admin, ...patch }
    update.mutate({
      id: event.event_id,
      patch: { ...next, review_requested: next.push_to_pm || next.push_to_admin },
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!compact && (
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#6F6A60]">
          Push
        </span>
      )}
      <Toggle label="PM" on={pm} busy={update.isPending} compact={compact}
        onClick={() => push({ push_to_pm: !pm })} />
      <Toggle label="Admin" on={admin} busy={update.isPending} compact={compact}
        onClick={() => push({ push_to_admin: !admin })} />
    </div>
  )
}
