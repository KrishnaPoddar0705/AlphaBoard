import { Users } from 'lucide-react'
import { Bone } from './Skeleton'
import type { EventContactTag } from '@/lib/commandCenter/api'

type Met = EventContactTag['contact']

interface Props {
  contacts: Met[] | undefined
  /** From the feed row: how many were tagged, known before the names load. */
  count: number | undefined
  loading?: boolean
  className?: string
}

const role = (c: Met) => (c.designation === 'Other' ? c.designation_other || 'Other' : c.designation)

/** "Met Dipendar · CEO, Asha · CFO" -- only when someone was tagged on the entry. */
export default function MetWith({ contacts, count, loading, className = '' }: Props) {
  if (!count) return null
  if (loading && !contacts?.length) {
    return <span className={`inline-block w-40 ${className}`}><Bone className="h-3" /></span>
  }
  if (!contacts?.length) return null
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 font-mono text-[11px] text-[#6F6A60] ${className}`}>
      <Users className="h-3 w-3 shrink-0" />
      <span className="truncate">
        Met{' '}
        {contacts.map((c, i) => (
          <span key={c.id}>
            {i > 0 && ', '}
            <span className="text-[#1C1B17]">{c.name}</span> · {role(c)}
          </span>
        ))}
      </span>
    </span>
  )
}
