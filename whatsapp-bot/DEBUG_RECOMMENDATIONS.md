# Debug Guide: Analyst Recommendations Not Loading

## Problem Summary
The WhatsApp bot is unable to retrieve analyst recommendations, getting stuck in a loop or returning 401 errors when querying Supabase tables.

## Root Cause
The Supabase Python client is not automatically setting the `apikey` header for the new secret key format (`sb_secret_...`). This causes all Supabase queries to fail with 401 Unauthorized errors.

## Fixes Applied

### 1. Header Patching (✅ Implemented)
- **Location**: `alphaboard_client.py` - `_patch_supabase_headers()` and `_ensure_headers_set()`
- **What it does**: Manually sets `apikey` and `Authorization` headers on the Supabase client's HTTP session
- **When**: During client initialization and before critical queries

### 2. Monkey-Patching Table Method (✅ Implemented)
- **Location**: `alphaboard_client.py` - `_monkey_patch_table_method()`
- **What it does**: Wraps the `table()` method to ensure headers are set before every query execution
- **When**: Always applied during client initialization

### 3. Explicit Header Setting Before Queries (✅ Implemented)
- **Location**: `get_or_create_user_by_phone()` and `get_analyst_recommendations_detailed()`
- **What it does**: Explicitly calls `_ensure_headers_set()` before executing queries
- **When**: Before every Supabase query in critical methods

### 4. Improved Error Handling (✅ Implemented)
- **Location**: `engine.py` - `_handle_show_analyst_recs()`
- **What it does**: Better error messages and ensures flow is always cancelled
- **When**: On any exception during recommendation retrieval

## Testing Steps

### Step 1: Verify Supabase Client Initialization
Check the logs when the bot starts. You should see:
```
✅ Patched headers via rest.postgrest.session.headers
✅ Monkey-patched table method to ensure headers on each request
Supabase client initialized and connection verified
```

### Step 2: Test User Lookup
Send any message to the bot. Check logs for:
```
Headers ensured before query
Found existing WhatsApp user: <user_id>
```

### Step 3: Test Track Analyst Flow
1. Send "Track Analyst" command
2. Select an analyst
3. Select position type (Open/Closed/All)
4. Check logs for:
   ```
   Querying public.recommendations table for user_id=<analyst_id>, status=<status>
   ✅ Query executed successfully, got <count> recommendations
   ```

### Step 4: Check for 401 Errors
If you still see 401 errors, check:
1. **Key Format**: Is `SUPABASE_SERVICE_ROLE_KEY` set to `sb_secret_...` format?
2. **Key Validity**: Is the key still valid? (Keys can expire or be rotated)
3. **Request Headers**: Check Supabase logs to see if `apikey` header is present

## Debugging Commands

### Check Current Key Format
```bash
cd whatsapp-bot
python -c "from src.config import get_settings; s = get_settings(); print(f'Key format: {s.SUPABASE_SERVICE_ROLE_KEY[:20]}...')"
```

### Test Supabase Connection
```bash
cd whatsapp-bot
python test_tul9_simple.py
```

### Check Logs for Header Issues
```bash
# Look for these patterns in logs:
grep -i "patched headers" logs/*.log
grep -i "api key" logs/*.log
grep -i "401" logs/*.log
```

## Common Issues & Solutions

### Issue 1: Still Getting 401 Errors
**Possible Causes**:
- Key format is incorrect
- Key has been rotated/expired
- Headers not being set correctly

**Solutions**:
1. Verify key format: Should start with `sb_secret_` for new format
2. Check Supabase dashboard for key validity
3. Add more logging to `_ensure_headers_set()` to verify headers are being set

### Issue 2: Headers Set But Still Failing
**Possible Causes**:
- Supabase client creating new sessions
- Headers being overwritten
- RLS policies blocking access

**Solutions**:
1. Check RLS policies on `recommendations` table
2. Verify service role key has proper permissions
3. Test with direct SQL query to verify data exists

### Issue 3: Bot Stuck in Loop
**Possible Causes**:
- Flow not being cancelled properly
- Exception being swallowed
- Query returning empty results incorrectly

**Solutions**:
1. Check logs for flow cancellation messages
2. Verify exception handling in `_handle_show_analyst_recs()`
3. Add more logging around flow state management

## Next Steps if Still Failing

1. **Enable Debug Logging**:
   ```python
   # In alphaboard_client.py, add:
   logger.setLevel(logging.DEBUG)
   ```

2. **Check Supabase Dashboard**:
   - Go to Supabase Dashboard → Logs
   - Filter for 401 errors
   - Check request headers in logs

3. **Test Direct Query**:
   ```python
   # Create a test script
   from supabase import create_client
   import os
   
   client = create_client(
       os.getenv("SUPABASE_URL"),
       os.getenv("SUPABASE_SERVICE_ROLE_KEY")
   )
   
   # Manually set headers
   client.rest.postgrest.session.headers['apikey'] = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
   client.rest.postgrest.session.headers['Authorization'] = f'Bearer {os.getenv("SUPABASE_SERVICE_ROLE_KEY")}'
   
   # Test query
   result = client.table("recommendations").select("*").limit(1).execute()
   print(result.data)
   ```

4. **Contact Supabase Support**:
   - If new secret key format is not working with Python client
   - Check if there's a newer version of `supabase-py` that supports new format

## Files Modified
- `whatsapp-bot/src/alphaboard_client.py`: Header patching, monkey-patching, error handling
- `whatsapp-bot/src/engine.py`: Improved error handling and flow cancellation

## Related Issues
- Edge Function 401 errors (separate issue - web app, not WhatsApp bot)
- Recommendations query returning empty results
- Flow getting stuck in loop



