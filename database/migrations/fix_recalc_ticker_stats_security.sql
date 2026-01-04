-- Migration: Fix recalc_ticker_stats to use SECURITY DEFINER
-- Purpose: Ensure ticker stats are calculated correctly regardless of caller permissions
-- Date: 2026-01-04

-- Update recalc_ticker_stats to use SECURITY DEFINER
-- This ensures the function runs with elevated permissions and bypasses RLS
-- so it can see all posts/comments regardless of who calls it
CREATE OR REPLACE FUNCTION public.recalc_ticker_stats(_ticker TEXT, _region TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with function owner's permissions (bypasses RLS)
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.community_ticker_stats (
    ticker, 
    region, 
    threads_count, 
    comments_count, 
    score,
    upvotes,
    downvotes,
    last_activity_at, 
    updated_at
  )
  SELECT 
    p.ticker,
    COALESCE(p.region, 'USA'),
    COUNT(*) FILTER (WHERE p.is_deleted = FALSE),
    COALESCE(SUM(p.comment_count) FILTER (WHERE p.is_deleted = FALSE), 0),
    COALESCE(SUM(p.score) FILTER (WHERE p.is_deleted = FALSE), 0),
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.community_votes v
      WHERE v.target_type = 'stock'
        AND v.target_id = p.ticker
        AND v.value = 1
    ), 0) as upvotes,
    COALESCE((
      SELECT COUNT(*)::integer
      FROM public.community_votes v
      WHERE v.target_type = 'stock'
        AND v.target_id = p.ticker
        AND v.value = -1
    ), 0) as downvotes,
    MAX(p.last_activity_at) FILTER (WHERE p.is_deleted = FALSE),
    NOW()
  FROM public.community_posts p
  WHERE p.ticker = _ticker
    AND COALESCE(p.region, 'USA') = _region
  GROUP BY p.ticker, COALESCE(p.region, 'USA')
  ON CONFLICT (ticker, region) DO UPDATE SET
    region = EXCLUDED.region,
    threads_count = EXCLUDED.threads_count,
    comments_count = EXCLUDED.comments_count,
    score = EXCLUDED.score,
    upvotes = EXCLUDED.upvotes,
    downvotes = EXCLUDED.downvotes,
    last_activity_at = EXCLUDED.last_activity_at,
    updated_at = NOW();
END;
$$;

-- Grant execute to all roles (function will run with elevated permissions)
GRANT EXECUTE ON FUNCTION public.recalc_ticker_stats(TEXT, TEXT) TO authenticated, anon, service_role;

-- Recalculate all ticker stats to fix any incorrect counts
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN 
    SELECT DISTINCT ticker, COALESCE(region, 'USA') as region
    FROM public.community_posts
  LOOP
    PERFORM public.recalc_ticker_stats(rec.ticker, rec.region);
  END LOOP;
END;
$$;

