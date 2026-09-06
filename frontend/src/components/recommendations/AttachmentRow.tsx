import { AlertCircle, Check, Loader2, RotateCw, X } from 'lucide-react'
import type { AttachmentItem } from '@/lib/recommendations/attachments'
import { formatBytes } from '@/lib/recommendations/attachments'
import { Button } from '@/components/ui/button'

interface AttachmentRowProps {
  item: AttachmentItem
  onRemove: (id: string) => void
  onRetry: (id: string) => void
}

/** One queued or completed attachment: name, size, status, and its controls. */
export default function AttachmentRow({ item, onRemove, onRetry }: AttachmentRowProps) {
  const failed = item.status === 'failed'

  return (
    <div
      className={`flex items-center gap-2 rounded border p-2 ${
        failed ? 'border-red-300 bg-red-50' : 'border-[#D7D0C2] bg-[#FBF7ED]'
      }`}
    >
      {item.status === 'uploading' && (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#6F6A60]" aria-hidden />
      )}
      {item.status === 'done' && <Check className="h-4 w-4 shrink-0 text-green-700" aria-hidden />}
      {failed && <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />}

      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs text-[#1C1B17]" title={item.name}>
          {item.name}
        </p>
        <p className={`font-mono text-[10px] ${failed ? 'text-red-600' : 'text-[#6F6A60]'}`}>
          {failed
            ? item.error || 'Upload failed'
            : item.status === 'uploading'
              ? `Uploading... ${formatBytes(item.size)}`
              : formatBytes(item.size)}
        </p>
      </div>

      {failed && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRetry(item.id)}
          className="h-6 gap-1 px-2 font-mono text-[10px] text-[#1C1B17]"
        >
          <RotateCw className="h-3 w-3" />
          Retry
        </Button>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Remove ${item.name}`}
        onClick={() => onRemove(item.id)}
        className="h-6 w-6 shrink-0 p-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
