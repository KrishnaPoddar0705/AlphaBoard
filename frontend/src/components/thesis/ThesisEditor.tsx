import React, { useRef, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { clipboardToMarkdownTable } from '@/lib/markdown/clipboardTable'
import { extractFiles, nameClipboardFiles } from '@/lib/recommendations/clipboardFiles'
import ThesisMarkdown from './ThesisMarkdown'

interface ThesisEditorProps {
  value: string
  onChange: (value: string) => void
  /** Receives files pasted while the cursor is in the textarea. */
  onFiles?: (files: File[]) => void
  rows?: number
  placeholder?: string
  className?: string
}

/**
 * Inserts text at the caret while keeping the browser's undo stack intact.
 *
 * `execCommand` is deprecated but it is the only way to get a native undo entry
 * plus a real `input` event, which is what keeps a controlled React value in
 * sync. Assigning `el.value` directly does not work: React 19 tracks the DOM
 * value and swallows the change.
 */
function insertAtCursor(
  el: HTMLTextAreaElement,
  text: string,
  onChange: (value: string) => void
): void {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? start
  const before = el.value.slice(0, start)
  const after = el.value.slice(end)

  // A pipe table only parses as a table if it is its own block.
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const trail = after.startsWith('\n') || after === '' ? '\n' : '\n\n'
  const payload = `${lead}${text}${trail}`

  try {
    if (document.execCommand && document.execCommand('insertText', false, payload)) return
  } catch {
    // Fall through to the state splice below.
  }

  onChange(before + payload + after)
  requestAnimationFrame(() => {
    const pos = start + payload.length
    el.setSelectionRange(pos, pos)
  })
}

/**
 * The investment thesis field: a plain markdown textarea with a preview.
 *
 * Pasting a spreadsheet range inserts a markdown table. That check runs before
 * the file check on purpose -- Excel and Numbers put a bitmap of the copied
 * range on the clipboard alongside the HTML, so testing for files first would
 * silently attach a screenshot instead of inserting the table.
 */
export default function ThesisEditor({
  value,
  onChange,
  onFiles,
  rows = 4,
  placeholder = 'Enter your investment thesis...',
  className = '',
}: ThesisEditorProps) {
  const [tab, setTab] = useState('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const table = clipboardToMarkdownTable(e.clipboardData)
    if (table) {
      e.preventDefault()
      insertAtCursor(e.currentTarget, table, onChange)
      return
    }

    if (onFiles) {
      const files = extractFiles(e.clipboardData)
      if (files.length > 0) {
        e.preventDefault()
        onFiles(nameClipboardFiles(files))
        return
      }
    }
    // Otherwise let the browser paste plain text as it always has.
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className={className}>
      <div className="flex items-center justify-between gap-2">
        <TabsList className="h-8">
          <TabsTrigger value="write" className="text-xs">
            Write
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs">
            Preview
          </TabsTrigger>
        </TabsList>
        <span className="hidden font-mono text-[10px] text-[#6F6A60] sm:inline">
          Paste a spreadsheet range to insert a table
        </span>
      </div>

      <TabsContent value="write">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          rows={rows}
          className="bg-[#FBF7ED] border-[#D7D0C2] font-mono text-sm"
        />
      </TabsContent>

      <TabsContent value="preview">
        <div
          className="min-h-[80px] rounded-[10px] border border-[#D7D0C2] bg-[#FBF7ED] p-3 font-mono text-sm text-[#1C1B17]"
          style={{ minHeight: `${Math.max(rows, 3) * 1.6}rem` }}
        >
          {value.trim() ? (
            <ThesisMarkdown content={value} />
          ) : (
            <span className="text-[#6F6A60]">Nothing to preview yet.</span>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
