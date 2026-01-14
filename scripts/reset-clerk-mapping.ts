/**
 * Reset Clerk User Mapping Script
 * 
 * This script helps reset/clean up Clerk user mappings for localhost development.
 * Run this using: npx tsx scripts/reset-clerk-mapping.ts <email>
 * 
 * It will:
 * 1. Find all mappings for the given email
 * 2. Show what mappings exist
 * 3. Optionally delete conflicting mappings or update them
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetMapping(email: string) {
    console.log(`\n🔍 Looking up mappings for email: ${email}\n`);

    // Find all mappings with this email
    const { data: mappings, error: mappingError } = await supabase
        .from('clerk_user_mapping')
        .select('*')
        .eq('email', email.toLowerCase());

    if (mappingError) {
        console.error('Error fetching mappings:', mappingError);
        return;
    }

    if (!mappings || mappings.length === 0) {
        console.log('✅ No mappings found for this email. Safe to proceed.');
        return;
    }

    console.log(`Found ${mappings.length} mapping(s):\n`);
    mappings.forEach((mapping, index) => {
        console.log(`${index + 1}. Clerk User ID: ${mapping.clerk_user_id}`);
        console.log(`   Supabase User ID: ${mapping.supabase_user_id}`);
        console.log(`   Email: ${mapping.email}`);
        console.log(`   Created: ${mapping.created_at}`);
        console.log(`   Updated: ${mapping.updated_at}\n`);
    });

    // Check if there are multiple mappings (conflict)
    if (mappings.length > 1) {
        console.log('⚠️  WARNING: Multiple mappings found! This is a conflict.\n');
    }

    // Ask user what to do
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise<void>((resolve) => {
        rl.question('Do you want to delete all mappings for this email? (yes/no): ', async (answer) => {
            if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
                console.log('\n🗑️  Deleting mappings...\n');

                for (const mapping of mappings) {
                    const { error: deleteError } = await supabase
                        .from('clerk_user_mapping')
                        .delete()
                        .eq('id', mapping.id);

                    if (deleteError) {
                        console.error(`Error deleting mapping ${mapping.id}:`, deleteError);
                    } else {
                        console.log(`✅ Deleted mapping for Clerk User: ${mapping.clerk_user_id}`);
                    }
                }

                console.log('\n✅ All mappings deleted. You can now try signing in again.');
            } else {
                console.log('\n❌ Cancelled. No changes made.');
            }

            rl.close();
            resolve();
        });
    });
}

// Get email from command line args
const email = process.argv[2];

if (!email) {
    console.error('Usage: npx tsx scripts/reset-clerk-mapping.ts <email>');
    console.error('Example: npx tsx scripts/reset-clerk-mapping.ts user@example.com');
    process.exit(1);
}

resetMapping(email).catch(console.error);



