import { THESIS_IMPACTS } from '@/lib/commandCenter/constants'
import type { Broker, ThesisImpact } from '@/lib/commandCenter/types'
import type { NewContactDraft } from './EventContactsField'

export interface DetailValues {
  brokerId: string | null
  thesisImpact: ThesisImpact | null
  openQuestions: string
  periodLabel: string
  /** Existing contacts on the stock who were there. */
  contactIds: string[]
  /** People typed in while logging; created as contacts when the entry saves. */
  newContacts: NewContactDraft[]
  /** Escalation targets. Independent -- either, both, or neither. */
  pushToPm: boolean
  pushToAdmin: boolean
  reviewNote: string
}

interface Props {
  values: DetailValues
  onChange: (next: DetailValues) => void
  brokers: Broker[]
  wantsBroker: boolean
  wantsPeriod: boolean
  periodOptions: string[]
}

const labelClass = 'font-mono text-[11px] uppercase tracking-wider text-[#6F6A60]'
const inputClass =
  'w-full rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] px-2.5 py-1.5 font-mono text-xs text-[#1C1B17] focus:border-[#8B857A] focus:outline-none'

/** A two-state escalation target. `aria-pressed` carries the state to screen readers. */
function PushToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
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
 * The fields beyond the bare title and date.
 *
 * Period and broker appear only when the chosen type needs them (a period for a concall,
 * a broker for a broker report). Everything else is always on screen: thesis impact,
 * open questions and the push targets were once collapsed behind an "Add detail"
 * disclosure and were missed too often to justify the saved vertical space.
 */
export default function EventDetailFields({
  values, onChange, brokers, wantsBroker, wantsPeriod, periodOptions,
}: Props) {
  const set = (patch: Partial<DetailValues>) => onChange({ ...values, ...patch })

  return (
    <div className="flex flex-col gap-3">
      {/* Always visible when the chosen type needs them. */}
      {wantsPeriod && (
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Period</label>
          <select
            value={values.periodLabel}
            onChange={(e) => set({ periodLabel: e.target.value })}
            className={inputClass}
          >
            <option value="">Not specified</option>
            {periodOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}

      {wantsBroker && (
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Broker</label>
          <select
            value={values.brokerId ?? ''}
            onChange={(e) => set({ brokerId: e.target.value || null })}
            className={inputClass}
          >
            <option value="">Select a broker</option>
            {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {/*
        Deliberately not behind a disclosure.
        These three decide whether the entry is ever seen again: the thesis signal is
        what What Changed reads, and the push targets are the only route into a
        reviewer's queue. Collapsed, they were routinely missed -- so the 20-second log
        is now bought by keeping the fields terse, not by hiding them.
      */}
      <div className="flex flex-col gap-3 rounded-lg border border-[#E3DDCF] bg-[#FBF7ED] p-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Impact on thesis</label>
          <div className="flex gap-1.5">
            {THESIS_IMPACTS.map((t) => {
              const on = values.thesisImpact === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set({ thesisImpact: on ? null : t.value })}
                  className={[
                    'rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors',
                    on ? 'text-[#F7F2E6]' : 'bg-[#F7F2E6] hover:bg-[rgba(28,27,23,0.04)]',
                  ].join(' ')}
                  style={on
                    ? { backgroundColor: t.color, borderColor: t.color }
                    : { borderColor: '#D7D0C2', color: t.color }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Open questions</label>
          <textarea
            value={values.openQuestions}
            onChange={(e) => set({ openQuestions: e.target.value })}
            rows={2}
            placeholder="What did they not answer?"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Push for review</label>
          {/*
            Opt-in escalation. Nothing reaches a PM's or an admin's queue unless it is
            pushed here, and the two targets are independent -- pushing to the PM does
            not put the entry in front of an admin.
          */}
          <div className="flex flex-wrap gap-1.5">
            <PushToggle
              label="Push to PM"
              on={values.pushToPm}
              onClick={() => set({ pushToPm: !values.pushToPm })}
            />
            <PushToggle
              label="Push to Admin"
              on={values.pushToAdmin}
              onClick={() => set({ pushToAdmin: !values.pushToAdmin })}
            />
          </div>
          {(values.pushToPm || values.pushToAdmin) && (
            <textarea
              value={values.reviewNote}
              onChange={(e) => set({ reviewNote: e.target.value })}
              rows={2}
              placeholder="What do you want their view on?"
              className={inputClass}
            />
          )}
        </div>
      </div>
    </div>
  )
}
