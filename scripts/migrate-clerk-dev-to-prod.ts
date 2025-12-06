/**
 * Migration Script: Migrate Users from Clerk Development to Production
 * 
 * This script exports users from Clerk Development instance and imports them into Clerk Production.
 * 
 * Usage:
 * 1. Set environment variables:
 *    - CLERK_DEV_SECRET_KEY (Development secret key: sk_test_...)
 *    - CLERK_PROD_SECRET_KEY (Production secret key: sk_live_...)
 * 
 * 2. Run with Node.js:
 *    npx tsx scripts/migrate-clerk-dev-to-prod.ts
 * 
 * Or with Deno:
 *    deno run --allow-net --allow-env --allow-write scripts/migrate-clerk-dev-to-prod.ts
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
    image_url: string | null;
    public_metadata: Record<string, any>;
    private_metadata: Record<string, any>;
    unsafe_metadata: Record<string, any>;
    external_id: string | null;
    created_at: number;
    updated_at: number;
    last_sign_in_at: number | null;
    password_enabled: boolean;
    totp_enabled: boolean;
    backup_code_enabled: boolean;
    two_factor_enabled: boolean;
    external_accounts: Array<{
        id: string;
        provider: string;
        provider_user_id: string;
        email_address: string;
        username: string | null;
        first_name: string | null;
        last_name: string | null;
        image_url: string | null;
    }>;
}

interface ClerkUserCreate {
    email_address: string[];
    username?: string;
    first_name?: string;
    last_name?: string;
    password?: string;
    skip_password_checks?: boolean;
    skip_password_requirement?: boolean;
    external_id?: string;
    public_metadata?: Record<string, any>;
    private_metadata?: Record<string, any>;
    unsafe_metadata?: Record<string, any>;
    skip_email_verification?: boolean;
}

interface MigrationMapping {
    devUserId: string;
    prodUserId: string;
    email: string;
    username: string | null;
    migrated_at: string;
}

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

/**
 * Fetch all users from Clerk instance
 */
async function fetchClerkUsers(secretKey: string): Promise<ClerkUser[]> {
    const allUsers: ClerkUser[] = [];
    let offset = 0;
    const limit = 500; // Clerk API limit
    let hasMore = true;

    console.log('Fetching users from Clerk...');

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

        // If we got fewer than the limit, we're done
        if (users.length < limit) {
            hasMore = false;
        }

        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return allUsers;
}

/**
 * Create user in Clerk instance
 */
