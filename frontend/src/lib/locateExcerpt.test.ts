import { describe, it, expect } from 'vitest'
import { locateExcerpt } from '../../../supabase/functions/_shared/rag/locate-excerpt'

const pages = [
  { page_number: 1, content: 'Cover page. India Defence Sector: Long Runway of Structural Growth.' },
  {
    page_number: 7,
    content:
      'Order inflows\nrose strongly in FY25. We expect EBITDA margin to expand by 120 bps to 18.5% on lower input costs, ' +
      'helped by operating leverage. Risks include delays in government payments.',
  },
]

describe('locateExcerpt', () => {
  it('finds the page and returns the report\'s own wording around a verbatim quote', () => {
    const r = locateExcerpt('EBITDA margin to expand by 120 bps to 18.5% on lower input costs', pages)!
    expect(r.page).toBe(7)
    expect(r.passage.slice(r.hit[0], r.hit[1])).toBe('EBITDA margin to expand by 120 bps to 18.5% on lower input costs')
    expect(r.passage).toContain('Order inflows rose strongly') // newline collapsed
  })

  it('still places a lightly reworded quote', () => {
    const r = locateExcerpt('margin to expand by 120 bps to 18.5% driven by lower input costs', pages)!
    expect(r.page).toBe(7)
    expect(r.score).toBeGreaterThan(0.5)
  })

  it('returns null for text that is not in the report or is too short to place', () => {
    expect(locateExcerpt('quarterly dividend policy was revised upwards sharply', pages)).toBeNull()
    expect(locateExcerpt('EBITDA margin', pages)).toBeNull()
    expect(locateExcerpt('anything at all here', [])).toBeNull()
  })
})
