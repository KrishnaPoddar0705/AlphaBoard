-- Migration: Scale Community Feed Architecture
-- Purpose: Replace per-ticker REST calls with single feed endpoint, add market data caching
-- Date: 2025-01-XX

-- ============================================================================
-- 1. ADD REGION COLUMN TO community_posts
-- ============================================================================

-- Add region column with default 'USA'
ALTER TABLE public.community_posts 
ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'USA' NOT NULL;

-- Update existing rows: .NS/.BO = India, else USA
UPDATE public.community_posts
SET region = CASE 
  WHEN ticker LIKE '%.NS' OR ticker LIKE '%.BO' THEN 'India'
  ELSE 'USA'
END
WHERE region = 'USA'; -- Only update if still default (avoid re-running)

-- Add index for region + ticker queries
CREATE INDEX IF NOT EXISTS idx_community_posts_region_ticker 
  ON public.community_posts(region, ticker) 
  WHERE is_deleted = FALSE;

-- ============================================================================
-- 2. CREATE MARKET CACHE TABLES
-- ============================================================================

-- Market quotes table: latest quote per symbol
CREATE TABLE IF NOT EXISTS public.market_quotes (
  symbol TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'USA',
  price NUMERIC,
  change NUMERIC,
  change_percent NUMERIC,
  currency TEXT,
  as_of TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (symbol, region)
);

CREATE INDEX IF NOT EXISTS market_quotes_region_updated_idx
  ON public.market_quotes(region, updated_at DESC);

-- Market sparklines table: 7D daily closes per symbol
CREATE TABLE IF NOT EXISTS public.market_sparklines (
  symbol TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'USA',
  period TEXT NOT NULL DEFAULT '7d',
  interval TEXT NOT NULL DEFAULT '1d',
  ts BIGINT[] NOT NULL,        -- 7 timestamps
  close NUMERIC[] NOT NULL,    -- 7 closes
  as_of TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (symbol, region, period, interval)
);

CREATE INDEX IF NOT EXISTS market_sparklines_region_updated_idx
  ON public.market_sparklines(region, updated_at DESC);

-- ============================================================================
-- 3. REPLACE community_stocks WITH community_ticker_stats
-- ============================================================================

-- Create new community_ticker_stats table with region support
CREATE TABLE IF NOT EXISTS public.community_ticker_stats (
  ticker TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'USA',
  threads_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ticker, region)
);

-- Create indexes for sorting
CREATE INDEX IF NOT EXISTS community_ticker_stats_sort_idx
  ON public.community_ticker_stats(region, score DESC, ticker ASC);

CREATE INDEX IF NOT EXISTS community_ticker_stats_comments_idx
  ON public.community_ticker_stats(region, comments_count DESC, ticker ASC);

CREATE INDEX IF NOT EXISTS community_ticker_stats_activity_idx
  ON public.community_ticker_stats(region, last_activity_at DESC NULLS LAST, ticker ASC);

-- Migrate data from community_stocks to community_ticker_stats
INSERT INTO public.community_ticker_stats (ticker, region, threads_count, comments_count, score, last_activity_at, updated_at)
SELECT 
  cs.ticker,
  CASE 
    WHEN cs.ticker LIKE '%.NS' OR cs.ticker LIKE '%.BO' THEN 'India'
    ELSE 'USA'
  END as region,
  cs.thread_count as threads_count,
  cs.comment_count as comments_count,
  cs.score,
  cs.last_activity_at,
  cs.created_at as updated_at
FROM public.community_stocks cs
ON CONFLICT (ticker, region) DO UPDATE SET
  threads_count = EXCLUDED.threads_count,
  comments_count = EXCLUDED.comments_count,
  score = EXCLUDED.score,
  last_activity_at = EXCLUDED.last_activity_at,
  updated_at = EXCLUDED.updated_at;