async function createClerkUser(secretKey: string, userData: ClerkUserCreate): Promise<string> {
    const response = await fetch(`${CLERK_API_URL}/users`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${secretKey}`,
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

/**
 * Create OAuth connection for user
 * Note: Clerk API may not support creating OAuth accounts directly.
 * Users will need to reconnect their OAuth accounts on first sign-in.
 */
async function createOAuthConnection(
    secretKey: string,
    userId: string,
    provider: string,
    providerUserId: string,
    email: string,
    username: string | null,
    firstName: string | null,
    lastName: string | null,
    imageUrl: string | null
): Promise<void> {
    // Note: Clerk's API doesn't support creating OAuth accounts directly.
    // Users will need to reconnect their OAuth accounts when they sign in.
    // We'll store the OAuth info in metadata for reference.
    console.log(`  ℹ️  OAuth connection for ${provider} will need to be reconnected on first sign-in`);

    // Store OAuth info in metadata for reference
    try {
        const response = await fetch(`${CLERK_API_URL}/users/${userId}/metadata`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                public_metadata: {
                    dev_oauth_providers: [provider],
                    dev_oauth_email: email,
                },
            }),
        });

        if (!response.ok) {
            // Non-critical, continue
            console.warn(`  ⚠️  Could not store OAuth metadata for ${provider}`);
        }
    } catch (error: any) {
        // Non-critical, continue
        console.warn(`  ⚠️  Error storing OAuth metadata for ${provider}: ${error.message}`);
    }
}

/**
 * Main migration function
 */
async function migrateUsers() {
    const devSecretKey = getEnv('CLERK_DEV_SECRET_KEY') || '';
    const prodSecretKey = getEnv('CLERK_PROD_SECRET_KEY') || '';

    if (!devSecretKey || !prodSecretKey) {
        console.error('Missing required environment variables:');
        console.error('  CLERK_DEV_SECRET_KEY:', !!devSecretKey);
        console.error('  CLERK_PROD_SECRET_KEY:', !!prodSecretKey);
        console.error('\nYou can set them as environment variables or edit the script defaults.');
        exit(1);
        return;
    }

    console.log('🚀 Starting migration from Clerk Development to Production...\n');
    console.log('⚠️  WARNING: This will create users in Production instance.');
    console.log('⚠️  Users will need to reset passwords or use OAuth to sign in.\n');

    try {
        // Fetch users from Development
        console.log('📥 Step 1: Fetching users from Development instance...');
        const devUsers = await fetchClerkUsers(devSecretKey);
        console.log(`✅ Found ${devUsers.length} users in Development\n`);

        if (devUsers.length === 0) {
            console.log('No users to migrate.');
            return;
        }

        // Create mapping file for reference
        const mappings: MigrationMapping[] = [];
        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        // Migrate users one by one
        console.log('📤 Step 2: Migrating users to Production instance...\n');
        for (let i = 0; i < devUsers.length; i++) {
            const devUser = devUsers[i];

            // Get primary email
            const primaryEmail = devUser.email_addresses.find(e => e.verification.status === 'verified')
                || devUser.email_addresses[0];

            if (!primaryEmail) {
                console.log(`[${i + 1}/${devUsers.length}] ⚠️  Skipping user ${devUser.id} - no email address`);
                skippedCount++;
                continue;
            }

            const email = primaryEmail.email_address;

            try {
                console.log(`[${i + 1}/${devUsers.length}] Migrating user: ${email}`);

                // Prepare user data for Production
                const prodUserData: ClerkUserCreate = {
                    email_address: [email],
                    skip_password_checks: true,
                    skip_password_requirement: true, // Users will set password on first login or use OAuth
                    skip_email_verification: primaryEmail.verification.status === 'verified',
                    external_id: devUser.external_id || devUser.id, // Store dev user ID for reference
                    public_metadata: {
                        ...devUser.public_metadata,
                        migrated_from_dev: true,
                        dev_user_id: devUser.id,
                        migrated_at: new Date().toISOString(),
                    },
                    private_metadata: devUser.private_metadata,
                    unsafe_metadata: devUser.unsafe_metadata,
                };

                // Add optional fields
                if (devUser.username) {
                    prodUserData.username = devUser.username;
                }
                if (devUser.first_name) {
                    prodUserData.first_name = devUser.first_name;
                }
                if (devUser.last_name) {
                    prodUserData.last_name = devUser.last_name;
                }

                // Create user in Production
                const prodUserId = await createClerkUser(prodSecretKey, prodUserData);
                console.log(`  ✓ Created Production user: ${prodUserId}`);

                // Migrate OAuth connections
                if (devUser.external_accounts && devUser.external_accounts.length > 0) {
                    console.log(`  🔗 Migrating ${devUser.external_accounts.length} OAuth connection(s)...`);
                    for (const account of devUser.external_accounts) {
                        await createOAuthConnection(
                            prodSecretKey,
                            prodUserId,
                            account.provider,
                            account.provider_user_id,
                            account.email_address,
                            account.username,
                            account.first_name,
                            account.last_name,
                            account.image_url
                        );
                    }
                }

                mappings.push({
                    devUserId: devUser.id,
                    prodUserId,
                    email,
                    username: devUser.username,
                    migrated_at: new Date().toISOString(),
                });

                successCount++;
                console.log(`  ✅ Successfully migrated\n`);

                // Rate limiting: wait 200ms between requests (Clerk allows 60 requests/second)
                if (i < devUsers.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (error: any) {
                console.error(`  ✗ Error migrating user ${email}:`, error.message);
                errorCount++;

                // If user already exists, that's okay
                if (error.message.includes('already exists') ||
                    error.message.includes('duplicate') ||
                    error.message.includes('resource_already_exists')) {
                    console.log(`  → User already exists in Production, skipping\n`);
                    skippedCount++;
                } else {
                    console.log(`  → Skipping this user\n`);
                }
            }
        }

        // Save mappings to file
        const mappingsJson = JSON.stringify(mappings, null, 2);
        const fs = await import('fs/promises');
        await fs.writeFile('clerk-dev-to-prod-mappings.json', mappingsJson, 'utf-8');

        console.log(`\n✅ Migration complete!`);
        console.log(`  ✅ Successfully migrated: ${successCount}`);
        console.log(`  ⚠️  Skipped (already exists): ${skippedCount}`);
        console.log(`  ✗ Errors: ${errorCount}`);
        console.log(`  📄 Mappings saved to: clerk-dev-to-prod-mappings.json`);
        console.log(`\n📋 Next steps:`);
        console.log(`  1. Review the mappings file`);
        console.log(`  2. Users can now sign in to Production with:`);
        console.log(`     - OAuth (if they had OAuth connections)`);
        console.log(`     - Email + "Forgot Password" flow (to set new password)`);
        console.log(`  3. Update your frontend to use Production Clerk keys`);
        console.log(`  4. Test authentication in Production environment`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
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

