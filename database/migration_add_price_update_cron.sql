-- Migration: Add cron job to update prices hourly between 3am-8am GMT
-- This creates a SQL function that calls the price update endpoint via HTTP
-- and schedules it using pg_cron

-- Enable pg_cron extension if not already enabled
create extension if not exists pg_cron;

-- Enable http extension for making HTTP requests
-- Note: Supabase may need to enable this extension
create extension if not exists http;

-- Create a function that calls the FastAPI price update endpoint
-- Replace YOUR_API_URL with your actual FastAPI backend URL
-- Example: https://your-backend.herokuapp.com or https://api.yourdomain.com
create or replace function public.update_all_prices_cron()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  api_url text := current_setting('app.api_url', true);
  service_key text := current_setting('app.service_key', true);
  response_status int;
  response_body text;
  request_id int;
begin
  -- Set default API URL if not configured
  -- Backend URL: https://alphaboard-backend.onrender.com
  if api_url is null or api_url = '' then
    api_url := 'https://alphaboard-backend.onrender.com';
  end if;
  
  -- Set default service key if not configured
  -- Service key should be set via: alter database postgres set app.service_key = 'your-key';
  -- Or use Supabase service role key from environment
  if service_key is null or service_key = '' then
    -- Try to get from Supabase service role key (if available in environment)
    -- Otherwise, this will need to be set manually
    raise warning 'Service key not configured. Please set app.service_key database setting.';
    return;
  end if;
  
  -- Make HTTP POST request to the FastAPI endpoint
  select status, content, id into response_status, response_body, request_id
  from http((
    'POST',
    api_url || '/admin/update-prices',
    array[
      http_header('Authorization', 'Bearer ' || service_key),
      http_header('Content-Type', 'application/json'),
      http_header('X-API-KEY', service_key)
    ],
    'application/json',
    '{}'
  )::http_request);
  
  -- Log the result
  if response_status = 200 then
    raise notice 'Price update cron job executed successfully at %: %', now(), response_body;
  else
    raise warning 'Price update cron job failed at % with status %: %', now(), response_status, response_body;
  end if;
  
exception
  when others then
    -- If http extension is not available, log the error
    raise warning 'Price update cron job error at %: %', now(), sqlerrm;
    -- You may want to use Supabase Edge Functions instead (see alternative below)
end;
$$;

-- Alternative: If http extension is not available, use this simpler function
-- that logs the execution time (you'll need to call the endpoint externally)
create or replace function public.update_all_prices_cron_simple()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Log the cron execution
  -- This is a placeholder - actual update should be done via Edge Function or external service
  raise notice 'Price update cron job triggered at %', now();
  
  -- Insert a log entry (optional - create a table for this if needed)
  -- insert into cron_logs (job_name, executed_at) values ('update_prices', now());
end;
$$;

-- Grant execute permission
grant execute on function public.update_all_prices_cron() to service_role;
grant execute on function public.update_all_prices_cron() to authenticated;
grant execute on function public.update_all_prices_cron_simple() to service_role;

-- Schedule the cron jobs to run every hour between 3am and 8am GMT
-- Cron syntax: minute hour day month weekday
-- GMT times: 3am, 4am, 5am, 6am, 7am, 8am

-- Unschedule existing jobs if they exist
select cron.unschedule('update-prices-3am-gmt') where exists (
  select 1 from cron.job where jobname = 'update-prices-3am-gmt'
);
select cron.unschedule('update-prices-4am-gmt') where exists (
  select 1 from cron.job where jobname = 'update-prices-4am-gmt'
);
select cron.unschedule('update-prices-5am-gmt') where exists (
  select 1 from cron.job where jobname = 'update-prices-5am-gmt'
);
select cron.unschedule('update-prices-6am-gmt') where exists (
  select 1 from cron.job where jobname = 'update-prices-6am-gmt'
);
select cron.unschedule('update-prices-7am-gmt') where exists (
  select 1 from cron.job where jobname = 'update-prices-7am-gmt'
);
select cron.unschedule('update-prices-8am-gmt') where exists (
  select 1 from cron.job where jobname = 'update-prices-8am-gmt'
);

-- Schedule for 3am GMT
select cron.schedule(
  'update-prices-3am-gmt',
  '0 3 * * *',  -- 3:00 AM GMT every day
  $$select public.update_all_prices_cron();$$
);

-- Schedule for 4am GMT
select cron.schedule(
  'update-prices-4am-gmt',
  '0 4 * * *',  -- 4:00 AM GMT every day
  $$select public.update_all_prices_cron();$$
);

-- Schedule for 5am GMT
select cron.schedule(
  'update-prices-5am-gmt',
  '0 5 * * *',  -- 5:00 AM GMT every day
  $$select public.update_all_prices_cron();$$
);

-- Schedule for 6am GMT
select cron.schedule(
  'update-prices-6am-gmt',
  '0 6 * * *',  -- 6:00 AM GMT every day
  $$select public.update_all_prices_cron();$$
);

-- Schedule for 7am GMT
select cron.schedule(
  'update-prices-7am-gmt',
  '0 7 * * *',  -- 7:00 AM GMT every day
  $$select public.update_all_prices_cron();$$
);

-- Schedule for 8am GMT
select cron.schedule(
  'update-prices-8am-gmt',
  '0 8 * * *',  -- 8:00 AM GMT every day
  $$select public.update_all_prices_cron();$$
);

-- View scheduled jobs
-- select * from cron.job where jobname like 'update-prices-%';

-- To manually test the function:
-- select public.update_all_prices_cron();

-- To unschedule a job later:
-- select cron.unschedule('update-prices-3am-gmt');

