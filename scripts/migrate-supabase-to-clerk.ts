/**
 * Migration Script: Import Supabase Users to Clerk
 * 
 * This script exports users from Supabase and imports them into Clerk.
 * Follows Clerk's migration guide: https://clerk.com/docs/guides/development/migrating/overview
 * 
 * Usage:
 * 1. Install dependencies:
 *    npm install @supabase/supabase-js
 * 
 * 2. Set environment variables:
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_ROLE_KEY
 *    - CLERK_SECRET_KEY
 * 
 * 3. Run with Node.js:
 *    npx tsx scripts/migrate-supabase-to-clerk.ts
 * 
 * Or with Deno:
 *    deno run --allow-net --allow-env --allow-write scripts/migrate-supabase-to-clerk.ts
 */

// Use Node.js import for TypeScript/Node.js compatibility
import { createClient } from '@supabase/supabase-js';

interface SupabaseUser {
    id: string;
    email: string;
    email_confirmed_at: string | null;
    created_at: string;
    updated_at: string;
    raw_user_meta_data: {
        username?: string;
        first_name?: string;
        last_name?: string;
    };
}

interface ClerkUserCreate {
    email_address: string[];
    password?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    skip_password_checks?: boolean;
    skip_password_requirement?: boolean;
    external_id?: string; // Store Supabase user ID
    public_metadata?: Record<string, any>;
    private_metadata?: Record<string, any>;
    unsafe_metadata?: Record<string, any>;
}

const CLERK_API_URL = 'https://api.clerk.com/v1';

// Helper to get env var (works in both Node.js and Deno)
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

// Helper to exit (works in both Node.js and Deno)
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

async function getSupabaseUsers(supabaseUrl: string, serviceRoleKey: string): Promise<SupabaseUser[]> {
    // Create Supabase admin client with service role key
    // The service role key bypasses RLS and allows admin operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    // Get all users from auth.users with pagination
    const allUsers: SupabaseUser[] = [];
    let page = 1;
    const perPage = 1000; // Max per page
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase.auth.admin.listUsers({
            page,
            perPage,
        });

        if (error) {
            throw new Error(`Failed to fetch Supabase users: ${error.message}. Make sure you're using the SERVICE_ROLE_KEY (not anon key).`);
        }

        if (!data || !data.users || data.users.length === 0) {
            hasMore = false;
            break;
        }

        // Map to our interface
        const mappedUsers = data.users.map(user => ({
            id: user.id,
            email: user.email || '',
            email_confirmed_at: user.email_confirmed_at || null,
            created_at: user.created_at,
            updated_at: user.updated_at || user.created_at,
            raw_user_meta_data: (user.user_metadata || {}) as {
                username?: string;
                first_name?: string;
                last_name?: string;
            },
        }));

        allUsers.push(...mappedUsers);

        // Check if there are more pages
        hasMore = data.users.length === perPage;
        page++;

        console.log(`  Fetched ${allUsers.length} users so far...`);
    }

    return allUsers;
}

