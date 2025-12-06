# Render.com Environment Variables Setup

## Missing Environment Variable

The frontend service is missing the `VITE_CLERK_PUBLISHABLE_KEY` environment variable, which is causing the production build to fail.

## How to Fix

### Step 1: Add Environment Variable to Render

1. Go to: https://dashboard.render.com/static/srv-d4mvjl49c44c738cij60/settings
2. Scroll down to the "Environment Variables" section
3. Click "Add Environment Variable"
4. Add the following:

   **Key**: `VITE_CLERK_PUBLISHABLE_KEY`
   
   **Value**: `pk_test_d2lubmluZy13YWxydXMtODEuY2xlcmsuYWNjb3VudHMuZGV2JA`

5. Click "Save Changes"

### Step 2: Trigger a New Build

After adding the environment variable, Render will automatically trigger a new build. You can also manually trigger one:

1. Go to: https://dashboard.render.com/static/srv-d4mvjl49c44c738cij60
2. Click "Manual Deploy" → "Deploy latest commit"

### Step 3: Verify

Once the build completes, check that:
- The build succeeds (no errors)
- The application loads without the "Missing Clerk Publishable Key" error
- Authentication works correctly

## Current Environment Variables

The following environment variables should be set for the frontend service:

- ✅ `VITE_SUPABASE_URL` - Already set
- ✅ `VITE_SUPABASE_ANON_KEY` - Already set
- ❌ `VITE_CLERK_PUBLISHABLE_KEY` - **MISSING - NEEDS TO BE ADDED**

## Important Notes

- For Vite apps, environment variables starting with `VITE_` are embedded at **build time**
- The environment variable must be set **before** the build runs
- After adding the variable, a new build will be triggered automatically
- The Clerk publishable key is safe to expose in the frontend (it's meant to be public)

## Production vs Development Keys

⚠️ **Important**: The key shown above (`pk_test_...`) is a **test key**. For production, you should:

1. Go to your Clerk Dashboard: https://dashboard.clerk.com
2. Select your application
3. Go to "API Keys"
4. Copy the **Production** publishable key (starts with `pk_live_...`)
5. Use that key instead of the test key in production

## Alternative: Use Production Clerk Key

If you want to use the production Clerk key:

1. Get your production publishable key from Clerk Dashboard
2. Replace the value in Step 1 above with your production key
3. Make sure your Clerk application is configured for production

