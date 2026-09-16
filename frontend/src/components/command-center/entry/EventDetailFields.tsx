import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
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
  reviewRequested: boolean
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

/**
 * Fields that only sometimes matter, behind a disclosure.
 *
 * Keeping these collapsed is the difference between a 20-second log and a form people
 * avoid. Anything genuinely required by the chosen type (a period for a concall, a
 * broker for a broker report) is surfaced expanded instead.
 */
export default function EventDetailFields({
  values, onChange, brokers, wantsBroker, wantsPeriod, periodOptions,
}: Props) {
  const [open, setOpen] = useState(false)
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

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 self-start font-mono text-[11px] text-[#6F6A60] hover:text-[#1C1B17]"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Add detail
        {!open && (values.thesisImpact || values.openQuestions
          || values.reviewRequested) && (
          <span className="ml-1 rounded-full bg-[#E3DDCF] px-1.5 text-[10px]">set</span>
        )}
      </button>

      {open && (
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
            <label className="inline-flex cursor-pointer items-center gap-2 font-mono text-[11px] text-[#1C1B17]">
              <input
                type="checkbox"
                checked={values.reviewRequested}
                onChange={(e) => set({ reviewRequested: e.target.checked })}
                className="h-3.5 w-3.5 accent-[#1C1B17]"
              />
              Ask my PM to review this
            </label>
            {values.reviewRequested && (
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
      )}
    </div>
  )
}
