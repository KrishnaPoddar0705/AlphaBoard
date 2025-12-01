-- Migration: Add position sizing and entry benchmark price to recommendations
-- Created: 2024

-- Add position_size column (nullable, optional quantity/position size)
ALTER TABLE public.recommendations 
ADD COLUMN IF NOT EXISTS position_size numeric;

-- Add entry_benchmark_price column (nullable, stores benchmark price at entry for accurate alpha calculation)
ALTER TABLE public.recommendations 
ADD COLUMN IF NOT EXISTS entry_benchmark_price numeric;

-- Add comment for documentation
COMMENT ON COLUMN public.recommendations.position_size IS 'Optional position size/quantity. If null, equal weight is assumed.';
COMMENT ON COLUMN public.recommendations.entry_benchmark_price IS 'Benchmark price at entry date for accurate alpha calculation.';

