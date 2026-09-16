import { useState } from 'react'
import { Mail, Phone, Plus, Trash2, Users } from 'lucide-react'
import SectionCard from '../shared/SectionCard'
import EmptyState from '../shared/EmptyState'
import { RowsSkeleton } from '../shared/Skeleton'
import ContactDialog from './ContactDialog'
import { useContacts, useDeleteContact } from '@/hooks/commandCenter/useContacts'
import { formatDayShort, relativeDays } from '@/lib/commandCenter/format'
import type { ContactWithRecency } from '@/lib/commandCenter/types'

/** Category 6: the points of contact, with a last-met date nobody has to maintain. */
export default function ContactsPanel({ coverageId }: { coverageId: string }) {
  const { data: contacts = [], isPending } = useContacts(coverageId)
  const del = useDeleteContact()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ContactWithRecency | null>(null)

  const openNew = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (c: ContactWithRecency) => { setEditing(c); setDialogOpen(true) }

  return (
    <SectionCard
      title="Contacts"
      action={
        <button type="button" onClick={openNew} aria-label="Add contact"
                className="rounded p-1 text-[#6F6A60] hover:bg-[rgba(28,27,23,0.06)]">
          <Plus className="h-3.5 w-3.5" />
        </button>
      }
    >
      {isPending ? (
        <RowsSkeleton rows={2} />
      ) : contacts.length === 0 ? (
        <EmptyState icon={Users} title="No contacts yet"
                    hint="IR, CFO, MD -- whoever you deal with." />
      ) : (
        <ul className="divide-y divide-[#E3DDCF]">
          {contacts.map((c) => (
            <li key={c.id} className="group flex items-start justify-between gap-2 py-2">
              <button type="button" onClick={() => openEdit(c)} className="min-w-0 flex-1 text-left">
                <span className="flex items-baseline gap-1.5">
                  <span className="truncate font-mono text-xs text-[#1C1B17]">{c.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-[#6F6A60]">
                    {c.designation === 'Other' ? c.designation_other || 'Other' : c.designation}
                  </span>
                </span>
                <span className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-[10px] text-[#8B857A]">
                  {c.email && <span className="inline-flex items-center gap-1 truncate">
                    <Mail className="h-2.5 w-2.5" />{c.email}
                  </span>}
                  {c.phone && <span className="inline-flex items-center gap-1">
                    <Phone className="h-2.5 w-2.5" />{c.phone}
                  </span>}
                </span>
                <span className="mt-0.5 block font-mono text-[10px]">
                  <span className="text-[#6F6A60]">
                    Last met {c.last_met_on ? `${formatDayShort(c.last_met_on)} (${relativeDays(c.last_met_on)})` : 'never'}
                  </span>
                  {c.next_meeting_on && (
                    <span className="ml-2 text-[#D06030]">
                      Next {formatDayShort(c.next_meeting_on)}
                    </span>
                  )}
                </span>
              </button>

              <button
                type="button"
                onClick={() => { if (confirm(`Remove ${c.name}?`)) del.mutate(c.id) }}
                aria-label={`Remove ${c.name}`}
                className="hidden shrink-0 rounded p-1 text-[#8B857A] hover:bg-[rgba(178,59,42,0.1)] hover:text-[#B23B2A] group-hover:block"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ContactDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        coverageId={coverageId}
        existing={editing}
      />
    </SectionCard>
  )
}
