import { describe, it, expect } from 'vitest'
import {
  healthBandFor, HEALTH_BANDS, HEALTH_COLORS, eventTypeOf, EVENT_TYPES,
  PRIMARY_EVENT_TYPE_IDS,
} from './constants'
import type { EventKind } from './types'

describe('healthBandFor', () => {
  it('treats a name touched today as fresh', () => {
    expect(healthBandFor(0)).toBe('fresh')
  })

  it('is fresh right up to the boundary, and stale on it', () => {
    expect(healthBandFor(HEALTH_BANDS.fresh - 1)).toBe('fresh')
    expect(healthBandFor(HEALTH_BANDS.fresh)).toBe('stale')
  })

  it('turns cold at ninety days -- the "needs attention" case the board exists for', () => {
    expect(healthBandFor(HEALTH_BANDS.stale - 1)).toBe('stale')
    expect(healthBandFor(HEALTH_BANDS.stale)).toBe('cold')
    expect(healthBandFor(400)).toBe('cold')
  })

  it('distinguishes "never touched" from "touched long ago"', () => {
    // They need different copy: one is a gap in coverage, the other a stock nobody has
    // started on.
    expect(healthBandFor(null)).toBe('untouched')
    expect(healthBandFor(null)).not.toBe('cold')
  })

  it('has a colour for every band', () => {
    for (const days of [0, 45, 200, null]) {
      expect(HEALTH_COLORS[healthBandFor(days)]).toBeDefined()
    }
  })
})

describe('eventTypeOf', () => {
  it('resolves a management meeting to its subtype tile', () => {
    expect(eventTypeOf('management_meeting', 'plant_visit').label).toBe('Plant Visit')
  })

  it('resolves a kind with no subtype', () => {
    expect(eventTypeOf('concall', null).label).toBe('Concall')
  })

  it('falls back to the kind when the subtype is unknown, rather than throwing', () => {
    expect(eventTypeOf('management_meeting', 'site_visit').kind).toBe('management_meeting')
  })

  it('never returns undefined for any kind the database allows', () => {
    const kinds: EventKind[] = [
      'management_meeting', 'concall', 'annual_report', 'broker_report', 'agm', 'other',
    ]
    for (const k of kinds) expect(eventTypeOf(k).kind).toBeTruthy()
  })
})

describe('EVENT_TYPES', () => {
  it('has unique ids, which the picker uses as React keys', () => {
    const ids = EVENT_TYPES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only sets a subtype on management meetings -- a CHECK constraint enforces this', () => {
    for (const t of EVENT_TYPES) {
      if (t.subtype !== null) expect(t.kind).toBe('management_meeting')
    }
  })

  it('every primary tile id exists', () => {
    for (const id of PRIMARY_EVENT_TYPE_IDS) {
      expect(EVENT_TYPES.some((t) => t.id === id)).toBe(true)
    }
  })

  it('leads with six tiles, so the common path fits above the fold', () => {
    expect(PRIMARY_EVENT_TYPE_IDS).toHaveLength(6)
  })
})
