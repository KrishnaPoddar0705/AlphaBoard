import { Extension, ReactRenderer, type Editor, type Range } from '@tiptap/react'
import SlashList, { type ListHandle, type ListProps } from './SlashList'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import {
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, Quote, Table, Minus, Code2, Pilcrow,
  type LucideIcon,
} from 'lucide-react'
import type { ConnectorId } from '@/lib/commandCenter/boardTypes'
import { CONNECTORS } from '@/lib/commandCenter/boardSources'

export interface SlashItem {
  title: string
  hint: string
  icon: LucideIcon
  group: 'Write' | 'Pull data'
  run: (editor: Editor, range: Range) => void
}

const WRITE_ITEMS: SlashItem[] = [
  { title: 'Text', hint: 'Plain paragraph', icon: Pilcrow, group: 'Write',
    run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
  { title: 'Heading', hint: 'Section title', icon: Heading1, group: 'Write',
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
  { title: 'Subheading', hint: 'Smaller section title', icon: Heading2, group: 'Write',
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
  { title: 'Small heading', hint: 'For a point inside a section', icon: Heading3, group: 'Write',
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
  { title: 'Bulleted list', hint: 'Unordered points', icon: List, group: 'Write',
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: 'Numbered list', hint: 'Ordered points', icon: ListOrdered, group: 'Write',
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: 'To-do list', hint: 'Open questions, follow-ups', icon: ListChecks, group: 'Write',
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { title: 'Quote', hint: 'Management said...', icon: Quote, group: 'Write',
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: 'Table', hint: '3 x 3 grid with a header row', icon: Table, group: 'Write',
    run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: 'Divider', hint: 'Horizontal rule', icon: Minus, group: 'Write',
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
  { title: 'Code', hint: 'Monospace block', icon: Code2, group: 'Write',
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
]

/**
 * Fired on the editor's DOM node when a connector is picked from the slash menu. An
 * event rather than a callback option: the extension is built once per editor, but the
 * handler (which knows the note's stock and quarter) changes as the note does.
 */
export const SLASH_PULL_EVENT = 'tb-slash-pull'
export interface SlashPullDetail { connector: ConnectorId; at: number }

export const SLASH_ITEMS: SlashItem[] = [
  ...WRITE_ITEMS,
  ...CONNECTORS.map<SlashItem>((c) => ({
    title: c.label, hint: c.hint, icon: c.icon, group: 'Pull data',
    run: (e, r) => {
      e.chain().focus().deleteRange(r).run()
      e.view.dom.dispatchEvent(new CustomEvent<SlashPullDetail>(SLASH_PULL_EVENT, {
        detail: { connector: c.id, at: r.from },
      }))
    },
  })),
]


function place(el: HTMLElement, rect: DOMRect | null | undefined) {
  if (!rect) return
  const below = rect.bottom + 8
  const flip = below + 340 > window.innerHeight && rect.top > 360
  el.style.left = `${Math.min(rect.left, window.innerWidth - 300)}px`
  el.style.top = flip ? `${rect.top - 8 - Math.min(340, el.offsetHeight || 340)}px` : `${below}px`
}

export const SlashCommand = Extension.create<{ items: SlashItem[] }>({
  name: 'slashCommand',
  addOptions() {
    return { items: SLASH_ITEMS }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        items: ({ query }) => {
          const q = query.toLowerCase()
          return this.options.items.filter((i) =>
            i.title.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q))
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let renderer: ReactRenderer<ListHandle, ListProps> | null = null
          const host = document.createElement('div')
          host.style.position = 'fixed'
          host.style.zIndex = '60'
          return {
            onStart: (props: SuggestionProps<SlashItem>) => {
              renderer = new ReactRenderer(SlashList, { props, editor: props.editor })
              host.appendChild(renderer.element)
              document.body.appendChild(host)
              place(host, props.clientRect?.())
            },
            onUpdate: (props: SuggestionProps<SlashItem>) => {
              renderer?.updateProps(props)
              place(host, props.clientRect?.())
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') { host.remove(); return true }
              return renderer?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => {
              renderer?.destroy()
              host.remove()
            },
          }
        },
      }),
    ]
  },
})