async function createClerkUser(clerkSecretKey: string, userData: ClerkUserCreate): Promise<string> {
    const response = await fetch(`${CLERK_API_URL}/users`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${clerkSecretKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to create Clerk user: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.id;
}

async function migrateUsers() {
    const supabaseUrl = getEnv('SUPABASE_URL');
    const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const clerkSecretKey = getEnv('CLERK_SECRET_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey || !clerkSecretKey) {
        console.error('Missing required environment variables:');
        console.error('  SUPABASE_URL:', !!supabaseUrl);
        console.error('  SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceRoleKey);
        console.error('  CLERK_SECRET_KEY:', !!clerkSecretKey);
        exit(1);
        return;
    }

    console.log('Starting migration from Supabase to Clerk...\n');

    try {
        // Get all Supabase users
        console.log('Fetching users from Supabase...');
        const supabaseUsers = await getSupabaseUsers(supabaseUrl!, supabaseServiceRoleKey!);
        console.log(`Found ${supabaseUsers.length} users in Supabase\n`);

        if (supabaseUsers.length === 0) {
            console.log('No users to migrate.');
            return;
        }

        // Create mapping file for reference
        const mappings: Array<{ supabaseUserId: string; clerkUserId: string; email: string }> = [];
        let successCount = 0;
        let errorCount = 0;

        // Migrate users one by one (respecting rate limits)
        for (let i = 0; i < supabaseUsers.length; i++) {
            const user = supabaseUsers[i];
            const email = user.email;

            if (!email) {
                console.log(`[${i + 1}/${supabaseUsers.length}] Skipping user ${user.id} - no email`);
                errorCount++;
                continue;
            }

            try {
                console.log(`[${i + 1}/${supabaseUsers.length}] Migrating user: ${email}`);

                // Prepare Clerk user data
                const clerkUserData: ClerkUserCreate = {
                    email_address: [email],
                    external_id: user.id, // Store Supabase ID for reference
                    skip_password_checks: true, // Skip password since we don't have it
                    skip_password_requirement: true, // Users will set password on first login
                    public_metadata: {
                        migrated_from_supabase: true,
                        supabase_user_id: user.id,
                        migrated_at: new Date().toISOString(),
                    },
                };

                // Add optional fields
                if (user.raw_user_meta_data?.username) {
                    // Sanitize username: Clerk only allows letters, numbers, - and _
                    // Replace invalid characters (like dots) with underscores
                    const sanitizedUsername = user.raw_user_meta_data.username
                        .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace invalid chars with underscore
                        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
                        .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

                    if (sanitizedUsername.length > 0) {
                        clerkUserData.username = sanitizedUsername;
                    }
                }
                if (user.raw_user_meta_data?.first_name) {
                    clerkUserData.first_name = user.raw_user_meta_data.first_name;
                }
                if (user.raw_user_meta_data?.last_name) {
                    clerkUserData.last_name = user.raw_user_meta_data.last_name;
                }

                // Create user in Clerk
                const clerkUserId = await createClerkUser(clerkSecretKey!, clerkUserData);

                mappings.push({
                    supabaseUserId: user.id,
                    clerkUserId,
                    email,
                });

                successCount++;
                console.log(`  ✓ Created Clerk user: ${clerkUserId}\n`);

                // Rate limiting: wait 100ms between requests (Clerk allows 60 requests/second)
                if (i < supabaseUsers.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error: any) {
                console.error(`  ✗ Error migrating user ${email}:`, error.message);
                errorCount++;

                // If user already exists, that's okay - we'll handle it in sync
                if (error.message.includes('already exists') || error.message.includes('duplicate')) {
                    console.log(`  → User already exists in Clerk, will be handled by sync function\n`);
                } else {
                    console.log(`  → Skipping this user\n`);
                }
            }
        }

        // Save mappings to file
        const mappingsJson = JSON.stringify(mappings, null, 2);
        const fs = await import('fs/promises');
        await fs.writeFile('clerk-migration-mappings.json', mappingsJson, 'utf-8');
        console.log(`\nMigration complete!`);
        console.log(`  Success: ${successCount}`);
        console.log(`  Errors: ${errorCount}`);
        console.log(`  Mappings saved to: clerk-migration-mappings.json`);
        console.log(`\nNext steps:`);
        console.log(`  1. Review the mappings file`);
        console.log(`  2. Run the database migration to create clerk_user_mapping entries`);
        console.log(`  3. Users can now sign in with Clerk using their email`);
        console.log(`  4. The sync function will automatically link Clerk users to Supabase users`);

    } catch (error) {
        console.error('Migration failed:', error);
        exit(1);
    }
}

// Run migration (works in both Node.js and Deno)
if (typeof require !== 'undefined' || (typeof import.meta !== 'undefined' && import.meta.main)) {
    migrateUsers().catch(error => {
        console.error('Unhandled error:', error);
        exit(1);
    });
}

