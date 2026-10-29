import { describe, expect, it } from 'vitest'
import { markdownToDoc } from './markdownToDoc'
import { docToMarkdown } from './docToMarkdown'
import { payloadToSourceBlock, upgradeDoc } from './sourceBlock'
import { splitChartMarkers } from './boardFormat'
import type { DocNode, SourcePayload } from './boardTypes'

// Shaped like Drishti's expanded concall analysis.
const ANALYSIS = `### Key Expectations

**1. Revenue Growth and Drivers**
- Domestic ports to grow **double digits**
   - Mundra CT5 starts in weeks
- Logistics margins to hold

| Metric | Value |
|---|---|
| Revenue | Rs. 11,320 Cr |

1. **Telecom Growth:**
   - **Question:** Analyst asked about ARPU
2. Retail`

describe('markdownToDoc', () => {
  const doc: DocNode = { type: 'doc', content: markdownToDoc(ANALYSIS) }
  const types = doc.content!.map((n) => n.type)

  it('builds headings, nested lists, tables and ordered lists as editor nodes', () => {
    expect(types).toEqual(['paragraph', 'paragraph', 'bulletList', 'table', 'orderedList'])
    const bullets = doc.content![2]
    expect(bullets.content![0].content![1].type).toBe('bulletList')       // nested
  })

  it('round-trips to readable markdown with the formatting kept', () => {
    const md = docToMarkdown(doc)
    expect(md).toContain('**Key Expectations**')
    expect(md).toContain('- Domestic ports to grow **double digits**')
    expect(md).toContain('  - Mundra CT5 starts in weeks')
    expect(md).toContain('| Revenue | Rs. 11,320 Cr |')
    expect(md).toContain('1. **Telecom Growth:**')
  })
})

describe('Full analysis folds', () => {
  const concall: SourcePayload = {
    connector: 'concall', source: 'drishti', source_url: null, fetched_at: '2026-10-29T10:00:00Z',
    title: 'Concall · Q2 FY27',
    sections: [{ heading: 'Guidance', bullets: ['Guidance raised'], markdown: ANALYSIS }],
  }

  it('sits as an editable fold right under its section', () => {
    const block = payloadToSourceBlock(concall)
    const types = block.content!.map((n) => n.type)
    expect(types).toEqual(['heading', 'paragraph', 'bulletList', 'analysisFold'])
  })

  it('publishes as a fold the log renders as a dropdown', () => {
    const md = docToMarkdown({ type: 'doc', content: [payloadToSourceBlock(concall)] })
    const fold = splitChartMarkers(md).find((p) => p.kind === 'fold')
    expect(fold && fold.kind === 'fold' && fold.title).toBe('Full analysis')
    expect(fold && fold.kind === 'fold' && fold.text).toContain('Mundra CT5')
  })

  it('moves the locked analysis of an earlier source block into folds', () => {
    const early: DocNode = { type: 'doc', content: [{
      type: 'sourceBlock', attrs: { connector: 'concall', source: 'drishti' },
      content: [
        { type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'Concall' }] },
        { type: 'sourceData', attrs: { payload: { ...concall, sections: [{ heading: 'Guidance', bullets: [], markdown: ANALYSIS }] } } },
        { type: 'paragraph', content: [{ type: 'text', text: 'Guidance', marks: [{ type: 'bold' }] }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Edited by me' }] }] }] },
      ],
    }] }
    const types = upgradeDoc(early).content![0].content!.map((n) => n.type)
    // No table, so the emptied data node goes; the fold lands after the analyst's bullets.
    expect(types).toEqual(['heading', 'paragraph', 'bulletList', 'analysisFold'])
  })
})
