import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileText, PanelLeftOpen, Plus } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { useCoverageBoard } from '@/hooks/commandCenter/useCoverage'
import {
  useBoardTree, useCreateBoard, useDeleteBoard, useFolderMutations, useMoveBoard,
} from '@/hooks/commandCenter/useBoards'
import { STARTER_DOC, starterTitle } from '@/lib/commandCenter/boardTypes'
import { relativeDays } from '@/lib/commandCenter/format'
import BoardTree, { type TreeActions } from './tree/BoardTree'
import StockBoardPicker from './StockBoardPicker'
import NoteWorkspace from './NoteWorkspace'
import './thinking.css'

type Confirm = { kind: 'note' | 'folder'; id: string; name: string } | null

const TREE_KEY = 'alphaboard-thinking-tree-collapsed'

/** A per-viewer layout preference; storage can be unavailable (private mode), which is fine. */
function readCollapsed(): boolean {
  try { return localStorage.getItem(TREE_KEY) === '1' } catch { return false }
}
function writeCollapsed(v: boolean) {
  try { localStorage.setItem(TREE_KEY, v ? '1' : '0') } catch { /* ignore */ }
}

/**
 * The Thinking Board: a research workspace per stock. Notes on the left, the page in
 * the middle, verified data on the right -- and a note publishes to the stock's log
 * when it is ready. The open note lives in the URL (?view=thinking&note=<id>).
 */
