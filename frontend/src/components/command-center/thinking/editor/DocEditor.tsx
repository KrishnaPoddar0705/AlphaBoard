import { useEffect, useMemo, useRef } from 'react'
import { useEditor, useEditorState, EditorContent, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { Placeholder, CharacterCount } from '@tiptap/extensions'
import { Bold, Italic, Highlighter, Strikethrough } from 'lucide-react'
import type { ConnectorId, DocNode } from '@/lib/commandCenter/boardTypes'
import { SourceBlock, SourceData, AnalysisFold } from './SourceBlock'
import { SlashCommand, SLASH_PULL_EVENT, type SlashPullDetail } from './slashCommand'
import EditorToolbar from './EditorToolbar'
import LinkControl from './LinkControl'

interface Props {
  /** Read once, on mount. The parent remounts per note via `key`. */
  initialDoc: DocNode
  onChange: (doc: DocNode) => void
  onPull: (connector: ConnectorId, at: number) => void
  onReady: (editor: Editor | null) => void
  title: React.ReactNode
}

function BubbleBtn({ on, label, icon: Icon, run }: {
  on: boolean; label: string; icon: typeof Bold; run: () => void
}) {
  return (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={run} aria-label={label} title={label}
      className={['flex h-7 w-7 items-center justify-center rounded-md',
        on ? 'bg-[#F7F2E6] text-[#1C1B17]' : 'text-[#E9E3D3] hover:bg-white/10'].join(' ')}>
      <Icon className="h-[14px] w-[14px]" strokeWidth={2} />
    </button>
  )
}

function BubbleMarks({ editor }: { editor: Editor }) {
  const m = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'), italic: e.isActive('italic'),
      strike: e.isActive('strike'), highlight: e.isActive('highlight'),
    }),
  })
  const c = () => editor.chain().focus()
  return (
    <>
      <BubbleBtn on={m.bold} label="Bold" icon={Bold} run={() => c().toggleBold().run()} />
      <BubbleBtn on={m.italic} label="Italic" icon={Italic} run={() => c().toggleItalic().run()} />
      <BubbleBtn on={m.strike} label="Strikethrough" icon={Strikethrough} run={() => c().toggleStrike().run()} />
      <BubbleBtn on={m.highlight} label="Highlight" icon={Highlighter} run={() => c().toggleHighlight().run()} />
    </>
  )
}

export default function DocEditor({ initialDoc, onChange, onPull, onReady, title }: Props) {
  const changeRef = useRef(onChange)
  useEffect(() => { changeRef.current = onChange }, [onChange])

  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },   // 4: the title of a pulled source block
      link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
    }),
    TableKit.configure({ table: { resizable: true } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Placeholder.configure({
      placeholder: ({ node }) => node.type.name === 'heading'
        ? 'Heading'
        : 'Start the thesis, or type / to pull financials, concalls and filings',
    }),
    CharacterCount,
    SourceBlock,
    SourceData,
    AnalysisFold,
    SlashCommand,
  ], [])

  const editor = useEditor({
    extensions,
    content: initialDoc,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { class: 'tb-prose', spellcheck: 'true' } },
    onUpdate: ({ editor: e }) => changeRef.current(e.getJSON() as DocNode),
  })

  // Connector picks from the slash menu arrive as a DOM event (see slashCommand.ts).
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const handler = (e: Event) => {
      const { connector, at } = (e as CustomEvent<SlashPullDetail>).detail
      onPull(connector, at)
    }
    dom.addEventListener(SLASH_PULL_EVENT, handler)
    return () => dom.removeEventListener(SLASH_PULL_EVENT, handler)
  }, [editor, onPull])

  useEffect(() => {
    onReady(editor)
    return () => onReady(null)
  }, [editor, onReady])

  if (!editor) return null

  return (
    <div className="flex flex-col">
      <div className="tb-no-print sticky top-0 z-10 rounded-t-[14px] border-b border-[#E6E0D2] bg-[#FBF7ED]/95 backdrop-blur">
        <EditorToolbar editor={editor} />
      </div>

      <div className="px-5 pb-24 pt-8 sm:px-12 sm:pt-12 lg:px-16">
        {title}
        <EditorContent editor={editor} className="mt-6" />
      </div>

      <BubbleMenu editor={editor}
        shouldShow={({ editor: e, state }) => !state.selection.empty && !e.isActive('sourceData') && !e.isActive('codeBlock')}
        className="flex items-center gap-0.5 rounded-lg bg-[#1C1B17] p-1 shadow-xl">
        <BubbleMarks editor={editor} />
        <span className="[&_button]:text-[#E9E3D3]"><LinkControl editor={editor} compact /></span>
      </BubbleMenu>
    </div>
  )
}
