import type { DocNode, SourcePayload } from './boardTypes'
import { visiblePayload } from './payloadToDoc'
import { formatCell, recentColumns, formatItemDate, sourceLine, chartPlan, chartMarker, foldMarkers } from './boardFormat'

/**
 * TipTap JSON -> GitHub-flavoured markdown, for publishing a Thinking Board note into
 * cc_events.kta. The log, drawer and timeline already render kta with react-markdown +
 * remark-gfm, so this is what makes a published board look right everywhere without
 * touching those views.
 *
 * Hand-written rather than a markdown extension: the node set is small and fixed, and
 * connector blocks need a custom rendering (a chart becomes its underlying table).
 * Marks with no markdown form (underline, highlight) are dropped, keeping the text.
 */

const MAX_MD_PERIODS = 8

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n+/g, ' ')
}

/** Wraps in a markdown marker, keeping edge spaces outside it -- `** x**` does not parse. */
function wrap(t: string, m: string): string {
  const lead = t.match(/^\s*/)![0]
  const trail = t.slice(lead.length).match(/\s*$/)![0]
  const core = t.slice(lead.length, t.length - trail.length)
  return core ? `${lead}${m}${core}${m}${trail}` : t
}

function inline(nodes: DocNode[] | undefined): string {
  if (!nodes) return ''
  return nodes.map((n) => {
    if (n.type === 'hardBreak') return '  \n'
    if (n.type !== 'text') return ''
    let t = n.text ?? ''
    const marks = n.marks ?? []
    const has = (m: string) => marks.some((x) => x.type === m)
    if (has('code')) return '`' + t + '`'
    // Highlight is innermost so it always sits in one text node for the log's parser.
    if (has('highlight')) t = wrap(t, '==')
    if (has('bold')) t = wrap(t, '**')
    if (has('italic')) t = wrap(t, '_')
    if (has('strike')) t = wrap(t, '~~')
    const link = marks.find((x) => x.type === 'link')
    if (link?.attrs?.href) t = `[${t}](${String(link.attrs.href)})`
    return t
  }).join('')
}

function indent(text: string, pad: string): string {
  return text.split('\n').map((l, i) => (i === 0 || !l ? l : pad + l)).join('\n')
}

function listItems(node: DocNode, marker: (i: number) => string): string {
  return (node.content ?? []).map((item, i) => {
    let m = marker(i)
    if (item.type === 'taskItem') m = `- [${item.attrs?.checked ? 'x' : ' '}] `
    const body = (item.content ?? []).map((c) => block(c)).filter(Boolean).join('\n')
    return m + indent(body, ' '.repeat(m.length))
  }).join('\n')
}

function gfmTable(header: string[], rows: string[][]): string {
  const head = `| ${header.map(escapeCell).join(' | ')} |`
  const sep = `| ${header.map((_, i) => (i === 0 ? '---' : '---:')).join(' | ')} |`
  const body = rows.map((r) => `| ${r.map(escapeCell).join(' | ')} |`)
  return [head, sep, ...body].join('\n')
}

function editorTable(node: DocNode): string {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) =>
      (cell.content ?? []).map((p) => inline(p.content)).join(' ').trim()))
  if (!rows.length) return ''
  const [header, ...body] = rows
  const width = Math.max(...rows.map((r) => r.length))
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')]
  return gfmTable(pad(header), body.map(pad))
}

export function connectorToMarkdown(p: SourcePayload, mode: 'chart' | 'table' = 'chart'): string {
  const out: string[] = [`#### ${p.title}`]
  if (p.subtitle) out.push(`_${p.subtitle}_`)
  // Only for blocks the analyst left as charts; a block toggled to table stays a table.
  const plan = mode !== 'table' ? chartPlan(p.table, p.chart) : null
  if (plan) out.push(chartMarker(plan))
  if (p.table) {
    const t = recentColumns(p.table, MAX_MD_PERIODS)
    out.push(gfmTable(t.columns, t.rows.map((r) => r.map((c, i) => (i === 0 ? String(c ?? '') : formatCell(c))))))
  }
  // Bullets only: the long-form analysis behind them stays on the board, where it is
  // folded away -- pasted whole it would bury the analyst's own writing in the log.
  for (const s of (p.sections ?? []).filter((x) => x.bullets.length)) {
    out.push(`**${s.heading}**\n` + s.bullets.map((b) => `- ${b}`).join('\n'))
  }
  if (p.items?.length) {
    out.push(p.items.map((it) => {
      const title = it.url ? `[${it.title}](${it.url})` : it.title
      const meta = [formatItemDate(it.date), it.tag].filter(Boolean).join(' · ')
      return `- ${title}${meta ? ` — ${meta}` : ''}${it.summary ? `: ${it.summary.replace(/\n+/g, ' ')}` : ''}`
    }).join('\n'))
  }
  const src = p.source_url ? `[${sourceLine(p)}](${p.source_url})` : sourceLine(p)
  out.push(`_Source: ${src}_`)
  return out.join('\n\n')
}

