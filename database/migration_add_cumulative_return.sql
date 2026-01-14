-- Migration: Add cumulative portfolio return fields to performance table
-- Created: 2024

-- Add cumulative_portfolio_return_pct field
ALTER TABLE public.performance 
ADD COLUMN IF NOT EXISTS cumulative_portfolio_return_pct numeric DEFAULT 0;

-- Add cumulative_return_updated_at timestamp field
ALTER TABLE public.performance 
ADD COLUMN IF NOT EXISTS cumulative_return_updated_at timestamp with time zone;

-- Add index on cumulative_return_updated_at for querying freshness
CREATE INDEX IF NOT EXISTS idx_performance_cumulative_return_updated_at 
ON public.performance(cumulative_return_updated_at DESC);

-- Add comment to document the field
COMMENT ON COLUMN public.performance.cumulative_portfolio_return_pct IS 
'Cumulative portfolio return percentage calculated from portfolio start to latest date. Updated daily.';

COMMENT ON COLUMN public.performance.cumulative_return_updated_at IS 
'Timestamp when cumulative_portfolio_return_pct was last updated.';



