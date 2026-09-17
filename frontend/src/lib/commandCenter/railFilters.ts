import { useSyncExternalStore } from 'react'
import type { HealthBand } from './constants'

export interface RailFilters {
  query: string
  scope: 'mine' | 'all'
  /** A team id, or '' for every team. */
  team: string
  sector: string
  band: HealthBand | 'any'
}

/**
 * How the coverage rail is filtered, held outside React.
 *
 * The rail straddles two routes -- /command-center?view=board and
 * /command-center/stock/:ticker -- so picking a stock unmounts the component that owns
 * the filters and mounts a fresh one. Held in useState, the analyst's "All desk ·
 * Finance" narrowing was thrown away by the very click it was there to serve, and the
 * rail appeared to reload.
 *
 * A module-level store survives that remount without threading a provider above both
 * routes, and without putting UI state in the URL (a stock link is for the stock, not
 * for whatever the sender had filtered at the time). It is deliberately not persisted
 * across a page load: "Mine" is the right thing to see on arrival.
 */
const INITIAL: RailFilters = { query: '', scope: 'mine', team: '', sector: '', band: 'any' }

let state: RailFilters = INITIAL
const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => { listeners.delete(onChange) }
}

/** The live filters. Exported for tests and for non-React readers. */
export const getRailFilters = (): RailFilters => state

const getSnapshot = getRailFilters

export function setRailFilters(patch: Partial<RailFilters>): void {
  const next = { ...state, ...patch }
  // Bail on a no-op so an unchanged select does not re-render every subscriber.
  if ((Object.keys(next) as Array<keyof RailFilters>).every((k) => next[k] === state[k])) return
  state = next
  for (const listener of listeners) listener()
}

/** Test seam: drops the store back to its defaults. */
export function resetRailFilters(): void {
  state = INITIAL
  for (const listener of listeners) listener()
}

export function useRailFilters(): [RailFilters, typeof setRailFilters] {
  return [useSyncExternalStore(subscribe, getSnapshot, getSnapshot), setRailFilters]
}
