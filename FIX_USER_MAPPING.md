# Fix: User Mapping Issue

## Problem
Multiple Clerk users were being mapped to the same Supabase user account (e.g., `kpoddar0705@gmail.com`). This happened because the sync function was checking for existing Supabase users by email and mapping new Clerk users to them.

## Root Cause
The sync function had migration logic that:
1. Checked if a Supabase user exists with the same email
2. If found, mapped the new Clerk user to that existing Supabase user
3. This caused multiple Clerk accounts to share the same Supabase account

## Solution
**Removed email-based lookup entirely** from the sync function. Now:

1. **Check for existing mapping by Clerk user ID** - If a mapping exists, use it
2. **If no mapping exists, ALWAYS create a NEW Supabase user** - Each Clerk user gets their own isolated Supabase account
3. **Migration is handled separately** - Use the migration script (`migrate-supabase-to-clerk.ts`) to map existing Supabase users to Clerk users

## Behavior After Fix

### New Clerk Signups
- Each new Clerk user → Gets a NEW Supabase user account
- Even if email matches an existing Supabase user → Still creates a new account
- One-to-one mapping: 1 Clerk user = 1 Supabase user

### Existing Mappings
- If mapping exists → Uses existing Supabase user
- If mapping doesn't exist → Creates new Supabase user

### Migration
- Use the migration script to map existing Supabase users to Clerk users
- The sync function no longer handles migration automatically

## Deployment

1. **Deploy the updated Edge Function:**
   ```bash
   supabase functions deploy sync-clerk-user --no-verify-jwt
   ```

2. **For users already incorrectly mapped:**
   - Option A: Delete incorrect mappings and have users sign in again (will create new Supabase accounts)
   - Option B: Manually fix mappings in `clerk_user_mapping` table

## Verification

After deployment, test:
1. Sign up with a new Clerk account
2. Check `clerk_user_mapping` table - should see new mapping
3. Sign up with another Clerk account (even same email)
4. Check `clerk_user_mapping` table - should see a DIFFERENT mapping with a different Supabase user ID

## Important Notes

- **Supabase allows duplicate emails** when created via admin API, so multiple users can have the same email
- **Each Clerk user ID maps to exactly one Supabase user ID**
- **The mapping table (`clerk_user_mapping`) is the source of truth** - always check there first

