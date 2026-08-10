/**
 * Add Domain to Clerk using Clerk Backend SDK
 * 
 * This script adds www.alphaboard.theunicornlabs.com to Clerk domains
 */

const { Clerk } = require('@clerk/backend');

// Never hardcode a fallback here. A Clerk sk_* key authenticates against the
// Backend API — it can list every user with their email, create and delete
// users, and mint sessions. This file previously carried a real development
// secret key as a default, in a public repository.
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) {
  console.error('CLERK_SECRET_KEY is not set. Export it before running:');
  console.error('  export CLERK_SECRET_KEY=sk_...');
  process.exit(1);
}
const DOMAIN_NAME = 'www.alphaboard.theunicornlabs.com';

const clerk = new Clerk({ 
  secretKey: CLERK_SECRET_KEY 
});

async function addDomain() {
  console.log('🚀 Adding domain to Clerk...\n');
  console.log(`   Domain: ${DOMAIN_NAME}\n`);

  try {
    const domain = await clerk.domains.createDomain({ 
      name: DOMAIN_NAME 
    });
    
    console.log('✅ Domain added successfully!');
    console.log('\nDomain details:');
    console.log(JSON.stringify(domain, null, 2));
    
    console.log('\n⚠️  Next steps:');
    console.log('   1. Complete DNS verification in Clerk Dashboard');
    console.log('   2. Add DNS records provided by Clerk to your DNS provider');
    console.log('   3. Wait for domain status to show "Active"');
    console.log('   4. Configure Paths in Clerk Dashboard');
    console.log(`   5. Test login at: https://${DOMAIN_NAME}/login`);
    
  } catch (error) {
    console.error('\n❌ Error adding domain:');
    console.error(`   ${error.message}`);
    
    if (error.errors) {
      console.error('\n   Details:');
      error.errors.forEach(err => {
        console.error(`   - ${err.message}`);
      });
    }
    
    process.exit(1);
  }
}

// Run the script
addDomain();


