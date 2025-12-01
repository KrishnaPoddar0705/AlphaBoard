-- Migration: Add invested_amount column to recommendations table
-- Created: 2024

-- Add invested_amount column (actual money invested in this position)
ALTER TABLE public.recommendations 
ADD COLUMN IF NOT EXISTS invested_amount numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.recommendations.invested_amount IS 'Actual money invested in this position. Used for portfolio allocation calculations.';

-- Update existing OPEN positions to have invested_amount based on entry_price
-- For existing positions without invested_amount, calculate based on equal weight assumption
UPDATE public.recommendations r
SET invested_amount = (
    SELECT CASE 
        WHEN COUNT(*) OVER (PARTITION BY r.user_id) > 0 
        THEN (1000000.0 / COUNT(*) OVER (PARTITION BY r.user_id))
        ELSE 0
    END
)
WHERE r.status = 'OPEN' 
  AND (r.invested_amount IS NULL OR r.invested_amount = 0)
  AND r.entry_price IS NOT NULL
  AND r.entry_price > 0;

