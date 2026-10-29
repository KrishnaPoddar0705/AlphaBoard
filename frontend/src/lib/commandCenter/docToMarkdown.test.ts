import { describe, expect, it } from 'vitest'
import { docToMarkdown, countWords } from './docToMarkdown'
import { splitChartMarkers } from './boardFormat'
import { stripMarkdown } from '@/lib/markdown/thesis'
import type { DocNode, SourcePayload } from './boardTypes'

const p = (text: string, marks?: DocNode['marks']): DocNode =>
  ({ type: 'paragraph', content: [{ type: 'text', text, marks }] })

describe('docToMarkdown', () => {
  it('renders headings, marks and links', () => {
    const md = docToMarkdown({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Thesis' }] },
      { type: 'paragraph', content: [
        { type: 'text', text: 'Margins ' },
        { type: 'text', text: 'expand', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' per ' },
        { type: 'text', text: 'mgmt', marks: [{ type: 'link', attrs: { href: 'https://x.in' } }] },
      ] },
    ] })
    expect(md).toBe('## Thesis\n\nMargins **expand** per [mgmt](https://x.in)')
  })

  it('renders nested, ordered and task lists', () => {
    const md = docToMarkdown({ type: 'doc', content: [
      { type: 'orderedList', attrs: { start: 1 }, content: [
        { type: 'listItem', content: [p('One'), { type: 'bulletList', content: [
          { type: 'listItem', content: [p('Sub')] },
        ] }] },
        { type: 'listItem', content: [p('Two')] },
      ] },
      { type: 'taskList', content: [
        { type: 'taskItem', attrs: { checked: true }, content: [p('Read AR')] },
        { type: 'taskItem', attrs: { checked: false }, content: [p('Call IR')] },
      ] },
    ] })
    expect(md).toBe('1. One\n   - Sub\n2. Two\n\n- [x] Read AR\n- [ ] Call IR')
  })

  it('renders editor tables as GFM with escaped pipes', () => {
    const cell = (t: string, type = 'tableCell'): DocNode => ({ type, content: [p(t)] })
    const md = docToMarkdown({ type: 'doc', content: [{ type: 'table', content: [
      { type: 'tableRow', content: [cell('Metric', 'tableHeader'), cell('FY26', 'tableHeader')] },
      { type: 'tableRow', content: [cell('a|b'), cell('12')] },
    ] }] })
    expect(md).toBe('| Metric | FY26 |\n| --- | ---: |\n| a\\|b | 12 |')
  })

  it('renders a connector block as its table plus a source line, latest 8 periods', () => {
    const payload: SourcePayload = {
      connector: 'pnl', source: 'screener', source_url: 'https://www.screener.in/company/X/',
      fetched_at: '2026-10-29T10:00:00Z', title: 'Income statement', subtitle: 'Consolidated · ₹ Cr',
      table: {
        columns: ['Line item', ...Array.from({ length: 10 }, (_, i) => `Mar ${2017 + i}`)],
        rows: [['Sales', ...Array.from({ length: 10 }, (_, i) => 1000 * (i + 1))]],
      },
      chart: { type: 'bar', series: ['Sales'] },
    }
    const md = docToMarkdown({ type: 'doc', content: [{ type: 'connectorBlock', attrs: { payload } }] })
    expect(md).toContain('#### Income statement')
    // The table keeps the latest 8 periods; the chart marker above it may plot more.
    const table = md.slice(md.indexOf('| Line item'))
    expect(table).toContain('| Line item | Mar 2019 |')
    expect(table).not.toContain('Mar 2018')
    expect(md).toContain('| Sales | 3,000 |')
    expect(md).toContain('10,000 |')
    expect(md).toMatch(/_Source: \[Screener\.in · .*2026\]\(https:\/\/www\.screener\.in\/company\/X\/\)_/)
  })

  it('drops empty paragraphs and counts only written words', () => {
    const doc: DocNode = { type: 'doc', content: [p('Two words'), { type: 'paragraph' },
      { type: 'connectorBlock', attrs: { payload: null } }] }
    expect(docToMarkdown(doc)).toBe('Two words')
    expect(countWords(doc)).toBe(2)
  })

  it('embeds a chart marker above the table, so the log can draw the chart', () => {
    const payload: SourcePayload = {
      connector: 'results', source: 'screener', source_url: null, fetched_at: '2026-10-29T10:00:00Z',
      title: 'Quarterly results', subtitle: null,
      table: { columns: ['Line item', 'Jun 2026', 'Sep 2026', 'Dec 2026', 'TTM'], rows: [['Sales', 10, 12, 15, 40]] },
      chart: { type: 'bar', series: ['Sales'] },
    }
    const md = docToMarkdown({ type: 'doc', content: [{ type: 'connectorBlock', attrs: { payload, mode: 'chart' } }] })
    const parts = splitChartMarkers(md)
    const chart = parts.find((p) => p.kind === 'chart')
    expect(chart && chart.kind === 'chart' && chart.plan.periods).toEqual(['Jun 2026', 'Sep 2026', 'Dec 2026'])
    expect(parts.some((p) => p.kind === 'markdown' && p.text.includes('| Sales |'))).toBe(true)
    // Previews and search snippets never show the marker.
    expect(stripMarkdown(md)).not.toContain('alphaboard')

    // A block the analyst switched to table view publishes as a table only.
    const tableOnly = docToMarkdown({ type: 'doc', content: [{ type: 'connectorBlock', attrs: { payload, mode: 'table' } }] })
    expect(tableOnly).not.toContain('alphaboard:chart')
  })

  it('drops a malformed marker instead of breaking the entry', () => {
    const parts = splitChartMarkers('Intro\n\n<!-- alphaboard:chart {"broken": -->\n\n| a |\n| --- |\n| 1 |')
    expect(parts.every((p) => p.kind === 'markdown')).toBe(true)
  })
})

