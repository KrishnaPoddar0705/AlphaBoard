import { useEffect, useRef } from 'react'
import FileDropzone from '@/components/recommendations/FileDropzone'
import { useAttachmentUploads } from '@/hooks/useAttachmentUploads'
import {
  uploadCommandCenterFile, deleteCommandCenterFile, validateAttachment as validateCc,
  type AttachmentContext,
} from '@/lib/commandCenter/attachments'
import { CC_MAX_FILES } from '@/lib/commandCenter/constants'

export interface PendingAttachment {
  storage_path: string
  external_url: null
  file_name: string
  mime_type: string | null
  size_bytes: number
}

interface Props {
  brokerId: string
  brokerName: string
  ctx: AttachmentContext
  /** Reports this broker's finished uploads up to the dialog. */
  onChange: (brokerId: string, files: PendingAttachment[]) => void
  /** Fired with this broker's storage keys when the row unmounts unsaved. */
  onDiscard: (keys: string[]) => void
}

/**
 * One broker's dropzone, owning its own upload queue.
 *
 * This is a component rather than a loop inside the dialog because
 * `useAttachmentUploads` is a hook: calling it once per broker inside a map would change
 * the hook count whenever the broker list loads or a broker is ticked, which React
 * treats as a fatal error ("rendered more hooks than during the previous render").
 * Mounting one component per ticked broker keeps every hook call unconditional.
 */
export default function BrokerUploadRow({
  brokerId, brokerName, ctx, onChange, onDiscard,
}: Props) {
  const uploads = useAttachmentUploads({
    ticker: '',
    userId: ctx.userId || null,
    upload: (file: File) => uploadCommandCenterFile(file, ctx),
    deleteFile: deleteCommandCenterFile,
    validate: validateCc,
    maxFiles: CC_MAX_FILES,
  })

  const { items } = uploads

  useEffect(() => {
    onChange(
      brokerId,
      items
        .filter((i) => i.status === 'done' && i.key)
        .map((i) => ({
          storage_path: i.key!,
          external_url: null,
          file_name: i.name,
          mime_type: i.mime ?? null,
          size_bytes: i.size,
        }))
    )
  }, [items, brokerId, onChange])

  // Un-ticking a broker should not leave its uploaded files orphaned in the bucket.
  // The cleanup must run only on unmount, but it needs the LATEST items -- reading
  // `items` from a mount-time closure would always see the empty initial array, so the
  // orphans it is meant to delete would survive. A ref gives it both.
  const latestItems = useRef(items)
  const onDiscardRef = useRef(onDiscard)
  useEffect(() => {
    latestItems.current = items
    onDiscardRef.current = onDiscard
  })

  useEffect(() => {
    return () => {
      const keys = latestItems.current.filter((i) => i.key).map((i) => i.key!)
      if (keys.length > 0) onDiscardRef.current(keys)
    }
  }, [])

  return (
    <div className="rounded-lg border border-[#E3DDCF] bg-[#FBF7ED] p-3">
      <p className="mb-2 font-mono text-xs text-[#1C1B17]">{brokerName}</p>
      <FileDropzone
        items={uploads.items}
        onFiles={uploads.addFiles}
        onRemove={uploads.remove}
        onRetry={uploads.retry}
        inputId={`cc-broker-${brokerId}`}
        hint="Drop this broker's note (PDF, up to 50 MB)"
      />
    </div>
  )
}
