-- Migration: Schedule vote cache update every 5 minutes
-- Purpose: Keep community_ticker_stats.upvotes/downvotes in sync with community_votes
-- Date: 2025-01-27

-- ============================================================================
-- 1. ENABLE REQUIRED EXTENSIONS
-- ============================================================================

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net if not already enabled (for HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- 2. CREATE CRON JOB TO UPDATE VOTE CACHE EVERY 5 MINUTES
-- ============================================================================

-- Remove existing job if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vote-cache-update') THEN
    PERFORM cron.unschedule('vote-cache-update');
  END IF;
END $$;

-- Schedule the job to run every 5 minutes
-- Cron syntax: '*/5 * * * *' = every 5 minutes
-- This directly calls the RPC function, avoiding HTTP overhead
SELECT cron.schedule(
  'vote-cache-update',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT public.batch_update_vote_counts();
  $$
);

-- ============================================================================
-- 4. VERIFY CRON JOB
-- ============================================================================

-- Check that the job was created
SELECT 
  jobname,
  schedule,
  command
FROM cron.job
WHERE jobname = 'vote-cache-update';

