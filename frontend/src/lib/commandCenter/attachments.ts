import { supabase } from '@/lib/supabase'
import { sanitizeFilename, formatBytes } from '@/lib/recommendations/attachments'
import { CC_BUCKET, CC_MAX_FILE_BYTES, CC_MAX_FILES, CC_SIGNED_URL_TTL_SECONDS } from './constants'

export { formatBytes }

/**
 * Attachment storage for Command Center.
 *
 * Deliberately NOT a reuse of lib/recommendations/attachments.ts, because that module
 * targets the PUBLIC `recommendation-images` bucket and resolves `getPublicUrl()`.
 * `command-center` is private: broker research is licensed material, and a public
 * bucket makes every object a permanent unauthenticated URL for anyone who has seen it.
 *
 * Consequences that callers must respect:
 *   - We persist the STORAGE PATH, never a URL. URLs here expire.
 *   - Reads go through `signedUrlFor()`, minted on demand.
 *   - `getPublicUrl()` must never be used: against a private bucket it returns a
 *     URL-shaped string that 400s, which reads like a broken file rather than a
 *     permissions problem.
 */

export interface AttachmentContext {
  /** The owning organization, or null for a user with no organization. */
  organizationId: string | null
  /** Supabase user id. Only used for the solo path shape. */
  userId: string
  coverageId: string
  /**
   * The event this file belongs to. The Log sheet mints this id client-side BEFORE the
   * event row exists, so uploads can run in the background while the analyst is still
   * typing, and the row is then inserted with this explicit id.
   */
  eventId: string
}

/**
 * The path convention the storage.objects policies and the cc_event_attachments INSERT
 * policy both enforce. Changing the shape here without changing both policies silently
 * breaks uploads.
 *
 *   org  : {organization_id}/{coverage_id}/{event_id}/{stamp}-{filename}
 *   solo : user/{user_id}/{coverage_id}/{event_id}/{stamp}-{filename}
 *
 * The literal 'user' segment can never collide with an organization id, which is always
 * a UUID. The {stamp}- prefix stops two analysts overwriting each other's upload of
 * "presentation.pdf" against the same event.
 */
export function tenantFolder(ctx: Pick<AttachmentContext, 'organizationId' | 'userId'>): string {
  return ctx.organizationId ?? `user/${ctx.userId}`
}

export function buildStoragePath(ctx: AttachmentContext, file: File): string {
  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  return [
    tenantFolder(ctx),
    ctx.coverageId,
    ctx.eventId,
    `${stamp}-${sanitizeFilename(file.name)}`,
  ].join('/')
}

/**
 * Types the bucket's `allowed_mime_types` accepts. Anything else is rejected here with
 * a readable message rather than by Storage with a 400, because the bucket-level
 * rejection gives the user nothing to act on.
 */
const ACCEPTED_MIME = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv', 'text/plain', 'text/markdown',
])

export function validateAttachment(file: File, currentCount: number): string | null {
  // A dropped directory arrives as a zero-byte entry with no type.
  if (file.size === 0 && !file.type) return `"${file.name}" is empty or is a folder`
  if (currentCount >= CC_MAX_FILES) return `You can attach at most ${CC_MAX_FILES} files`
  if (file.size > CC_MAX_FILE_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)} -- the limit is ${formatBytes(CC_MAX_FILE_BYTES)}`
  }
  if (file.type && !ACCEPTED_MIME.has(file.type)) {
    return `"${file.name}" is a ${file.type} file -- attach a PDF, image, spreadsheet, doc or text file`
  }
  return null
}

export interface CcUploadResult {
  /** What goes in cc_event_attachments.storage_path. */
  key: string
  /** A short-lived signed URL, for showing the file immediately after upload. */
  url: string
}

export async function uploadCommandCenterFile(
  file: File,
  ctx: AttachmentContext
): Promise<CcUploadResult> {
  const key = buildStoragePath(ctx, file)

  const { error } = await supabase.storage.from(CC_BUCKET).upload(key, file, {
    // Unlike the public bucket, we do not force octet-stream: this bucket has a MIME
    // allowlist and is never served to an anonymous browser, so there is no
    // open-file-host risk to close here.
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw new Error(error.message || 'Upload failed')

  return { key, url: await signedUrlFor(key) }
}

/**
 * Mints a read URL. RLS gates MINTING, not using -- once issued the token works for
 * anyone holding the string until it expires, so the TTL is deliberately short and
 * callers re-mint rather than caching.
 */
export async function signedUrlFor(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CC_BUCKET)
    .createSignedUrl(storagePath, CC_SIGNED_URL_TTL_SECONDS)
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Could not open that file')
  }
  return data.signedUrl
}

/** As above, but asks Storage to hand back the original filename on download. */
export async function signedDownloadUrlFor(
  storagePath: string,
  fileName: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(CC_BUCKET)
    .createSignedUrl(storagePath, CC_SIGNED_URL_TTL_SECONDS, { download: fileName })
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Could not download that file')
  }
  return data.signedUrl
}

/** Best-effort cleanup for a file removed mid-flight, or an abandoned draft. */
export async function deleteCommandCenterFile(storagePath: string): Promise<void> {
  try {
    await supabase.storage.from(CC_BUCKET).remove([storagePath])
  } catch {
    // An orphaned object is not worth surfacing to the user.
  }
}

export async function deleteCommandCenterFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    await supabase.storage.from(CC_BUCKET).remove(paths)
  } catch {
    // As above.
  }
}

/** True for types a browser renders inline, so the UI can preview rather than download. */
export function isInlineViewable(mime: string | null | undefined): boolean {
  return !!mime && /^image\/(png|jpe?g|webp)$|^application\/pdf$/i.test(mime)
}
