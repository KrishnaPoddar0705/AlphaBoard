/**
 * Configure Clerk Domain and Allowed Origins
 * 
 * This script configures Clerk to allow authentication from the custom domain
 * https://www.alphaboard.theunicornlabs.com/
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Never hardcode a fallback here — see the note in add-domain-clerk.js.
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) {
    console.error('CLERK_SECRET_KEY is not set. Export it before running:');
    console.error('  export CLERK_SECRET_KEY=sk_...');
    process.exit(1);
}
const CLERK_API_URL = 'https://api.clerk.com/v1';

// Override with: npx tsx scripts/configure-clerk-domain.ts alphaboard.theunicornlabs.com
const CUSTOM_DOMAIN = process.argv[2] || 'alphaboard.theunicornlabs.com';
const CUSTOM_DOMAIN_URL = `https://${CUSTOM_DOMAIN}`;

interface ClerkInstance {
    id: string;
    name: string;
    frontend_api: {
        allowed_origins: string[];
    };
}

/**
 * Get the Clerk instance ID
 */
async function getInstanceId(): Promise<string> {
    const response = await fetch(`${CLERK_API_URL}/instances`, {
        headers: {
            'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get instances: ${response.status} ${error}`);
    }

    const instances = await response.json();
    if (!instances || instances.length === 0) {
        throw new Error('No Clerk instances found');
    }

    return instances[0].id;
}

/**
 * Get instance details
 */
async function getInstance(instanceId: string): Promise<ClerkInstance> {
    const response = await fetch(`${CLERK_API_URL}/instances/${instanceId}`, {
        headers: {
            'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get instance: ${response.status} ${error}`);
    }

    return await response.json();
}

/**
 * Update Frontend API allowed origins
 */
async function updateAllowedOrigins(instanceId: string, origins: string[]): Promise<void> {
    console.log(`\n📝 Updating allowed origins for instance ${instanceId}...`);
    console.log(`   Origins to add: ${origins.join(', ')}`);

    // Get current instance to see existing origins
    const instance = await getInstance(instanceId);
    const currentOrigins = instance.frontend_api?.allowed_origins || [];

    // Merge with new origins (avoid duplicates)
    const newOrigins = [...new Set([...currentOrigins, ...origins])];

    console.log(`   Current origins: ${currentOrigins.join(', ') || '(none)'}`);
    console.log(`   New origins: ${newOrigins.join(', ')}`);

    const response = await fetch(`${CLERK_API_URL}/instances/${instanceId}/frontend_api`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            allowed_origins: newOrigins,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to update allowed origins: ${response.status} ${error}`);
    }

    const result = await response.json();
    console.log(`✅ Successfully updated allowed origins!`);
    console.log(`   Updated origins: ${result.allowed_origins?.join(', ') || '(none)'}`);
}

/**
 * Main function
 */
async function main() {
    console.log('🚀 Configuring Clerk for custom domain...\n');
    console.log(`   Domain: ${CUSTOM_DOMAIN}`);
    console.log(`   URL: ${CUSTOM_DOMAIN_URL}\n`);

    try {
        // Get instance ID
        console.log('📋 Getting Clerk instance...');
        const instanceId = await getInstanceId();
        console.log(`✅ Found instance: ${instanceId}\n`);

        // Update allowed origins
        // On a PRODUCTION Clerk instance, only origins on the instance's own
        // registrable domain are accepted. Clerk rejects anything else before
        // consulting this list at all:
        //
        //   alphaboard.pages.dev  -> origin_invalid
        //     "The Request HTTP Origin header must be equal to or a subdomain
        //      of the requesting URL."
        //
        // So pages.dev and localhost belong on the DEVELOPMENT instance, which
        // accepts any origin, and must not be added here — listing them looks
        // like it works and then silently does nothing.
        //
        // Cloudflare Pages preview deployments are always *.pages.dev, which is
        // why Preview must be configured with the pk_test_ key and Production
        // with pk_live_.
        const originsToAdd = [
            CUSTOM_DOMAIN_URL,
            `https://www.${CUSTOM_DOMAIN}`,
        ];

        await updateAllowedOrigins(instanceId, originsToAdd);

        console.log('\n✅ Configuration complete!');
        console.log('\n⚠️  IMPORTANT: Manual steps required:');
        console.log('   1. Go to Clerk Dashboard → Configure → Developers → Domains');
        console.log(`   2. Add domain: ${CUSTOM_DOMAIN}`);
        console.log('   3. Complete DNS verification if required');
        console.log('   4. Go to Configure → Developers → Paths');
        console.log(`   5. Set Home URL to: ${CUSTOM_DOMAIN_URL}`);
        console.log(`   6. Set Sign-in/Sign-up paths if needed`);
        console.log('\n📚 After configuration, wait a few minutes for changes to propagate.');
        console.log('   Then test login at:', `${CUSTOM_DOMAIN_URL}/login`);

    } catch (error) {
        console.error('\n❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

// Run the script
main();


