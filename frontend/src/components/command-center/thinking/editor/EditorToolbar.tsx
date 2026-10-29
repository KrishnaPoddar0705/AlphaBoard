import { useEditorState, type Editor } from '@tiptap/react'
import {
  Bold, Italic, Underline, Strikethrough, Highlighter, List, ListOrdered, ListChecks, Quote,
  Code2, Minus, Table, AlignLeft, AlignCenter, AlignRight, Undo2, Redo2, Rows3, Columns3, Trash2,
  type LucideIcon,
} from 'lucide-react'
import LinkControl from './LinkControl'

function Btn({ icon: Icon, label, active, onClick, disabled }: {
  icon: LucideIcon; label: string; active?: boolean; onClick: () => void; disabled?: boolean
}) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onClick} disabled={disabled}
      aria-label={label} title={label} aria-pressed={active}
      className={[
        'flex h-7 w-7 flex-none items-center justify-center rounded-md transition-colors disabled:opacity-30',
        active ? 'bg-[#1C1B17] text-[#F7F2E6]' : 'text-[#4A463E] hover:bg-[#EFE9DA]',
      ].join(' ')}>
      <Icon className="h-[15px] w-[15px]" strokeWidth={1.8} />
    </button>
  )
}

const Sep = () => <span className="mx-1 h-4 w-px flex-none bg-[#DDD6C7]" />

type Block = 'p' | 'h1' | 'h2' | 'h3'

/** The sticky row above the page: everything a research note needs, nothing it does not. */
export default function EditorToolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: (e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2'
        : e.isActive('heading', { level: 3 }) ? 'h3' : 'p') as Block,
      bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'),
      strike: e.isActive('strike'), highlight: e.isActive('highlight'),
      bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), task: e.isActive('taskList'),
      quote: e.isActive('blockquote'), code: e.isActive('codeBlock'), table: e.isActive('table'),
      left: e.isActive({ textAlign: 'left' }), center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }),
      canUndo: e.can().undo(), canRedo: e.can().redo(),
    }),
  })
  const c = () => editor.chain().focus()

  const setBlock = (b: Block) => {
    if (b === 'p') c().setParagraph().run()
    else c().setHeading({ level: Number(b[1]) as 1 | 2 | 3 }).run()
  }

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto px-2 py-1.5 [scrollbar-width:none]">
      <Btn icon={Undo2} label="Undo" onClick={() => c().undo().run()} disabled={!s.canUndo} />
      <Btn icon={Redo2} label="Redo" onClick={() => c().redo().run()} disabled={!s.canRedo} />
      <Sep />
      <select value={s.block} onChange={(e) => setBlock(e.target.value as Block)} aria-label="Text style"
        className="tb-data h-7 flex-none cursor-pointer rounded-md bg-transparent px-1.5 text-[11px] text-[#3F3C35] hover:bg-[#EFE9DA] focus:outline-none">
        <option value="p">Body</option>
        <option value="h1">Heading</option>
        <option value="h2">Subheading</option>
        <option value="h3">Small heading</option>
      </select>
      <Sep />
      <Btn icon={Bold} label="Bold" active={s.bold} onClick={() => c().toggleBold().run()} />
      <Btn icon={Italic} label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()} />
      <Btn icon={Underline} label="Underline" active={s.underline} onClick={() => c().toggleUnderline().run()} />
      <Btn icon={Strikethrough} label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()} />
      <Btn icon={Highlighter} label="Highlight" active={s.highlight} onClick={() => c().toggleHighlight().run()} />
      <LinkControl editor={editor} />
      <Sep />
      <Btn icon={List} label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()} />
      <Btn icon={ListOrdered} label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()} />
      <Btn icon={ListChecks} label="To-do list" active={s.task} onClick={() => c().toggleTaskList().run()} />
      <Btn icon={Quote} label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()} />
      <Btn icon={Code2} label="Code block" active={s.code} onClick={() => c().toggleCodeBlock().run()} />
      <Btn icon={Minus} label="Divider" onClick={() => c().setHorizontalRule().run()} />
      <Sep />
      <Btn icon={AlignLeft} label="Align left" active={s.left} onClick={() => c().setTextAlign('left').run()} />
      <Btn icon={AlignCenter} label="Align centre" active={s.center} onClick={() => c().setTextAlign('center').run()} />
      <Btn icon={AlignRight} label="Align right" active={s.right} onClick={() => c().setTextAlign('right').run()} />
      <Sep />
      <Btn icon={Table} label="Insert table" active={s.table}
        onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      {s.table && (
        <>
          <Btn icon={Rows3} label="Add row below" onClick={() => c().addRowAfter().run()} />
          <Btn icon={Columns3} label="Add column right" onClick={() => c().addColumnAfter().run()} />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteRow().run()}
            className="tb-data h-7 flex-none rounded-md px-1.5 text-[10.5px] text-[#4A463E] hover:bg-[#EFE9DA]">− row</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => c().deleteColumn().run()}
            className="tb-data h-7 flex-none rounded-md px-1.5 text-[10.5px] text-[#4A463E] hover:bg-[#EFE9DA]">− col</button>
          <Btn icon={Trash2} label="Delete table" onClick={() => c().deleteTable().run()} />
        </>
      )}
    </div>
  )
}
