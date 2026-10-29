import { Link } from 'react-router-dom'
import { Check, CircleAlert, FileDown, FolderOpen, Loader2, PanelLeft, Send } from 'lucide-react'
import { formatDay } from '@/lib/commandCenter/format'
import type { SaveStatus } from './useAutosave'

interface Props {
  ticker: string
  company: string | null
  folder: string | null
  status: SaveStatus
  words: number
  lastPublishedAt: string | null
  onPublish: () => void
  onExport: () => void
  onRetrySave: () => void
  /** Phones and tablets: opens the note tree. */
  onOpenTree?: () => void
}

function SaveState({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === 'saving') return <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving</span>
  if (status === 'unsaved') return <span>Edited</span>
  if (status === 'error') {
    return (
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-[#B23B2A] hover:underline">
        <CircleAlert className="h-3 w-3" /> Not saved. Retry
      </button>
    )
  }
  return <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" /> Saved</span>
}

/** The note's place (stock, folder), its save state, and the one action that matters: publish. */
export default function BoardHeader({
  ticker, company, folder, status, words, lastPublishedAt, onPublish, onExport, onRetrySave, onOpenTree,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#DDD6C7] bg-[#F7F2E6] px-3 py-2 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        {onOpenTree && (
          <button type="button" onClick={onOpenTree} aria-label="Show notes"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-[#DDD6C7] text-[#3F3C35] hover:bg-[#EFE9DA] lg:hidden">
            <PanelLeft className="h-4 w-4" />
          </button>
        )}
        <Link to={`/command-center/stock/${encodeURIComponent(ticker)}`}
          className="flex-none rounded-md bg-[#1C1B17] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#F7F2E6] hover:bg-[#33312B]"
          title="Open the stock's log">
          {ticker}
        </Link>
        <span className="hidden min-w-0 truncate font-mono text-[11.5px] text-[#3F3C35] sm:inline">{company}</span>
        {folder && (
          <span className="hidden min-w-0 items-center gap-1 truncate font-mono text-[11px] text-[#8B857A] md:inline-flex">
            <FolderOpen className="h-3 w-3 flex-none" />{folder}
          </span>
        )}
      </div>

      <div className="flex flex-none items-center gap-3 font-mono text-[11px] text-[#8B857A]">
        <span className="hidden lg:inline">{words.toLocaleString('en-IN')} words</span>
        <span aria-live="polite"><SaveState status={status} onRetry={onRetrySave} /></span>
        {lastPublishedAt && (
          <span className="hidden text-[#2F8F5B] md:inline" title="This note has an entry on the stock's log">
            Published {formatDay(lastPublishedAt.slice(0, 10))}
          </span>
        )}
        <button type="button" onClick={onExport} title="Export as PDF (Save as PDF in the print dialog)"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7D0C2] bg-[#FBF7ED] px-2.5 py-1.5 text-[11.5px] text-[#1C1B17] hover:border-[#1C1B17]">
          <FileDown className="h-3.5 w-3.5" /><span className="hidden sm:inline">PDF</span>
        </button>
        <button type="button" onClick={onPublish}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C1B17] px-3 py-1.5 text-[11.5px] text-[#F7F2E6] hover:bg-[#33312B]">
          <Send className="h-3.5 w-3.5" />
          {lastPublishedAt ? 'Update log' : 'Publish to log'}
        </button>
      </div>
    </div>
  )
}
