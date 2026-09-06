import { describe, expect, it, vi } from 'vitest'

// The module pulls in the Supabase client at import time; the pure helpers
// under test never touch it.
vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: () => ({}) } } }))

const {
  attachmentHref,
  buildStorageKey,
  contentTypeFor,
  fileNameFromUrl,
  sanitizeFilename,
  validateAttachment,
  MAX_FILE_BYTES,
} = await import('./attachments')

const file = (name: string, opts: { type?: string; size?: number } = {}) => {
  const f = new File(['x'], name, { type: opts.type ?? '' })
  if (opts.size !== undefined) Object.defineProperty(f, 'size', { value: opts.size })
  return f
}

const PUBLIC = 'https://proj.supabase.co/storage/v1/object/public/recommendation-images'

describe('sanitizeFilename', () => {
  it('strips the characters that encodeURI leaves unescaped', () => {
    // Supabase builds public URLs with encodeURI over the whole path, so a "#"
    // would truncate the URL and a "?" would start a query string.
    expect(sanitizeFilename('Q3 report #2 (final).xlsx')).toBe('Q3-report-2-final.xlsx')
  })

  it('keeps a file with no extension', () => {
    expect(sanitizeFilename('Makefile')).toBe('Makefile')
  })

  it('folds accents rather than dropping the word', () => {
    expect(sanitizeFilename('résumé.pdf')).toBe('resume.pdf')
  })

  it('never emits a path separator', () => {
    const out = sanitizeFilename('../../etc/passwd')
    expect(out).not.toContain('/')
    expect(out).not.toContain('..')
  })

  it('caps a very long base name but keeps the extension', () => {
    const out = sanitizeFilename(`${'a'.repeat(300)}.pdf`)
    expect(out.endsWith('.pdf')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(64)
  })

  it('falls back to "file" when nothing survives', () => {
    expect(sanitizeFilename('###.pdf')).toBe('file.pdf')
  })

  it('keeps a non-ASCII name, which encodeURI percent-encodes safely', () => {
    expect(sanitizeFilename('日本語.pdf')).toBe('日本語.pdf')
    expect(sanitizeFilename('रिपोर्ट.pdf')).toBe('रिपोर्ट.pdf')
  })

  it('round-trips a non-ASCII name through the storage key', () => {
    const key = buildStorageKey('u', 'INFY', file('रिपोर्ट.pdf'))
    const url = `${PUBLIC}/${encodeURI(key)}`
    expect(fileNameFromUrl(url)).toBe('रिपोर्ट.pdf')
  })

  it('handles an empty name', () => {
    expect(sanitizeFilename('')).toBe('file')
  })
})

describe('buildStorageKey', () => {
  it('produces a three-part key ending in the real extension', () => {
    const key = buildStorageKey('user-1', 'INFY', file('Deck.pdf'))
    expect(key).toMatch(/^user-1\/INFY\/\d{10,16}_[a-z0-9]{6}_Deck\.pdf$/)
  })

  it('falls back to _unassigned when no ticker is chosen yet', () => {
    // A file can be dropped before a stock is picked; an empty segment would
    // put "//" in the key, which Supabase rejects.
    expect(buildStorageKey('user-1', '', file('a.png'))).toContain('/_unassigned/')
  })
})

describe('fileNameFromUrl', () => {
  it('recovers the original filename from a current key', () => {
    const key = buildStorageKey('user-1', 'INFY', file('Q3 deck.pdf'))
    expect(fileNameFromUrl(`${PUBLIC}/${key}`)).toBe('Q3-deck.pdf')
  })

  it('returns null for a legacy key, which discarded the filename', () => {
    // Legacy keys are `{millis}_{random}.{ext}` -- one underscore. The tile
    // must fall back to its generic label rather than showing this at the user.
    expect(fileNameFromUrl(`${PUBLIC}/u/INFY/1767475922027_n8o3no.pdf`)).toBeNull()
  })

  it('returns null for a malformed URL', () => {
    expect(fileNameFromUrl('not a url')).toBeNull()
  })
})

describe('contentTypeFor', () => {
  it('serves images and PDFs inline', () => {
    expect(contentTypeFor(file('a.png', { type: 'image/png' }))).toBe('image/png')
    expect(contentTypeFor(file('a.pdf', { type: 'application/pdf' }))).toBe('application/pdf')
  })

  it('forces a download for SVG, which can run script', () => {
    expect(contentTypeFor(file('a.svg', { type: 'image/svg+xml' }))).toBe('application/octet-stream')
  })

  it('forces a download for HTML and spreadsheets', () => {
    expect(contentTypeFor(file('a.html', { type: 'text/html' }))).toBe('application/octet-stream')
    expect(contentTypeFor(file('a.xlsx', { type: '' }))).toBe('application/octet-stream')
  })
})

describe('attachmentHref', () => {
  it('leaves an image URL alone', () => {
    const key = buildStorageKey('u', 'INFY', file('chart.png'))
    expect(attachmentHref(`${PUBLIC}/${key}`)).toBe(`${PUBLIC}/${key}`)
  })

  it('asks for a named download on types we store as octet-stream', () => {
    const key = buildStorageKey('u', 'INFY', file('model.xlsx'))
    expect(attachmentHref(`${PUBLIC}/${key}`)).toContain('?download=model.xlsx')
  })

  it('leaves a legacy URL alone', () => {
    const url = `${PUBLIC}/u/INFY/1767475922027_n8o3no.pdf`
    expect(attachmentHref(url)).toBe(url)
  })
})

describe('validateAttachment', () => {
  it('accepts an ordinary file', () => {
    expect(validateAttachment(file('a.pdf', { size: 1024 }), 0)).toBeNull()
  })

  it('rejects a file over the size cap', () => {
    expect(validateAttachment(file('big.zip', { size: MAX_FILE_BYTES + 1 }), 0)).toMatch(/limit/)
  })

  it('rejects a dropped folder, which arrives empty and untyped', () => {
    expect(validateAttachment(file('somedir', { size: 0 }), 0)).toMatch(/empty or is a folder/)
  })

  it('rejects once the count cap is reached', () => {
    expect(validateAttachment(file('a.pdf', { size: 10 }), 10)).toMatch(/at most/)
  })
})
