import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { CONTACT_DESIGNATIONS } from '@/lib/commandCenter/constants'
import type { ContactDesignation, ContactWithRecency } from '@/lib/commandCenter/types'
import { Bone } from '../shared/Skeleton'

/** A person typed in while logging; saved as a contact on the stock when the entry saves. */
export interface NewContactDraft {
  draftId: string
  name: string
  designation: ContactDesignation
  designation_other: string | null
  email: string | null
  phone: string | null
}

interface Props {
  contacts: ContactWithRecency[]
  selectedIds: string[]
  onSelectedIds: (ids: string[]) => void
  drafts: NewContactDraft[]
  onDrafts: (drafts: NewContactDraft[]) => void
  /** No stock picked yet: contacts belong to a stock, so there is nothing to tag. */
  disabled?: boolean
  /** The stock's contacts are still loading. */
  loading?: boolean
}

const labelClass = 'font-mono text-[11px] uppercase tracking-wider text-[#6F6A60]'
const inputClass =
  'w-full min-w-0 rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] px-2.5 py-1.5 font-mono text-xs text-[#1C1B17] focus:border-[#8B857A] focus:outline-none'
const chip = (on: boolean) => [
  'inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[11px] transition-colors',
  on
    ? 'border-[#1C1B17] bg-[#1C1B17] text-[#F7F2E6]'
    : 'border-[#D7D0C2] bg-[#F7F2E6] text-[#1C1B17] hover:bg-[rgba(28,27,23,0.04)]',
].join(' ')

const EMPTY = { name: '', designation: 'IR' as ContactDesignation, other: '', email: '', phone: '' }

/**
 * Who was in the room. Existing contacts on the stock are one tap to tag; someone new is
 * typed in once and becomes a contact when the entry is saved, so the next meeting with
 * them is a tap too. Tagging is what drives each contact's "last met".
 */
export default function EventContactsField({
  contacts, selectedIds, onSelectedIds, drafts, onDrafts, disabled, loading,
}: Props) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [notice, setNotice] = useState<string | null>(null)

  const toggle = (id: string) =>
    onSelectedIds(selectedIds.includes(id) ? selectedIds.filter((c) => c !== id) : [...selectedIds, id])

  const add = () => {
    const name = form.name.trim()
    if (!name) return
    const email = form.email.trim().toLowerCase()

    // Already a contact on this stock? Tag them instead of creating a duplicate.
    const match = contacts.find((c) =>
      c.name.trim().toLowerCase() === name.toLowerCase() || (!!email && c.email?.toLowerCase() === email))
    if (match) {
      if (!selectedIds.includes(match.id)) onSelectedIds([...selectedIds, match.id])
      setNotice(`${match.name} is already a contact -- tagged them.`)
    } else if (!drafts.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
      onDrafts([...drafts, {
        draftId: crypto.randomUUID(),
        name,
        designation: form.designation,
        designation_other: form.designation === 'Other' ? form.other.trim() || null : null,
        email: email || null,
        phone: form.phone.trim() || null,
      }])
      setNotice(null)
    }
    setForm(EMPTY)
    setAdding(false)
  }

  if (disabled) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Who was there</span>
        <p className="font-mono text-[11px] text-[#8B857A]">Pick a stock first.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>Who was there</span>

      <div className="flex flex-wrap gap-1.5">
        {loading && [96, 120, 84].map((w) => (
          <span key={w} style={{ width: w }}><Bone className="h-7 rounded-lg" /></span>
        ))}
        {!loading && contacts.map((c) => (
          <button key={c.id} type="button" onClick={() => toggle(c.id)} className={chip(selectedIds.includes(c.id))}>
            {c.name} · {c.designation === 'Other' ? c.designation_other ?? 'Other' : c.designation}
          </button>
        ))}
        {drafts.map((d) => (
          <span key={d.draftId} className={chip(true)}>
            {d.name} · {d.designation === 'Other' ? d.designation_other ?? 'Other' : d.designation}
            <span className="rounded bg-[#D06030] px-1 text-[9px] uppercase text-[#1C1B17]">new</span>
            <button
              type="button"
              onClick={() => onDrafts(drafts.filter((x) => x.draftId !== d.draftId))}
              aria-label={`Remove ${d.name}`}
              className="text-[#CFC8B8] hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[#8B857A] px-2 py-1 font-mono text-[11px] text-[#6F6A60] hover:border-[#1C1B17] hover:text-[#1C1B17]"
          >
            <Plus className="h-3 w-3" /> New contact
          </button>
        )}
      </div>

      {adding && (
        <div
          className="grid grid-cols-2 gap-2 rounded-lg border border-[#E3DDCF] bg-[#FBF7ED] p-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        >
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name"
            className={`${inputClass} col-span-2 sm:col-span-1`}
          />
          <select
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value as ContactDesignation })}
            className={inputClass}
          >
            {CONTACT_DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email (optional)"
            className={inputClass}
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone (optional)"
            className={`${inputClass} col-span-2 sm:col-span-1`}
          />
          {form.designation === 'Other' && (
            <input
              value={form.other}
              onChange={(e) => setForm({ ...form, other: e.target.value })}
              placeholder="Role title"
              className={`${inputClass} col-span-2 sm:col-span-4`}
            />
          )}
          <div className="col-span-2 flex justify-end gap-1.5 sm:col-span-4">
            <button
              type="button"
              onClick={() => { setAdding(false); setForm(EMPTY) }}
              className="rounded-lg border border-[#D7D0C2] px-2.5 py-1 font-mono text-[11px] text-[#1C1B17]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={add}
              disabled={!form.name.trim()}
              className="rounded-lg border border-[#1C1B17] bg-[#1C1B17] px-2.5 py-1 font-mono text-[11px] text-[#F7F2E6] disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <p className="font-mono text-[10px] text-[#8B857A]">
        {notice ?? (!loading && contacts.length === 0 && drafts.length === 0
          ? 'No contacts on this stock yet. Anyone you add is saved to it.'
          : 'Tagging someone updates their "last met" date. New people are saved to the stock.')}
      </p>
    </div>
  )
}
