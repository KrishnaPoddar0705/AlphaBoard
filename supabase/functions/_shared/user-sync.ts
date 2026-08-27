// Resolve a Clerk user to a Supabase user, creating or re-linking as needed.
//
// WHY THIS EXISTS
// ---------------
// Clerk development and production are separate instances with separate user
// pools. Switching the app to a pk_live_ key issues every returning user a NEW
// clerk_user_id that matches nothing in public.clerk_user_mapping, while their
// Supabase account — and all their recommendations, portfolios and performance
// history — still exists under the old ID.
//
// join-organization and create-organization used to respond to a mapping miss
// by calling auth.admin.createUser unconditionally. For a returning user that
// fails on the unique email constraint, and the caller reported the raw
// "Failed to create user". Creating a second account would be the wrong repair
// anyway: it would orphan everything the user already has.
//
// So an existing account for this email is the EXPECTED case, not an error. We
// rebind the mapping row to the new Clerk ID and keep the original Supabase
// user, which preserves their data and is idempotent across retries.
//
// Rebinding is only safe when the stored Clerk ID is genuinely stale. Clerk
// enforces one verified email per user within an instance, so if the stored ID
// still resolves in the *current* instance, two live accounts share the email
// and that is a real conflict a human must settle — we return 409 rather than
// silently merging two people's accounts.

import { getClerkUser } from './clerk.ts'

export interface UserSyncResult {
    userId: string | null
    error: string | null
    details: string | null
    status: number
}

function ok(userId: string): UserSyncResult {
    return { userId, error: null, details: null, status: 200 }
}

function fail(error: string, details: string, status: number): UserSyncResult {
    return { userId: null, error, details, status }
}

/** Supabase surfaces "email already registered" in several shapes. */
function isEmailExistsError(err: unknown): boolean {
    if (!err) return false
    const e = err as { message?: string; status?: number; code?: string }
    const text = `${e.message ?? ''} ${JSON.stringify(err)}`.toLowerCase()
    const code = String(e.code ?? '').toLowerCase()

    if (code === 'email_exists' || code === 'user_already_exists') return true
    if (e.status === 422 || e.status === 400) return true
    return (
        text.includes('email') &&
        (text.includes('already') ||
            text.includes('registered') ||
            text.includes('exists') ||
            text.includes('duplicate') ||
            text.includes('unique'))
    )
}

/** Page through auth users to find one by email. */
async function findAuthUserByEmail(supabaseAdmin: any, email: string): Promise<string | null> {
    const perPage = 1000
    const maxPages = 5
    const target = email.toLowerCase()

    for (let page = 1; page <= maxPages; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
        if (error || !data?.users?.length) return null

        const match = data.users.find(
            (u: { id: string; email?: string }) => u.email?.toLowerCase() === target,
        )
        if (match) return match.id

        if (data.users.length < perPage) return null
    }
    return null
}

/**
 * Returns the Supabase user ID for a Clerk user, creating the account and its
 * supporting rows when the user is genuinely new.
 *
 * Never throws for expected conditions — callers get a structured result with
 * an HTTP status to forward.
 */
