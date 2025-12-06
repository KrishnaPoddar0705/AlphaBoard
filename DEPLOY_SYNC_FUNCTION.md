# Deploy Sync Clerk User Edge Function

## Important: Deploy with --no-verify-jwt Flag

The `sync-clerk-user` Edge Function must be deployed **without JWT verification** because it's called from the frontend before the user has a Supabase session.

### Deploy Command

```bash
supabase functions deploy sync-clerk-user --no-verify-jwt
```

### Why --no-verify-jwt?

1. The sync function is called **before** the user has a Supabase session
2. It uses the **service role key** for all operations (bypasses RLS)
3. It doesn't need user authentication - it creates/finds users based on Clerk user info
4. The function validates input and uses service role for security

### Alternative: If you can't use --no-verify-jwt

If your Supabase setup doesn't support `--no-verify-jwt`, you can:

1. **Use anon key in Authorization header** (already implemented in frontend)
2. **Configure the function to accept anon key** - The function already accepts requests with anon key in Authorization header

### Verify Deployment

After deploying, test the function:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/sync-clerk-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{
    "clerkUser": {
      "clerkUserId": "user_test123",
      "email": "test@example.com"
    }
  }'
```

### Troubleshooting

If you still get "Missing authorization header":
1. Check that `VITE_SUPABASE_ANON_KEY` is set in frontend `.env.local`
2. Verify the Edge Function is deployed: `supabase functions list`
3. Check Edge Function logs: `supabase functions logs sync-clerk-user`
4. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Edge Function secrets

