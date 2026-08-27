/**
 * Backfill Clerk organizations for AlphaBoard organizations that have none.
 *
 * WHY THIS EXISTS
 * ---------------
 * create-organization has always mirrored new organizations into Clerk, but two
 * defects meant the link was never usable:
 *
 *   1. join-organization posted `userId` to Clerk's memberships endpoint. The
 *      Clerk Backend API requires `user_id`, so every member add returned 422.
 *   2. create-organization persisted clerk_org_id with a trailing
 *      `.catch(...)` on a Supabase query builder. PostgrestBuilder implements
 *      `then` but not `catch`, so that line threw a TypeError which the
 *      surrounding try/catch swallowed — the column stayed NULL even when the
 *      Clerk organization had been created.
 *
 * Both are fixed going forward. Organizations created before the fix still have
 * a NULL clerk_org_id, and organizations created against the Clerk *development*
 * instance hold an ID that does not resolve in production. This script repairs
 * both cases.
 *
 * WHAT IT DOES
 * ------------
 * For each organization:
 *   - clerk_org_id set and resolvable in the current instance -> reconcile members only
 *   - clerk_org_id set but 404 (stale dev ID)                 -> re-create and relink
 *   - clerk_org_id NULL                                       -> create and link
 * Then adds every member to the Clerk organization. The AlphaBoard admin is the
 * Clerk org's `created_by`, which makes them org:admin without a separate call.
 *
 * Idempotent: re-running makes no changes once everything is linked.
 *
 * USAGE
 * -----
 *   export CLERK_SECRET_KEY=sk_live_...
 *   export SUPABASE_URL=https://<ref>.supabase.co
 *   export SUPABASE_SERVICE_KEY=<service role key>
 *
 *   npx tsx scripts/backfill-clerk-orgs.ts            # dry run, no writes
 *   npx tsx scripts/backfill-clerk-orgs.ts --apply    # write
 *
 * Pass --allow-test-instance to run against a sk_test_ key (local/dev only).
 */

export {};

const CLERK_API_URL = 'https://api.clerk.com/v1';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const APPLY = process.argv.includes('--apply');
const ALLOW_TEST_INSTANCE = process.argv.includes('--allow-test-instance');

interface OrganizationRow {
    id: string;
    name: string;
    clerk_org_id: string | null;
}

interface MembershipRow {
    user_id: string;
    organization_id: string;
    role: string;
}

interface MappingRow {
    supabase_user_id: string;
    clerk_user_id: string;
    email: string;
}

function requireEnv(): void {
    const missing = [
        ['CLERK_SECRET_KEY', CLERK_SECRET_KEY],
        ['SUPABASE_URL', SUPABASE_URL],
        ['SUPABASE_SERVICE_KEY', SUPABASE_SERVICE_KEY],
    ].filter(([, v]) => !v).map(([k]) => k);

    if (missing.length) {
        console.error(`Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }

    if (!CLERK_SECRET_KEY!.startsWith('sk_live_') && !ALLOW_TEST_INSTANCE) {
        // Clerk development and production are separate instances. Running this
        // against development would create organizations that never appear in
        // the production dashboard — the exact failure this script repairs.
        console.error(
            `CLERK_SECRET_KEY does not start with sk_live_ (got "${CLERK_SECRET_KEY!.slice(0, 8)}...").\n` +
            'Refusing to run: this would create organizations in the development instance.\n' +
            'Pass --allow-test-instance if that is genuinely what you want.'
        );
        process.exit(1);
    }
}

// --- Supabase (PostgREST) -------------------------------------------------

function supabaseHeaders(extra: Record<string, string> = {}): Record<string, string> {
    return {
        apikey: SUPABASE_SERVICE_KEY!,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        ...extra,
    };
}

async function supabaseGet<T>(path: string): Promise<T> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: supabaseHeaders() });
    if (!res.ok) {
        throw new Error(`Supabase ${res.status} on ${path}: ${await res.text()}`);
    }
    return res.json();
}

async function linkClerkOrg(organizationId: string, clerkOrgId: string): Promise<void> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/organizations?id=eq.${organizationId}`, {
        method: 'PATCH',
        headers: supabaseHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ clerk_org_id: clerkOrgId }),
    });
    if (!res.ok) {
        throw new Error(`Supabase ${res.status} linking org ${organizationId}: ${await res.text()}`);
    }
}

// --- Clerk ----------------------------------------------------------------

