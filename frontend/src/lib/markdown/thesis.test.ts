import { describe, expect, it } from 'vitest'
import { prepareThesis, remarkHardBreaks, stripMarkdown } from './thesis'

describe('prepareThesis', () => {
  // Each of these is a shape a real analyst has plausibly typed into a plain
  // textarea. The contract is that markdown must not eat any of it.
  const unchanged: Array<[string, string]> = [
    ['a hash not followed by a space', '#1 concern is margins'],
    ['whitespace-flanked asterisk', 'EBITDA * 3 = 90'],
    ['a currency amount times a factor', '$1,000 * 3 per unit'],
    ['intraword underscores', 'EV_EBITDA_multiple stays flat'],
    ['a less-than before a digit', 'Revenue <10% growth'],
    ['a windows path', 'Model at C:\\Users\\model.xlsx'],
    ['a single pipe row with no delimiter row', 'Cost | Revenue | FY24'],
  ]

  it.each(unchanged)('leaves %s alone', (_label, input) => {
    expect(prepareThesis(input)).toBe(input)
  })

  it('de-indents four leading spaces so they do not become a code block', () => {
    expect(prepareThesis('    indented note')).toBe('   indented note')
  })

  it('escapes tag-like text that react-markdown would otherwise discard', () => {
    expect(prepareThesis('Use <b>caution</b> here')).toBe('Use &lt;b>caution&lt;/b> here')
  })

  it('leaves tag-like text inside an inline-code span alone', () => {
    expect(prepareThesis('call `<Widget />` directly')).toBe('call `<Widget />` directly')
  })

  it('does not touch indentation inside a fenced block', () => {
    const src = '```\n    keep this indent\n```'
    expect(prepareThesis(src)).toBe(src)
  })

  it('preserves a markdown table verbatim', () => {
    const table = '| A | B |\n| --- | --- |\n| 1 | 2 |'
    expect(prepareThesis(table)).toBe(table)
  })

  it('normalises CRLF and tolerates null', () => {
    expect(prepareThesis('a\r\nb')).toBe('a\nb')
    expect(prepareThesis(null)).toBe('')
    expect(prepareThesis(undefined)).toBe('')
  })
})

describe('remarkHardBreaks', () => {
  // A minimal mdast shape; the plugin only cares about type/value/children.
  interface Node {
    type: string
    value?: string
    children?: Node[]
  }
  const run = (tree: Node): Node => {
    remarkHardBreaks()(tree)
    return tree
  }
  /** Children of the tree's first block, asserted present. */
  const kids = (tree: Node): Node[] => {
    const first = tree.children?.[0]
    expect(first).toBeDefined()
    return first!.children ?? []
  }
  /** The tree's first block. */
  const block = (tree: Node): Node => tree.children![0]

  it('splits a single newline into a hard break', () => {
    const tree = run({
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', value: 'one\ntwo' }] }],
    })
    expect(kids(tree)).toEqual([
      { type: 'text', value: 'one' },
      { type: 'break' },
      { type: 'text', value: 'two' },
    ])
  })

  it('leaves a code node untouched', () => {
    const tree = run({
      type: 'root',
      children: [{ type: 'code', value: 'line one\nline two' }],
    })
    expect(block(tree)).toEqual({ type: 'code', value: 'line one\nline two' })
  })

  it('does not descend into inline code', () => {
    const tree = run({
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'inlineCode', value: 'a\nb' }],
        },
      ],
    })
    expect(kids(tree)[0]).toEqual({ type: 'inlineCode', value: 'a\nb' })
  })

  it('trims the spaces around the break', () => {
    const tree = run({
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', value: 'one   \n   two' }] }],
    })
    expect(kids(tree)).toEqual([
      { type: 'text', value: 'one' },
      { type: 'break' },
      { type: 'text', value: 'two' },
    ])
  })

  it('is a no-op on text with no newline', () => {
    const tree = run({
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', value: 'flat' }] }],
    })
    expect(kids(tree)).toEqual([{ type: 'text', value: 'flat' }])
  })
})

describe('stripMarkdown', () => {
  it('flattens a table to its cell text', () => {
    const md = '| Metric | FY24 |\n| --- | --- |\n| Revenue | 1200 |'
    expect(stripMarkdown(md)).toBe('Metric FY24 Revenue 1200')
  })

  it('strips headings, emphasis, bullets and links', () => {
    const md = '# Key risks\n\n- **margin** pressure\n- see [the note](https://x.com/a)'
    expect(stripMarkdown(md)).toBe('Key risks margin pressure see the note')
  })

  it('strips blockquotes and code fences', () => {
    expect(stripMarkdown('> quoted line\n\n```\ncode here\n```')).toBe('quoted line')
  })

  it('unescapes backslash-escaped punctuation', () => {
    expect(stripMarkdown('a \\| b')).toBe('a | b')
  })

  it('truncates with an ellipsis at the requested length', () => {
    expect(stripMarkdown('the quick brown fox jumps', 10)).toBe('the quick…')
  })

  it('tolerates null and undefined', () => {
    expect(stripMarkdown(null)).toBe('')
    expect(stripMarkdown(undefined)).toBe('')
  })

  it('contains no lookbehind, which Safari below 16.4 fails to parse', () => {
    // A SyntaxError here would be thrown at module load, taking down every
    // consumer rather than just this function.
    expect(stripMarkdown.toString()).not.toContain('(?<')
  })
})
