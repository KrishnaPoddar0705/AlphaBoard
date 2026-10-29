import { describe, expect, it } from 'vitest'
import { chartPlan, shortPeriod } from './boardFormat'
import type { SourceTable } from './boardTypes'

const annual = (n: number): SourceTable => ({
  columns: ['Line item', ...Array.from({ length: n }, (_, i) => `Mar ${2020 + i}`), 'TTM'],
  rows: [
    ['Sales', ...Array.from({ length: n }, (_, i) => 100 + i), 999],
    ['Net Profit', ...Array.from({ length: n }, (_, i) => 10 + i), 99],
    ['ROCE %', ...Array.from({ length: n }, () => 12), null],
  ],
})

describe('chartPlan', () => {
  it('plots only time periods, never TTM', () => {
    const plan = chartPlan(annual(5), { type: 'bar', series: ['Sales', 'Net Profit'] })!
    expect(plan.periods).toEqual(['Mar 2020', 'Mar 2021', 'Mar 2022', 'Mar 2023', 'Mar 2024'])
    expect(plan.series[0].values).toEqual([100, 101, 102, 103, 104])
  })

  it('refuses a chart with fewer than three periods (a newly listed company)', () => {
    expect(chartPlan(annual(1), { type: 'bar', series: ['Sales'] })).toBeNull()
    expect(chartPlan(annual(2), { type: 'bar', series: ['Sales'] })).toBeNull()
  })

  it('drops series with no real numbers, and gives up when none are left', () => {
    const t = annual(4)
    t.rows.push(['Empty', null, null, null, null, null])
    expect(chartPlan(t, { type: 'bar', series: ['Empty'] })).toBeNull()
    expect(chartPlan(t, { type: 'bar', series: ['Sales', 'Empty'] })!.series.map((s) => s.label)).toEqual(['Sales'])
  })

  it('never mixes a % series with amounts: keeps the % ones as a line', () => {
    const plan = chartPlan(annual(4), { type: 'bar', series: ['Sales', 'ROCE %'] })!
    expect(plan.type).toBe('line')
    expect(plan.series.map((s) => s.label)).toEqual(['ROCE %'])
  })

  it('uses explicit periods and ignores comparison columns like YoY %', () => {
    const t: SourceTable = {
      columns: ['Line item', 'Q1 FY26', 'Q4 FY26', 'Q1 FY27', 'YoY %', 'QoQ %'],
      rows: [['Revenue', 248660, 298621, 298621, 20.1, 0]],
    }
    const plan = chartPlan(t, { type: 'bar', series: ['Revenue'], periods: ['Q1 FY26', 'Q4 FY26', 'Q1 FY27'] })!
    expect(plan.periods).toEqual(['Q1 FY26', 'Q4 FY26', 'Q1 FY27'])
    // Older snapshots carry no `periods`; the label pattern finds the same three.
    expect(chartPlan(t, { type: 'bar', series: ['Revenue'] })!.periods).toEqual(['Q1 FY26', 'Q4 FY26', 'Q1 FY27'])
  })

  it('caps the axis at the most recent periods', () => {
    expect(chartPlan(annual(12), { type: 'bar', series: ['Sales'] }, 8)!.periods[0]).toBe('Mar 2024')
  })
})

describe('shortPeriod', () => {
  it('shortens years and leaves quarter labels alone', () => {
    expect(shortPeriod('Sep 2024')).toBe("Sep '24")
    expect(shortPeriod('Q1 FY27')).toBe('Q1 FY27')
  })
})
