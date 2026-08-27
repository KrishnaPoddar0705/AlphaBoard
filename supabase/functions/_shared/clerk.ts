// Shared helpers for the Clerk Backend API.
//
// Two things this module exists to prevent, both of which shipped broken:
//   1. The Clerk Backend API is strictly snake_case. Sending `userId` instead
//      of `user_id` to the memberships endpoint fails with a 422 that is easy
//      to swallow, because `user_id` is a *required* field.
//   2. Callers used to log failures with console.warn and continue, so a
//      permanently broken sync looked identical to a working one. Every helper
//      here returns a structured result the caller is expected to surface.

const CLERK_API_URL = 'https://api.clerk.com/v1'

export interface ClerkResult<T> {
    ok: boolean
    status: number
    data: T | null
    /** Human-readable failure description, null when ok. */
    error: string | null
}

/**
 * Reports whether the configured key targets Clerk's live or test instance,
 * without ever revealing the key. Clerk development and production are
 * separate instances with separate user and organization pools, so a
 * `sk_test_` key here silently creates organizations that never appear in the
 * production dashboard.
 */
export function clerkInstanceKind(secretKey: string): 'live' | 'test' | 'unknown' {
    if (secretKey.startsWith('sk_live_')) return 'live'
    if (secretKey.startsWith('sk_test_')) return 'test'
    return 'unknown'
}

function describeClerkError(status: number, body: unknown): string {
    const errors = (body as { errors?: Array<{ code?: string; message?: string; long_message?: string }> })?.errors
    if (Array.isArray(errors) && errors.length > 0) {
        const detail = errors
            .map((e) => `${e.code ?? 'error'}: ${e.long_message ?? e.message ?? 'no detail'}`)
            .join('; ')
        return `Clerk HTTP ${status} — ${detail}`
    }
    return `Clerk HTTP ${status}`
}

async function clerkFetch<T>(
    secretKey: string,
    path: string,
    init: RequestInit = {},
): Promise<ClerkResult<T>> {
    let response: Response
    try {
        response = await fetch(`${CLERK_API_URL}${path}`, {
            ...init,
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
                ...(init.headers ?? {}),
            },
        })
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { ok: false, status: 0, data: null, error: `Could not reach Clerk: ${message}` }
    }

    const text = await response.text()
    let body: unknown = {}
    if (text) {
        try {
            body = JSON.parse(text)
        } catch {
            body = { raw: text }
        }
    }

    if (!response.ok) {
        return {
            ok: false,
            status: response.status,
            data: body as T,
            error: describeClerkError(response.status, body),
        }
    }

    return { ok: true, status: response.status, data: body as T, error: null }
}

export interface ClerkOrganization {
    id: string
    name: string
}

/**
 * Creates a Clerk organization. `created_by` becomes its org:admin, so the
 * AlphaBoard admin does not need a separate membership call.
 */
export function createClerkOrganization(
    secretKey: string,
    name: string,
    createdByClerkUserId: string,
): Promise<ClerkResult<ClerkOrganization>> {
    return clerkFetch<ClerkOrganization>(secretKey, '/organizations', {
        method: 'POST',
        body: JSON.stringify({ name, created_by: createdByClerkUserId }),
    })
}

/** Resolves ok:true when the organization exists in the *current* instance. */
export function getClerkOrganization(
    secretKey: string,
    clerkOrgId: string,
): Promise<ClerkResult<ClerkOrganization>> {
    return clerkFetch<ClerkOrganization>(secretKey, `/organizations/${clerkOrgId}`, { method: 'GET' })
}

export function deleteClerkOrganization(
    secretKey: string,
    clerkOrgId: string,
): Promise<ClerkResult<unknown>> {
    return clerkFetch(secretKey, `/organizations/${clerkOrgId}`, { method: 'DELETE' })
}

function isAlreadyMemberError(result: ClerkResult<unknown>): boolean {
    if (result.status !== 422) return false
    const errors = (result.data as { errors?: Array<{ code?: string; message?: string }> })?.errors
    if (!Array.isArray(errors)) return false
    return errors.some(
        (e) =>
            e.code === 'organization_membership_exists' ||
            e.code === 'duplicate_record' ||
            /already a member/i.test(e.message ?? ''),
    )
}

/**
 * Adds a user to a Clerk organization. Idempotent: a user who is already a
 * member resolves ok, so retrying a join is not reported as a failure.
 *
 * NOTE: the body key is `user_id`, not `userId`. Clerk rejects the camelCase
 * form with a 422 because `user_id` is required.
 */
export async function addClerkOrganizationMember(
    secretKey: string,
    clerkOrgId: string,
    clerkUserId: string,
    role = 'org:member',
): Promise<ClerkResult<unknown>> {
    const result = await clerkFetch(secretKey, `/organizations/${clerkOrgId}/memberships`, {
        method: 'POST',
        body: JSON.stringify({ user_id: clerkUserId, role }),
    })

    if (!result.ok && isAlreadyMemberError(result)) {
        return { ok: true, status: result.status, data: result.data, error: null }
    }
    return result
}
