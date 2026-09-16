import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CONTACT_DESIGNATIONS } from '@/lib/commandCenter/constants'
import { useSaveContact } from '@/hooks/commandCenter/useContacts'
import type { ContactDesignation, ContactWithRecency } from '@/lib/commandCenter/types'

const inputClass =
  'w-full rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] px-2.5 py-1.5 font-mono text-sm text-[#1C1B17] focus:border-[#8B857A] focus:outline-none'

interface Props {
  open: boolean
  onClose: () => void
  coverageId: string
  existing?: ContactWithRecency | null
}

export default function ContactDialog({ open, onClose, coverageId, existing }: Props) {
  // Seeded once per mount. The parent gives this component a `key` that changes with
  // the contact being edited, so switching contacts remounts it rather than syncing
  // five fields in an effect.
  const [name, setName] = useState(existing?.name ?? '')
  const [designation, setDesignation] = useState<ContactDesignation>(existing?.designation ?? 'IR')
  const [designationOther, setDesignationOther] = useState(existing?.designation_other ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const save = useSaveContact()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    await save.mutateAsync({
      id: existing?.id,
      values: {
        coverage_id: coverageId,
        name,
        designation,
        designation_other: designation === 'Other' ? designationOther : null,
        email: email || null,
        phone: phone || null,
      },
    }).then(onClose).catch(() => { /* the mutation toasts */ })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">
            {existing ? 'Edit contact' : 'Add contact'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-[#6F6A60]">Name</span>
            <input autoFocus required value={name} onChange={(e) => setName(e.target.value)}
                   className={inputClass} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-[#6F6A60]">Role</span>
            <select value={designation} className={inputClass}
                    onChange={(e) => setDesignation(e.target.value as ContactDesignation)}>
              {CONTACT_DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>

          {designation === 'Other' && (
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] text-[#6F6A60]">Role title</span>
              <input value={designationOther} onChange={(e) => setDesignationOther(e.target.value)}
                     className={inputClass} />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-[#6F6A60]">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                   className={inputClass} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-[#6F6A60]">Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </label>

          <p className="font-mono text-[10px] text-[#8B857A]">
            There is no "date met" field on purpose -- it comes from the interactions you
            tag this person on, so it can never go stale.
          </p>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={save.isPending || !name.trim()}>Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