export default function ThinkingBoardView() {
  const [params, setParams] = useSearchParams()
  const noteId = params.get('note')
  // ?new=pick opens the stock picker on arrival (the Log sheet's link, with no stock chosen).
  const startFor = params.get('new')
  const isMobile = useIsMobile()
  const { data: tree, isPending: treePending, error: treeError } = useBoardTree()
  const { data: coverage = [] } = useCoverageBoard()
  const createBoard = useCreateBoard()
  const deleteBoard = useDeleteBoard()
  const moveBoard = useMoveBoard()
  const folderOps = useFolderMutations()
  const [pickerOpen, setPickerOpen] = useState(() => startFor === 'pick')
  const [treeOpen, setTreeOpen] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [treeCollapsed, setTreeCollapsed] = useState(readCollapsed)
  const setCollapsed = (v: boolean) => { setTreeCollapsed(v); writeCollapsed(v) }

  const folders = useMemo(() => tree?.folders ?? [], [tree])
  const boards = useMemo(() => tree?.boards ?? [], [tree])
  const covById = useMemo(() => new Map(coverage.map((c) => [c.id, c])), [coverage])
  const active = boards.find((b) => b.id === noteId)
  const activeFolder = active?.folder_id ? folders.find((f) => f.id === active.folder_id)?.name ?? null : null

  const openNote = useCallback((id: string | null) => {
    const p = new URLSearchParams(params)
    if (id) p.set('note', id); else p.delete('note')
    p.delete('new')
    setParams(p, { replace: true })
    setTreeOpen(false)
  }, [params, setParams])

  const newNote = useCallback(async (coverageId: string, folderId: string | null) => {
    const board = await createBoard.mutateAsync({
      coverage_id: coverageId, folder_id: folderId,
      title: starterTitle(covById.get(coverageId)?.ticker), doc: STARTER_DOC,
    }).catch(() => null)
    if (board) openNote(board.id)
  }, [covById, createBoard, openNote])

  const actions: TreeActions = {
    openNote,
    newNote: (c, f) => void newNote(c, f),
    newFolder: async (coverageId, parentId) => {
      const f = await folderOps.create.mutateAsync({ coverage_id: coverageId, parent_id: parentId, name: 'New folder' })
        .catch(() => null)
      return f?.id ?? null
    },
    renameFolder: (id, name) => folderOps.rename.mutate({ id, name }),
    deleteFolder: (id) => setConfirm({ kind: 'folder', id, name: folders.find((f) => f.id === id)?.name ?? 'this folder' }),
    deleteNote: (id) => setConfirm({ kind: 'note', id, name: boards.find((b) => b.id === id)?.title ?? 'this note' }),
    moveNote: (id, folderId) => moveBoard.mutate({ id, folder_id: folderId }),
    pickStock: () => { setTreeOpen(false); setPickerOpen(true) },
  }

  const runConfirm = async () => {
    if (!confirm) return
    if (confirm.kind === 'note') {
      await deleteBoard.mutateAsync(confirm.id).catch(() => undefined)
      if (confirm.id === noteId) openNote(null)
    } else {
      await folderOps.remove.mutateAsync(confirm.id).catch(() => undefined)
    }
    setConfirm(null)
  }

  const renderTree = (onCollapse?: () => void) => treeError ? (
    <p className="p-4 font-mono text-[11px] leading-relaxed text-[#B23B2A]">{(treeError as Error).message}</p>
  ) : treePending ? (
    <div className="flex flex-col gap-2 p-3">{[0, 1, 2, 3].map((i) => <div key={i} className="tb-shimmer h-7 rounded-md" />)}</div>
  ) : (
    <BoardTree folders={folders} boards={boards} coverage={coverage} activeId={noteId} actions={actions}
      onCollapse={onCollapse} />
  )

  return (
    <div className="-mx-3 -mb-4 flex h-[calc(100dvh-11.5rem)] min-h-[520px] overflow-hidden border-y border-[#DDD6C7] bg-[#F7F2E6] sm:-mx-5 sm:-mb-6 sm:rounded-xl sm:border lg:mx-0 lg:mb-0">
      {treeCollapsed ? (
        // Folded: a slim strip that keeps the two things you reach for -- reopen, new board.
        <aside className="hidden w-12 flex-none flex-col items-center gap-2 border-r border-[#DDD6C7] bg-[#F4F0E3] py-3 lg:flex">
          <button type="button" onClick={() => setCollapsed(false)} aria-label="Show notes panel" title="Show notes panel"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DDD6C7] text-[#3F3C35] hover:bg-[#EAE4D5]">
            <PanelLeftOpen className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setPickerOpen(true)} aria-label="New board" title="New board"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1C1B17] text-[#F7F2E6] hover:bg-[#33312B]">
            <Plus className="h-4 w-4" />
          </button>
        </aside>
      ) : (
        <aside className="hidden w-[256px] flex-none border-r border-[#DDD6C7] bg-[#F4F0E3] lg:flex lg:flex-col">
          {renderTree(() => setCollapsed(true))}
        </aside>
      )}

      {noteId ? (
        <NoteWorkspace boardId={noteId} coverage={active ? covById.get(active.coverage_id) : undefined}
          folderName={activeFolder} compact={isMobile} onOpenTree={() => setTreeOpen(true)} />
      ) : (
        <EmptyBoard recent={boards.slice(0, 5).map((b) => ({ ...b, ticker: covById.get(b.coverage_id)?.ticker ?? '' }))}
          onOpen={openNote} onNew={() => setPickerOpen(true)} onBrowse={() => setTreeOpen(true)} />
      )}

      <Sheet open={treeOpen} onOpenChange={setTreeOpen}>
        <SheetContent side="left" className="w-[300px] border-[#DDD6C7] bg-[#F4F0E3] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Research notes</SheetTitle>
            <SheetDescription>Your boards, folders and notes by stock</SheetDescription>
          </SheetHeader>
          {renderTree()}
        </SheetContent>
      </Sheet>

      <StockBoardPicker open={pickerOpen} onClose={() => { setPickerOpen(false); if (startFor) openNote(noteId) }}
        onPicked={(coverageId) => { setPickerOpen(false); void newNote(coverageId, null) }} />

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="border-[#D7D0C2] bg-[#F7F2E6] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono text-base text-[#1C1B17]">
              Delete {confirm?.kind === 'folder' ? 'folder' : 'note'}?
            </DialogTitle>
            <DialogDescription className="font-mono text-[11px] leading-relaxed text-[#6F6A60]">
              {confirm?.kind === 'folder'
                ? `“${confirm?.name}” and the folders inside it go. Notes inside move to the stock's top level.`
                : `“${confirm?.name}” is deleted for good. A log entry it was published as stays on the log.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>Keep it</Button>
            <Button size="sm" className="bg-[#B23B2A] hover:bg-[#962F20]" onClick={runConfirm}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptyBoard({ recent, onOpen, onNew, onBrowse }: {
  recent: Array<{ id: string; title: string; ticker: string; updated_at: string }>
  onOpen: (id: string) => void; onNew: () => void; onBrowse: () => void
}) {
  return (
    <div className="tb-canvas flex flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="tb-sheet w-full max-w-[560px] px-8 py-10 sm:px-12">
        <h2 className="tb-title !text-[1.7rem]">Write the report where the data is.</h2>
        <p className="mt-3 max-w-[46ch] font-mono text-[12px] leading-relaxed text-[#6F6A60]">
          Pick a stock, pull its financials, concalls and filings beside the page, write the thesis,
          and publish it straight to the stock’s log.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={onNew}><Plus className="h-4 w-4" /> New board</Button>
          {recent.length > 0 && <Button variant="outline" className="lg:hidden" onClick={onBrowse}>Your notes</Button>}
        </div>
        {recent.length > 0 && (
          <div className="mt-8 border-t border-[#E6E0D2] pt-4">
            <p className="mb-2 font-mono text-[10.5px] text-[#8B857A]">Pick up where you left off</p>
            {recent.map((r) => (
              <button key={r.id} type="button" onClick={() => onOpen(r.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[#EFE9DA]">
                <FileText className="h-3.5 w-3.5 flex-none text-[#8B857A]" />
                <span className="w-20 flex-none truncate font-mono text-[11px] font-medium text-[#1C1B17]">{r.ticker.replace(/\.(NS|BO)$/, '')}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[#3F3C35]">{r.title}</span>
                <span className="flex-none font-mono text-[10px] text-[#A39D90]">{relativeDays(r.updated_at.slice(0, 10))}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
