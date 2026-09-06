import { supabase } from '@/lib/supabase'

export const ATTACHMENT_BUCKET = 'recommendation-images'
export const MAX_FILE_BYTES = 25 * 1024 * 1024
export const MAX_FILES = 10

/**
 * Filename characters that survive Supabase's public-URL construction.
 *
 * `@supabase/storage-js` builds public URLs with `encodeURI` over the whole
 * path rather than `encodeURIComponent` per segment, and `encodeURI` leaves
 * `#`, `?`, `&`, `+`, `=`, `;`, `,` and friends untouched by design. A file
 * called "Q3 report #2 (final).xlsx" would therefore yield a URL that clients
 * truncate at the `#`.
 *
 * Non-ASCII is *not* in that dangerous set -- `encodeURI` percent-encodes it
 * correctly and `fileNameFromUrl` decodes it back -- so this keeps unicode
 * letters and digits. A report named in Hindi or Japanese keeps its name
 * instead of collapsing to "file".
 */
// \p{M} matters: Devanagari vowel signs and similar are combining marks,
// not letters, so omitting it would turn "रिपोर्ट" into "र-प-र-ट".
const SAFE_BASE = /[^\p{L}\p{N}\p{M}._-]+/gu
const MAX_BASE_LEN = 60
const MAX_EXT_LEN = 10

/**
 * Keys written by this module are `{millis}_{rand6}_{filename}` -- three parts.
 * Keys written before filenames were preserved are `{millis}_{rand}.{ext}` --
 * two parts. Because the random group is alphanumeric and can never contain an
 * underscore, requiring a second underscore distinguishes the two schemes
 * unambiguously, which is what keeps old recommendations rendering correctly.
 */
const NEW_KEY_SCHEME = /^\d{10,16}_[a-z0-9]{1,10}_(.+)$/i

/** Types safe to serve inline. SVG is excluded on purpose -- it can run script. */
const INLINE_SAFE_TYPE = /^image\/(png|jpe?g|gif|webp|avif)$|^application\/pdf$/i

export type AttachmentStatus = 'uploading' | 'done' | 'failed'

export interface AttachmentItem {
  id: string
  name: string
  size: number
  status: AttachmentStatus
  url?: string
  /** Storage key, kept so a removed-mid-flight upload can be cleaned up. */
  key?: string
  error?: string
}

function rand6(): string {
  // Alphanumeric only -- never an underscore, which NEW_KEY_SCHEME relies on.
  return Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 6).padEnd(6, '0')
}

export function sanitizeFilename(name: string): string {
  const clean = (name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  const dot = clean.lastIndexOf('.')
  // `dot > 0` so a dotfile like ".env" keeps its name instead of becoming all extension.
  let base = dot > 0 ? clean.slice(0, dot) : clean
  let ext = dot > 0 ? clean.slice(dot + 1) : ''

  base = base
    .replace(SAFE_BASE, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
  ext = ext.replace(/[^\p{L}\p{N}\p{M}]+/gu, '').toLowerCase().slice(0, MAX_EXT_LEN)

  if (!base) base = 'file'
  if (base.length > MAX_BASE_LEN) base = base.slice(0, MAX_BASE_LEN)

  return ext ? `${base}.${ext}` : base
}

export function buildStorageKey(userId: string, ticker: string, file: File): string {
  // The ticker is not chosen yet when a file is dropped before a stock is
  // picked. An empty segment would produce "//" in the key, which Supabase
  // rejects outright.
  const folder = (ticker || '').trim().toUpperCase() || '_unassigned'
  // Filename last so the URL still ends in the real extension, which is what
  // UploadedFileTile's PDF detection keys off.
  return `${userId}/${folder}/${Date.now()}_${rand6()}_${sanitizeFilename(file.name)}`
}

/**
 * The bucket is public, and we accept arbitrary file types. Serving an
 * uploaded .html or .svg inline would not be stored XSS against the app --
 * storage lives on a different origin than the SPA, so it cannot reach the
 * app's session -- but it would leave an open file host usable for phishing
 * pages under infrastructure that looks like ours. Forcing a download for
 * everything but images and PDFs closes that without touching the two types
 * users actually preview today.
 */
export function contentTypeFor(file: File): string {
  return INLINE_SAFE_TYPE.test(file.type) ? file.type : 'application/octet-stream'
}

export function validateAttachment(file: File, currentCount: number): string | null {
  // A dropped directory arrives as a zero-byte entry with no type.
  if (file.size === 0 && !file.type) return `"${file.name}" is empty or is a folder`
  if (currentCount >= MAX_FILES) return `You can attach at most ${MAX_FILES} files`
  if (file.size > MAX_FILE_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)} -- the limit is ${formatBytes(MAX_FILE_BYTES)}`
  }
  return null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface UploadResult {
  url: string
  key: string
}

/** Uploads one file and resolves its public URL. Throws on failure. */
export async function uploadAttachment(
  file: File,
  opts: { userId: string; ticker: string }
): Promise<UploadResult> {
  const key = buildStorageKey(opts.userId, opts.ticker, file)

  const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(key, file, {
    contentType: contentTypeFor(file),
    cacheControl: '3600',
    upsert: false,
  })

  // Throwing rather than returning a falsy value is the point: the previous
  // `if (!uploadError)` with no else is what let failed uploads vanish.
  if (error) throw new Error(error.message || 'Upload failed')

  const { data } = supabase.storage.from(ATTACHMENT_BUCKET).getPublicUrl(key)
  if (!data?.publicUrl) throw new Error('Could not resolve the uploaded file URL')

  return { url: data.publicUrl, key }
}

/** Best-effort cleanup for a file the user removed while it was still uploading. */
export async function deleteAttachment(key: string): Promise<void> {
  try {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([key])
  } catch {
    // An orphaned object is not worth surfacing to the user.
  }
}

/** The original filename, or null for uploads made before we preserved it. */
export function fileNameFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname
    const last = decodeURIComponent(path.slice(path.lastIndexOf('/') + 1))
    const match = NEW_KEY_SCHEME.exec(last)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/**
 * Link target for an attachment. Types we store as octet-stream download
 * rather than render, so ask Supabase to hand back the original filename.
 */
export function attachmentHref(url: string): string {
  const name = fileNameFromUrl(url)
  if (!name) return url
  if (/\.(png|jpe?g|gif|webp|avif|pdf)$/i.test(name)) return url
  return `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(name)}`
}
