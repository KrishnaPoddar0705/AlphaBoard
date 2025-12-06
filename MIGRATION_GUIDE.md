# Migration Guide: Supabase Users to Clerk

This guide walks you through migrating existing Supabase users to Clerk and setting up the sync system.

## Overview

Following [Clerk's migration guide](https://clerk.com/docs/guides/development/migrating/overview), we'll:
1. Export users from Supabase
2. Import them into Clerk using Clerk's Backend API
3. Create mappings between Clerk and Supabase user IDs
4. Set up automatic sync for new users

## Prerequisites

1. **Clerk Account**: Sign up at https://clerk.com
2. **Clerk Secret Key**: Get from Clerk Dashboard → API Keys → Secret Key
3. **Supabase Service Role Key**: Get from Supabase Dashboard → Settings → API → service_role key
4. **Node.js/Deno**: For running migration scripts

## Step 1: Run Database Migration

First, create the mapping table in Supabase:

```sql
-- Run this in Supabase SQL Editor
\i database/migration_add_clerk_sync.sql
```

Or manually run the SQL from `database/migration_add_clerk_sync.sql`.

## Step 2: Migrate Users to Clerk

### Option A: Using Deno (Recommended)

```bash
# Set environment variables
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export CLERK_SECRET_KEY="your-clerk-secret-key"


# Run migration script
deno run --allow-net --allow-env --allow-write scripts/migrate-supabase-to-clerk.ts
```

### Option B: Using Node.js/TypeScript

```bash
# Install dependencies
npm install @supabase/supabase-js

# Set environment variables (same as above)

# Run with tsx
npx tsx scripts/migrate-supabase-to-clerk.ts
```

The script will:
- Export all users from Supabase
- Create them in Clerk (storing Supabase ID in `external_id`)
- Save mappings to `clerk-migration-mappings.json`
- Handle rate limits and errors gracefully

## Step 3: Create Mappings in Database

After migration, create the mappings in your Supabase database:

### Option A: Use the generated JSON file

Create a script to import from `clerk-migration-mappings.json`:

```sql
-- Example: Insert mappings manually or via script
-- The migration script creates clerk-migration-mappings.json
-- You can use that to generate INSERT statements

INSERT INTO public.clerk_user_mapping (clerk_user_id, supabase_user_id, email)
VALUES
  ('user_xxx', 'supabase-uuid', 'user@example.com'),
  -- Add all mappings here
ON CONFLICT (clerk_user_id) DO UPDATE
SET 
  supabase_user_id = EXCLUDED.supabase_user_id,
  email = EXCLUDED.email,
  updated_at = NOW();
```

### Option B: Use Edge Function (Recommended)

Create an Edge Function to import mappings programmatically (see below).

## Step 4: Verify Mappings

Check that mappings were created correctly:

```sql
SELECT 
  cm.clerk_user_id,
  cm.supabase_user_id,
  cm.email,
  au.email as supabase_email,
  p.username,
  cm.created_at
FROM public.clerk_user_mapping cm
LEFT JOIN auth.users au ON au.id = cm.supabase_user_id
LEFT JOIN public.profiles p ON p.id = cm.supabase_user_id
ORDER BY cm.created_at DESC;
```

## Step 5: Test the Sync

1. Sign in with a migrated user using Clerk
2. The sync function should automatically:
   - Find the existing Supabase user by email
   - Create/update the mapping
   - Return the Supabase user ID
3. User should be able to access their data

## Troubleshooting

### "Missing authorization header" Error

The sync function doesn't require authorization - it uses service role. If you see this error:
1. Check that `SUPABASE_SERVICE_ROLE_KEY` is set in Edge Function secrets
2. Verify the Edge Function is deployed correctly
3. Check Edge Function logs in Supabase Dashboard

### Users Not Found During Sync

If sync can't find existing users:
1. Verify mappings exist in `clerk_user_mapping` table
2. Check that email addresses match exactly (case-sensitive)
3. Verify Supabase users still exist in `auth.users`

### Rate Limiting

Clerk's Backend API has rate limits (60 requests/second). The migration script includes delays to respect these limits. If you hit limits:
1. Wait a few minutes
2. Resume migration (script handles duplicates gracefully)
3. Or run migration in smaller batches

## Next Steps

After migration:
1. **Update Frontend**: Ensure Clerk components are properly integrated
2. **Test Authentication**: Verify sign-in/sign-up flows work
3. **Monitor Sync**: Check Edge Function logs for sync issues
4. **User Communication**: Inform users they can now sign in with Clerk

## Important Notes

- **Passwords**: Migrated users won't have passwords initially. They'll need to:
  - Use "Forgot Password" flow on first login, OR
  - Set password through Clerk's user management
- **Email Verification**: Users imported via API are auto-verified
- **External IDs**: Supabase user IDs are stored in Clerk's `external_id` field for reference
- **Metadata**: Migration timestamp and source are stored in Clerk's `public_metadata`

## References

- [Clerk Migration Guide](https://clerk.com/docs/guides/development/migrating/overview)
- [Clerk Backend API - CreateUser](https://clerk.com/docs/reference/backend-api/tag/Users#operation/CreateUser)
- [Clerk Migration Script](https://github.com/clerk/migration-script)

