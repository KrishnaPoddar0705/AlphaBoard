-- Migration: Add upvotes/downvotes to community_ticker_stats and include user votes in feed
-- Purpose: Fix vote scores rendering and add periodic vote cache updates
-- Date: 2025-01-27

-- ============================================================================
-- 1. ADD upvotes/downvotes COLUMNS TO community_ticker_stats
-- ============================================================================

-- Add upvotes column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'community_ticker_stats' 
    AND column_name = 'upvotes'
  ) THEN
    ALTER TABLE public.community_ticker_stats 
    ADD COLUMN upvotes INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add downvotes column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'community_ticker_stats' 
    AND column_name = 'downvotes'
  ) THEN
    ALTER TABLE public.community_ticker_stats 
    ADD COLUMN downvotes INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- 2. MIGRATE upvotes/downvotes FROM community_stocks
-- ============================================================================

-- Migrate upvotes/downvotes from community_stocks if it still exists
UPDATE public.community_ticker_stats cts
SET 
  upvotes = COALESCE(cs.upvotes, 0),
  downvotes = COALESCE(cs.downvotes, 0)
FROM public.community_stocks cs
WHERE cts.ticker = cs.ticker
  AND cts.region = CASE 
    WHEN cs.ticker LIKE '%.NS' OR cs.ticker LIKE '%.BO' THEN 'India'
    ELSE 'USA'
  END
  AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'community_stocks'
  );

-- ============================================================================
-- 3. UPDATE recalc_ticker_stats TO MAINTAIN upvotes/downvotes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalc_ticker_stats(_ticker TEXT, _region TEXT)
RETURNS VOID
LANGUAGE plpgsql
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

-- ============================================================================
-- 4. UPDATE get_community_feed TO INCLUDE upvotes/downvotes AND USER VOTES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_community_feed(
  _region TEXT,
  _sort TEXT,
  _limit INT,
  _cursor_value NUMERIC DEFAULT NULL,
  _cursor_ticker TEXT DEFAULT NULL,
  _user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  ticker TEXT,
  threads_count INT,
  comments_count INT,
  score INT,
  upvotes INT,
  downvotes INT,
  my_vote SMALLINT,
  last_activity_at TIMESTAMPTZ,
  price NUMERIC,
  change NUMERIC,
  change_percent NUMERIC,
  currency TEXT,
  spark_ts BIGINT[],
  spark_close NUMERIC[],
  quote_updated_at TIMESTAMPTZ,
  spark_updated_at TIMESTAMPTZ
)
LANGUAGE SQL 
STABLE 
AS $$
  WITH base AS (
    SELECT
      s.ticker,
      s.threads_count,
      s.comments_count,
      s.score,
      COALESCE(s.upvotes, 0) as upvotes,
      COALESCE(s.downvotes, 0) as downvotes,
      s.last_activity_at,
      q.price, 
      q.change, 
      q.change_percent, 
      q.currency, 
      q.updated_at as quote_updated_at,
      sp.ts as spark_ts, 
      sp.close as spark_close, 
      sp.updated_at as spark_updated_at,
      CASE
        WHEN LOWER(_sort) = 'mostvoted' THEN s.score::NUMERIC
        WHEN LOWER(_sort) = 'mostcomments' THEN s.comments_count::NUMERIC
        WHEN LOWER(_sort) = 'recent' THEN EXTRACT(EPOCH FROM s.last_activity_at)::NUMERIC
        ELSE s.score::NUMERIC
      END as sort_value
    FROM public.community_ticker_stats s
    LEFT JOIN public.market_quotes q
      ON q.symbol = s.ticker AND q.region = s.region
    LEFT JOIN public.market_sparklines sp
      ON sp.symbol = s.ticker 
      AND sp.region = s.region 
      AND sp.period = '7d' 
      AND sp.interval = '1d'
    WHERE s.region = _region
  ),
  with_user_votes AS (
    SELECT
      b.*,
      COALESCE(v.value, NULL)::SMALLINT as my_vote
    FROM base b
    LEFT JOIN public.community_votes v
      ON v.target_type = 'stock'
      AND v.target_id = b.ticker
      AND v.user_id = _user_id
  )
  SELECT
    ticker, 
    threads_count, 
    comments_count, 
    score,
    upvotes,
    downvotes,
    my_vote,
    last_activity_at,
    price, 
    change, 
    change_percent, 
    currency, 
    spark_ts, 
    spark_close,
    quote_updated_at, 
    spark_updated_at
  FROM with_user_votes
  WHERE
    (_cursor_value IS NULL AND _cursor_ticker IS NULL)
    OR (sort_value < _cursor_value)
    OR (sort_value = _cursor_value AND ticker > _cursor_ticker)
  ORDER BY
    sort_value DESC,
    ticker ASC
  LIMIT _limit;
$$;

-- ============================================================================
-- 5. CREATE FUNCTION TO BATCH UPDATE VOTE COUNTS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.batch_update_vote_counts()
RETURNS TABLE(
  ticker TEXT,
  region TEXT,
  updated_count INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  updated_rows INT;
BEGIN
  -- Update vote counts for all tickers from community_votes
  WITH vote_aggregates AS (
    SELECT
      v.target_id as ticker,
      CASE 
        WHEN v.target_id LIKE '%.NS' OR v.target_id LIKE '%.BO' THEN 'India'
        ELSE 'USA'
      END as region,
      COUNT(*) FILTER (WHERE v.value = 1)::INTEGER as upvotes,
      COUNT(*) FILTER (WHERE v.value = -1)::INTEGER as downvotes,
      COALESCE(SUM(v.value), 0)::INTEGER as score
    FROM public.community_votes v
    WHERE v.target_type = 'stock'
      AND v.target_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' -- Not a UUID
    GROUP BY v.target_id
  )
  UPDATE public.community_ticker_stats cts
  SET 
    upvotes = va.upvotes,
    downvotes = va.downvotes,
    score = va.score,
    updated_at = NOW()
  FROM vote_aggregates va
  WHERE cts.ticker = va.ticker
    AND cts.region = va.region
    AND (
      cts.upvotes IS DISTINCT FROM va.upvotes
      OR cts.downvotes IS DISTINCT FROM va.downvotes
      OR cts.score IS DISTINCT FROM va.score
    );

  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  -- Return summary
  RETURN QUERY
  SELECT 
    'summary'::TEXT as ticker,
    'all'::TEXT as region,
    updated_rows::INT as updated_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.batch_update_vote_counts() TO service_role, authenticated, anon;

-- ============================================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_community_votes_stock_lookup
  ON public.community_votes(target_type, target_id, user_id)
  WHERE target_type = 'stock';

CREATE INDEX IF NOT EXISTS idx_community_ticker_stats_votes
  ON public.community_ticker_stats(upvotes DESC, downvotes DESC, score DESC);

