# Troubleshooting: "Auth session missing" Error

## Quick Fix Checklist

### 1. Check if you're logged in
Open browser console and run:
```javascript
const { data } = await supabase.auth.getSession();
console.log('Session:', data.session);
console.log('User:', data.session?.user);
```

If `null`, you need to log in first!

### 2. Verify Environment Variables

Check your frontend `.env` file has:
```bash
VITE_SUPABASE_URL=https://odfavebjfcwsovumrefx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

In browser console, verify they're loaded:
```javascript
console.log('URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Key:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
```

### 3. Check if user is in an organization

The upload function requires user to be in an organization:
```javascript
const { data } = await supabase
  .from('user_organization_membership')
  .select('*')
  .eq('user_id', (await supabase.auth.getUser()).data.user.id);
console.log('Org membership:', data);
```

If empty, you need to:
- Create an organization, OR
- Join an existing organization

### 4. Test Edge Function Directly

Open browser console and test:
```javascript
const { data: { session } } = await supabase.auth.getSession();

const response = await fetch('https://odfavebjfcwsovumrefx.supabase.co/functions/v1/upload-research-report', {
  method: 'OPTIONS',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
});

console.log('CORS preflight:', response.status); // Should be 204
```

### 5. Check Edge Function Logs

From terminal:
```bash
cd /Users/krishna.poddar/leaderboard
supabase functions logs upload-research-report --tail
```

Upload a file and watch for errors in real-time.

## Common Solutions

### Solution 1: Log Out and Log Back In
Sometimes the session expires:
1. Click "Sign Out"
2. Log back in
3. Try upload again

### Solution 2: Restart Dev Server
```bash
cd frontend
# Stop the server (Ctrl+C)
npm run dev
```

### Solution 3: Create/Join Organization

If you see "User must belong to an organization":

**Create new org:**
1. Go to sidebar → "Create Org"
2. Enter organization name
3. You'll be assigned as admin

**Join existing org:**
1. Get join code from admin
2. Go to sidebar → "Join Org"
3. Enter join code

### Solution 4: Clear Browser Cache
1. Open DevTools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"

## Still Not Working?

### Check Function Is Deployed
```bash
supabase functions list | grep upload-research-report
```

Should show STATUS = ACTIVE

### Check Secrets Are Set
```bash
supabase secrets list | grep GEMINI
```

Should show:
- GEMINI_API_KEY
- SUPABASE_ANON_KEY
- SUPABASE_URL

### Test with curl
```bash
# Get your access token from browser console:
# const { data: { session } } = await supabase.auth.getSession();
# console.log(session.access_token);

curl -X OPTIONS \
  https://odfavebjfcwsovumrefx.supabase.co/functions/v1/upload-research-report \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "apikey: YOUR_ANON_KEY" \
  -v
```

Should return 204 No Content.

## Debug Mode

Add this to your upload function to see detailed logs:

In `UploadReportModal.tsx`, add before upload:
```typescript
console.log('=== Upload Debug ===');
console.log('Session:', session);
console.log('User ID:', session.user?.id);
console.log('Upload URL:', uploadUrl);
console.log('Anon Key:', supabaseAnonKey?.substring(0, 20));
console.log('===================');
```

Check browser console during upload.

## Error Meanings

| Error | Meaning | Solution |
|-------|---------|----------|
| "Auth session missing" | No auth token received | Log in again |
| "User must belong to an organization" | No org membership | Create/join org |
| "Missing Authorization header" | Token not sent | Check frontend code |
| "Invalid token" | Expired/wrong token | Log out and back in |
| CORS error | Function not deployed | Deploy functions |

## Get Help

If still stuck, check:
1. Edge Function logs: `supabase functions logs upload-research-report`
2. Browser console for errors
3. Network tab to see actual request/response

