# Clerk-Supabase User Synchronization

This document describes the backend integration that syncs Clerk user authentication with Supabase to maintain Supabase session tokens for API calls.

## Architecture Overview

1. **Clerk** handles user authentication and management (UI, sign-in, sign-up)
2. **Supabase** handles data operations and API calls (Edge Functions, database)
3. **Mapping Table** (`clerk_user_mapping`) links Clerk user IDs to Supabase user IDs
4. **Sync Edge Function** (`sync-clerk-user`) creates/finds Supabase users for Clerk users

## Database Schema

### `clerk_user_mapping` Table

```sql
CREATE TABLE public.clerk_user_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT UNIQUE NOT NULL,
    supabase_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

This table maintains a one-to-one mapping between Clerk user IDs and Supabase user IDs.

## Edge Function: `sync-clerk-user`

**Location:** `supabase/functions/sync-clerk-user/index.ts`

**Purpose:** Syncs Clerk users with Supabase users and returns Supabase user information.

**Request:**
```json
{
  "clerkUser": {
    "clerkUserId": "user_xxx",
    "email": "user@example.com",
    "username": "optional",
    "firstName": "optional",
    "lastName": "optional"
  }
}
```

**Response:**
```json
{
  "success": true,
  "supabaseUserId": "uuid",
  "email": "user@example.com",
  "isNewUser": false
}
```

**Behavior:**
1. Checks if mapping exists for Clerk user ID
2. If mapping exists, returns existing Supabase user ID
3. If no mapping, checks if Supabase user exists by email (for migration)
4. If user exists, creates mapping
5. If user doesn't exist, creates new Supabase user and mapping
6. Ensures profile and performance records exist

## Frontend Integration

### Sync Helper: `lib/clerkSupabaseSync.ts`

The `syncClerkUserToSupabase()` function:
1. Calls the sync Edge Function with Clerk user info
2. Gets Supabase user ID from response
3. Attempts to create Supabase session using passwordless OTP
4. Returns session and user ID

### Auth Hook: `hooks/useAuth.ts`

The `useAuth()` hook:
1. Gets Clerk user from `useUser()` hook
2. Automatically syncs Clerk user to Supabase when user is loaded
3. Gets Supabase session token
4. Returns session object compatible with existing code

## Migration Path

### Existing Users

Existing Supabase users can be migrated by:
1. Signing in with Clerk using the same email
2. The sync function will find the existing Supabase user by email
3. Creates mapping between Clerk user ID and Supabase user ID
4. User retains all existing data

### New Users

New users signing up with Clerk:
1. Clerk creates user account
2. Frontend calls sync function
3. Sync function creates Supabase user
4. Creates mapping
5. Creates profile and performance records

## Session Management

Currently, session creation uses Supabase's passwordless OTP (magic link):
1. Sync function returns Supabase user ID
2. Frontend calls `signInWithOtp()` with user's email
3. User receives email with verification link
4. After verification, Supabase session is created

**Future Improvement:** The Edge Function could generate session tokens directly using Supabase's admin API to avoid requiring email verification.

## API Calls

All API calls continue to use Supabase session tokens:
- Edge Functions expect `Authorization: Bearer <supabase_token>` header
- Frontend gets Supabase session from `useAuth()` hook
- Session is automatically synced from Clerk authentication

## Files Modified

1. **Database:**
   - `database/migration_add_clerk_sync.sql` - Creates mapping table

2. **Edge Functions:**
   - `supabase/functions/sync-clerk-user/index.ts` - Sync function

3. **Frontend:**
   - `frontend/src/lib/clerkSupabaseSync.ts` - Sync helper
   - `frontend/src/hooks/useAuth.ts` - Updated to sync and get Supabase session
   - `frontend/src/lib/edgeFunctions.ts` - Updated to use Supabase tokens
   - `frontend/src/components/Layout.tsx` - Updated to use Supabase user ID
   - `frontend/src/components/research/UploadReportModal.tsx` - Updated comments
   - `frontend/src/components/research/RAGSearchBar.tsx` - Updated comments

## Deployment Steps

1. **Run Database Migration:**
   ```sql
   -- Apply migration_add_clerk_sync.sql to your Supabase database
   ```

2. **Deploy Edge Function:**
   ```bash
   supabase functions deploy sync-clerk-user
   ```

3. **Set Environment Variables:**
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Edge Function secrets
   - Ensure `VITE_CLERK_PUBLISHABLE_KEY` is set in frontend `.env.local`

4. **Test:**
   - Sign in with Clerk
   - Verify sync happens automatically
   - Check that Supabase session is created
   - Verify API calls work with Supabase tokens

## Troubleshooting

### Session Not Created

If Supabase session is not created after sync:
1. Check browser console for errors
2. Verify Edge Function is deployed and accessible
3. Check Supabase logs for Edge Function errors
4. Verify email OTP is being sent and verified

### Mapping Not Created

If mapping is not created:
1. Check Edge Function logs
2. Verify `clerk_user_mapping` table exists
3. Check for unique constraint violations
4. Verify service role key has proper permissions

### API Calls Failing

If API calls fail with authentication errors:
1. Verify Supabase session exists: `supabase.auth.getSession()`
2. Check session token is being sent in Authorization header
3. Verify Edge Function is reading token correctly
4. Check Supabase user exists and is active

