-- Migration: Test 1 hour interval sparklines
-- Purpose: Update get_market_data_for_tickers to use 1h intervals instead of 1d for testing
-- Date: 2025-01-05

-- Update function to use 1h intervals
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
    AND sp.interval = '1h'  -- TEST: Changed from '1d' to '1h' for hourly data
  WHERE q.region = _region
    AND q.symbol = ANY(_tickers)
$$;



