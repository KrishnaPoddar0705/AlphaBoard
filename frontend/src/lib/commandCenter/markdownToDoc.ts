import type { DocNode } from './boardTypes'

/**
 * Markdown -> TipTap JSON for Drishti's long-form analysis, so it becomes ordinary,
 * editable note text. Covers what that analysis actually uses: headings, paragraphs,
 * nested bullet and numbered lists, GFM pipe tables, blockquotes, rules, and inline
 * bold / italic / code / links. Hand-written to stay dependency-free; anything else
 * falls through as a plain paragraph, so nothing is ever lost.
 */

type Marks = NonNullable<DocNode['marks']>

/** Inline markdown -> text nodes with marks. */
export function inlineToNodes(src: string, marks: Marks = []): DocNode[] {
  const out: DocNode[] = []
  // Longest-first alternation: **bold**, __bold__, *em*, _em_, `code`, [text](url)
  // No lookbehind: Safari before 16.4 fails to even parse it (see lib/markdown/thesis.ts).
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|\b_([^_\s][^_]*)_\b|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g
  let last = 0
  let m: RegExpExecArray | null
  const push = (t: string, mk: Marks) => { if (t) out.push({ type: 'text', text: t, ...(mk.length ? { marks: mk } : {}) }) }
  while ((m = re.exec(src))) {
    push(src.slice(last, m.index), marks)
    if (m[2] ?? m[3]) out.push(...inlineToNodes(m[2] ?? m[3], [...marks, { type: 'bold' }]))
    else if (m[4] ?? m[5]) out.push(...inlineToNodes(m[4] ?? m[5], [...marks, { type: 'italic' }]))
    else if (m[6]) push(m[6], [...marks, { type: 'code' }])
    else if (m[7]) out.push(...inlineToNodes(m[7], [...marks, { type: 'link', attrs: { href: m[8] } }]))
    last = m.index + m[0].length
  }
  push(src.slice(last), marks)
  return out
}

const para = (t: string): DocNode => {
  const content = inlineToNodes(t.trim())
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

function splitRow(line: string): string[] {
  // Escaped pipes are cell text: park them, split on the rest, then restore.
  const PIPE = '\u0000p\u0000'
  return line.trim().replace(/\\\|/g, PIPE).replace(/^\||\|$/g, '').split('|')
    .map((c) => c.trim().split(PIPE).join('|'))
}

function table(lines: string[]): DocNode {
  const [head, , ...body] = lines
  const cells = (row: string[], type: string) => row.map((c) => ({ type, content: [para(c)] }))
  const header = splitRow(head)
  return {
    type: 'table',
    content: [
      { type: 'tableRow', content: cells(header, 'tableHeader') },
      ...body.map((l) => {
        const r = splitRow(l)
        return { type: 'tableRow', content: cells(header.map((_, i) => r[i] ?? ''), 'tableCell') }
      }),
    ],
  }
}

interface Item { indent: number; ordered: boolean; text: string; children: string[] }

/** Lines of one list (any nesting) -> a bullet/ordered list node, recursing on indentation. */
function list(lines: string[]): DocNode {
  const base = (LIST_RE.exec(lines[0])?.[1] ?? '').length
  const items: Item[] = []
  for (const line of lines) {
    const m = LIST_RE.exec(line)
    if (m && m[1].length <= base) {
      items.push({ indent: m[1].length, ordered: /\d/.test(m[2]), text: m[3], children: [] })
    } else if (items.length) {
      items[items.length - 1].children.push(line)
    }
  }
  const ordered = items[0]?.ordered ?? false
  return {
    type: ordered ? 'orderedList' : 'bulletList',
    ...(ordered ? { attrs: { start: 1 } } : {}),
    content: items.map((it) => {
      const nested = it.children.filter((l) => l.trim())
      const content: DocNode[] = [para(it.text)]
      if (nested.length) {
        if (LIST_RE.test(nested[0])) content.push(list(nested))
        else content.push(...markdownToDoc(nested.map((l) => l.trim()).join('\n')))
      }
      return { type: 'listItem', content }
    }),
  }
}

export function markdownToDoc(md: string): DocNode[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const out: DocNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      // Inside a source block the title is h4; analysis headings sit below it.
      out.push({ type: 'paragraph', content: inlineToNodes(h[2].trim(), [{ type: 'bold' }]) })
      i++; continue
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push({ type: 'horizontalRule' }); i++; continue }

    if (line.includes('|') && TABLE_SEP.test(lines[i + 1] ?? '')) {
      const rows = [line, lines[i + 1]]
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(lines[i++])
      out.push(table(rows))
      continue
    }

    if (LIST_RE.test(line)) {
      const block: string[] = []
      // A list runs until a blank line followed by non-indented, non-list text.
      while (i < lines.length) {
        const l = lines[i]
        if (!l.trim()) {
          const next = lines[i + 1] ?? ''
          if (!next.trim() || (!LIST_RE.test(next) && !/^\s/.test(next))) break
          i++; continue
        }
        if (!LIST_RE.test(l) && !/^\s/.test(l) && block.length) break
        block.push(l); i++
      }
      out.push(list(block))
      continue
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''))
      out.push({ type: 'blockquote', content: markdownToDoc(quote.join('\n')) })
      continue
    }

    // Paragraph: consecutive non-blank lines that start nothing else.
    const parts: string[] = []
    while (i < lines.length && lines[i].trim() && !LIST_RE.test(lines[i]) && !/^#{1,6}\s/.test(lines[i])
      && !/^\s*>/.test(lines[i]) && !(lines[i].includes('|') && TABLE_SEP.test(lines[i + 1] ?? ''))) {
      parts.push(lines[i++].trim())
    }
    if (parts.length) out.push(para(parts.join(' ')))
    else i++
  }
  return out
}
