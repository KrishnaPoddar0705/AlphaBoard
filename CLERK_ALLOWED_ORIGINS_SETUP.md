# Clerk Allowed Origins Configuration

## ⚠️ IMPORTANT: Action Required

To allow `https://www.alphaboard.theunicornlabs.com/` to work with Clerk authentication, you **MUST** add it to Clerk's allowed origins/redirect URLs in the Clerk Dashboard. This cannot be done from the frontend code - it's a server-side security configuration.

## Overview

The frontend code has been updated to include `https://www.alphaboard.theunicornlabs.com` in the allowed origins configuration file (`frontend/src/config/allowedOrigins.ts`), but you still need to configure it in Clerk Dashboard for it to work.

## Steps to Add Allowed Origin

### 1. Go to Clerk Dashboard

1. Navigate to: https://dashboard.clerk.com
2. Select your application
3. Go to **"Paths"** or **"Settings"** → **"Paths"**

### 2. Add Allowed Redirect URLs

In the **"Allowed redirect URLs"** section, add:

```
https://www.alphaboard.theunicornlabs.com
https://www.alphaboard.theunicornlabs.com/*
```

**Note**: Include both:
- The base URL (without trailing slash)
- The wildcard pattern `/*` to allow all paths

### 3. Add Allowed Origins (if available)

Some Clerk configurations also have an **"Allowed origins"** section. If available, add:

```
https://www.alphaboard.theunicornlabs.com
```

### 4. Save Changes

Click **"Save"** or **"Apply"** to save your changes.

## Current Configuration

The frontend code already uses dynamic origin detection:

```typescript
// In clerkSupabaseSync.ts
emailRedirectTo: window.location.origin
```

This means the code will automatically work with any allowed origin configured in Clerk Dashboard.

## Multiple Domains

If you need to support multiple domains, add all of them to Clerk's allowed redirect URLs:

```
https://alphaboard.onrender.com
https://alphaboard.onrender.com/*
https://www.alphaboard.theunicornlabs.com
https://www.alphaboard.theunicornlabs.com/*
http://localhost:5173
http://localhost:5173/*
```

## Verification

After adding the domain:

1. Clear your browser cache
2. Visit: https://www.alphaboard.theunicornlabs.com
3. Try to sign in/sign up
4. Verify that authentication redirects work correctly

## Troubleshooting

### Error: "Redirect URL not allowed"

- **Cause**: The domain is not in Clerk's allowed redirect URLs
- **Fix**: Add the domain to Clerk Dashboard as described above

### Error: "Invalid origin"

- **Cause**: The origin is not in Clerk's allowed origins
- **Fix**: Add the origin to Clerk Dashboard's allowed origins list

### Authentication works but redirect fails

- **Cause**: The redirect URL pattern doesn't match
- **Fix**: Make sure you've added both the base URL and the wildcard pattern (`/*`)

## Important Notes

- **Clerk Dashboard Configuration**: Allowed origins/redirect URLs are configured server-side in Clerk Dashboard, not in the frontend code
- **Dynamic Detection**: The frontend code uses `window.location.origin` which automatically adapts to the current domain
- **HTTPS Required**: Production domains must use HTTPS
- **Wildcard Patterns**: Use `/*` to allow all paths under a domain

## Related Files

- `frontend/src/main.tsx` - ClerkProvider configuration
- `frontend/src/lib/clerkSupabaseSync.ts` - Uses `window.location.origin` for redirects
- `frontend/src/pages/AuthCallback.tsx` - Handles auth callbacks

