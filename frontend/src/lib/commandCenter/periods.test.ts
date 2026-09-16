import { describe, it, expect } from 'vitest'
import {
  fiscalQuarterOf, formatQuarterLabel, formatFyLabel, startOfFiscalQuarter,
  recentQuarters, recentFiscalYears, parsePeriodLabel,
  periodKey, periodLabelOf, latestCompletedKey, periodLabels,
} from './periods'

describe('fiscalQuarterOf', () => {
  it('puts April in Q1 of the following fiscal year', () => {
    expect(fiscalQuarterOf(new Date(2025, 3, 1))).toEqual({ quarter: 1, fyYear: 2026 })
  })

  it('puts September in Q2', () => {
    expect(fiscalQuarterOf(new Date(2025, 8, 30))).toEqual({ quarter: 2, fyYear: 2026 })
  })

  // January-March is the case that catches naive `month / 3` implementations: the
  // calendar year has ticked over but the fiscal year has not.
  it('keeps January in Q4 of the fiscal year that started the previous April', () => {
    expect(fiscalQuarterOf(new Date(2026, 0, 15))).toEqual({ quarter: 4, fyYear: 2026 })
  })

  it('treats 31 March as the last day of Q4, not the first of Q1', () => {
    expect(fiscalQuarterOf(new Date(2026, 2, 31))).toEqual({ quarter: 4, fyYear: 2026 })
  })
})

describe('labels', () => {
  it('formats a quarter the way the CHECK constraint expects', () => {
    expect(formatQuarterLabel({ quarter: 2, fyYear: 2026 })).toBe('Q2 FY26')
  })

  it('formats a fiscal year', () => {
    expect(formatFyLabel(2025)).toBe('FY25')
  })

  it('produces labels the database CHECK accepts', () => {
    const pattern = /^(Q[1-4] )?(FY|CY)[0-9]{2}([0-9]{2})?$/
    expect(pattern.test(formatQuarterLabel({ quarter: 4, fyYear: 2026 }))).toBe(true)
    expect(pattern.test(formatFyLabel(2026))).toBe(true)
  })
})

describe('startOfFiscalQuarter', () => {
  it('starts Q1 FY26 in April 2025', () => {
    expect(startOfFiscalQuarter({ quarter: 1, fyYear: 2026 })).toEqual(new Date(2025, 3, 1))
  })

  it('starts Q4 FY26 in January 2026', () => {
    expect(startOfFiscalQuarter({ quarter: 4, fyYear: 2026 })).toEqual(new Date(2026, 0, 1))
  })
})

describe('recentQuarters', () => {
  // Reported weeks after the quarter closes, so the in-progress one is excluded.
  it('excludes the quarter currently in progress', () => {
    const asOf = new Date(2026, 8, 12)          // Sep 2026 -> we are inside Q2 FY27
    expect(recentQuarters(3, asOf).map(formatQuarterLabel))
      .toEqual(['Q1 FY27', 'Q4 FY26', 'Q3 FY26'])
  })

  it('walks back across a fiscal-year boundary', () => {
    const asOf = new Date(2025, 4, 1)           // May 2025 -> inside Q1 FY26
    expect(recentQuarters(2, asOf).map(formatQuarterLabel)).toEqual(['Q4 FY25', 'Q3 FY25'])
  })

  it('returns exactly the requested count', () => {
    expect(recentQuarters(8, new Date(2026, 8, 12))).toHaveLength(8)
  })
})

describe('recentFiscalYears', () => {
  it('excludes the fiscal year still in progress', () => {
    // Sep 2026 is inside FY27, so FY26 is the most recent completed year.
    expect(recentFiscalYears(3, new Date(2026, 8, 12)).map(formatFyLabel))
      .toEqual(['FY26', 'FY25', 'FY24'])
  })

  it('handles February, when the calendar year leads the fiscal year', () => {
    expect(recentFiscalYears(2, new Date(2026, 1, 10)).map(formatFyLabel))
      .toEqual(['FY25', 'FY24'])
  })
})

describe('parsePeriodLabel', () => {
  it('round-trips a quarter label', () => {
    expect(parsePeriodLabel('Q2 FY26')).toEqual({ quarter: 2, fyYear: 2026 })
  })

  it('treats a bare fiscal year as the end of that year, so it sorts last', () => {
    expect(parsePeriodLabel('FY25')).toEqual({ quarter: 4, fyYear: 2025 })
  })

  it('accepts a four-digit calendar year', () => {
    expect(parsePeriodLabel('CY2025')).toEqual({ quarter: 4, fyYear: 2025 })
  })

  it('returns null for junk rather than guessing', () => {
    expect(parsePeriodLabel('last quarter')).toBeNull()
    expect(parsePeriodLabel('')).toBeNull()
    expect(parsePeriodLabel(null)).toBeNull()
  })
})

describe('period keys', () => {
  it('round-trips quarter labels, including across a fiscal-year boundary', () => {
    for (const label of ['Q1 FY27', 'Q4 FY26', 'Q3 FY26']) {
      expect(periodLabelOf('concall', periodKey('concall', label)!)).toBe(label)
    }
    expect(periodKey('concall', 'Q1 FY27')! - periodKey('concall', 'Q4 FY26')!).toBe(1)
  })

  it('does not mix quarter and year labels', () => {
    expect(periodKey('concall', 'FY26')).toBeNull()
    expect(periodKey('annual_report', 'Q1 FY26')).toBeNull()
    expect(periodKey('annual_report', 'FY26')).toBe(2026)
  })

  it('finds the latest completed period', () => {
    const asOf = new Date(2026, 8, 17) // 17 Sep 2026: Q2 FY27 in progress
    expect(periodLabelOf('concall', latestCompletedKey('concall', asOf))).toBe('Q1 FY27')
    expect(periodLabelOf('annual_report', latestCompletedKey('annual_report', asOf))).toBe('FY26')
  })

  it('lists labels newest first', () => {
    const newest = periodKey('concall', 'Q2 FY27')!
    expect(periodLabels('concall', newest, newest - 2)).toEqual(['Q2 FY27', 'Q1 FY27', 'Q4 FY26'])
  })
})
