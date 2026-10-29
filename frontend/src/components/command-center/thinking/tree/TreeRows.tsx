import { useState, type ReactNode } from 'react'
import { DropdownMenu } from 'radix-ui'
import { ChevronRight, FileText, Folder, FolderOpen, MoreHorizontal } from 'lucide-react'
import type { BoardSummary } from '@/lib/commandCenter/boardTypes'
import { relativeDays } from '@/lib/commandCenter/format'

export interface MenuItem { label: string; onSelect: () => void; danger?: boolean }

function RowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" aria-label={label} onClick={(e) => e.stopPropagation()}
          className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-[#8B857A] opacity-0 hover:bg-[#E6E0D2] hover:text-[#1C1B17] focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={4}
          className="tb-card z-50 min-w-[170px] p-1 font-mono text-[11.5px]">
          {items.map((it) => (
            <DropdownMenu.Item key={it.label} onSelect={it.onSelect}
              className={['cursor-pointer rounded-md px-2 py-1.5 outline-none data-[highlighted]:bg-[#EFE9DA]',
                it.danger ? 'text-[#B23B2A]' : 'text-[#1C1B17]'].join(' ')}>
              {it.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** Inline rename: Enter saves, Escape or blur with no change cancels. */
export function RenameField({ value, onDone }: { value: string; onDone: (next: string | null) => void }) {
  const [text, setText] = useState(value)
  const finish = () => onDone(text.trim() && text.trim() !== value ? text.trim() : null)
  return (
    <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={finish} maxLength={120}
      onKeyDown={(e) => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') onDone(null) }}
      onClick={(e) => e.stopPropagation()}
      className="h-6 min-w-0 flex-1 rounded border border-[#8B857A] bg-[#FFFDF7] px-1.5 font-mono text-[11.5px] focus:outline-none" />
  )
}

export function FolderRow({ name, depth, open, onToggle, menu, renaming, onRenamed, children }: {
  name: string; depth: number; open: boolean; onToggle: () => void; menu: MenuItem[]
  renaming: boolean; onRenamed: (next: string | null) => void; children?: ReactNode
}) {
  const Icon = open ? FolderOpen : Folder
  return (
    <div>
      <div role="treeitem" aria-expanded={open} tabIndex={0} onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
        style={{ paddingLeft: 8 + depth * 14 }}
        className="group flex h-8 cursor-pointer items-center gap-1.5 rounded-md pr-1 text-[#3F3C35] hover:bg-[#EAE4D5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B857A]">
        <ChevronRight className={['h-3 w-3 flex-none text-[#8B857A] transition-transform', open ? 'rotate-90' : ''].join(' ')} />
        <Icon className="h-3.5 w-3.5 flex-none text-[#8B857A]" />
        {renaming ? <RenameField value={name} onDone={onRenamed} />
          : <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">{name}</span>}
        <RowMenu items={menu} label={`Folder actions for ${name}`} />
      </div>
      {open && <div role="group">{children}</div>}
    </div>
  )
}

export function NoteRow({ note, depth, active, onOpen, menu }: {
  note: BoardSummary; depth: number; active: boolean; onOpen: () => void; menu: MenuItem[]
}) {
  return (
    <div role="treeitem" aria-selected={active} tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}
      style={{ paddingLeft: 8 + depth * 14 + 15 }}
      className={[
        'group flex h-8 cursor-pointer items-center gap-1.5 rounded-md pr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B857A]',
        active ? 'bg-[#1C1B17] text-[#F7F2E6]' : 'text-[#1C1B17] hover:bg-[#EAE4D5]',
      ].join(' ')}>
      <FileText className={['h-3.5 w-3.5 flex-none', active ? 'text-[#C9C1AF]' : 'text-[#8B857A]'].join(' ')} />
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">{note.title}</span>
      {note.published_event_id && (
        <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#2F8F5B]" title="Published to the log" />
      )}
      <span className={['flex-none font-mono text-[9.5px] group-hover:hidden', active ? 'text-[#C9C1AF]' : 'text-[#A39D90]'].join(' ')}>
        {relativeDays(note.updated_at.slice(0, 10))}
      </span>
      <span className="hidden group-hover:block"><RowMenu items={menu} label={`Actions for ${note.title}`} /></span>
    </div>
  )
}
