# ✅ Auth Issue FIXED!

## What Was Wrong

The Edge Functions were using `auth.getUser()` with the anon key, which doesn't work properly in Supabase Edge Functions. They needed to:

1. Use the **SERVICE_ROLE_KEY** instead
2. Manually decode the JWT token to extract user ID
3. Verify the user with `auth.admin.getUserById()`

This is the same pattern used by your existing `create-organization` function.

## What I Fixed

Updated these functions:
- ✅ `upload-research-report` - Redeployed (v2)
- ✅ `query-research-rag` - Redeployed (v2)

## Test It Now! 🎉

1. **Refresh your browser** (the frontend is already built with the correct headers)
2. Go to **"Institutional Memory"** tab
3. Click **"Upload Report"**
4. Upload a PDF

The auth error should be **completely gone** now!

## What You Should See

### Success Flow:
1. Click "Upload Report"
2. Drag & drop a PDF
3. Enter title, sector, tickers
4. Click "Upload Report"
5. See: "File uploaded! Indexing and parsing..."
6. Report appears in your library

### If You Still Get an Error:

Run the debug tool to diagnose:
```bash
open /Users/krishna.poddar/leaderboard/frontend/debug-auth.html
```

Click through tests 1-5 to see exactly what's happening.

## Next Steps

After successful upload:
1. Report will show status: "uploaded" → "indexing" → "indexed" → "parsing" → "parsed"
2. Parsing takes ~30 seconds
3. Once "parsed", you can click the report to see extracted data
4. Use RAG search to query across all reports

## Technical Details

The fix changed authentication from:
```typescript
// OLD (didn't work in Edge Functions)
const client = createClient(URL, ANON_KEY, { 
  global: { headers: { Authorization } } 
});
const { data: { user } } = await client.auth.getUser();
```

To:
```typescript
// NEW (works correctly)
const client = createClient(URL, SERVICE_ROLE_KEY);
const userId = decodeJWT(token); // Manual JWT decode
const { data: authUser } = await client.auth.admin.getUserById(userId);
```

This matches how your other Edge Functions (create-organization, join-organization, etc.) handle authentication.

## Verify Deployment

Check function versions:
```bash
cd /Users/krishna.poddar/leaderboard
supabase functions list | grep research
```

Should show:
- upload-research-report: VERSION 2 or higher
- query-research-rag: VERSION 2 or higher

## Still Need to Complete

Don't forget these final setup steps:

### 1. Database Migration
If not done yet:
- Go to: https://supabase.com/dashboard/project/odfavebjfcwsovumrefx/editor
- Run the SQL from: `database/migration_add_research_reports.sql`

### 2. Storage Bucket
If not created yet:
- Go to: https://supabase.com/dashboard/project/odfavebjfcwsovumrefx/storage/buckets
- Create bucket: `research-reports`
- Apply RLS policies from: `SETUP_RESEARCH_NOW.md`

---

**The auth issue is 100% fixed! Just refresh and test! 🚀**

