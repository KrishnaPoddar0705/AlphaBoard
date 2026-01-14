# Track Analyst Flow - Debug Guide

## Expected Flow

1. **User selects analyst** → `analyst_id` (Supabase UUID from `profiles` table)
2. **User selects position type** → `status` (OPEN/CLOSED/ALL)
3. **Bot validates UUID format** → Must match UUID pattern
4. **Bot queries `public.profiles`** → Verify analyst exists, get `analyst_supabase_uuid`
5. **Bot queries `public.recommendations`** → `WHERE user_id = analyst_supabase_uuid AND status = ?`
6. **Bot sends message** → Shows recommendations or "no recommendations" message
7. **Bot cancels flow** → Prevents loop

## Logging Added

All log messages are prefixed with `[TRACK ANALYST]` or `[RECOMMENDATIONS]` for easy filtering.

### Key Log Messages to Look For:

1. **Start of flow:**
   ```
   🔍 [TRACK ANALYST] Starting flow - analyst_id=..., status=..., whatsapp_user_id=...
   ```

2. **UUID validation:**
   ```
   🔍 [TRACK ANALYST] Querying public.profiles table for UUID: ...
   ✅ [TRACK ANALYST] Found analyst: ... | UUID: ... | org_id: ...
   ```

3. **Recommendations query:**
   ```
   🔍 [RECOMMENDATIONS] Starting fetch for analyst Supabase UUID: ...
   🔍 [RECOMMENDATIONS] Supabase User ID: ...
   🔍 [RECOMMENDATIONS] SQL equivalent: SELECT * FROM recommendations WHERE user_id='...' AND status='...'
   ✅ [RECOMMENDATIONS] Query SUCCESS - returned X recommendations
   ```

4. **Flow completion:**
   ```
   ✅ [TRACK ANALYST] Flow completed and cancelled for user ...
   ```

## Debugging Steps

### If stuck in loop:

1. **Check logs for flow cancellation:**
   ```bash
   grep "\[TRACK ANALYST\] Flow completed" logs/*.log
   ```
   - If missing, flow is not being cancelled properly

2. **Check if analyst profile is found:**
   ```bash
   grep "Found analyst profile" logs/*.log
   ```
   - If missing, analyst_id might be wrong format

3. **Check recommendations query:**
   ```bash
   grep "\[RECOMMENDATIONS\]" logs/*.log
   ```
   - Should see "Starting fetch", "Query SUCCESS", and "Returning X recommendations"

4. **Check Supabase User ID:**
   ```bash
   grep "Supabase User ID:" logs/*.log
   ```
   - This is the UUID being used to query recommendations

### If no recommendations returned:

1. **Verify analyst has recommendations:**
   ```sql
   SELECT COUNT(*) FROM recommendations WHERE user_id = '<analyst_supabase_uuid>';
   ```

2. **Check status filter:**
   ```sql
   SELECT DISTINCT status FROM recommendations WHERE user_id = '<analyst_supabase_uuid>';
   ```

3. **Verify query is executing:**
   - Look for `[RECOMMENDATIONS] Query SUCCESS` in logs
   - If missing, query might be failing silently

## Common Issues

### Issue 1: Query to `whatsapp_users` instead of `recommendations`
**Symptom:** Logs show `GET /rest/v1/whatsapp_users?id=eq...` but no `GET /rest/v1/recommendations`

**Cause:** Code might be querying wrong table or analyst_id is wrong format

**Fix:** Ensure:
- `analyst_id` is a Supabase UUID (not WhatsApp user ID)
- Code queries `public.profiles` first to get UUID
- Code then queries `public.recommendations` with that UUID

### Issue 2: Flow not cancelling
**Symptom:** Bot keeps asking for position type

**Cause:** `state_manager.cancel_flow()` not being called or exception before cancellation

**Fix:** Ensure flow is cancelled:
- After sending message (success case)
- After sending error message (error case)
- In exception handler

### Issue 3: No recommendations found
**Symptom:** Bot says "No recommendations found" but analyst has recommendations

**Cause:** 
- Wrong `user_id` being used
- Status filter doesn't match
- Query failing silently

**Fix:** Check logs for:
- `Supabase User ID:` - verify it's correct
- `Query SUCCESS` - verify query executed
- `returned X recommendations` - verify data returned

## Testing

To test the flow:

1. **Send "Track Analyst" command**
2. **Select an analyst** (should see UUID in logs)
3. **Select position type** (OPEN/CLOSED/ALL)
4. **Check logs for:**
   - `[TRACK ANALYST] Starting flow`
   - `[TRACK ANALYST] Found analyst: ... | UUID: ...`
   - `[RECOMMENDATIONS] Supabase User ID: ...`
   - `[RECOMMENDATIONS] Query SUCCESS`
   - `[TRACK ANALYST] Flow completed`

## SQL Query Equivalent

The bot should execute this query:
```sql
SELECT * 
FROM recommendations 
WHERE user_id = '<analyst_supabase_uuid>' 
  AND status = '<status_filter>' 
ORDER BY entry_date DESC 
LIMIT 50;
```

Where:
- `analyst_supabase_uuid` = UUID from `public.profiles.id`
- `status_filter` = OPEN, CLOSED, WATCHLIST, or NULL (for ALL)



