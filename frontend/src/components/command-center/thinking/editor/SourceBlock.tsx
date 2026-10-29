import {
  Node, mergeAttributes, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps,
} from '@tiptap/react'
import { BarChart3, ChevronRight, Table2, Trash2 } from 'lucide-react'
import type { ConnectorId, SourceId, SourcePayload } from '@/lib/commandCenter/boardTypes'
import { CONNECTOR_BY_ID } from '@/lib/commandCenter/boardSources'
import { chartPlan } from '@/lib/commandCenter/boardFormat'
import { payloadToSourceBlock } from '@/lib/commandCenter/sourceBlock'
import SourceView, { type SourceMode } from '../connectors/SourceView'
import SourceBadge from '../connectors/SourceBadge'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sourceBlock: {
      insertConnectorBlock: (payload: SourcePayload, at?: number) => ReturnType
    }
  }
}

/**
 * The frame around a pulled dataset: a locked header (what it is, where it came from,
 * remove) around ordinary note content. Everything inside except `sourceData` is plain
 * editor text -- bold it, highlight it, delete a bullet, undo with Cmd+Z.
 */
function SourceBlockView({ node, deleteNode, selected }: ReactNodeViewProps) {
  const connector = node.attrs.connector as ConnectorId
  const def = CONNECTOR_BY_ID[connector]
  const Icon = def?.icon
  const badge = {
    source: node.attrs.source as SourceId, fetched_at: node.attrs.fetched_at as string,
  } as SourcePayload
  return (
    <NodeViewWrapper
      className={['tb-source my-6 rounded-xl border bg-[#FFFDF7] [--tb-pin-bg:#FFFDF7]',
        selected ? 'border-[#2C4F7C]' : 'border-[#DDD6C7]'].join(' ')}
    >
      <div contentEditable={false}
        className="flex select-none items-center justify-between gap-2 border-b border-[#ECE6D6] px-4 py-2">
        <span className="tb-data flex items-center gap-1.5 text-[10.5px] text-[#8B857A]">
          {Icon && <Icon className="h-3.5 w-3.5" />}{def?.label ?? 'Data'}
        </span>
        <span className="flex items-center gap-1">
          {node.attrs.source && <SourceBadge payload={badge} />}
          <button type="button" onClick={deleteNode}
            className="rounded-md p-1 text-[#8B857A] hover:bg-[#EFE9DA] hover:text-[#B23B2A]"
            aria-label="Remove from note" title="Remove from note">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
      <NodeViewContent className="tb-source-body px-4 pb-2 pt-1" />
    </NodeViewWrapper>
  )
}

/** The locked part: chart or table (toggle only) and the folded full analysis. */
function SourceDataView({ node, updateAttributes }: ReactNodeViewProps) {
  const payload = node.attrs.payload as SourcePayload | null
  if (!payload) return <NodeViewWrapper />
  const mode = (node.attrs.mode as SourceMode) ?? 'chart'
  const canChart = !!chartPlan(payload.table, payload.chart)
  return (
    <NodeViewWrapper contentEditable={false} className="relative my-3">
      {canChart && (
        <button type="button" onClick={() => updateAttributes({ mode: mode === 'chart' ? 'table' : 'chart' })}
          className="absolute right-0 top-0 z-[2] rounded-md p-1 text-[#8B857A] hover:bg-[#EFE9DA] hover:text-[#1C1B17]"
          aria-label={mode === 'chart' ? 'Show as table' : 'Show as chart'}
          title={mode === 'chart' ? 'Show as table' : 'Show as chart'}>
          {mode === 'chart' ? <Table2 className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
        </button>
      )}
      <SourceView payload={{ ...payload, source_url: null }} mode={canChart ? mode : 'table'} />
    </NodeViewWrapper>
  )
}

/**
 * "Full analysis": Drishti's long-form write-up as a fold of ordinary note text -- select,
 * bold, highlight, edit, undo. Open/closed is saved with the note and travels to the log.
 */
function AnalysisFoldView({ node, updateAttributes }: ReactNodeViewProps) {
  const open = !!node.attrs.open
  return (
    <NodeViewWrapper className="tb-fold my-1.5">
      <button type="button" contentEditable={false} onClick={() => updateAttributes({ open: !open })}
        aria-expanded={open}
        className="tb-data flex select-none items-center gap-1 text-[10.5px] text-[#2C4F7C] hover:underline">
        <ChevronRight className={['h-3 w-3 transition-transform', open ? 'rotate-90' : ''].join(' ')} />
        {node.attrs.title || 'Full analysis'}
      </button>
      <NodeViewContent
        className={['tb-fold-body mt-1.5 rounded-lg border border-[#ECE6D6] bg-[#FBF7ED] px-3 py-2',
          open ? '' : 'hidden'].join(' ')} />
    </NodeViewWrapper>
  )
}

const TEXT_BLOCKS = 'paragraph | heading | bulletList | orderedList | taskList | blockquote | horizontalRule | table | analysisFold'

export const SourceBlock = Node.create({
  name: 'sourceBlock',
  group: 'block',
  content: `(${TEXT_BLOCKS} | sourceData)+`,
  // Keeps Backspace/Enter at its edges from merging its text into the note around it.
  isolating: true,
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      connector: { default: null, rendered: false },
      source: { default: null, rendered: false },
      fetched_at: { default: null, rendered: false },
      source_url: { default: null, rendered: false },
    }
  },
  parseHTML() { return [{ tag: 'section[data-source-block]' }] },
  renderHTML({ HTMLAttributes }) { return ['section', mergeAttributes(HTMLAttributes, { 'data-source-block': '' }), 0] },
  addNodeView() { return ReactNodeViewRenderer(SourceBlockView) },

  addCommands() {
    return {
      insertConnectorBlock: (payload, at) => ({ chain }) => {
        const content = [payloadToSourceBlock(payload), { type: 'paragraph' }]
        return at === undefined
          ? chain().insertContent(content).run()
          : chain().insertContentAt(at, content).run()
      },
    }
  },
})

export const SourceData = Node.create({
  name: 'sourceData',
  group: 'sourceData',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      payload: { default: null, rendered: false },
      mode: { default: 'chart', rendered: false },
    }
  },
  parseHTML() { return [{ tag: 'div[data-source-data]' }] },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-source-data': '' })] },
  addNodeView() { return ReactNodeViewRenderer(SourceDataView) },
})

export const AnalysisFold = Node.create({
  name: 'analysisFold',
  group: 'block',
  content: '(paragraph | heading | bulletList | orderedList | blockquote | horizontalRule | table)+',
  isolating: true,
  defining: true,
  addAttributes() {
    return {
      title: { default: 'Full analysis', rendered: false },
      open: { default: false, rendered: false },
    }
  },
  parseHTML() { return [{ tag: 'div[data-analysis-fold]' }] },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-analysis-fold': '' }), 0] },
  addNodeView() { return ReactNodeViewRenderer(AnalysisFoldView) },
})
