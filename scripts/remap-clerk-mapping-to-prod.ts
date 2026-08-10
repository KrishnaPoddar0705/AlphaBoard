/**
 * Remap clerk_user_mapping from the Clerk development instance to production.
 *
 * WHY THIS EXISTS
 * ---------------
 * Clerk development and production are separate instances with separate user
 * pools. A user who signs in against the production instance receives a brand
 * new user ID — `user_...` values do not carry over.
 *
 * public.clerk_user_mapping keys on clerk_user_id, and the backend resolves
 * every request through it (main.py looks it up in 11 places, plus
 * performance.py:92). So the moment VITE_CLERK_PUBLISHABLE_KEY switches to a
 * pk_live_ key, every row in that table points at a dev ID that will never be
 * presented again, and each user's recommendations, portfolio and performance
 * history become unreachable.
 *
 * This script rewrites clerk_user_id in place, matching on the email column
 * that clerk_user_mapping already stores. supabase_user_id is never touched,
 * so nothing downstream of the mapping has to change.
 *
 * ORDER OF OPERATIONS
 * -------------------
 * Run this AFTER users have signed in to the production instance at least
 * once — a user with no production account cannot be matched and will be
 * reported as unmatched. Re-running is safe and idempotent.
 *
 * USAGE
 * -----
 *   export CLERK_PROD_SECRET_KEY=sk_live_...
 *   export SUPABASE_URL=https://<ref>.supabase.co
 *   export SUPABASE_SERVICE_KEY=<service role key>
 *
 *   npx tsx scripts/remap-clerk-mapping-to-prod.ts            # dry run
 *   npx tsx scripts/remap-clerk-mapping-to-prod.ts --apply    # write
 *
 * Dry run is the default and makes no writes. --apply writes a JSON backup of
 * the whole table before touching anything.
 */

export {};

const CLERK_API_URL = 'https://api.clerk.com/v1';

const CLERK_PROD_SECRET_KEY = process.env.CLERK_PROD_SECRET_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const APPLY = process.argv.includes('--apply');

interface ClerkUser {
    id: string;
    email_addresses: Array<{ email_address: string; verification?: { status: string } }>;
    primary_email_address_id?: string | null;
}

interface MappingRow {
    id: string;
    clerk_user_id: string;
    supabase_user_id: string;
    email: string;
}

