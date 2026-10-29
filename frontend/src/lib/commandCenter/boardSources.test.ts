import { describe, expect, it } from 'vitest'
import { pullKey, recentQuarters } from './boardSources'

describe('pullKey', () => {
  it('treats statements as one pull per board, whatever quarter is selected', () => {
    expect(pullKey('balance', 'q3_25')).toBe(pullKey('balance', null))
    expect(pullKey('pnl', undefined)).toBe('pnl')
  })

  it('separates quarter-aware pulls by quarter, with Latest as its own period', () => {
    expect(pullKey('results', 'q3_25')).not.toBe(pullKey('results', 'q4_26'))
    expect(pullKey('results', null)).toBe('results:latest')
    expect(pullKey('concall', 'q1_27')).toBe('concall:q1_27')
  })

  it('never matches a legacy quarter-aware card whose quarter was not recorded', () => {
    expect(pullKey('results', undefined)).toBeNull()
  })
})

describe('recentQuarters', () => {
  it('starts at the last completed quarter of the Indian fiscal year', () => {
    // 29 Oct 2026 is in Q3 FY27 (Oct-Dec), so the latest results are Q2 FY27.
    expect(recentQuarters(new Date(2026, 9, 29), 3).map((q) => q.key)).toEqual(['q2_27', 'q1_27', 'q4_26'])
  })
})
