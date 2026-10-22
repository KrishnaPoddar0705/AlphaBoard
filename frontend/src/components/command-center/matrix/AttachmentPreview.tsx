import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ExternalLink, FileText, Image as ImageIcon, Link2, Loader2 } from 'lucide-react'
import { formatBytes, isInlineViewable, signedDownloadUrlFor, signedUrlFor } from '@/lib/commandCenter/attachments'
import type { EventAttachment } from '@/lib/commandCenter/types'

/**
 * An entry's source files as cards, with the chosen one previewed inline -- a PDF in a
 * frame, an image as itself -- so reading a broker note does not mean leaving the matrix.
 *
 * URLs are minted on demand and expire in minutes (see CC_SIGNED_URL_TTL_SECONDS), so
 * the cached copy is dropped before the signature lapses.
 */
export default function AttachmentPreview({ items }: { items: EventAttachment[] }) {
  const [active, setActive] = useState<EventAttachment | null>(
    () => items.find((a) => a.storage_path && isInlineViewable(a.mime_type)) ?? null,
  )
  const previewable = !!active?.storage_path && isInlineViewable(active.mime_type)
  // Kept for 4 minutes, under the 5-minute signature, so flipping between files does
  // not re-mint -- and never served after the URL itself would have expired.
  const { data: url, isPending: loading, isError } = useQuery({
    queryKey: ['command-center', 'signed-url', active?.storage_path],
    queryFn: () => signedUrlFor(active!.storage_path!),
    enabled: previewable,
    staleTime: 4 * 60_000,
    gcTime: 4 * 60_000,
  })

  const open = async (a: EventAttachment) => {
    if (a.external_url) return window.open(a.external_url, '_blank', 'noopener,noreferrer')
    if (!a.storage_path) return
    if (isInlineViewable(a.mime_type)) return setActive(a)
    try {
      window.open(await signedDownloadUrlFor(a.storage_path, a.file_name), '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open that file')
    }
  }

  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {items.map((a) => {
          const Icon = a.external_url ? Link2 : a.mime_type?.startsWith('image/') ? ImageIcon : FileText
          const on = active?.id === a.id
          return (
            <li key={a.id}>
              <button type="button" onClick={() => open(a)}
                className={[
                  'flex w-full items-center gap-2.5 rounded-(--mx-radius) border px-3 py-2 text-left transition-colors',
                  on ? 'border-(--mx-line-strong) bg-(--mx-raised) shadow-(--mx-shadow)' : 'border-(--mx-line) hover:bg-(--mx-hover)',
                ].join(' ')}>
                <Icon className="size-4 shrink-0 text-(--mx-text-3)" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-(--mx-text)">{a.file_name}</span>
                  <span className="font-mono text-[10.5px] text-(--mx-text-3)">
                    {a.external_url ? 'Link' : isInlineViewable(a.mime_type) ? 'Preview' : 'Download'}
                    {a.size_bytes != null && <> · {formatBytes(a.size_bytes)}</>}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {active && (
        <div className="overflow-hidden rounded-(--mx-radius) border border-(--mx-line) bg-(--mx-sunken)">
          <div className="flex items-center justify-between border-b border-(--mx-line) px-3 py-1.5 text-[11.5px] text-(--mx-text-2)">
            <span className="truncate">{active.file_name}</span>
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 hover:text-(--mx-text)">
                <ExternalLink className="h-3 w-3" /> New tab
              </a>
            )}
          </div>
          {isError ? (
            <p className="p-4 text-[12px] text-[#B23B2A]">Could not open this file. Try "New tab" or reopen the entry.</p>
          ) : loading || !url ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="size-4 animate-spin text-(--mx-text-3)" /></div>
          ) : active.mime_type?.startsWith('image/') ? (
            <img src={url} alt={active.file_name} className="max-h-[480px] w-full object-contain" />
          ) : (
            <iframe src={url} title={active.file_name} className="h-[480px] w-full bg-white" />
          )}
        </div>
      )}
    </div>
  )
}
