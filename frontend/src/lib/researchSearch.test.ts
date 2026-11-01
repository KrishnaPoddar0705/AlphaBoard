import { describe, it, expect } from 'vitest'
import { splitSnippet, groupByReport, type KeywordHit } from './researchSearch'

const hit = (report_id: string, page_number: number, report_hits = 2): KeywordHit => ({
  report_id, title: `T-${report_id}`, sector: null, tickers: null, page_number, snippet: '', rank: 1, report_hits,
})

describe('splitSnippet', () => {
  it('marks the text between STX and ETX as a hit', () => {
    expect(splitSnippet('margin \u0002EBITDA\u0003 grew \u0002fast\u0003')).toEqual([
      { text: 'margin ', hit: false },
      { text: 'EBITDA', hit: true },
      { text: ' grew ', hit: false },
      { text: 'fast', hit: true },
    ])
  })

  it('returns plain text untouched and never emits HTML', () => {
    expect(splitSnippet('a <b>bold</b> claim')).toEqual([{ text: 'a <b>bold</b> claim', hit: false }])
  })

  it('returns nothing for an empty snippet', () => {
    expect(splitSnippet('')).toEqual([])
  })
})

describe('groupByReport', () => {
  it('groups pages under their report in first-seen order', () => {
    const groups = groupByReport([hit('a', 1), hit('b', 4, 1), hit('a', 7)])
    expect(groups.map((g) => [g.report_id, g.hits.map((h) => h.page_number), g.totalHits])).toEqual([
      ['a', [1, 7], 2],
      ['b', [4], 1],
    ])
  })
})
