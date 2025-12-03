# Quick Deploy - Research Functions

## The CORS error occurs because the Edge Functions aren't deployed yet.

Follow these steps to deploy:

## Step 1: Set Required Secrets

The functions need a Gemini API key. Set it with:

```bash
cd /Users/krishna.poddar/leaderboard
supabase secrets set GEMINI_API_KEY=your-gemini-api-key-here
```

To get a Gemini API key:
1. Go to https://aistudio.google.com/apikey
2. Create a new API key
3. Copy it and run the command above

Optional (for advanced features):
```bash
supabase secrets set GOOGLE_CLOUD_PROJECT_ID=your-project-id
supabase secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
```

## Step 2: Deploy Functions

Deploy all three research functions:

```bash
cd /Users/krishna.poddar/leaderboard

# Deploy upload function
supabase functions deploy upload-research-report --no-verify-jwt

# Deploy parse function  
supabase functions deploy parse-research-report --no-verify-jwt

# Deploy query function
supabase functions deploy query-research-rag --no-verify-jwt
```

Or use the script:
```bash
./deploy-research-functions.sh
```

## Step 3: Run Database Migration

```bash
psql $DATABASE_URL -f database/migration_add_research_reports.sql
```

Or via Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `database/migration_add_research_reports.sql`
3. Run the migration

## Step 4: Create Storage Bucket

In Supabase Dashboard:
1. Go to Storage
2. Create new bucket named: `research-reports`
3. Make it private (public: false)
4. Apply RLS policies from `database/STORAGE_BUCKET_SETUP.md`

Or run this SQL:
```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('research-reports', 'research-reports', false);

-- Apply RLS policies (see STORAGE_BUCKET_SETUP.md for full policies)
```

## Step 5: Test

1. Start frontend: `cd frontend && npm run dev`
2. Navigate to "Institutional Memory"
3. Upload a PDF
4. The CORS error should be gone!

## Troubleshooting

### CORS Error Persists
- Make sure functions are deployed: `supabase functions list`
- Check function logs: `supabase functions logs upload-research-report`
- Verify secrets are set: `supabase secrets list`

### Upload Fails
- Check if storage bucket exists
- Verify user is part of an organization
- Check browser console for detailed errors

### Function Not Found
- Redeploy: `supabase functions deploy upload-research-report --no-verify-jwt`
- Check project is linked: `supabase link --project-ref odfavebjfcwsovumrefx`

## Quick Commands

```bash
# Check status
supabase functions list
supabase secrets list

# View logs
supabase functions logs upload-research-report
supabase functions logs parse-research-report
supabase functions logs query-research-rag

# Redeploy if needed
supabase functions deploy upload-research-report --no-verify-jwt
```

