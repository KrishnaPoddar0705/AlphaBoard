import { describe, it, expect } from 'vitest'
import { canonicalSector, sectorOptions } from './sectors'

describe('sectorOptions', () => {
  it('lists each sector once, sorted, ignoring blanks and case', () => {
    const board = [
      { sector: 'Real Estate' }, { sector: null }, { sector: ' Banks ' },
      { sector: 'banks' }, { sector: '' }, { sector: 'Chemicals' },
    ]
    expect(sectorOptions(board)).toEqual(['Banks', 'Chemicals', 'Real Estate'])
  })
})

describe('canonicalSector', () => {
  it('snaps to an existing sector that differs only by case or spacing', () => {
    expect(canonicalSector('  real   estate ', ['Banks', 'Real Estate'])).toBe('Real Estate')
  })

  it('keeps a new sector as typed, tidied', () => {
    expect(canonicalSector(' Capital  Goods ', ['Banks'])).toBe('Capital Goods')
    expect(canonicalSector('   ', ['Banks'])).toBe('')
  })
})
