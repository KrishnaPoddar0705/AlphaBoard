/**
 * Script: Map Existing Clerk Production Users to Supabase
 * 
 * This script maps all existing Clerk Production users to Supabase users.
 * It calls the sync-clerk-user edge function for each user to create mappings.
 * 
 * Usage:
 * 1. Set environment variables:
 *    - CLERK_PROD_SECRET_KEY (Production secret key: sk_live_...)
 *    - SUPABASE_URL
 *    - SUPABASE_ANON_KEY (or service role key)
 * 
 * 2. Run with Node.js:
 *    npx tsx scripts/map-clerk-prod-users.ts
 */

const CLERK_API_URL = 'https://api.clerk.com/v1';

interface ClerkUser {
    id: string;
    email_addresses: Array<{
        id: string;
        email_address: string;
        verification: {
            status: string;
        };
    }>;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
}

// Helper to get env var
function getEnv(key: string): string | undefined {
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key];
    }
    // @ts-ignore - Deno global
    if (typeof Deno !== 'undefined' && Deno.env) {
        // @ts-ignore
        return Deno.env.get(key);
    }
    return undefined;
}

function exit(code: number): void {
    if (typeof process !== 'undefined') {
        process.exit(code);
    }
    // @ts-ignore - Deno global
    if (typeof Deno !== 'undefined') {
        // @ts-ignore
        Deno.exit(code);
    }
}

/**
 * Fetch all users from Clerk Production instance
 */
async function fetchClerkUsers(secretKey: string): Promise<ClerkUser[]> {
    const allUsers: ClerkUser[] = [];
    let offset = 0;
    const limit = 500;
    let hasMore = true;

    console.log('📥 Fetching users from Clerk Production...');

    while (hasMore) {
        const response = await fetch(`${CLERK_API_URL}/users?limit=${limit}&offset=${offset}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to fetch Clerk users: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        const users = data as ClerkUser[];

        if (users.length === 0) {
            hasMore = false;
            break;
        }

        allUsers.push(...users);
        offset += users.length;

        console.log(`  Fetched ${allUsers.length} users so far...`);

        if (users.length < limit) {
            hasMore = false;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return allUsers;
}

/**
 * Call sync-clerk-user edge function to create mapping
 */
async function syncUserToSupabase(
    supabaseUrl: string,
    supabaseKey: string,
    clerkUser: ClerkUser
): Promise<{ success: boolean; supabaseUserId?: string; error?: string }> {
    const primaryEmail = clerkUser.email_addresses.find(e => e.verification.status === 'verified')
        || clerkUser.email_addresses[0];

    if (!primaryEmail) {
        return { success: false, error: 'No email address' };
    }

    const edgeFunctionUrl = `${supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')}/functions/v1/sync-clerk-user`;

    try {
        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey,
            },
            body: JSON.stringify({
                clerkUser: {
                    clerkUserId: clerkUser.id,
                    email: primaryEmail.email_address,
                    username: clerkUser.username || undefined,
                    firstName: clerkUser.first_name || undefined,
                    lastName: clerkUser.last_name || undefined,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            return { success: false, error: JSON.stringify(error) };
        }

        const data = await response.json();
        return { success: true, supabaseUserId: data.supabaseUserId };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Main mapping function
 */
async function mapUsers() {
    const prodSecretKey = getEnv('CLERK_PROD_SECRET_KEY') || '';
    const supabaseUrl = getEnv('SUPABASE_URL') || '';
    const supabaseKey = getEnv('SUPABASE_ANON_KEY') || getEnv('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!prodSecretKey || !supabaseUrl || !supabaseKey) {
        console.error('Missing required environment variables:');
        console.error('  CLERK_PROD_SECRET_KEY:', !!prodSecretKey);
        console.error('  SUPABASE_URL:', !!supabaseUrl);
        console.error('  SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey);
        console.error('\nYou can set them as environment variables or edit the script defaults.');
        exit(1);
        return;
    }

    console.log('🚀 Mapping Clerk Production users to Supabase...\n');

    try {
        // Fetch users from Production
        const prodUsers = await fetchClerkUsers(prodSecretKey);
        console.log(`✅ Found ${prodUsers.length} users in Production\n`);

        if (prodUsers.length === 0) {
            console.log('No users to map.');
            return;
        }

        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        // Map users one by one
        console.log('📤 Mapping users to Supabase...\n');
        for (let i = 0; i < prodUsers.length; i++) {
            const user = prodUsers[i];
            const primaryEmail = user.email_addresses.find(e => e.verification.status === 'verified')
                || user.email_addresses[0];

            if (!primaryEmail) {
                console.log(`[${i + 1}/${prodUsers.length}] ⚠️  Skipping user ${user.id} - no email address`);
                skippedCount++;
                continue;
            }

            try {
                console.log(`[${i + 1}/${prodUsers.length}] Mapping user: ${primaryEmail.email_address}`);

                const result = await syncUserToSupabase(supabaseUrl, supabaseKey, user);

                if (result.success) {
                    console.log(`  ✅ Mapped to Supabase user: ${result.supabaseUserId}\n`);
                    successCount++;
                } else {
                    // Check if user already mapped (that's okay)
                    if (result.error?.includes('already exists') || result.error?.includes('duplicate')) {
                        console.log(`  ℹ️  Already mapped (skipping)\n`);
                        skippedCount++;
                    } else {
                        console.error(`  ✗ Error: ${result.error}\n`);
                        errorCount++;
                    }
                }

                // Rate limiting
                if (i < prodUsers.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (error: any) {
                console.error(`  ✗ Error mapping user: ${error.message}\n`);
                errorCount++;
            }
        }

        console.log(`\n✅ Mapping complete!`);
        console.log(`  ✅ Successfully mapped: ${successCount}`);
        console.log(`  ℹ️  Already mapped (skipped): ${skippedCount}`);
        console.log(`  ✗ Errors: ${errorCount}`);
        console.log(`\n📋 Next steps:`);
        console.log(`  1. Check Supabase Dashboard → clerk_user_mapping table`);
        console.log(`  2. Set up Clerk webhook for automatic sync (see CLERK_WEBHOOK_SETUP.md)`);

    } catch (error) {
        console.error('❌ Mapping failed:', error);
        exit(1);
    }
}

// Run mapping
if (typeof require !== 'undefined' || (typeof import.meta !== 'undefined' && import.meta.main)) {
    mapUsers().catch(error => {
        console.error('Unhandled error:', error);
        exit(1);
    });
}

