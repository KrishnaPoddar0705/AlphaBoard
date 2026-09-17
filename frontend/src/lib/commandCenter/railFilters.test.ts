import { describe, it, expect, beforeEach } from 'vitest'
import { getRailFilters, setRailFilters, resetRailFilters } from './railFilters'

/**
 * The store exists so the rail's filters outlive the remount that picking a stock
 * causes. These pin the behaviour that buys: state persists, patches merge, and a
 * no-op write does not churn subscribers into a re-render.
 */
describe('railFilters', () => {
  beforeEach(() => resetRailFilters())

  it('starts on "mine" with nothing narrowed', () => {
    expect(getRailFilters()).toEqual({
      query: '', scope: 'mine', team: '', sector: '', band: 'any',
    })
  })

  it('survives the remount a route change causes', () => {
    setRailFilters({ scope: 'all', sector: 'Finance' })
    // Mounting a fresh StockSidebar reads the same module-level state.
    expect(getRailFilters()).toMatchObject({ scope: 'all', sector: 'Finance', band: 'any' })
  })

  it('merges patches rather than replacing the filter set', () => {
    setRailFilters({ scope: 'all' })
    setRailFilters({ query: 'bse' })
    expect(getRailFilters()).toMatchObject({ scope: 'all', query: 'bse' })
  })

  it('keeps the same snapshot object when nothing changed', () => {
    setRailFilters({ scope: 'all' })
    const before = getRailFilters()
    setRailFilters({ scope: 'all' })
    // Identity matters: useSyncExternalStore re-renders on a new reference.
    expect(getRailFilters()).toBe(before)
  })

  it('returns a new snapshot when something did change', () => {
    const before = getRailFilters()
    setRailFilters({ band: 'cold' })
    expect(getRailFilters()).not.toBe(before)
    expect(getRailFilters().band).toBe('cold')
  })

  it('resets to defaults', () => {
    setRailFilters({ scope: 'all', query: 'x', team: 't', sector: 's', band: 'stale' })
    resetRailFilters()
    expect(getRailFilters()).toEqual({
      query: '', scope: 'mine', team: '', sector: '', band: 'any',
    })
  })
})
