import { useState } from 'react'
import toast from 'react-hot-toast'
import { FileText, Image as ImageIcon, Link2, Loader2, Paperclip } from 'lucide-react'
import { signedUrlFor, signedDownloadUrlFor, isInlineViewable, formatBytes }
  from '@/lib/commandCenter/attachments'
import type { EventAttachment } from '@/lib/commandCenter/types'

/**
 * Attachments are stored as PATHS into a private bucket, not URLs, so a link cannot be
 * rendered ahead of time -- a signed URL is minted on click and is short-lived by
 * design. That is deliberate: broker research is licensed, and a URL baked into the
 * page would keep working for anyone it was forwarded to.
 */
export default function AttachmentList({ items }: { items: EventAttachment[] }) {
  const [opening, setOpening] = useState<string | null>(null)

  if (items.length === 0) return null

  const open = async (a: EventAttachment) => {
    if (a.external_url) {
      window.open(a.external_url, '_blank', 'noopener,noreferrer')
      return
    }
    if (!a.storage_path) return
    setOpening(a.id)
    try {
      const url = isInlineViewable(a.mime_type)
        ? await signedUrlFor(a.storage_path)
        : await signedDownloadUrlFor(a.storage_path, a.file_name)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open that file')
    } finally {
      setOpening(null)
    }
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((a) => {
        const Icon = a.external_url ? Link2 : a.mime_type?.startsWith('image/') ? ImageIcon : FileText
        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => open(a)}
              disabled={opening === a.id}
              className="inline-flex max-w-[240px] items-center gap-1.5 rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] px-2 py-1 font-mono text-[11px] text-[#1C1B17] transition-colors hover:bg-[rgba(28,27,23,0.04)] disabled:opacity-60"
            >
              {opening === a.id
                ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                : <Icon className="h-3 w-3 shrink-0 text-[#6F6A60]" />}
              <span className="truncate">{a.file_name}</span>
              {a.size_bytes != null && (
                <span className="shrink-0 text-[#8B857A]">{formatBytes(a.size_bytes)}</span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function AttachmentCount({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#6F6A60]">
      <Paperclip className="h-3 w-3" />{count}
    </span>
  )
}
