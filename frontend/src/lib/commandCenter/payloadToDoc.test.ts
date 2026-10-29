import { describe, expect, it } from 'vitest'
import { editKey, visiblePayload } from './payloadToDoc'
import { docToMarkdown } from './docToMarkdown'
import type { SourcePayload } from './boardTypes'

const concall: SourcePayload = {
  connector: 'concall', source: 'drishti', source_url: 'https://example.com/t.pdf',
  fetched_at: '2026-10-29T10:00:00Z', title: 'Concall · Q2 FY27', subtitle: 'Management commentary, analysed',
  sections: [
    { heading: 'Guidance', bullets: ['FY27 revenue guidance raised'] },
    { heading: 'Market trends', bullets: ['Containerisation is a long-term opportunity'] },
  ],
  items: [
    { date: '2026-10-29', title: 'Transcript · Q2 FY27', url: 'https://example.com/t.pdf', tag: 'Transcript' },
    { date: '2026-10-28', title: 'Investor presentation', url: null, tag: 'PPT' },
  ],
}

describe('trimming a pulled block', () => {
  it('hides sections and items without touching the snapshot', () => {
    const v = visiblePayload(concall, { hiddenSections: ['Market trends'], hiddenItems: [1] })
    expect(v.sections!.map((s) => s.heading)).toEqual(['Guidance'])
    expect(v.items!.map((i) => i.title)).toEqual(['Transcript · Q2 FY27'])
    expect(concall.sections).toHaveLength(2)
  })

  it('publishes only what the analyst kept', () => {
    const md = docToMarkdown({ type: 'doc', content: [{
      type: 'connectorBlock',
      attrs: { payload: concall, mode: 'table', hiddenSections: ['Market trends'], hiddenItems: [1] },
    }] })
    expect(md).toContain('FY27 revenue guidance raised')
    expect(md).not.toContain('Containerisation')
    expect(md).not.toContain('Investor presentation')
  })
})

describe('editing bullets in place', () => {
  it('applies reworded bullets and drops cleared ones, leaving the snapshot as pulled', () => {
    const v = visiblePayload(concall, { edits: {
      [editKey('Guidance', 0)]: 'Guidance raised by ₹1,000 Cr -- conservative in my view',
      [editKey('Market trends', 0)]: '',
    } })
    expect(v.sections![0].bullets).toEqual(['Guidance raised by ₹1,000 Cr -- conservative in my view'])
    expect(v.sections![1].bullets).toEqual([])
    expect(concall.sections![0].bullets[0]).toBe('FY27 revenue guidance raised')
  })

  it('publishes the edited wording, and keys are safe to store in jsonb', () => {
    const edits = { [editKey('Guidance', 0)]: 'My rewording' }
    expect(JSON.stringify(edits)).not.toContain('\\u0000')
    const md = docToMarkdown({ type: 'doc', content: [{ type: 'connectorBlock', attrs: { payload: concall, mode: 'table', edits } }] })
    expect(md).toContain('- My rewording')
    expect(md).not.toContain('FY27 revenue guidance raised')
  })
})