function requireEnv(): void {
    const missing = [
        ['CLERK_PROD_SECRET_KEY', CLERK_PROD_SECRET_KEY],
        ['SUPABASE_URL', SUPABASE_URL],
        ['SUPABASE_SERVICE_KEY', SUPABASE_SERVICE_KEY],
    ].filter(([, v]) => !v).map(([k]) => k);

    if (missing.length) {
        console.error(`Missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }
    if (!CLERK_PROD_SECRET_KEY!.startsWith('sk_live_')) {
        // Guard against pointing this at the development instance, which would
        // "successfully" rewrite every row back to the IDs we are migrating off.
        console.error(
            `CLERK_PROD_SECRET_KEY does not start with sk_live_ (got "${CLERK_PROD_SECRET_KEY!.slice(0, 8)}...").\n` +
            'Refusing to run: pointing this at the development instance would rewrite\n' +
            'the mapping back to development IDs.'
        );
        process.exit(1);
    }
}

const normalizeEmail = (e: string): string => e.trim().toLowerCase();

/** Fetch every user from the Clerk production instance, following pagination. */
async function fetchAllClerkProdUsers(): Promise<ClerkUser[]> {
    const users: ClerkUser[] = [];
    const limit = 100;
    let offset = 0;

    for (;;) {
        const res = await fetch(`${CLERK_API_URL}/users?limit=${limit}&offset=${offset}`, {
            headers: { Authorization: `Bearer ${CLERK_PROD_SECRET_KEY}` },
        });
        if (!res.ok) {
            throw new Error(`Clerk API ${res.status}: ${await res.text()}`);
        }
        const body = await res.json();
        // Clerk has returned both a bare array and a {data,total_count} envelope
        // depending on API version; accept either.
        const batch: ClerkUser[] = Array.isArray(body) ? body : body.data;
        users.push(...batch);
        if (batch.length < limit) break;
        offset += limit;
    }
    return users;
}

/** Fetch every row of clerk_user_mapping via PostgREST. */
async function fetchMappingRows(): Promise<MappingRow[]> {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/clerk_user_mapping?select=id,clerk_user_id,supabase_user_id,email`,
        {
            headers: {
                apikey: SUPABASE_SERVICE_KEY!,
                Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
        }
    );
    if (!res.ok) {
        throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    }
    return res.json();
}

async function updateMappingRow(rowId: string, newClerkUserId: string): Promise<void> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clerk_user_mapping?id=eq.${rowId}`, {
        method: 'PATCH',
        headers: {
            apikey: SUPABASE_SERVICE_KEY!,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify({ clerk_user_id: newClerkUserId, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) {
        throw new Error(`Supabase PATCH ${res.status}: ${await res.text()}`);
    }
}

/** Primary email if identifiable, otherwise the first address on the account. */
function primaryEmail(u: ClerkUser): string | null {
    if (!u.email_addresses?.length) return null;
    return u.email_addresses[0].email_address ?? null;
}

async function main(): Promise<void> {
    requireEnv();

    console.log(APPLY ? '=== APPLY MODE — will write ===\n' : '=== DRY RUN — no writes ===\n');

    const [prodUsers, rows] = await Promise.all([fetchAllClerkProdUsers(), fetchMappingRows()]);
    console.log(`Clerk production users : ${prodUsers.length}`);
    console.log(`clerk_user_mapping rows: ${rows.length}\n`);

    // email -> production clerk id
    const byEmail = new Map<string, string>();
    const duplicateEmails: string[] = [];
    for (const u of prodUsers) {
        const email = primaryEmail(u);
        if (!email) continue;
        const key = normalizeEmail(email);
        if (byEmail.has(key)) duplicateEmails.push(key);
        else byEmail.set(key, u.id);
    }

    if (duplicateEmails.length) {
        console.log('WARNING: multiple production accounts share these emails; the');
        console.log('first was used. Resolve by hand if any of these matter:');
        for (const e of duplicateEmails) console.log(`  ${e}`);
        console.log('');
    }

    const toUpdate: Array<{ row: MappingRow; newId: string }> = [];
    const alreadyCorrect: MappingRow[] = [];
    const unmatched: MappingRow[] = [];

    for (const row of rows) {
        const newId = byEmail.get(normalizeEmail(row.email));
        if (!newId) unmatched.push(row);
        else if (newId === row.clerk_user_id) alreadyCorrect.push(row);
        else toUpdate.push({ row, newId });
    }

    // clerk_user_id carries a UNIQUE constraint. If two mapping rows would
    // resolve to the same production ID the second PATCH fails mid-run, so
    // catch it before writing anything.
    const targetCounts = new Map<string, number>();
    for (const { newId } of toUpdate) targetCounts.set(newId, (targetCounts.get(newId) ?? 0) + 1);
    const collisions = [...targetCounts.entries()].filter(([, n]) => n > 1);
    if (collisions.length) {
        console.error('ABORT: these production IDs are the target of more than one mapping row,');
        console.error('which would violate the UNIQUE constraint on clerk_user_id:');
        for (const [id, n] of collisions) console.error(`  ${id} (${n} rows)`);
        process.exit(1);
    }

    console.log(`To remap       : ${toUpdate.length}`);
    console.log(`Already correct: ${alreadyCorrect.length}`);
    console.log(`Unmatched      : ${unmatched.length}\n`);

    for (const { row, newId } of toUpdate) {
        console.log(`  ${row.email}`);
        console.log(`    ${row.clerk_user_id}  ->  ${newId}`);
    }

    if (unmatched.length) {
        console.log('\nUnmatched — no production Clerk account with this email.');
        console.log('These users keep their development ID and will not see their data');
        console.log('until they sign in to production and this script is re-run:');
        for (const row of unmatched) console.log(`  ${row.email}  (${row.clerk_user_id})`);
    }

    const orphanProd = [...byEmail.keys()].filter(
        (e) => !rows.some((r) => normalizeEmail(r.email) === e)
    );
    if (orphanProd.length) {
        console.log('\nProduction accounts with no mapping row (new signups, nothing to do):');
        for (const e of orphanProd) console.log(`  ${e}`);
    }

    if (!APPLY) {
        console.log('\nDry run complete. Re-run with --apply to write these changes.');
        return;
    }

    if (!toUpdate.length) {
        console.log('\nNothing to write.');
        return;
    }

    // Back up the untouched table first. Restoring is a PATCH per row using
    // this file, so it is worth keeping until the migration is confirmed good.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const dir = path.join(process.cwd(), 'scripts', 'backups');
    await fs.mkdir(dir, { recursive: true });
    const backup = path.join(dir, `clerk_user_mapping-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await fs.writeFile(backup, JSON.stringify(rows, null, 2));
    console.log(`\nBacked up ${rows.length} rows to ${backup}`);

    let ok = 0;
    const failed: Array<{ email: string; error: string }> = [];
    for (const { row, newId } of toUpdate) {
        try {
            await updateMappingRow(row.id, newId);
            ok++;
            console.log(`  updated ${row.email}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            failed.push({ email: row.email, error: message });
            console.error(`  FAILED  ${row.email}: ${message}`);
        }
    }

    console.log(`\nUpdated ${ok}/${toUpdate.length}`);
    if (failed.length) {
        console.error(`${failed.length} failed — the backup above holds the original values.`);
        process.exit(1);
    }
    console.log('Re-run without --apply to confirm everything now reports as already correct.');
}

main().catch((err) => {
    console.error('\nFatal:', err instanceof Error ? err.message : err);
    process.exit(1);
});
