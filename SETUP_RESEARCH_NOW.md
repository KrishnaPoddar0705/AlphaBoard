# Setup Research Reports - Final Steps

✅ **Edge Functions Deployed Successfully!**
- upload-research-report
- parse-research-report  
- query-research-rag

## Now Complete These 2 Steps:

### Step 1: Run Database Migration (5 minutes)

Go to your Supabase Dashboard:
1. Open: https://supabase.com/dashboard/project/odfavebjfcwsovumrefx/editor
2. Click "SQL Editor" in left sidebar
3. Click "New Query"
4. Copy the ENTIRE contents of: `database/migration_add_research_reports.sql`
5. Paste into the editor
6. Click "RUN" button
7. You should see "Success. No rows returned"

### Step 2: Create Storage Bucket (2 minutes)

In Supabase Dashboard:
1. Go to: https://supabase.com/dashboard/project/odfavebjfcwsovumrefx/storage/buckets
2. Click "Create a new bucket"
3. Name: `research-reports` (exactly this, no spaces)
4. Set "Public bucket" to OFF (keep it private)
5. Click "Create bucket"

#### Apply Storage Policies:

After creating bucket, click on it and go to "Policies" tab:

**Policy 1: Allow org members to upload**
```sql
CREATE POLICY "Allow org members to upload reports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'research-reports' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM public.user_organization_membership
    WHERE user_id = auth.uid()
  )
);
```

**Policy 2: Allow org members to read**
```sql
CREATE POLICY "Allow org members to read reports"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'research-reports' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM public.user_organization_membership
    WHERE user_id = auth.uid()
  )
);
```

**Policy 3: Allow users to update own files**
```sql
CREATE POLICY "Allow analysts to update their own reports"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'research-reports' AND
  owner = auth.uid()
);
```

**Policy 4: Allow users to delete own files**
```sql
CREATE POLICY "Allow analysts to delete their own reports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'research-reports' AND
  owner = auth.uid()
);
```

## That's It! 🎉

Once both steps are complete:

1. **Refresh your frontend**: http://localhost:5174
2. Navigate to **"Institutional Memory"** in the top nav
3. Click **"Upload Report"** 
4. The CORS error will be GONE! ✅

You can now:
- Upload PDFs
- AI will automatically parse them
- Search across all reports with RAG
- Get answers with citations

## Verify Setup

Run this in SQL Editor to verify:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('research_reports', 'report_queries');

-- Check bucket exists
SELECT id, name FROM storage.buckets WHERE id = 'research-reports';
```

You should see 2 tables and 1 bucket.

## Troubleshooting

### If upload still fails:
1. Check browser console for specific error
2. Verify you're logged in and part of an organization
3. Check function logs: `supabase functions logs upload-research-report`

### If parsing doesn't work:
1. GEMINI_API_KEY must be valid
2. Check parse function logs: `supabase functions logs parse-research-report`

### If RAG queries fail:
1. Reports must be fully parsed first (wait ~30 seconds after upload)
2. Check query function logs: `supabase functions logs query-research-rag`

