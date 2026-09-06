import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ThesisMarkdown from './ThesisMarkdown'

/**
 * Exercises the real pipeline -- prepareThesis, remark-gfm and remarkHardBreaks
 * together -- rather than the helpers in isolation. Every thesis in the
 * database today is plain text that used to render inside `whitespace-pre-wrap`,
 * so what matters is what these strings actually turn into.
 */
const render = (content: string) => renderToStaticMarkup(<ThesisMarkdown content={content} />)

/** The text a reader actually sees: tags removed, entities decoded. */
const text = (content: string) =>
  render(content)
    .replace(/<br\s*\/?>\n?/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')

describe('legacy plain-text theses', () => {
  it.each([
    ['a hash not followed by a space', '#1 concern is margins'],
    ['a whitespace-flanked asterisk', 'EBITDA * 3 = 90'],
    ['a currency amount times a factor', '$1,000 * 3 per unit'],
    ['intraword underscores', 'EV_EBITDA_multiple stays flat'],
    ['a less-than before a digit', 'Revenue <10% growth'],
    ['a pipe row with no delimiter row', 'Cost | Revenue | FY24'],
  ])('renders %s unchanged', (_label, input) => {
    expect(text(input)).toBe(input)
  })

  it('keeps a windows path readable', () => {
    // The backslashes are not escapable in CommonMark, so they survive.
    expect(text('Model at C:\\Users\\model.xlsx')).toContain('C:\\Users\\model.xlsx')
  })

  it('preserves single newlines as hard breaks, as pre-wrap did', () => {
    expect(render('line one\nline two')).toContain('<br/>')
    expect(text('line one\nline two')).toBe('line one\nline two')
  })

  it('keeps paragraphs separate', () => {
    const html = render('para one\n\npara two')
    expect(html.match(/<p\b/g)).toHaveLength(2)
    expect(html).not.toContain('<br')
  })

  it('does not swallow tag-like prose', () => {
    // Without prepareThesis escaping the "<", react-markdown drops the html
    // node and the word "caution" disappears entirely.
    expect(text('Use <b>caution</b> here')).toBe('Use <b>caution</b> here')
  })

  it('does not turn an indented note into a code block', () => {
    expect(render('    indented note')).not.toContain('<pre')
  })
})

describe('markdown features', () => {
  it('renders a GFM pipe table with a header row', () => {
    const html = render('| Metric | FY24 |\n| --- | --- |\n| Revenue | 1200 |')
    expect(html).toContain('<table')
    expect(html).toContain('<th')
    expect(html).toContain('Revenue')
    expect(html).toContain('1200')
  })

  it('lets a wide table scroll instead of widening the page', () => {
    expect(render('| A | B |\n| --- | --- |\n| 1 | 2 |')).toContain('overflow-x-auto')
  })

  it('renders an escaped pipe as literal text inside a cell', () => {
    const html = render('| A | B |\n| --- | --- |\n| x\\|y | z |')
    expect(html).toContain('x|y')
  })

  it('renders headings, bullets and bold', () => {
    const html = render('# Risks\n\n- **margin** pressure')
    expect(html).toContain('<h1')
    expect(html).toContain('<ul')
    expect(html).toContain('<strong')
  })

  it('opens autolinked URLs in a new tab safely', () => {
    const html = render('see https://example.com/a')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('target="_blank"')
  })

  it('emits no colours of its own, so each read site keeps its palette', () => {
    // Four of the read sites are on a dark theme and three on the paper theme.
    const html = render('# H\n\ntext\n\n| A | B |\n| --- | --- |\n| 1 | 2 |')
    expect(html).not.toMatch(/text-\[/)
    expect(html).not.toMatch(/#[0-9A-Fa-f]{6}/)
  })

  it('does not leak react-markdown\'s node prop into the markup', () => {
    // Spreading the component props straight onto a DOM element renders
    // node="[object Object]" and trips a React unknown-prop warning.
    const html = render('# H\n\ntext\n\n| A | B |\n| --- | --- |\n| 1 | 2 |')
    expect(html).not.toContain('node=')
  })

  it('renders nothing for empty or whitespace-only content', () => {
    expect(render('')).toBe('')
    expect(render('   \n  ')).toBe('')
  })
})