function block(node: DocNode): string {
  switch (node.type) {
    case 'paragraph': return inline(node.content)
    case 'heading': return `${'#'.repeat(Number(node.attrs?.level ?? 2))} ${inline(node.content)}`
    case 'blockquote':
      return (node.content ?? []).map(block).join('\n\n').split('\n').map((l) => `> ${l}`).join('\n')
    case 'codeBlock':
      return '```' + String(node.attrs?.language ?? '') + '\n' + (node.content ?? []).map((t) => t.text ?? '').join('') + '\n```'
    case 'horizontalRule': return '---'
    case 'bulletList': return listItems(node, () => '- ')
    case 'taskList': return listItems(node, () => '- [ ] ')
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1)
      return listItems(node, (i) => `${start + i}. `)
    }
    case 'table': return editorTable(node)
    case 'sourceBlock': {
      // The analyst's edited text, then the citation the block was pulled with.
      const body = (node.content ?? []).map(block).filter((b) => b.trim() !== '').join('\n\n')
      const a = node.attrs ?? {}
      if (!a.source) return body
      const src = sourceLine({ source: a.source, fetched_at: a.fetched_at } as SourcePayload)
      return `${body}\n\n_Source: ${a.source_url ? `[${src}](${String(a.source_url)})` : src}_`
    }
    case 'analysisFold': {
      // A dropdown in the log; renderers that do not know the markers show the text plainly.
      const body = (node.content ?? []).map(block).filter((b) => b.trim() !== '').join('\n\n')
      if (!body) return ''
      const { start, end } = foldMarkers(String(node.attrs?.title ?? 'Full analysis'))
      return `${start}\n\n${body}\n\n${end}`
    }
    case 'sourceData': {
      const payload = node.attrs?.payload as SourcePayload | undefined
      if (!payload?.table) return ''
      const out: string[] = []
      const plan = node.attrs?.mode !== 'table' ? chartPlan(payload.table, payload.chart) : null
      if (plan) out.push(chartMarker(plan))
      const t = recentColumns(payload.table, MAX_MD_PERIODS)
      out.push(gfmTable(t.columns, t.rows.map((r) => r.map((c, i) => (i === 0 ? String(c ?? '') : formatCell(c))))))
      return out.join('\n\n')
    }
    case 'connectorBlock': {
      const payload = node.attrs?.payload as SourcePayload | undefined
      if (!payload) return ''
      // Publish what the analyst kept, in their wording: hidden parts stay out of the log.
      const trimmed = visiblePayload(payload, {
        hiddenSections: node.attrs?.hiddenSections as string[] | undefined,
        hiddenItems: node.attrs?.hiddenItems as number[] | undefined,
        edits: node.attrs?.edits as Record<string, string> | undefined,
      })
      return connectorToMarkdown(trimmed, node.attrs?.mode === 'table' ? 'table' : 'chart')
    }
    default: return (node.content ?? []).map(block).join('\n\n')
  }
}

export function docToMarkdown(doc: DocNode): string {
  return (doc.content ?? [])
    .map(block)
    .filter((b) => b.trim() !== '')
    .join('\n\n')
    .trim()
}

/** Plain word count for the header; connector blocks count as zero words of writing. */
export function countWords(doc: DocNode): number {
  let n = 0
  const walk = (node: DocNode) => {
    // Pulled material is not the analyst's writing, even once edited.
    if (node.type === 'connectorBlock' || node.type === 'sourceBlock') return
    if (node.type === 'text' && node.text) n += node.text.split(/\s+/).filter(Boolean).length
    node.content?.forEach(walk)
  }
  walk(doc)
  return n
}
