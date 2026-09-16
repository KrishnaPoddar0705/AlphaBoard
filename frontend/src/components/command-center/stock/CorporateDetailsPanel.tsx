import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import SectionCard from '../shared/SectionCard'
import { UNDERSTANDING_LEVELS, MODEL_STATUSES } from '@/lib/commandCenter/constants'
import { useUpdateCoverage } from '@/hooks/commandCenter/useCoverage'
import { useRoster } from '@/hooks/commandCenter/useHome'
import { leadCandidates } from '@/lib/commandCenter/teams'
import type { CoverageBoardRow, ModelStatus, UnderstandingLevel }
  from '@/lib/commandCenter/types'

const LEVEL_COLOR: Record<UnderstandingLevel, string> = {
  high: '#2F8F5B', medium: '#D06030', low: '#B23B2A',
}

const inputClass =
  'w-full rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] px-2 py-1 font-mono text-xs text-[#1C1B17] focus:border-[#8B857A] focus:outline-none'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="shrink-0 font-mono text-[11px] text-[#6F6A60]">{label}</span>
      <span className="min-w-0 text-right font-mono text-xs text-[#1C1B17]">{children}</span>
    </div>
  )
}

/** Category 5: how well we know this company, and how to reach it. */
export default function CorporateDetailsPanel({ coverage }: { coverage: CoverageBoardRow }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    understanding_level: coverage.understanding_level,
    model_status: coverage.model_status,
    sector: coverage.sector ?? '',
    corporate_address: coverage.corporate_address ?? '',
    lead_analyst_id: coverage.lead_analyst_id ?? '',
  })
  const update = useUpdateCoverage()
  // Who may lead: the adder or an analyst/PM on their team -- enforced again on save.
  const { data: roster, isPending: rosterPending } = useRoster(null)
  const candidates = leadCandidates(coverage, roster)

  const save = async () => {
    await update.mutateAsync({
      id: coverage.id,
      patch: {
        understanding_level: (draft.understanding_level || null) as UnderstandingLevel | null,
        model_status: draft.model_status as ModelStatus,
        sector: draft.sector.trim() || null,
        corporate_address: draft.corporate_address.trim() || null,
        lead_analyst_id: draft.lead_analyst_id || null,
      },
    }).catch(() => { /* the mutation toasts */ })
    setEditing(false)
  }

  return (
    <SectionCard
      title="Corporate details"
      action={
        editing ? (
          <span className="flex gap-1">
            <button type="button" onClick={save} aria-label="Save"
                    className="rounded p-1 text-[#2F8F5B] hover:bg-[rgba(47,143,91,0.1)]">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => setEditing(false)} aria-label="Cancel"
                    className="rounded p-1 text-[#6F6A60] hover:bg-[rgba(28,27,23,0.06)]">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setEditing(true)} aria-label="Edit details"
                  className="rounded p-1 text-[#6F6A60] hover:bg-[rgba(28,27,23,0.06)]">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )
      }
    >
      {editing ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-[#6F6A60]">Level of understanding</span>
            <select className={inputClass} value={draft.understanding_level ?? ''}
                    onChange={(e) => setDraft({ ...draft, understanding_level: e.target.value as UnderstandingLevel })}>
              <option value="">Not set</option>
              {UNDERSTANDING_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-[#6F6A60]">Model</span>
            <select className={inputClass} value={draft.model_status}
                    onChange={(e) => setDraft({ ...draft, model_status: e.target.value as ModelStatus })}>
              {MODEL_STATUSES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-[#6F6A60]">Lead analyst</span>
            <select className={inputClass} value={draft.lead_analyst_id} disabled={rosterPending}
                    onChange={(e) => setDraft({ ...draft, lead_analyst_id: e.target.value })}>
              {rosterPending && <option value={draft.lead_analyst_id}>Loading team...</option>}
              {!rosterPending && !draft.lead_analyst_id && <option value="">Unassigned</option>}
              {candidates.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.username ?? m.user_id.slice(0, 8)}
                  {m.user_id === coverage.created_by ? ' (added it)' : ''}
                  {m.role === 'portfolio_manager' ? ' · PM' : ''}
                </option>
              ))}
            </select>
            <span className="font-mono text-[10px] text-[#8B857A]">
              Whoever added the stock, or an analyst or PM on their team.
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-[#6F6A60]">Sector</span>
            <input className={inputClass} value={draft.sector}
                   onChange={(e) => setDraft({ ...draft, sector: e.target.value })} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-[#6F6A60]">Corporate address</span>
            <textarea className={inputClass} rows={3} value={draft.corporate_address}
                      onChange={(e) => setDraft({ ...draft, corporate_address: e.target.value })} />
          </label>
        </div>
      ) : (
        <div className="divide-y divide-[#E3DDCF]">
          <Row label="Understanding">
            {coverage.understanding_level ? (
              <span style={{ color: LEVEL_COLOR[coverage.understanding_level] }}>
                {coverage.understanding_level}
              </span>
            ) : <span className="text-[#8B857A]">not set</span>}
          </Row>
          <Row label="Model">{coverage.model_status}</Row>
          <Row label="Lead analyst">
            {coverage.lead_analyst_username ?? <span className="text-[#8B857A]">unassigned</span>}
          </Row>
          <Row label="Sector">
            {coverage.sector ?? <span className="text-[#8B857A]">not set</span>}
          </Row>
          <Row label="Address">
            {coverage.corporate_address
              ? <span className="whitespace-pre-line">{coverage.corporate_address}</span>
              : <span className="text-[#8B857A]">not set</span>}
          </Row>
        </div>
      )}
    </SectionCard>
  )
}
