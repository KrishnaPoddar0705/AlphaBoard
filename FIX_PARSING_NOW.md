# 🔧 Fix "Failed" Status - Complete Setup

Your uploads are reaching the server but failing because the database and storage aren't fully set up yet.

## Quick Fix (5 minutes)

### Step 1: Run Database Setup

1. **Open Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/odfavebjfcwsovumrefx/editor
   ```

2. **Click "New Query"**

3. **Copy ALL contents from this file:**
   ```
   complete-research-setup.sql
   ```

4. **Paste into SQL Editor and click RUN**

You should see:
```
✓ research_reports table created
✓ report_queries table created  
✓ Storage bucket created
✓ Storage policies created
✓ Setup Complete!
```

### Step 2: Verify Setup

Run this query to check:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('research_reports', 'report_queries');

-- Check storage bucket
SELECT id, name FROM storage.buckets WHERE id = 'research-reports';

-- Check your uploaded reports
SELECT id, title, upload_status, error_message 
FROM research_reports 
ORDER BY created_at DESC 
LIMIT 5;
```

## Why It's Failing

The PDFs uploaded successfully to the Edge Function, but:
- ❌ Database tables don't exist → Can't save metadata
- ❌ Storage bucket doesn't exist → Can't store PDFs
- ❌ Parse function can't run → No place to store results

After running the setup:
- ✅ Tables will exist
- ✅ Storage will be configured
- ✅ Future uploads will work end-to-end

## Re-Upload Your Files

After setup is complete:

1. **Refresh the Research Library page**
2. **Delete the failed reports** (if they show up)
3. **Upload your PDFs again:**
   - [Kotak] IT Services, November 24, 2025
   - [Kotak] Consumer Durables & Apparel, November 24, 2025

This time they will:
1. ✅ Upload to storage successfully
2. ✅ Save to database
3. ✅ Index in Gemini (5-15 seconds)
4. ✅ Parse with AI (15-45 seconds)
5. ✅ Show "parsed" status with extracted data

## Watch The Progress

After re-uploading, refresh every 10 seconds to see:
```
uploading → uploaded → indexing → indexed → parsing → parsed ✓
```

Once "parsed", click the report to see all extracted insights!

## If Still Failing

Check Edge Function logs:
```bash
cd /Users/krishna.poddar/leaderboard

# Check upload logs
supabase functions logs upload-research-report

# Check parse logs  
supabase functions logs parse-research-report
```

Look for errors like:
- "relation research_reports does not exist" → Run migration
- "bucket research-reports does not exist" → Run migration
- "Invalid GEMINI_API_KEY" → Check secrets

## Test Gemini API Key

Verify your Gemini API is working:
```bash
# Check if secret is set
supabase secrets list | grep GEMINI_API_KEY

# Should show:
# GEMINI_API_KEY | [hash]
```

If not set:
```bash
supabase secrets set GEMINI_API_KEY=your-actual-key-here
```

Get a key at: https://aistudio.google.com/apikey

---

**Run the SQL script now, then re-upload your PDFs! 🚀**

