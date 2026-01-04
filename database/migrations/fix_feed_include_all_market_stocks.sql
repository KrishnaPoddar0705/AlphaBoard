-- Migration: Fix feed to include all market stocks with FULL OUTER JOIN
-- Purpose: Show all stocks from market_quotes, even if they don't have community activity
-- Date: 2025-01-27

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
  WITH community_data AS (
    SELECT
      s.ticker,
      s.region,
      s.threads_count,
      s.comments_count,
      s.score,
      COALESCE(s.upvotes, 0) as upvotes,
      COALESCE(s.downvotes, 0) as downvotes,
      s.last_activity_at,
      CASE
        WHEN LOWER(_sort) = 'mostvoted' THEN s.score::NUMERIC
        WHEN LOWER(_sort) = 'mostcomments' THEN s.comments_count::NUMERIC
        WHEN LOWER(_sort) = 'recent' THEN EXTRACT(EPOCH FROM s.last_activity_at)::NUMERIC
        ELSE s.score::NUMERIC
      END as sort_value
    FROM public.community_ticker_stats s
    WHERE s.region = _region
  ),
  market_data AS (
    SELECT
      mq.symbol as ticker,
      mq.region,
      mq.price,
      mq.change,
      mq.change_percent,
      mq.currency,
      mq.updated_at as quote_updated_at,
      sp.ts as spark_ts,
      sp.close as spark_close,
      sp.updated_at as spark_updated_at
    FROM public.market_quotes mq
    LEFT JOIN public.market_sparklines sp
      ON sp.symbol = mq.symbol
      AND sp.region = mq.region
      AND sp.period = '7d'
      AND sp.interval = '1d'
    WHERE mq.region = _region
  ),
  combined AS (
    SELECT
      COALESCE(cd.ticker, md.ticker) as ticker,
      COALESCE(cd.threads_count, 0) as threads_count,
      COALESCE(cd.comments_count, 0) as comments_count,
      COALESCE(cd.score, 0) as score,
      COALESCE(cd.upvotes, 0) as upvotes,
      COALESCE(cd.downvotes, 0) as downvotes,
      cd.last_activity_at,
      md.price,
      md.change,
      md.change_percent,
      md.currency,
      md.spark_ts,
      md.spark_close,
      md.quote_updated_at,
      md.spark_updated_at,
      COALESCE(cd.sort_value, 0)::NUMERIC as sort_value
    FROM community_data cd
    FULL OUTER JOIN market_data md
      ON cd.ticker = md.ticker AND cd.region = md.region
    WHERE COALESCE(cd.region, md.region) = _region
  ),
  with_user_votes AS (
    SELECT
      c.*,
      COALESCE(v.value, NULL)::SMALLINT as my_vote
    FROM combined c
    LEFT JOIN public.community_votes v
      ON v.target_type = 'stock'
      AND v.target_id = c.ticker
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

