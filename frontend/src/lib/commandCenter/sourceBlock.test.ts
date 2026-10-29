import { describe, expect, it } from 'vitest'
import { payloadToSourceBlock, upgradeDoc } from './sourceBlock'
import { docToMarkdown, countWords } from './docToMarkdown'
import { editKey } from './payloadToDoc'
import type { DocNode, SourcePayload } from './boardTypes'

const concall: SourcePayload = {
  connector: 'concall', source: 'drishti', source_url: 'https://example.com/t.pdf',
  fetched_at: '2026-10-29T10:00:00Z', title: 'Concall · Q2 FY27', subtitle: 'Management commentary, analysed',
  sections: [
    { heading: 'Guidance', bullets: ['FY27 revenue guidance raised'], markdown: '### Long form' },
    { heading: 'Red flags', bullets: ['Iron ore ban'] },
  ],
  items: [{ date: '2026-10-29', title: 'Transcript · Q2 FY27', url: 'https://example.com/t.pdf', tag: 'Transcript' }],
}

describe('source blocks', () => {
  it('keeps every word as editable content; a concall has no locked data node', () => {
    const block = payloadToSourceBlock(concall)
    const types = block.content!.map((n) => n.type)
    expect(types[0]).toBe('heading')
    expect(types).toContain('bulletList')
    expect(types).toContain('analysisFold')        // the long form, editable and folded
    expect(types).not.toContain('sourceData')       // nothing numeric to lock
  })

  it('publishes the analyst\'s formatting, highlights included, plus the citation', () => {
    const block = payloadToSourceBlock(concall)
    // Simulate the analyst highlighting the first guidance bullet.
    const list = block.content!.find((n) => n.type === 'bulletList')!
    list.content![0].content![0].content![0].marks = [{ type: 'highlight' }]
    const md = docToMarkdown({ type: 'doc', content: [block] })
    expect(md).toContain('#### Concall · Q2 FY27')
    expect(md).toContain('- ==FY27 revenue guidance raised==')
    expect(md).toContain('**Red flags**')
    expect(md).toMatch(/_Source: \[Drishti · .*\]\(https:\/\/example\.com\/t\.pdf\)_$/)
  })

  it('does not count pulled text as the analyst\'s words', () => {
    expect(countWords({ type: 'doc', content: [payloadToSourceBlock(concall)] })).toBe(0)
  })

  it('upgrades a legacy locked block, keeping hidden parts and edits', () => {
    const legacy: DocNode = { type: 'doc', content: [{ type: 'connectorBlock', attrs: {
      payload: concall, mode: 'chart',
      hiddenSections: ['Red flags'], edits: { [editKey('Guidance', 0)]: 'My wording' },
    } }] }
    const doc = upgradeDoc(legacy)
    expect(doc.content![0].type).toBe('sourceBlock')
    const md = docToMarkdown(doc)
    expect(md).toContain('My wording')
    expect(md).not.toContain('Iron ore ban')
    // Already-upgraded documents pass through untouched.
    expect(upgradeDoc(doc)).toBe(doc)
  })
})
