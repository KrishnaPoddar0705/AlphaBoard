import { useMemo, useState } from 'react'
import { FilePlus2, FolderPlus, PanelLeftClose, Plus, Search } from 'lucide-react'
import type { BoardFolder, BoardSummary } from '@/lib/commandCenter/boardTypes'
import type { CoverageBoardRow } from '@/lib/commandCenter/types'
import { FolderRow, NoteRow, type MenuItem } from './TreeRows'

export interface TreeActions {
  openNote: (id: string) => void
  newNote: (coverageId: string, folderId: string | null) => void
  newFolder: (coverageId: string, parentId: string | null) => Promise<string | null>
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void
  deleteNote: (id: string) => void
  moveNote: (id: string, folderId: string | null) => void
  pickStock: () => void
}

interface Props {
  folders: BoardFolder[]
  boards: BoardSummary[]
  coverage: CoverageBoardRow[]
  activeId: string | null
  actions: TreeActions
  /** Desktop only: folds the panel down to a slim strip. */
  onCollapse?: () => void
}

/**
 * Stocks at the root, then the analyst's own folders and notes under each. Only stocks
 * with something in them appear -- the whole coverage universe would bury the five
 * names someone is actually writing on. "New board" brings any other stock in.
 */
export default function BoardTree({ folders, boards, coverage, activeId, actions, onCollapse }: Props) {
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)

  const covById = useMemo(() => new Map(coverage.map((c) => [c.id, c])), [coverage])

  // Roots ordered by their most recently edited note: today's work sits on top.
  const roots = useMemo(() => {
    const latest = new Map<string, string>()
    for (const b of boards) if (!latest.has(b.coverage_id) || b.updated_at > latest.get(b.coverage_id)!) latest.set(b.coverage_id, b.updated_at)
    for (const f of folders) if (!latest.has(f.coverage_id)) latest.set(f.coverage_id, f.created_at)
    return [...latest.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([id]) => id)
  }, [boards, folders])

  const q = query.trim().toLowerCase()
  const noteMatches = (b: BoardSummary) => !q || b.title.toLowerCase().includes(q)
  const stockMatches = (id: string) => {
    const c = covById.get(id)
    return !q || !!c && (c.ticker.toLowerCase().includes(q) || (c.company_name ?? '').toLowerCase().includes(q))
  }

  const toggle = (key: string) => setCollapsed((s) => {
    const n = new Set(s)
    if (n.has(key)) n.delete(key); else n.add(key)
    return n
  })
  // While searching, everything opens so matches are visible.
  const isOpen = (key: string) => !!q || !collapsed.has(key)

  const moveTargets = (note: BoardSummary): MenuItem[] => [
    ...(note.folder_id ? [{ label: 'Move to stock root', onSelect: () => actions.moveNote(note.id, null) }] : []),
    ...folders.filter((f) => f.coverage_id === note.coverage_id && f.id !== note.folder_id)
      .map((f) => ({ label: `Move to ${f.name}`, onSelect: () => actions.moveNote(note.id, f.id) })),
  ]

  const renderNotes = (coverageId: string, folderId: string | null, depth: number, showAll: boolean) =>
    boards.filter((b) => b.coverage_id === coverageId && b.folder_id === folderId && (showAll || noteMatches(b)))
      .map((b) => (
        <NoteRow key={b.id} note={b} depth={depth} active={b.id === activeId} onOpen={() => actions.openNote(b.id)}
          menu={[...moveTargets(b), { label: 'Delete note', danger: true, onSelect: () => actions.deleteNote(b.id) }]} />
      ))

  const renderFolders = (coverageId: string, parentId: string | null, depth: number, showAll: boolean): React.ReactNode =>
    folders.filter((f) => f.coverage_id === coverageId && f.parent_id === parentId).map((f) => (
      <FolderRow key={f.id} name={f.name} depth={depth} open={isOpen(f.id)} onToggle={() => toggle(f.id)}
        renaming={renaming === f.id}
        onRenamed={(next) => { setRenaming(null); if (next) actions.renameFolder(f.id, next) }}
        menu={[
          { label: 'New note here', onSelect: () => actions.newNote(coverageId, f.id) },
          { label: 'New folder inside', onSelect: async () => {
            const id = await actions.newFolder(coverageId, f.id)
            if (id) setRenaming(id)
          } },
          { label: 'Rename', onSelect: () => setRenaming(f.id) },
          { label: 'Delete folder', danger: true, onSelect: () => actions.deleteFolder(f.id) },
        ]}>
        {renderFolders(coverageId, f.id, depth + 1, showAll)}
        {renderNotes(coverageId, f.id, depth + 1, showAll)}
      </FolderRow>
    ))

  const visibleRoots = roots.filter((id) => stockMatches(id) || boards.some((b) => b.coverage_id === id && noteMatches(b)))

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-[#DDD6C7] p-3">
        <div className="flex gap-2">
          <button type="button" onClick={actions.pickStock}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1C1B17] font-mono text-[11.5px] text-[#F7F2E6] hover:bg-[#33312B]">
            <Plus className="h-3.5 w-3.5" /> New board
          </button>
          {onCollapse && (
            <button type="button" onClick={onCollapse} aria-label="Hide notes panel" title="Hide notes panel"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-[#DDD6C7] text-[#6F6A60] hover:bg-[#EAE4D5] hover:text-[#1C1B17]">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        <label className="flex h-8 items-center gap-1.5 rounded-lg border border-[#DDD6C7] bg-[#FBF7ED] px-2">
          <Search className="h-3.5 w-3.5 flex-none text-[#8B857A]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a note or stock"
            className="min-w-0 flex-1 bg-transparent font-mono text-[11.5px] text-[#1C1B17] placeholder:text-[#A39D90] focus:outline-none" />
        </label>
      </div>

      <div role="tree" aria-label="Research notes" className="flex-1 overflow-y-auto p-2">
        {visibleRoots.length === 0 && (
          <p className="px-3 py-8 text-center font-mono text-[11px] leading-relaxed text-[#8B857A]">
            {q ? 'No notes match.' : 'Start a board for a stock you cover. Notes, folders and pulled data live under it.'}
          </p>
        )}
        {visibleRoots.map((id) => {
          const c = covById.get(id)
          const showAll = stockMatches(id)
          const key = `stock:${id}`
          return (
            <div key={id} className="mb-1">
              <div className="group flex h-9 items-center gap-1 rounded-md pr-1 hover:bg-[#EAE4D5]">
                <button type="button" onClick={() => toggle(key)} aria-expanded={isOpen(key)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2 text-left">
                  <span className="flex-none rounded bg-[#E3DDCF] px-1 py-[1px] font-mono text-[10px] font-medium text-[#1C1B17]">
                    {c?.ticker.replace(/\.(NS|BO)$/, '') ?? '—'}
                  </span>
                  <span className="min-w-0 truncate font-mono text-[11.5px] text-[#3F3C35]">{c?.company_name ?? 'Stock no longer covered'}</span>
                </button>
                <button type="button" title="New note" aria-label="New note" onClick={() => actions.newNote(id, null)}
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-[#8B857A] opacity-0 hover:bg-[#E6E0D2] hover:text-[#1C1B17] focus:opacity-100 group-hover:opacity-100">
                  <FilePlus2 className="h-3.5 w-3.5" />
                </button>
                <button type="button" title="New folder" aria-label="New folder"
                  onClick={async () => { const fid = await actions.newFolder(id, null); if (fid) setRenaming(fid) }}
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-[#8B857A] opacity-0 hover:bg-[#E6E0D2] hover:text-[#1C1B17] focus:opacity-100 group-hover:opacity-100">
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
              </div>
              {isOpen(key) && (
                <div role="group">
                  {renderFolders(id, null, 0, showAll)}
                  {renderNotes(id, null, 0, showAll)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
