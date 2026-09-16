import { describe, it, expect } from 'vitest'
import { tenantFolder, buildStoragePath, validateAttachment, isInlineViewable }
  from './attachments'
import { CC_MAX_FILES } from './constants'

const ORG = 'aaaaaaaa-0000-0000-0000-000000000001'
const USER = '11111111-0000-0000-0000-000000000001'
const COVERAGE = 'cccccccc-0000-0000-0000-000000000003'
const EVENT = 'eeeeeeee-0000-0000-0000-000000000004'

const file = (name: string, type = 'application/pdf', size = 1024) =>
  new File([new Uint8Array(size)], name, { type })

/**
 * These assertions mirror the `storage.objects` policies and the
 * cc_event_attachments INSERT policy in migration_add_command_center.sql. If the shape
 * changes here without changing both policies, every upload starts failing RLS.
 */
describe('storage path convention', () => {
  it('puts an organization at the root of the path', () => {
    expect(tenantFolder({ organizationId: ORG, userId: USER })).toBe(ORG)
  })

  it('prefixes a solo user with the literal "user" segment', () => {
    // The literal segment exists precisely because the tenant key is a user id rather
    // than an org id -- without it, folder[1] would mean two different things and no
    // single storage policy could read it.
    expect(tenantFolder({ organizationId: null, userId: USER })).toBe(`user/${USER}`)
  })

  it('builds {org}/{coverage}/{event}/{stamp}-{file} for an org', () => {
    const path = buildStoragePath(
      { organizationId: ORG, userId: USER, coverageId: COVERAGE, eventId: EVENT },
      file('Q3 deck.pdf')
    )
    const segments = path.split('/')
    expect(segments).toHaveLength(4)
    expect(segments[0]).toBe(ORG)
    expect(segments[1]).toBe(COVERAGE)
    expect(segments[2]).toBe(EVENT)
    expect(segments[3]).toMatch(/^\d+[a-z0-9]{4}-Q3-deck\.pdf$/)
  })

  it('builds user/{id}/{coverage}/{event}/{file} for a solo user', () => {
    const path = buildStoragePath(
      { organizationId: null, userId: USER, coverageId: COVERAGE, eventId: EVENT },
      file('note.pdf')
    )
    const segments = path.split('/')
    expect(segments).toHaveLength(5)
    expect(segments[0]).toBe('user')
    expect(segments[1]).toBe(USER)
  })

  it('satisfies the LIKE prefix the attachments INSERT policy checks', () => {
    const path = buildStoragePath(
      { organizationId: ORG, userId: USER, coverageId: COVERAGE, eventId: EVENT },
      file('x.pdf')
    )
    expect(path.startsWith(`${ORG}/${COVERAGE}/${EVENT}/`)).toBe(true)
  })

  it('gives two uploads of the same filename distinct paths', () => {
    const ctx = { organizationId: ORG, userId: USER, coverageId: COVERAGE, eventId: EVENT }
    expect(buildStoragePath(ctx, file('deck.pdf')))
      .not.toBe(buildStoragePath(ctx, file('deck.pdf')))
  })

  it('sanitises a filename that would break URL construction', () => {
    const path = buildStoragePath(
      { organizationId: ORG, userId: USER, coverageId: COVERAGE, eventId: EVENT },
      file('Q3 report #2 (final)?.pdf')
    )
    expect(path).not.toMatch(/[#?]/)
  })
})

describe('validateAttachment', () => {
  it('accepts a PDF', () => {
    expect(validateAttachment(file('a.pdf'), 0)).toBeNull()
  })

  it('rejects a type the bucket allowlist would refuse, with a readable reason', () => {
    // Storage would answer 400 here, which reads like a broken file rather than a
    // rejected one -- so it is caught before the request.
    const err = validateAttachment(file('evil.exe', 'application/x-msdownload'), 0)
    expect(err).toContain('evil.exe')
  })

  it('rejects a file over the bucket limit', () => {
    expect(validateAttachment(file('big.pdf', 'application/pdf', 51 * 1024 * 1024), 0))
      .toContain('limit')
  })

  it('rejects a dropped folder, which arrives as a zero-byte typeless entry', () => {
    expect(validateAttachment(new File([], 'somefolder', { type: '' }), 0))
      .toContain('folder')
  })

  it('enforces the file count cap', () => {
    expect(validateAttachment(file('a.pdf'), CC_MAX_FILES)).toContain('at most')
  })
})

describe('isInlineViewable', () => {
  it('previews images and PDFs', () => {
    expect(isInlineViewable('application/pdf')).toBe(true)
    expect(isInlineViewable('image/png')).toBe(true)
  })

  it('downloads everything else, including SVG', () => {
    expect(isInlineViewable('image/svg+xml')).toBe(false)
    expect(isInlineViewable('text/html')).toBe(false)
    expect(isInlineViewable(null)).toBe(false)
  })
})
