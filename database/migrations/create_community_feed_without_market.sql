-- Migration: Create optimized feed function that excludes market data
-- Purpose: Fetch community stats first, lazy-load market data on scroll
-- Date: 2025-01-27

-- Create a lightweight feed function that excludes market data for initial load
CREATE OR REPLACE FUNCTION public.get_community_feed_lightweight(
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
  last_activity_at TIMESTAMPTZ
)
LANGUAGE SQL 
STABLE 
AS $$
  WITH all_stocks AS (
    -- Get all stocks from market_quotes (stocks with market data)
    SELECT DISTINCT symbol as ticker, region
    FROM public.market_quotes
    WHERE region = _region
    
    UNION
    
    -- Also include stocks from community_ticker_stats (stocks with community activity)
    SELECT ticker, region
    FROM public.community_ticker_stats
    WHERE region = _region
  ),
  base AS (
    SELECT
      s.ticker,
      COALESCE(stats.threads_count, 0) as threads_count,
      COALESCE(stats.comments_count, 0) as comments_count,
      COALESCE(stats.score, 0) as score,
      COALESCE(stats.upvotes, 0) as upvotes,
      COALESCE(stats.downvotes, 0) as downvotes,
      stats.last_activity_at,
      CASE
        WHEN LOWER(_sort) = 'mostvoted' THEN COALESCE(stats.score, 0)::NUMERIC
        WHEN LOWER(_sort) = 'mostcomments' THEN COALESCE(stats.comments_count, 0)::NUMERIC
        WHEN LOWER(_sort) = 'recent' THEN 
          CASE 
            WHEN stats.last_activity_at IS NOT NULL THEN EXTRACT(EPOCH FROM stats.last_activity_at)::NUMERIC
            ELSE 0::NUMERIC
          END
        ELSE COALESCE(stats.score, 0)::NUMERIC
      END as sort_value
    FROM all_stocks s
    LEFT JOIN public.community_ticker_stats stats
      ON stats.ticker = s.ticker AND stats.region = s.region
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
    last_activity_at
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

-- Create function to fetch market data for specific tickers
CREATE OR REPLACE FUNCTION public.get_market_data_for_tickers(
  _tickers TEXT[],
  _region TEXT
)
RETURNS TABLE(
  ticker TEXT,
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
  SELECT
    q.symbol as ticker,
    q.price,
    q.change,
    q.change_percent,
    q.currency,
    sp.ts as spark_ts,
    sp.close as spark_close,
    q.updated_at as quote_updated_at,
    sp.updated_at as spark_updated_at
  FROM public.market_quotes q
  LEFT JOIN public.market_sparklines sp
    ON sp.symbol = q.symbol
    AND sp.region = q.region
    AND sp.period = '7d'
    AND sp.interval = '1d'
  WHERE q.region = _region
    AND q.symbol = ANY(_tickers)
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_community_feed_lightweight(TEXT, TEXT, INT, NUMERIC, TEXT, UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_market_data_for_tickers(TEXT[], TEXT) TO authenticated, anon, service_role;