-- Backfill stats from community_posts and community_comments
INSERT INTO public.community_ticker_stats (ticker, region, threads_count, comments_count, score, last_activity_at)
SELECT
  p.ticker,
  COALESCE(p.region, 'USA') as region,
  COUNT(*) FILTER (WHERE p.is_deleted = FALSE) as threads_count,
  COALESCE(SUM(p.comment_count) FILTER (WHERE p.is_deleted = FALSE), 0) as comments_count,
  COALESCE(SUM(p.score) FILTER (WHERE p.is_deleted = FALSE), 0) as score,
  MAX(p.last_activity_at) FILTER (WHERE p.is_deleted = FALSE) as last_activity_at
FROM public.community_posts p
GROUP BY p.ticker, COALESCE(p.region, 'USA')
ON CONFLICT (ticker, region) DO UPDATE SET
  threads_count = EXCLUDED.threads_count,
  comments_count = EXCLUDED.comments_count,
  score = EXCLUDED.score,
  last_activity_at = EXCLUDED.last_activity_at,
  updated_at = NOW();

-- ============================================================================
-- 4. CREATE TRIGGER TO AUTO-UPDATE TICKER STATS
-- ============================================================================

-- Function to recalculate ticker stats
CREATE OR REPLACE FUNCTION public.recalc_ticker_stats(_ticker TEXT, _region TEXT)
RETURNS VOID 
LANGUAGE plpgsql 
AS $$
BEGIN
  INSERT INTO public.community_ticker_stats (ticker, region, threads_count, comments_count, score, last_activity_at, updated_at)
  SELECT
    p.ticker,
    COALESCE(p.region, 'USA'),
    COUNT(*) FILTER (WHERE p.is_deleted = FALSE),
    COALESCE(SUM(p.comment_count) FILTER (WHERE p.is_deleted = FALSE), 0),
    COALESCE(SUM(p.score) FILTER (WHERE p.is_deleted = FALSE), 0),
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
    last_activity_at = EXCLUDED.last_activity_at,
    updated_at = NOW();
END;
$$;

-- Trigger function for community_posts changes
CREATE OR REPLACE FUNCTION public.community_posts_ticker_stats_trigger()
RETURNS TRIGGER 
LANGUAGE plpgsql 
AS $$
DECLARE
  t TEXT;
  r TEXT;
BEGIN
  t := COALESCE(NEW.ticker, OLD.ticker);
  r := COALESCE(COALESCE(NEW.region, OLD.region), 'USA');
  PERFORM public.recalc_ticker_stats(t, r);
  RETURN NULL;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_community_posts_ticker_stats ON public.community_posts;
CREATE TRIGGER trg_community_posts_ticker_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.community_posts
  FOR EACH ROW 
  EXECUTE FUNCTION public.community_posts_ticker_stats_trigger();

-- ============================================================================
-- 5. CREATE FEED RPC FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_community_feed(
  _region TEXT,
  _sort TEXT,
  _limit INT,
  _cursor_value NUMERIC DEFAULT NULL,
  _cursor_ticker TEXT DEFAULT NULL
)
RETURNS TABLE(
  ticker TEXT,
  threads_count INT,
  comments_count INT,
  score INT,
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
  )
  SELECT
    ticker, 
    threads_count, 
    comments_count, 
    score, 
    last_activity_at,
    price, 
    change, 
    change_percent, 
    currency, 
    spark_ts, 
    spark_close,
    quote_updated_at, 
    spark_updated_at
  FROM base
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
-- 6. RLS POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.market_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_sparklines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_ticker_stats ENABLE ROW LEVEL SECURITY;

-- Public read access
DROP POLICY IF EXISTS "public read quotes" ON public.market_quotes;
CREATE POLICY "public read quotes"
  ON public.market_quotes FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "public read sparklines" ON public.market_sparklines;
CREATE POLICY "public read sparklines"
  ON public.market_sparklines FOR SELECT
  TO anon, authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "public read ticker stats" ON public.community_ticker_stats;
CREATE POLICY "public read ticker stats"
  ON public.community_ticker_stats FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Service role bypasses RLS (no insert/update policies needed)

-- ============================================================================
-- 7. DROP OLD community_stocks TABLE (after migration)
-- ============================================================================

-- Note: Drop this after verifying migration is successful
-- DROP TABLE IF EXISTS public.community_stocks CASCADE;