export async function resolveSupabaseUserForClerkUser(
    supabaseAdmin: any,
    clerkSecretKey: string,
    clerkUserId: string,
): Promise<UserSyncResult> {
    // 1. Happy path: the mapping already exists.
    const { data: mapping } = await supabaseAdmin
        .from('clerk_user_mapping')
        .select('supabase_user_id')
        .eq('clerk_user_id', clerkUserId)
        .maybeSingle()

    if (mapping?.supabase_user_id) {
        return ok(mapping.supabase_user_id)
    }

    // 2. Find out who this Clerk user is.
    const clerkResult = await getClerkUser(clerkSecretKey, clerkUserId)
    if (!clerkResult.ok || !clerkResult.data) {
        return fail('Failed to fetch user from Clerk', clerkResult.error ?? 'Unknown error', 401)
    }

    const clerkUser = clerkResult.data as {
        id: string
        username?: string
        first_name?: string
        last_name?: string
        email_addresses?: Array<{ email_address: string }>
    }
    const email = clerkUser.email_addresses?.[0]?.email_address
    if (!email) {
        return fail('Invalid Clerk user', 'Clerk user has no email address', 400)
    }

    // 3. Try to create a brand new Supabase account.
    const userMetadata: Record<string, unknown> = { clerk_user_id: clerkUserId }
    if (clerkUser.username) userMetadata.username = clerkUser.username
    if (clerkUser.first_name) userMetadata.first_name = clerkUser.first_name
    if (clerkUser.last_name) userMetadata.last_name = clerkUser.last_name

    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: userMetadata,
    })

    if (!createUserError && newUser?.user) {
        const userId = newUser.user.id
        await createSupportingRows(supabaseAdmin, userId, clerkUserId, email, clerkUser)
        console.log(`Created Supabase user ${userId} for Clerk user ${clerkUserId}`)
        return ok(userId)
    }

    if (!isEmailExistsError(createUserError)) {
        return fail(
            'Failed to create user',
            (createUserError as { message?: string })?.message ?? 'Unknown error',
            500,
        )
    }

    // 4. The account already exists. Re-link rather than duplicate.
    console.log(`Email ${email} already has a Supabase account; attempting to re-link`)

    const { data: mappingByEmail } = await supabaseAdmin
        .from('clerk_user_mapping')
        .select('clerk_user_id, supabase_user_id')
        .eq('email', email)
        .maybeSingle()

    if (mappingByEmail?.supabase_user_id) {
        if (mappingByEmail.clerk_user_id === clerkUserId) {
            return ok(mappingByEmail.supabase_user_id)
        }

        // Refuse to rebind only for a genuinely different, still-live account.
        //
        // Clerk enforces one verified email per user within an instance, so a
        // stored ID that still resolves *with this same email* has to be the
        // same person — which contradicts the mapping miss and is safe to
        // rebind. A 404 means the ID came from another instance (development)
        // and is likewise safe. Only a live ID owning a DIFFERENT email is a
        // real clash, and merging those would hand one person another's data.
        const stored = await getClerkUser(clerkSecretKey, mappingByEmail.clerk_user_id)
        const storedEmail = stored.data?.email_addresses?.[0]?.email_address?.toLowerCase()

        if (stored.ok && storedEmail && storedEmail !== email.toLowerCase()) {
            return fail(
                'Email already registered',
                `This Supabase account is linked to a different active Clerk user ` +
                    `(${mappingByEmail.clerk_user_id}, ${storedEmail}). Contact support to merge them.`,
                409,
            )
        }

        const { error: rebindError } = await supabaseAdmin
            .from('clerk_user_mapping')
            .update({ clerk_user_id: clerkUserId })
            .eq('supabase_user_id', mappingByEmail.supabase_user_id)

        if (rebindError) {
            return fail('Failed to link account', rebindError.message, 500)
        }

        console.log(
            `Re-linked ${email} from stale Clerk ID ${mappingByEmail.clerk_user_id} to ${clerkUserId}`,
        )
        return ok(mappingByEmail.supabase_user_id)
    }

    // 5. Account exists but was never mapped — find it and map it.
    const existingUserId = await findAuthUserByEmail(supabaseAdmin, email)
    if (!existingUserId) {
        return fail(
            'Email already registered',
            'An account exists for this email but could not be located. Please contact support.',
            409,
        )
    }

    const { error: insertError } = await supabaseAdmin
        .from('clerk_user_mapping')
        .insert({ clerk_user_id: clerkUserId, supabase_user_id: existingUserId, email })

    if (insertError) {
        return fail('Failed to link account', insertError.message, 500)
    }

    console.log(`Linked existing Supabase user ${existingUserId} to Clerk user ${clerkUserId}`)
    return ok(existingUserId)
}

/**
 * Best-effort supporting rows for a newly created user.
 *
 * NOTE: these are awaited and their errors inspected. A Supabase query builder
 * is PromiseLike but has no .catch(), so the previous `.catch(...)` form threw
 * a TypeError that aborted the whole sync.
 */
async function createSupportingRows(
    supabaseAdmin: any,
    userId: string,
    clerkUserId: string,
    email: string,
    clerkUser: { username?: string; first_name?: string },
): Promise<void> {
    const { error: mappingError } = await supabaseAdmin
        .from('clerk_user_mapping')
        .insert({ clerk_user_id: clerkUserId, supabase_user_id: userId, email })
    if (mappingError) console.warn('Could not create clerk_user_mapping row:', mappingError)

    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
            id: userId,
            username: clerkUser.username || clerkUser.first_name || email.split('@')[0],
            role: 'analyst',
        })
    if (profileError) console.warn('Could not create profile row:', profileError)

    const { error: performanceError } = await supabaseAdmin
        .from('performance')
        .insert({ user_id: userId })
    if (performanceError) console.warn('Could not create performance row:', performanceError)
}
