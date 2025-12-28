# Supabase Cron Job Setup Instructions

## Overview
This guide explains how to set up the price update cron job in Supabase to run hourly between 3am-8am GMT.

## Prerequisites
1. Supabase project with `pg_cron` extension enabled
2. FastAPI backend running and accessible
3. Service role key or API key for authentication

## Step 1: Apply the Migration

1. Go to your Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `database/migration_add_price_update_cron.sql`
3. **IMPORTANT**: Before running, update these values:
   - Replace `'https://your-backend-url.com'` with your actual FastAPI backend URL
   - Replace `'your-service-key'` with your actual service key or API key
4. Click "Run" to execute the migration

## Step 2: Configure API URL and Service Key

You have two options:

### Option A: Use PostgreSQL Settings (Recommended)
```sql
-- Set the API URL
alter database postgres set app.api_url = 'https://your-backend-url.com';

-- Set the service key (be careful with this - it's sensitive)
alter database postgres set app.service_key = 'your-service-key-here';
```

### Option B: Edit the Function Directly
Edit the `update_all_prices_cron()` function in the migration file to hardcode your values.

## Step 3: Verify HTTP Extension

Check if the `http` extension is available:
```sql
select * from pg_extension where extname = 'http';
```

If not available, you'll need to:
1. Enable it in Supabase Dashboard → Database → Extensions
2. Or use the Edge Function approach (see Alternative below)

## Step 4: Test the Function

Test the cron function manually:
```sql
select public.update_all_prices_cron();
```

Check the logs in Supabase Dashboard → Logs → Postgres Logs

## Step 5: Verify Scheduled Jobs

View all scheduled cron jobs:
```sql
select * from cron.job where jobname like 'update-prices-%';
```

You should see 6 jobs scheduled for 3am, 4am, 5am, 6am, 7am, and 8am GMT.

## Alternative: Using Supabase Edge Functions

If the `http` extension is not available, you can create a Supabase Edge Function instead:

1. Create an Edge Function that calls your FastAPI endpoint
2. Schedule it using Supabase's scheduled functions or external cron service
3. Or use the Edge Function URL in the SQL function

## Troubleshooting

### Cron jobs not running
- Check Supabase Dashboard → Database → Cron Jobs
- Verify `pg_cron` extension is enabled
- Check Postgres logs for errors

### HTTP requests failing
- Verify your FastAPI backend is accessible
- Check API URL and service key are correct
- Ensure CORS is configured on your FastAPI backend
- Check FastAPI logs for incoming requests

### Function errors
- Check Postgres logs: `select * from cron.job_run_details order by start_time desc limit 10;`
- Verify the function exists: `select proname from pg_proc where proname = 'update_all_prices_cron';`

## Manual Execution

To manually trigger a price update:
```sql
select public.update_all_prices_cron();
```

Or call the FastAPI endpoint directly:
```bash
curl -X POST 'https://your-backend-url.com/admin/update-prices' \
  -H 'Authorization: Bearer your-service-key' \
  -H 'Content-Type: application/json'
```

## Unschedule Jobs

To remove all scheduled jobs:
```sql
select cron.unschedule('update-prices-3am-gmt');
select cron.unschedule('update-prices-4am-gmt');
select cron.unschedule('update-prices-5am-gmt');
select cron.unschedule('update-prices-6am-gmt');
select cron.unschedule('update-prices-7am-gmt');
select cron.unschedule('update-prices-8am-gmt');
```