async function clerkRequest(
    path: string,
    init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: any }> {
    const res = await fetch(`${CLERK_API_URL}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
            ...(init.headers ?? {}),
        },
    });
    const text = await res.text();
    let body: any = {};
    if (text) {
        try { body = JSON.parse(text); } catch { body = { raw: text }; }
    }
    return { ok: res.ok, status: res.status, body };
}

function clerkErrorText(status: number, body: any): string {
    const errors = body?.errors;
    if (Array.isArray(errors) && errors.length) {
        return errors.map((e: any) => `${e.code ?? 'error'}: ${e.long_message ?? e.message}`).join('; ');
    }
    return `HTTP ${status}`;
}

async function clerkOrgExists(clerkOrgId: string): Promise<boolean> {
    const { ok } = await clerkRequest(`/organizations/${clerkOrgId}`, { method: 'GET' });
    return ok;
}

async function createClerkOrg(name: string, createdBy: string): Promise<string> {
    const { ok, status, body } = await clerkRequest('/organizations', {
        method: 'POST',
        body: JSON.stringify({ name, created_by: createdBy }),
    });
    if (!ok || !body?.id) {
        throw new Error(clerkErrorText(status, body));
    }
    return body.id;
}

/** Returns true when the member is in the org afterwards (including already). */
async function addClerkMember(clerkOrgId: string, clerkUserId: string): Promise<void> {
    // NOTE: `user_id`, not `userId`. Clerk rejects the camelCase form with 422.
    const { ok, status, body } = await clerkRequest(`/organizations/${clerkOrgId}/memberships`, {
        method: 'POST',
        body: JSON.stringify({ user_id: clerkUserId, role: 'org:member' }),
    });
    if (ok) return;

    const errors = body?.errors;
    const alreadyMember = status === 422 && Array.isArray(errors) && errors.some(
        (e: any) =>
            e.code === 'organization_membership_exists' ||
            e.code === 'duplicate_record' ||
            /already a member/i.test(e.message ?? ''),
    );
    if (alreadyMember) return;

    throw new Error(clerkErrorText(status, body));
}

// --- Main -----------------------------------------------------------------

async function main(): Promise<void> {
    requireEnv();

    console.log(APPLY ? 'MODE: apply (writes enabled)' : 'MODE: dry run (no writes)');
    console.log(`Clerk instance: ${CLERK_SECRET_KEY!.startsWith('sk_live_') ? 'live' : 'test'}\n`);

    const [organizations, memberships, mappings] = await Promise.all([
        supabaseGet<OrganizationRow[]>('organizations?select=id,name,clerk_org_id&order=created_at.asc'),
        supabaseGet<MembershipRow[]>('user_organization_membership?select=user_id,organization_id,role'),
        supabaseGet<MappingRow[]>('clerk_user_mapping?select=supabase_user_id,clerk_user_id,email'),
    ]);

    const clerkIdBySupabaseId = new Map(mappings.map((m) => [m.supabase_user_id, m.clerk_user_id]));
    const membersByOrg = new Map<string, MembershipRow[]>();
    for (const m of memberships) {
        const list = membersByOrg.get(m.organization_id) ?? [];
        list.push(m);
        membersByOrg.set(m.organization_id, list);
    }

    console.log(`Found ${organizations.length} organization(s), ${memberships.length} membership(s).\n`);

    let created = 0;
    let relinked = 0;
    let membersAdded = 0;
    const problems: string[] = [];

    for (const org of organizations) {
        const members = membersByOrg.get(org.id) ?? [];
        const admin = members.find((m) => m.role === 'admin');
        console.log(`- ${org.name} (${org.id}) — ${members.length} member(s)`);

        let clerkOrgId = org.clerk_org_id;
        let needsCreate = false;

        if (!clerkOrgId) {
            needsCreate = true;
            console.log('    no Clerk organization linked');
        } else if (await clerkOrgExists(clerkOrgId)) {
            console.log(`    linked to Clerk org ${clerkOrgId}`);
        } else {
            needsCreate = true;
            console.log(`    linked to ${clerkOrgId}, which does not exist in this instance (stale)`);
        }

        if (needsCreate) {
            if (!admin) {
                problems.push(`${org.name}: no admin member, cannot set the Clerk org creator`);
                console.log('    SKIP: no admin member\n');
                continue;
            }
            const adminClerkId = clerkIdBySupabaseId.get(admin.user_id);
            if (!adminClerkId) {
                problems.push(`${org.name}: admin ${admin.user_id} has no clerk_user_mapping row`);
                console.log('    SKIP: admin has no Clerk mapping\n');
                continue;
            }

            if (!APPLY) {
                console.log(`    would create Clerk org "${org.name}" with created_by=${adminClerkId}`);
                clerkOrgId = null;
            } else {
                try {
                    clerkOrgId = await createClerkOrg(org.name, adminClerkId);
                    await linkClerkOrg(org.id, clerkOrgId);
                    if (org.clerk_org_id) relinked++; else created++;
                    console.log(`    created Clerk org ${clerkOrgId} and linked it`);
                } catch (err: any) {
                    problems.push(`${org.name}: could not create Clerk org — ${err.message}`);
                    console.log(`    FAILED: ${err.message}\n`);
                    continue;
                }
            }
        }

        // Reconcile members. The admin is already org:admin via created_by, but
        // re-adding is harmless because addClerkMember tolerates duplicates.
        for (const member of members) {
            if (admin && member.user_id === admin.user_id && needsCreate) continue;

            const memberClerkId = clerkIdBySupabaseId.get(member.user_id);
            if (!memberClerkId) {
                problems.push(`${org.name}: member ${member.user_id} has no clerk_user_mapping row`);
                continue;
            }

            if (!APPLY || !clerkOrgId) {
                console.log(`    would add ${memberClerkId} as org:member`);
                continue;
            }

            try {
                await addClerkMember(clerkOrgId, memberClerkId);
                membersAdded++;
                console.log(`    ensured ${memberClerkId} is a member`);
            } catch (err: any) {
                problems.push(`${org.name}: could not add ${memberClerkId} — ${err.message}`);
                console.log(`    FAILED adding ${memberClerkId}: ${err.message}`);
            }
        }
        console.log('');
    }

    console.log('---');
    if (APPLY) {
        console.log(`Clerk organizations created: ${created}`);
        console.log(`Stale links repaired:        ${relinked}`);
        console.log(`Memberships ensured:         ${membersAdded}`);
    } else {
        console.log('Dry run complete. Re-run with --apply to make these changes.');
    }

    if (problems.length) {
        console.log(`\n${problems.length} problem(s) needing attention:`);
        for (const p of problems) console.log(`  - ${p}`);
        console.log(
            '\nUsers with no clerk_user_mapping row have not signed in to this Clerk\n' +
            'instance yet. Have them sign in, then re-run this script.'
        );
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
