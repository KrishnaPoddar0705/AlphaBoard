import type { DocNode, SourcePayload } from './boardTypes'
import { chartPlan, formatItemDate } from './boardFormat'
import { visiblePayload, type Trim } from './payloadToDoc'
import { markdownToDoc } from './markdownToDoc'

/**
 * A pulled dataset inside a note, as editor content.
 *
 *   sourceBlock            attrs: connector, source, fetched_at, source_url (the citation)
 *   ├─ heading (4)         the title           -- editable text
 *   ├─ paragraph (italic)  the subtitle        -- editable text
 *   ├─ sourceData          chart / table                -- locked (atom)
 *   ├─ paragraph + list    each analysis section -- editable text
 *   │  └─ analysisFold     "Full analysis" fold         -- editable text
 *   └─ bulletList          stories / filings, linked -- editable text
 *
 * The words are ordinary ProseMirror content, so bold, highlight, links and Cmd+Z behave
 * exactly as in the rest of the note. The numbers live in the atom and cannot be changed.
 */

const text = (t: string, marks?: DocNode['marks']): DocNode => ({ type: 'text', text: t, ...(marks?.length ? { marks } : {}) })
const para = (...content: DocNode[]): DocNode => ({ type: 'paragraph', ...(content.length ? { content } : {}) })

/** Data the atom needs: the table/chart only. Everything worded is editable text. */
function dataPayload(p: SourcePayload): SourcePayload {
  return { ...p, items: null, sections: null }
}

/** A section's long-form analysis as a closed, editable fold. */
export function analysisFold(markdown: string): DocNode | null {
  const content = markdownToDoc(markdown)
  return content.length ? { type: 'analysisFold', attrs: { title: 'Full analysis', open: false }, content } : null
}

export function payloadToSourceBlock(payload: SourcePayload, mode?: 'chart' | 'table', trim?: Trim): DocNode {
  const p = trim ? visiblePayload(payload, trim) : payload
  const content: DocNode[] = [{ type: 'heading', attrs: { level: 4 }, content: [text(p.title)] }]
  if (p.subtitle) content.push(para(text(p.subtitle, [{ type: 'italic' }])))

  const data = dataPayload(p)
  if (data.table || data.fallback_note) {
    content.push({
      type: 'sourceData',
      attrs: { payload: data, mode: mode ?? (chartPlan(data.table, data.chart) ? 'chart' : 'table') },
    })
  }

  for (const s of p.sections ?? []) {
    const fold = s.markdown ? analysisFold(s.markdown) : null
    if (!s.bullets.length && !fold) continue
    content.push(para(text(s.heading, [{ type: 'bold' }])))
    if (s.bullets.length) {
      content.push({ type: 'bulletList', content: s.bullets.map((b) => ({ type: 'listItem', content: [para(text(b))] })) })
    }
    if (fold) content.push(fold)
  }

  if (p.items?.length) {
    content.push({
      type: 'bulletList',
      content: p.items.map((it) => {
        const meta = [formatItemDate(it.date), it.tag].filter(Boolean).join(' / ')
        const line: DocNode[] = [text(it.title, it.url ? [{ type: 'link', attrs: { href: it.url } }] : undefined)]
        if (meta) line.push(text(`  ${meta}`, [{ type: 'italic' }]))
        if (it.summary) line.push(text(` — ${it.summary.replace(/\s+/g, ' ')}`))
        return { type: 'listItem', content: [para(...line)] }
      }),
    })
  }

  return {
    type: 'sourceBlock',
    attrs: { connector: p.connector, source: p.source, fetched_at: p.fetched_at, source_url: p.source_url },
    content,
  }
}

/**
 * Notes saved before source blocks held a single locked `connectorBlock`. Upgrade them on
 * open, carrying over hidden parts, reworded bullets and the chart/table choice, so the
 * analyst finds their text editable and nothing they did is lost.
 */
export function upgradeDoc(doc: DocNode): DocNode {
  const raw = JSON.stringify(doc)
  if (!raw.includes('"connectorBlock"') && !raw.includes('"markdown"')) return doc
  const walk = (node: DocNode): DocNode => {
    // Source blocks from before folds: their analysis sat locked inside sourceData.
    if (node.type === 'sourceBlock' && node.content?.some((c) => c.type === 'sourceData'
      && (c.attrs?.payload as SourcePayload | undefined)?.sections?.some((s) => s.markdown))) {
      return foldSourceData(node)
    }
    if (node.type === 'connectorBlock') {
      const payload = node.attrs?.payload as SourcePayload | null
      if (!payload) return para()
      return payloadToSourceBlock(payload, node.attrs?.mode === 'table' ? 'table' : 'chart', {
        hiddenSections: node.attrs?.hiddenSections as string[] | undefined,
        hiddenItems: node.attrs?.hiddenItems as number[] | undefined,
        edits: node.attrs?.edits as Record<string, string> | undefined,
      })
    }
    return node.content ? { ...node, content: node.content.map(walk) } : node
  }
  return walk(doc)
}

/** Moves each locked "Full analysis" out of sourceData into an editable fold under its section. */
function foldSourceData(block: DocNode): DocNode {
  const content = [...(block.content ?? [])]
  const dataIdx = content.findIndex((c) => c.type === 'sourceData')
  const data = content[dataIdx]
  const payload = data.attrs!.payload as SourcePayload
  content[dataIdx] = { ...data, attrs: { ...data.attrs, payload: { ...payload, sections: null } } }
  if (!payload.table && !payload.fallback_note) content.splice(dataIdx, 1)

  for (const s of payload.sections ?? []) {
    const fold = s.markdown ? analysisFold(s.markdown) : null
    if (!fold) continue
    // After the section's bold label and its bullets, if the analyst kept them.
    const label = content.findIndex((c) => c.type === 'paragraph' && c.content?.length === 1
      && c.content[0].text === s.heading && c.content[0].marks?.some((m) => m.type === 'bold'))
    if (label === -1) { content.push(para(text(s.heading, [{ type: 'bold' }])), fold); continue }
    const at = content[label + 1]?.type === 'bulletList' ? label + 2 : label + 1
    content.splice(at, 0, fold)
  }
  return { ...block, content }
}
