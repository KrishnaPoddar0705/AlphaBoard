import React, { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import type { AttachmentItem } from '@/lib/recommendations/attachments'
import { MAX_FILES, MAX_FILE_BYTES, formatBytes } from '@/lib/recommendations/attachments'
import AttachmentRow from './AttachmentRow'
import { extractFiles, nameClipboardFiles } from '@/lib/recommendations/clipboardFiles'

interface FileDropzoneProps {
  items: AttachmentItem[]
  onFiles: (files: File[]) => void
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  /** Uploads cannot start until the Supabase user id resolves. */
  disabled?: boolean
  /** Distinct per mount -- two dropzones can be on the page at once. */
  inputId?: string
}

/**
 * Click, drag-and-drop, or paste target for recommendation attachments.
 *
 * Presentational: it holds no upload state and never touches Supabase. The
 * only state it owns is whether a drag is currently over it.
 */
export default function FileDropzone({
  items,
  onFiles,
  onRemove,
  onRetry,
  disabled = false,
  inputId = 'file-upload',
}: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  // dragenter/dragleave fire for every child element crossed, so a boolean
  // flickers as the pointer moves over the icon and the label. Count instead.
  const dragDepth = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const accept = (files: File[]) => {
    if (disabled || files.length === 0) return
    onFiles(files)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current += 1
    setIsDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setIsDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepth.current = 0
    setIsDragActive(false)
    accept(extractFiles(e.dataTransfer))
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = extractFiles(e.clipboardData)
    if (files.length === 0) return
    e.preventDefault()
    accept(nameClipboardFiles(files))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    accept(Array.from(e.target.files ?? []))
    // Without this, removing a file and re-picking the same one fires no change event.
    e.target.value = ''
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="Attach files by clicking, dragging, or pasting"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={handleDragEnter}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        className={`rounded-lg border border-dashed p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-[#6F6A60] ${
          disabled
            ? 'cursor-not-allowed border-[#D7D0C2] opacity-60'
            : isDragActive
              ? 'cursor-pointer border-[#1C1B17] bg-[#E8E3D3]'
              : 'cursor-pointer border-[#D7D0C2] hover:border-[#1C1B17]'
        }`}
      >
        <div className="flex flex-col items-center justify-center py-2 text-center">
          <Upload className="mb-2 h-6 w-6 text-[#6F6A60]" aria-hidden />
          <p className="font-mono text-xs text-[#1C1B17]">
            {isDragActive ? 'Drop to attach' : 'Click, drag, or paste files here'}
          </p>
          <p className="mt-1 font-mono text-[10px] text-[#6F6A60]">
            Any file type, up to {formatBytes(MAX_FILE_BYTES)} each, {MAX_FILES} files max
          </p>
        </div>

        <input
          id={inputId}
          ref={inputRef}
          type="file"
          multiple
          disabled={disabled}
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <AttachmentRow key={item.id} item={item} onRemove={onRemove} onRetry={onRetry} />
          ))}
        </div>
      )}
    </div>
  )
}
