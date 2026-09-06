/**
 * Makes the investment thesis safe to render as markdown.
 *
 * Every thesis written before this feature is plain text that was displayed
 * with `whitespace-pre-wrap`. Handing that straight to a markdown renderer
 * changes how some of it looks, so this module does two jobs: restore the line
 * breaks markdown would otherwise swallow, and neutralise the two constructs
 * that would actually lose content.
 */

interface MdNode {
  type: string
  value?: string
  children?: MdNode[]
}

/** Node types whose text is literal and must not be reflowed. */
const LITERAL_NODES = new Set(['code', 'inlineCode', 'html', 'yaml', 'toml'])

/**
 * remark plugin: a single newline becomes a hard break, as it did under
 * `whitespace-pre-wrap`. This is what `remark-breaks` does; it is reimplemented
 * here because adding a dependency for twenty lines is not worth it, and
 * because importing `unist-util-visit` directly would be reaching into a
 * transitive dependency of react-markdown.
 *
 * Working on the AST rather than the source string is what makes it safe:
 * fenced code arrives as a `code` node and table cells cannot contain a literal
 * newline, so neither can be corrupted here.
 */
export function remarkHardBreaks() {
  const splitBreaks = (node: MdNode): void => {
    if (!node.children) return

    const out: MdNode[] = []
    for (const child of node.children) {
      if (child.type === 'text' && typeof child.value === 'string' && /\r|\n/.test(child.value)) {
        const parts = child.value.split(/[\t ]*(?:\r\n|\r|\n)[\t ]*/)
        parts.forEach((part, i) => {
          if (i > 0) out.push({ type: 'break' })
          if (part !== '') out.push({ type: 'text', value: part })
        })
        continue
      }
      if (!LITERAL_NODES.has(child.type)) splitBreaks(child)
      out.push(child)
    }
    node.children = out
  }

  return (tree: MdNode) => {
    splitBreaks(tree)
  }
}

const FENCE = /^ {0,3}(```+|~~~+)/

/**
 * Neutralises the two markdown constructs that would silently destroy legacy
 * plain-text content:
 *
 *  - Four or more leading spaces become an indented code block, so an indented
 *    note would render in a monospace box.
 *  - react-markdown discards raw HTML nodes (rehype-raw is not installed), so
 *    a thesis containing "use <b>caution</b>" would lose the word entirely.
 *
 * Everything else markdown reinterprets is either impossible (`#1` needs a
 * space after the hash; `EBITDA * 3` cannot open emphasis because the asterisk
 * is whitespace-flanked; `EV_EBITDA` cannot because intraword underscores do
 * not emphasise) or a harmless improvement.
 */
export function prepareThesis(raw: string | null | undefined): string {
  const lines = (raw ?? '').replace(/\r\n?/g, '\n').split('\n')
  let inFence = false

  return lines
    .map((line) => {
      if (FENCE.test(line)) {
        inFence = !inFence
        return line
      }
      if (inFence) return line

      let out = line.replace(/^ {4,}/, '   ')
      // Split on inline-code spans and leave those (odd indices) untouched.
      out = out
        .split(/(`+[^`]*`+)/)
        .map((seg, i) => (i % 2 === 1 ? seg : seg.replace(/<(?=[/!?a-zA-Z])/g, '&lt;')))
        .join('')
      return out
    })
    .join('\n')
}

/**
 * Flattens markdown to a single line of plain text, for the places that show a
 * truncated preview. Those use `truncate` and `line-clamp`, which do nothing to
 * a container full of block elements, so they must not use the renderer.
 *
 * No lookbehind assertions: Safari before 16.4 throws a SyntaxError while
 * *parsing* them, which would take down this whole module on load rather than
 * just this function.
 */
export function stripMarkdown(raw: string | null | undefined, maxLen = 0): string {
  let t = (raw ?? '').replace(/\r\n?/g, '\n')

  t = t.replace(/^```[\s\S]*?^```/gm, ' ').replace(/`+([^`]*)`+/g, '$1')
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  t = t.replace(/^ {0,3}#{1,6}\s+/gm, '')
  t = t.replace(/^ {0,3}>\s?/gm, '')
  t = t.replace(/^ {0,3}([-*+]|\d+[.)])\s+/gm, '')
  t = t.replace(/^ {0,3}([-*_])(\s*\1){2,}\s*$/gm, ' ')

  // An escaped pipe is literal cell content -- our own table converter emits it
  // for a cell containing "|". Park it before the unescaped pipes, which are
  // table delimiters, get flattened to spaces.
  const PIPE = '\u0000p\u0000'
  t = t.replace(/\\\|/g, PIPE)
  t = t.replace(/^\s*\|?[\s:|-]*\|[\s:|-]*$/gm, ' ')
  t = t.replace(/\|/g, ' ')

  t = t.replace(/(\*\*|__)(.+?)\1/g, '$2').replace(/(\*|_)([^*_\n]+?)\1/g, '$2')
  t = t.replace(/~~(.+?)~~/g, '$1')
  t = t.replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1')
  t = t.split(PIPE).join('|')
  t = t.replace(/\s+/g, ' ').trim()

  if (maxLen > 0 && t.length > maxLen) return `${t.slice(0, maxLen - 1).trimEnd()}…`
  return t
}
