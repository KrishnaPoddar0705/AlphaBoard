/**
 * Configure Clerk Domain and Allowed Origins
 * 
 * This script configures Clerk to allow authentication from the custom domain
 * https://www.alphaboard.theunicornlabs.com/
 */

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || 'sk_test_EHpe511kz1FsEe0VIMeIyG2t4QsbTdCDw9pyB1mhFc';
const CLERK_API_URL = 'https://api.clerk.com/v1';

// Instance ID from the Clerk Dashboard URL
// Format: ins_36Si6Jr8vfr4jMVJwejJFKRzqcU
const INSTANCE_ID = process.env.CLERK_INSTANCE_ID || 'ins_36Si6Jr8vfr4jMVJwejJFKRzqcU';

const CUSTOM_DOMAIN = 'www.alphaboard.theunicornlabs.com';
const CUSTOM_DOMAIN_URL = `https://${CUSTOM_DOMAIN}`;

/**
 * Get instance details
 */
async function getInstance(instanceId) {
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
async function updateAllowedOrigins(instanceId, origins) {
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
    console.log(`📋 Using Clerk instance: ${INSTANCE_ID}\n`);

    // Update allowed origins
    const originsToAdd = [
      CUSTOM_DOMAIN_URL,
      'https://alphaboard.onrender.com',
      'http://localhost:5173',
      'http://localhost:3000',
    ];

    await updateAllowedOrigins(INSTANCE_ID, originsToAdd);

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
    console.error('\n❌ Error:', error.message || error);
    process.exit(1);
  }
}

// Run the script
main();

